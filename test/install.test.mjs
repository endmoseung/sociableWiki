import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installer = path.join(repoRoot, "cli", "install.mjs");
const managedImport = [
  "<!-- sociableWiki:managed-import:start -->",
  "@.claude/sociablewiki.md",
  "<!-- sociableWiki:managed-import:end -->",
].join("\n");

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sociablewiki-install-"));
  fs.mkdirSync(path.join(dir, ".claude"));
  return dir;
}

function install(cwd, input = "y\nn\n", args = ["install"]) {
  return spawnSync(process.execPath, [installer, ...args], {
    cwd,
    input,
    encoding: "utf8",
  });
}

describe("Claude Code installer", () => {
  it("creates a managed CLAUDE.md import when none exists", () => {
    // Given: a Claude Code project without a root memory file.
    const project = makeProject();

    // When: the installer runs and init is declined.
    const result = install(project);

    // Then: the shipped Claude guide is copied and imported by CLAUDE.md.
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      fs.existsSync(path.join(project, ".claude", "sociablewiki.md")),
      true
    );
    assert.equal(fs.readFileSync(path.join(project, "CLAUDE.md"), "utf8"), `${managedImport}\n`);
  });

  it("preserves existing CLAUDE.md content while appending one managed import", () => {
    // Given: a project already has human-authored Claude instructions.
    const project = makeProject();
    const claudeMd = path.join(project, "CLAUDE.md");
    fs.writeFileSync(claudeMd, "# Project rules\n\nKeep this line.\n");

    // When: the installer runs twice.
    const first = install(project);
    const afterFirst = fs.readFileSync(claudeMd, "utf8");
    const second = install(project);
    const afterSecond = fs.readFileSync(claudeMd, "utf8");

    // Then: the original content remains and repeat install is idempotent.
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(afterFirst, /^# Project rules\n\nKeep this line\.\n\n/);
    assert.equal(afterFirst.includes(managedImport), true);
    assert.equal(afterSecond, afterFirst);
    assert.equal(afterFirst.match(/sociableWiki:managed-import:start/g)?.length, 1);
  });

  it("skips identical managed files on repeat install", () => {
    // Given: the managed Claude file already matches the packaged copy.
    const project = makeProject();
    const source = path.join(repoRoot, "dist", "claude-code", ".claude", "sociablewiki.md");
    fs.copyFileSync(source, path.join(project, ".claude", "sociablewiki.md"));

    // When: the installer runs.
    const result = install(project);

    // Then: it succeeds without treating the identical file as a conflict.
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /unchanged/);
  });

  it("does not overwrite a differing managed file unless the user accepts", () => {
    // Given: the target already has a conflicting managed Claude file.
    const project = makeProject();
    const targetFile = path.join(project, ".claude", "sociablewiki.md");
    fs.writeFileSync(targetFile, "local project copy\n");

    // When: the user declines the overwrite prompt.
    const result = install(project, "y\nn\n");

    // Then: install fails clearly and leaves the local file untouched.
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /already exists and differs/);
    assert.match(result.stdout, /Re-run and answer y to overwrite/);
    assert.equal(fs.readFileSync(targetFile, "utf8"), "local project copy\n");
    assert.equal(fs.existsSync(path.join(project, "CLAUDE.md")), false);
    assert.equal(fs.existsSync(path.join(project, ".claude", "skills")), false);
  });

  it("refuses to write a managed file through a symlink", () => {
    // Given: a malicious project points the managed file at another writable file.
    const project = makeProject();
    const linkedTarget = path.join(project, "..", `${path.basename(project)}-linked-managed.md`);
    fs.writeFileSync(linkedTarget, "outside content\n");
    fs.symlinkSync(linkedTarget, path.join(project, ".claude", "sociablewiki.md"));

    // When: the installer runs.
    const result = install(project);

    // Then: it fails without changing the symlink target or creating the import.
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /refusing to write through symlink/i);
    assert.equal(fs.readFileSync(linkedTarget, "utf8"), "outside content\n");
    assert.equal(fs.existsSync(path.join(project, "CLAUDE.md")), false);
    assert.equal(fs.existsSync(path.join(project, ".claude", "skills")), false);
  });

  it("refuses to update CLAUDE.md through a symlink", () => {
    // Given: a malicious project points root CLAUDE.md at another writable file.
    const project = makeProject();
    const linkedTarget = path.join(project, "..", `${path.basename(project)}-linked-claude.md`);
    fs.writeFileSync(linkedTarget, "outside project rules\n");
    fs.symlinkSync(linkedTarget, path.join(project, "CLAUDE.md"));

    // When: the installer runs.
    const result = install(project);

    // Then: it fails before modifying the linked file.
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /refusing to write through symlink/i);
    assert.equal(fs.readFileSync(linkedTarget, "utf8"), "outside project rules\n");
  });

  it("installs both local and global Claude providers when --global is passed in a Claude project", () => {
    // Given: a Claude project and a separate temporary HOME that also has ~/.claude.
    const project = makeProject();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sociablewiki-home-"));
    fs.mkdirSync(path.join(home, ".claude"));

    // When: --global is passed from inside the local project.
    const result = spawnSync(process.execPath, [installer, "install", "--global"], {
      cwd: project,
      env: { ...process.env, HOME: home },
      input: "y\nn\n",
      encoding: "utf8",
    });

    // Then: both the project and home Claude surfaces are installed and imported.
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(project, ".claude", "sociablewiki.md")), true);
    assert.equal(fs.existsSync(path.join(home, ".claude", "sociablewiki.md")), true);
    assert.equal(
      fs.readFileSync(path.join(project, "CLAUDE.md"), "utf8"),
      `${managedImport}\n`
    );
    assert.equal(
      fs.readFileSync(path.join(home, ".claude", "CLAUDE.md"), "utf8"),
      [
        "<!-- sociableWiki:managed-import:start -->",
        "@sociablewiki.md",
        "<!-- sociableWiki:managed-import:end -->",
        "",
      ].join("\n")
    );
    assert.match(result.stdout, /Claude Code → ~\/\.claude \(global\)/);
  });

  it("preflights all providers before writing when a later global target conflicts", () => {
    // Given: local Claude is clean but the later global target has a conflict.
    const project = makeProject();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sociablewiki-home-conflict-"));
    fs.mkdirSync(path.join(home, ".claude"));
    const globalManaged = path.join(home, ".claude", "sociablewiki.md");
    fs.writeFileSync(globalManaged, "keep global copy\n");

    // When: the user declines the global overwrite.
    const result = spawnSync(process.execPath, [installer, "install", "--global"], {
      cwd: project,
      env: { ...process.env, HOME: home },
      input: "y\nn\n",
      encoding: "utf8",
    });

    // Then: no earlier local target was partially installed.
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(globalManaged, "utf8"), "keep global copy\n");
    assert.equal(fs.existsSync(path.join(project, ".claude", "sociablewiki.md")), false);
    assert.equal(fs.existsSync(path.join(project, "CLAUDE.md")), false);
  });

  it("refuses init when .sociablewiki is a symlink", () => {
    // Given: a project points its config directory outside the project.
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "sociablewiki-init-"));
    const linkedConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "sociablewiki-linked-config-"));
    fs.symlinkSync(linkedConfigDir, path.join(project, ".sociablewiki"));

    // When: init runs with default answers.
    const result = spawnSync(process.execPath, [installer, "init"], {
      cwd: project,
      input: "\n\n\n\n",
      encoding: "utf8",
    });

    // Then: it fails without writing through the symlink.
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /refusing to write through symlink/i);
    assert.equal(fs.existsSync(path.join(linkedConfigDir, "config.json")), false);
  });
});
