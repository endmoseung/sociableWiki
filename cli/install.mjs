#!/usr/bin/env node
// sociableWiki installer — copies the agent-neutral skills into whatever AI
// harnesses exist in the target project. Zero dependencies (Node built-ins only)
// so `npx github:<owner>/<repo> install` works cold.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_IMPORT_START = "<!-- sociableWiki:managed-import:start -->";
const CLAUDE_IMPORT_END = "<!-- sociableWiki:managed-import:end -->";
const CLAUDE_IMPORT_RE =
  /<!-- sociableWiki:managed-import:start -->[\s\S]*?<!-- sociableWiki:managed-import:end -->/;

/**
 * A prompt helper that survives piped input. Node's readline.question() drops
 * buffered lines between sequential awaits when stdin is a pipe, so instead we
 * consume stdin as a line stream and pull one answer at a time from a queue.
 */
function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin });
  const pending = []; // resolvers waiting for a line
  const buffered = []; // lines that arrived before anyone asked
  let closed = false;

  rl.on("line", (line) => {
    if (pending.length) pending.shift()(line);
    else buffered.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (pending.length) pending.shift()(null); // unblock with EOF
  });

  return {
    async ask(question, fallback) {
      process.stdout.write(`${question}${fallback ? ` (${fallback})` : ""}: `);
      let line;
      if (buffered.length) line = buffered.shift();
      else if (closed) line = null;
      else line = await new Promise((resolve) => pending.push(resolve));
      const answer = (line ?? "").trim();
      const value = answer || fallback || "";
      process.stdout.write(value + "\n");
      return value;
    },
    close() {
      rl.close();
    },
  };
}

// Each provider: where its files live in dist/, and the marker that means
// "this harness is used in the target project".
const PROVIDERS = [
  {
    id: "claude-code",
    label: "Claude Code",
    distSubdir: path.join("dist", "claude-code"),
    marker: ".claude",
  },
  {
    id: "cursor",
    label: "Cursor",
    distSubdir: path.join("dist", "cursor"),
    marker: ".cursor",
  },
];

function log(msg) {
  process.stdout.write(msg + "\n");
}

function sameFile(src, dest) {
  if (!fs.existsSync(dest)) return false;
  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);
  if (srcStat.size !== destStat.size) return false;
  return fs.readFileSync(src).equals(fs.readFileSync(dest));
}

function atomicWriteFile(dest, data, { mode } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const temp = path.join(
    path.dirname(dest),
    `.${path.basename(dest)}.sociablewiki-${process.pid}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.tmp`
  );
  try {
    fs.writeFileSync(temp, data, { flag: "wx", mode });
    if (mode !== undefined) fs.chmodSync(temp, mode);
    fs.renameSync(temp, dest);
  } catch (err) {
    try {
      fs.unlinkSync(temp);
    } catch {}
    throw err;
  }
}

function atomicCopyFile(src, dest) {
  const mode = fs.statSync(src).mode & 0o777;
  atomicWriteFile(dest, fs.readFileSync(src), { mode });
}

function displayPath(root, targetPath) {
  const rel = path.relative(root, targetPath);
  return rel && !rel.startsWith("..") ? rel.split(path.sep).join("/") : targetPath;
}

function existingEntry(pathToCheck) {
  try {
    return fs.lstatSync(pathToCheck);
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

function assertSafeDirectoryPath(dir, root) {
  const rel = path.relative(root, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Refusing to write outside install root: ${dir}`);
  }
  const parts = rel ? rel.split(path.sep).filter(Boolean) : [];
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = existingEntry(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to write through symlink: ${displayPath(root, current)}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`Refusing to write under non-directory: ${displayPath(root, current)}`);
    }
  }
}

function assertSafeRegularFilePath(filePath, root) {
  assertSafeDirectoryPath(path.dirname(filePath), root);
  const stat = existingEntry(filePath);
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlink: ${displayPath(root, filePath)}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Refusing to overwrite non-regular file: ${displayPath(root, filePath)}`);
  }
}

async function planManagedFile(src, dest, rel, prompter, destRoot) {
  assertSafeRegularFilePath(dest, destRoot);
  if (fs.existsSync(dest)) {
    if (sameFile(src, dest)) {
      return { action: "unchanged", src, dest, rel };
    }
    const answer = await prompter.ask(
      `  ! ${rel} already exists and differs. Overwrite the managed sociableWiki copy? [y/N]`,
      "n"
    );
    if (answer.toLowerCase() !== "y") {
      throw new Error(
        `${rel} already exists and differs. Re-run and answer y to overwrite, ` +
          "or edit/remove that file before installing."
      );
    }
    return { action: "overwrite", src, dest, rel };
  }
  return { action: "create", src, dest, rel };
}

async function planDir(src, dest, prompter, srcRoot = src, destRoot = dest, plan = []) {
  assertSafeDirectoryPath(dest, destRoot);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await planDir(s, d, prompter, srcRoot, destRoot, plan);
    } else {
      plan.push(
        await planManagedFile(
          s,
          d,
          path.relative(srcRoot, s).split(path.sep).join("/"),
          prompter,
          destRoot
        )
      );
    }
  }
  return plan;
}

function applyCopyPlan(plan) {
  for (const op of plan) {
    if (op.action === "unchanged") {
      log(`    = ${op.rel} unchanged`);
      continue;
    }
    atomicCopyFile(op.src, op.dest);
    log(`    ${op.action === "overwrite" ? "~" : "+"} ${op.rel}${op.action === "overwrite" ? " overwritten" : ""}`);
  }
}

function claudeImportBlock(importPath) {
  return `${CLAUDE_IMPORT_START}\n@${importPath}\n${CLAUDE_IMPORT_END}`;
}

function appendManagedBlock(existing, block) {
  if (!existing) return `${block}\n`;
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing}${separator}${block}\n`;
}

function claudeImportTarget(provider, installRoot) {
  const claudeMdPath = provider._global
    ? path.join(installRoot, ".claude", "CLAUDE.md")
    : path.join(installRoot, "CLAUDE.md");
  const importPath = provider._global ? "sociablewiki.md" : ".claude/sociablewiki.md";
  return { claudeMdPath, importPath };
}

function planClaudeImport(provider, installRoot) {
  const { claudeMdPath, importPath } = claudeImportTarget(provider, installRoot);
  const block = claudeImportBlock(importPath);
  assertSafeRegularFilePath(claudeMdPath, installRoot);
  const existing = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, "utf8") : "";
  if (existing.includes(block)) {
    return { action: "unchanged", claudeMdPath, importPath, installRoot, next: existing };
  }
  const next = CLAUDE_IMPORT_RE.test(existing)
    ? existing.replace(CLAUDE_IMPORT_RE, block)
    : appendManagedBlock(existing, block);
  return { action: "write", claudeMdPath, importPath, installRoot, next };
}

function applyClaudeImportPlan(plan) {
  const rel = path.relative(plan.installRoot, plan.claudeMdPath);
  if (plan.action === "unchanged") {
    log(`    = ${rel} import unchanged`);
    return;
  }
  const existingMode = fs.existsSync(plan.claudeMdPath)
    ? fs.statSync(plan.claudeMdPath).mode & 0o777
    : 0o644;
  atomicWriteFile(plan.claudeMdPath, plan.next, { mode: existingMode });
  log(`    + ${rel} imports ${plan.importPath}`);
}

function detectProviders(target, { global = false } = {}) {
  // Project-local harnesses only, by default — never touch the user's home dir
  // unless they explicitly pass --global.
  const found = PROVIDERS.filter((p) => fs.existsSync(path.join(target, p.marker)));
  if (global) {
    const homeClaude = path.join(process.env.HOME || "", ".claude");
    if (fs.existsSync(homeClaude)) {
      found.push({ ...PROVIDERS.find((p) => p.id === "claude-code"), _global: true });
    }
  }
  return found;
}

async function planProviderInstall(provider, target, prompter) {
  const src = path.join(REPO_ROOT, provider.distSubdir);
  if (!fs.existsSync(src)) {
    log(`  ! ${provider.label}: dist folder missing (${provider.distSubdir}) — skipped`);
    return null;
  }
  // A provider's dist folder (e.g. dist/claude-code/.claude/...) mirrors the layout
  // the harness expects at the project root. Global Claude targets the home directory.
  const dest = provider._global ? process.env.HOME : target;
  if (!dest || !path.isAbsolute(dest)) {
    throw new Error("--global requires HOME to be an absolute path");
  }
  const plan = await planDir(src, dest, prompter);
  const importPlan = provider.id === "claude-code" ? planClaudeImport(provider, dest) : null;
  return { provider, plan, importPlan };
}

function applyProviderInstall(prepared) {
  const { provider, plan, importPlan } = prepared;
  applyCopyPlan(plan);
  if (importPlan) applyClaudeImportPlan(importPlan);
  log(`  ✓ ${provider.label}${provider._global ? " (global ~/.claude)" : ""}`);
}

async function runInit(target, prompter) {
  log("\n── init: make this wiki yours ──");
  const cfgDir = path.join(target, ".sociablewiki");
  const cfgExample = path.join(cfgDir, "config.example.json");
  const cfgPath = path.join(cfgDir, "config.json");
  assertSafeDirectoryPath(cfgDir, target);
  assertSafeRegularFilePath(cfgPath, target);
  assertSafeRegularFilePath(cfgExample, target);
  // Prefer an existing config.json (re-running init keeps your prior answers as
  // defaults); fall back to the shipped example only on a first run.
  let base = {};
  let fromExistingConfig = false;
  for (const p of [cfgPath, cfgExample]) {
    if (fs.existsSync(p)) {
      try {
        base = JSON.parse(fs.readFileSync(p, "utf8"));
        fromExistingConfig = p === cfgPath;
        break;
      } catch {
        // malformed file — try the next source
      }
    }
  }
  const author = await prompter.ask("Author name", base.author || "");
  const handle = await prompter.ask("GitHub handle", base.githubHandle || "");
  const repoName = await prompter.ask("Repo name", base.repoName || "sociableWiki");
  const mcpName = await prompter.ask("MCP server name", base.mcpServerName || "sociable-wiki");
  const cfg = {
    author,
    githubHandle: handle,
    repoName,
    mcpServerName: mcpName,
    areas: base.areas || ["ai-native", "dev", "principles"],
    languages: base.languages || ["en"],
    // Preserve secretPatterns only when re-running against a real config.json —
    // the shipped example's array holds comment strings, not real patterns.
    secretPatterns:
      fromExistingConfig && Array.isArray(base.secretPatterns) ? base.secretPatterns : [],
  };
  assertSafeRegularFilePath(cfgPath, target);
  const existingMode = fs.existsSync(cfgPath) ? fs.statSync(cfgPath).mode & 0o777 : 0o600;
  atomicWriteFile(cfgPath, JSON.stringify(cfg, null, 2) + "\n", { mode: existingMode });
  log(`  ✓ wrote .sociablewiki/config.json`);
  log("\n  Next: your agent can now run knowledge-new to clear the example content,");
  log("  then knowledge-set to add your first concept. See dist/universal/AGENTS.md.");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "install";
  const global = args.includes("--global");
  const target = process.cwd();
  const prompter = createPrompter();

  try {
    if (cmd === "init") {
      await runInit(target, prompter);
      prompter.close();
      return;
    }

    // install (default)
    log("sociableWiki installer\n");
    const detected = detectProviders(target, { global });
    if (detected.length === 0) {
      log("No AI harness detected here (.claude / .cursor in this folder).");
      log("Run inside a project that uses one, or pass --global to install into ~/.claude.");
      prompter.close();
      return;
    }
    log(
      "Detected harnesses: " +
        detected.map((p) => `${p.label}${p._global ? " → ~/.claude (global)" : ""}`).join(", ")
    );
    const anyGlobal = detected.some((p) => p._global);
    const installQuestion = anyGlobal
      ? "Install sociableWiki skills, including into your home ~/.claude? [Y/n]"
      : "Install sociableWiki skills into this project? [Y/n]";
    const proceed = await prompter.ask(installQuestion, "y");
    if (proceed.toLowerCase() !== "y") {
      log("Aborted.");
      prompter.close();
      return;
    }
    log("");
    // Preflight every provider and import target before the first write. A
    // conflict in a later target must not leave earlier providers installed.
    const prepared = [];
    for (const p of detected) {
      const providerPlan = await planProviderInstall(p, target, prompter);
      if (providerPlan) prepared.push(providerPlan);
    }
    for (const providerPlan of prepared) applyProviderInstall(providerPlan);
    const any = prepared.length > 0;

    if (any) {
      const doInit = await prompter.ask("\nRun init now to set author/repo? [Y/n]", "y");
      if (doInit.toLowerCase() !== "n") await runInit(target, prompter);
      log("\nDone. Reload your agent so it picks up the new skills.");
    }
    prompter.close();
  } catch (err) {
    log("Installer error: " + err.message);
    prompter.close();
    process.exitCode = 1;
  }
}

main();
