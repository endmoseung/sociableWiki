#!/usr/bin/env node
// sociableWiki installer — copies the agent-neutral skills into whatever AI
// harnesses exist in the target project. Zero dependencies (Node built-ins only)
// so `npx github:<owner>/<repo> install` works cold.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function detectProviders(target, { global = false } = {}) {
  // Project-local harnesses only, by default — never touch the user's home dir
  // unless they explicitly pass --global.
  const found = PROVIDERS.filter((p) => fs.existsSync(path.join(target, p.marker)));
  if (global) {
    const homeClaude = path.join(process.env.HOME || "", ".claude");
    if (fs.existsSync(homeClaude) && !found.some((p) => p.id === "claude-code")) {
      found.push({ ...PROVIDERS.find((p) => p.id === "claude-code"), _global: true });
    }
  }
  return found;
}

function installProvider(provider, target) {
  const src = path.join(REPO_ROOT, provider.distSubdir);
  if (!fs.existsSync(src)) {
    log(`  ! ${provider.label}: dist folder missing (${provider.distSubdir}) — skipped`);
    return false;
  }
  // A provider's dist folder (e.g. dist/claude-code/.claude/...) mirrors the layout
  // the harness expects at the project root, so we copy its tree straight into target.
  // For a global ~/.claude install we target the home dir instead.
  const dest = provider._global ? process.env.HOME : target;
  copyDir(src, dest);
  log(`  ✓ ${provider.label}${provider._global ? " (global ~/.claude)" : ""}`);
  return true;
}

async function runInit(target, prompter) {
  log("\n── init: make this wiki yours ──");
  const cfgExample = path.join(target, ".sociablewiki", "config.example.json");
  const cfgPath = path.join(target, ".sociablewiki", "config.json");
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
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
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
    let any = false;
    for (const p of detected) any = installProvider(p, target) || any;

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
