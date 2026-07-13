---
type: reference
title: "Authoring a Claude Code plugin: the checklist local testing misses (paths · versions · triggers · publish receipts)"
description: A plugin that works in a local .claude/ dir can silently break once it ships and gets installed; paths, versions, triggers, and revision-bound publish receipts catch almost all of it.
tags: [claude-code, plugins, packaging, distribution, checklist, verification]
date: 2026-06-24
source: original
relates: []
---

# Authoring a Claude Code plugin: the checklist local testing misses

## TL;DR

A plugin that works perfectly in a local `.claude/` dir can break **silently** the moment
it ships through a marketplace and gets installed — no error, just a quiet miss. Three
install axes catch most of it: **paths, versions, triggers.** A fourth gate catches the
last-mile lie: **publish receipts** bound to the exact revision/worktree. This is the
*while-you-build* checklist — the part that never shows up when you test the plugin in the
same directory you wrote it in.

Each check follows the same shape: **why it breaks → the rule → the self-check.**

## 1. Paths / portability — absolute paths die on another machine

- **Why it breaks:** the installed copy does not live where you authored it. It lives at
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/...`, a path that differs per
  machine *and* per version. Any hardcoded `/Users/<you>/...` or `~/Documents/...` that
  worked in your dev checkout points at nothing on a teammate's machine.
- **Rule:** reference a plugin's own assets — the `lib`, `template`, config file, or any
  resource a skill, agent, or hook reads — via **`${CLAUDE_PLUGIN_ROOT}/...`**. Claude Code
  injects this env var as the install root when a plugin hook or skill runs, so it resolves
  correctly wherever the plugin actually landed.
- **Code vs state split:** plugin **code** lives under `${CLAUDE_PLUGIN_ROOT}`; runtime
  **output/state** is written under the *target* repo's `$PWD`, never back into the plugin
  dir. A hook that ships in the plugin should read its assets from the plugin root but write
  its working state into the project it's operating on.
- **Self-check:** `grep -rE '/Users/|/home/|/Volumes/' <plugin-dir>/` → must be 0 (excluding
  docs/examples). A bare `~/` inside a hook command string is the same trap.

## 2. Versions / sync — if you don't bump it, your fix never reaches the installed side

- **Why it breaks:** the installed side only recognizes an update through the `version` in
  `plugin.json` / `marketplace.json`. Fix the code and *forget the bump* → installed users
  keep running the old version, and "it's fixed on main" is a lie to everyone who already
  installed it.
- **Rule — behavior change ⇒ bump:** a PR that changes behavior (code, a worker prompt, a
  hook, a config/state file) **must** bump. bugfix/hardening = **patch**, new feature =
  **minor**, breaking change = **major**.
- **Rule — keep two files in sync:** the `version` in
  `<plugin-dir>/.claude-plugin/plugin.json` and that plugin's version in the **root**
  `.claude-plugin/marketplace.json` must always be **equal**. (Note the layout trap:
  `plugin.json` sits under `.claude-plugin/`, *not* directly under the plugin dir.)
- **Exception:** a docs/README-only PR needs no bump. But if a behavior change is bundled
  into the same change set, bump it together — don't split the fix from its version.
- **Self-check (before you open the PR):** "Did this change behavior? Did I bump? Are the two
  files equal?" Compare `jq -r .version <plugin-dir>/.claude-plugin/plugin.json` against the
  matching entry in the root `marketplace.json`.
- **How I learned this the hard way:** two consecutive PRs on one of my plugins changed
  behavior but skipped the bump, so the published origin stayed pinned at an old version and
  the second PR's fix never reached anyone who installed it. It took a dedicated third PR
  whose *only* job was the version bump to unstick it. The fix on main meant nothing until
  the number moved.

## 3. Triggers / naming — installation changes both your command name and your competition

- **Why it breaks (name):** a local `/foo` becomes `/plugin-name:foo` once installed
  (namespaced). Any **bare `/foo`** hardcoded in a trigger table, or a "then call `/foo`"
  inside another skill, silently goes stale — no error, just a miss. The breakage is at the
  *call site*, not in the skill body, so a diff review of the skill file won't catch it.
- **Why it breaks (competition):** a skill's `description:` now competes in the **same
  matching pool as its installed bundle siblings**. You author and test one skill in a
  low-contention pool; install drags in every sibling in the bundle, each with its own
  `description:`. Big bundle + overlapping descriptions → each skill's auto-fire odds drop
  (shadowing). Keep bundles **small and coherent** — bundle size *is* a trigger-rate
  decision, not just a packaging convenience.
- **The general rule:** *the unit you test must equal the unit you ship.* Testing a single
  local skill but shipping a plugin violates it — re-test auto-fire with the **installed
  bundle**: namespaced command and the full sibling `description:` pool included.
- **Self-check:** grep for any bare `/name` in triggers, commands, and READMEs before
  packaging (each must become `/plugin-name:name` or an explicit alias); after install,
  confirm auto-fire actually fires once on a representative prompt — don't assume the local
  pass carries over.

## 4. Publish verification / receipts — the last edit makes old evidence stale

- **Why it breaks:** the last change before a PR or publish is often "just docs," "just the
  manifest," or "just the install import." That change can alter the package artifact,
  command name, model routing, or loaded context after the build/smoke evidence was
  collected. A green receipt from the previous worktree state no longer proves the current
  publish candidate.
- **Rule:** any final edit invalidates prior evidence for the artifact it touched. The last
  receipts before publish must bind to the exact revision and worktree fingerprint being
  shipped. Capture at least `git rev-parse HEAD`, a dirty-worktree summary, command, exit
  status, and timestamp. If the worktree is dirty by design, name the changed files in the
  receipt; don't pretend a commit hash alone identifies the artifact.
- **Build/MCP self-check:** after the final edit, run the build and MCP smoke on the same
  worktree. For sociableWiki-style plugins, smoke both English and Korean reads: `list_topics`
  sees the new concept, `read_doc` returns the English canonical doc, and `read_doc` with
  `lang: "ko"` returns the Korean mirror. The receipt should say which revision/worktree
  produced those observations.
- **Behavioral QA self-check:** drive the installed behavior through the surface a user will
  touch. For an installer, that means a temporary target project: install once, verify the
  import loads the managed file, install again for idempotency, and force a conflicting
  managed file to confirm the prompt/failure semantics. Unit tests are helpful, but the QA
  claim is the observed install behavior.

## Why these checks and not "just test more"

The trap underneath all four checks is the same: **the thing you test is not the thing your
users run.** You test code at an absolute path they won't have, at a version number they
can't see, in a matching pool that doesn't contain the siblings install will drag in, or at
a worktree revision that is no longer the publish candidate. Local testing isn't wrong —
it's just testing the wrong artifact. The fix isn't "test harder," it's to make the test
artifact equal the ship artifact wherever the two can diverge: portable paths, a version
that moves when behavior does, an auto-fire re-test under the installed bundle, and final
receipts tied to the exact revision/worktree being shipped.
