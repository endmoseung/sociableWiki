---
type: deep-dive
title: "One rule source for two coding agents, plus a daily contradiction check"
description: "When two agent tools follow the same personal rules, keep one canonical copy linked into both by symlink (not hardlink), and run a daily job that repairs broken links and asks an LLM judge for rule pairs that cannot both be obeyed."
tags: [agent-rules, agents-md, symlinks, drift, contradiction-check, harness]
date: 2026-09-28
source: original
relates: [ai-native/enforcement-floor-vs-drift-detector, ai-native/configured-is-not-effective, ai-native/agent-writable-trace-is-testimony, ai-native/harness-self-knowledge-version-skew]
---

## TL;DR

I run two coding agents — Claude Code and Codex — and want both to follow the same personal rules. Two separately edited copies drift by default; mine had. The setup that fixed it has two parts:

1. **One canonical copy, symlinked into each tool's rules folder.** Not hardlinked: an editor that rewrites the file breaks a hardlink silently, while a symlink either survives or forces the edit onto the original.
2. **A daily job that repairs links and checks for contradictions.** It restores any link a tool replaced with a plain file (via a three-way merge), then asks an LLM judge for rule pairs that cannot both be obeyed, and only auto-fixes when it can quote a human instruction for the winning side.

## How it started

As of September 2026, Claude Code began reading `AGENTS.md` when a project has no `CLAUDE.md`. My home directory had no `CLAUDE.md`, so a 328-line `~/AGENTS.md` that I hadn't touched in two months was quietly being loaded next to my current rules. Around the same time I found that five of my seven shared rule modules had drifted between the Claude copy and the Codex copy. Nobody did anything wrong; I had simply been editing two copies.

Both failures have the same shape: a file I thought was dead or synced was live and different.

## The layout

| Layer | Where | Who reads it |
|---|---|---|
| Shared modules (7) | one canonical directory outside both tools' config folders | both tools, through symlinks in `~/.claude/rules/` and `~/.codex/rules/` |
| Host-specific rules | one file per tool | only that tool |
| Index | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | only that tool |
| Home pointer | `~/AGENTS.md`, cut down to about a dozen lines that point at the above | both tools, when launched from home |

A separate section in the shared rules sets the precedence order when two rules collide, so the judge below has something to resolve against.

## Why symlinks: what I measured

I tested each link type against the actual edit tools (as of September 2026) instead of assuming:

- **Claude Code's Edit tool refuses to write through a symlink** and tells you to edit the target path. Net effect: only the original ever changes. Good.
- **Claude Code's Edit tool breaks a hardlink.** It writes a new inode, so the "linked" file silently becomes an independent copy. Never hardlink a file Claude may edit. (I had been hardlinking skill files by convention, which carries the same risk.)
- **Codex's `apply_patch` keeps a symlink intact** when you edit through the link path.
- **`@` imports in the global `CLAUDE.md` follow symlinks.** An import in a *project* `CLAUDE.md` that points outside the project folder did not load.
- **My older copy-sync tool crashed** (`SameFileError`) once both paths pointed at the same file, so I removed the rule pairs from its manifest. A sync tool and a link are two answers to the same problem; keep one.

## The daily check

A scheduled job runs once a day; if the machine was asleep, it runs after wake.

1. **Link repair.** If a tool has replaced a link with a regular file, the job does a three-way merge against the last known-good baseline. If only one side changed, it applies that change to the original and restores the link. If both sides changed the same spot differently, it writes a decision card instead of guessing.
2. **Contradiction judgment.** On days when a watched file changed, and weekly regardless, an LLM judge reads all the rules and lists sentence pairs that cannot both be obeyed. It runs isolated — `claude -p --safe-mode --tools "" --no-session-persistence` — so no `CLAUDE.md`, hooks, or tools load and no session history is saved. Any pair whose quoted sentence does not appear verbatim in the files is discarded.
3. **Evidence lookup.** For each contradiction, the job first finds the session that last edited that file and reads only the **human-typed message** just before the edit. Instructions relayed to subagents and tool output are excluded, because an agent can write those itself. If no session evidence exists, it searches my personal notes.
4. **Resolution.** It auto-fixes only when it can quote a human instruction or note verbatim **and** the losing sentence is actually deleted. A script does the file edit; the LLM only returns JSON. Everything else becomes a decision card, and both tools' session-start hooks report how many cards are open.

## Performance lesson

The session logs were large (about 1.4 GB for Claude, 6.5 GB for Codex). Scanning them with BSD grep and several fixed-string patterns took about 50 minutes of CPU, and switching the locale to `C` didn't help. Matching the common prefix of edit records (`"file_path":`, `Update File: `) with a Python regex and caching by file modification time brought it to 31 seconds for the first index and 3.7 seconds per run after that.

One trap: Codex re-reads the rule files every turn, so searching by **path** matches almost every session. Search by the **edit-record string** instead.

## Known limits

- Contradictions the judge misses stay in. The weekly full audit catches some of them.
- Session logs only go back about two months, so rules edited long ago fall through to the notes search.
- When rules are edited in a batch ("clean up this session"), the human message right before the edit says only that, which is useless as evidence. Batch edits weaken the audit trail.

## When this is wrong

If you only use one agent tool, or the two tools need genuinely different rules, a single source adds link maintenance for no gain — keep separate files and accept the drift. And if your tools' editors change how they treat symlinks, re-measure; the link choice above is only as good as the last test.
