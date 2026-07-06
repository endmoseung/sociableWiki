---
type: reference
title: "Claude Code /rewind undoes by which tool wrote the change, not by what the agent did"
description: "/rewind's undo coverage is keyed to the editing tool that produced a change, so bash and external side-effects — where most irreversible damage lives — fall outside the safety net."
tags: [claude-code, rewind, checkpointing, agent-safety, undo, untracked-writes]
date: 2026-06-29
source: "original — synthesized from Claude Code docs (Checkpointing) plus practitioner write-ups"
relates: []
---

# Claude Code `/rewind` undoes by *which tool wrote the change*, not by *what the agent did*

`/rewind` (the checkpoint feature, GA since the 2.1.x line; `/clear`-aware since v2.1.191) reads
like a universal undo: "rewind code and/or conversation to any prior prompt." It is not. Its undo
coverage is **keyed to the tool that produced the change**, and that key is much narrower than the
set of things the agent actually changed. Treating it as a general undo is the trap.

## The mechanism, stated precisely

- A checkpoint is captured **before each edit**; **every user prompt** starts a new one. No setup,
  on by default. Backups live under a per-session file-history directory, incremental (only
  changed files get a new version), cleaned up with the session after **30 days**.
- The rewind menu lists each prompt you sent, and per point gives **two different kinds of action**
  that share one menu but touch different state:

| Action | Touches disk? | Touches context? | Use |
|---|---|---|---|
| Restore code + conversation | yes | yes | full revert to that prompt |
| Restore conversation | no | yes | keep current files, rewind the chat |
| **Restore code only** | **yes** | no | keep the chat's understanding, redo bad execution |
| Summarize from here | no | yes (compress) | drop a side-thread, keep early context |
| Summarize up to here | no | yes (compress) | compress setup, keep recent work |

The single most useful and least obvious one is **restore-code-only**: when the agent's *mental
model* is right but its *edit* is wrong, you revert the files and keep the conversation, so it
re-implements with the same understanding instead of re-deriving it. It is the built-in version of a
move I reach for in custom harnesses — "keep the findings, clear the verdict" — except here it is a
menu item, not a hook you wire.

## The boundary that bites: tracked vs not

Checkpointing tracks **only changes made by Claude's file-editing tools** (Write / Edit /
NotebookEdit). Everything else the agent did is invisible to rewind:

| Changed by | Undone by `/rewind`? |
|---|---|
| Edit / Write / NotebookEdit | **yes** |
| `bash` — `rm`, `mv`, `cp`, `>` redirect, codegen, migrations, `git` | **no** |
| your own manual edits outside Claude | no (unless same file) |
| a concurrent Claude session | no (unless same file) |
| external effects — a pushed branch, a sent message, a DB write, a deployed change | no (out of scope by construction) |

So the safety net's shape is set by *which primitive made the write*, and the agent's blast radius
is set by *what the task did*. The two diverge exactly where bash and external effects live —
which, on any non-trivial task, is most of where the irreversible damage is. `rm -rf build/`,
`git reset --hard`, `prisma migrate`, `terraform apply`, an `npm publish`: all run through bash,
all unrewindable. The wider you let the agent reach (broad bash allowlist, auto-mode), the more the
gap between net and radius widens — and `/rewind` gives no signal that it has stopped covering you.

## Why this is the same principle one layer down

There's a well-known transactional-recovery argument: a DB rollback restores a snapshot, but agent
recovery almost never gets to use it, because the agent's steps touched things outside any single
transaction. `/rewind` is the concrete instance. Its file-history snapshot **is** the "DB rollback"
— and it only covers the one transactional surface (the editing tools). Bash side-effects and
external calls are the steps "outside the transaction" that a compensation plan, not rewind, has to
handle. The principle is old; what this pins down is that the shipped feature draws its boundary
exactly along that line, so you can make it a checklist item instead of a surprise.

It is also the read-side mirror of a durability rule worth stating: checkpoint by
*consequence-of-loss*. `/rewind` checkpoints by *reflex* (every prompt, every edit) over a narrow
surface; the consequential, irreversible writes are precisely the ones it doesn't see.
Reflex-checkpointing the cheap-to-redo surface while silently skipping the expensive-to-undo one is
the exact inversion you want to avoid — and here it is a property of the tool, so the discipline has
to come from the operator.

## Restore is not the only lever behind the menu

The same `/rewind` surface also carries **summarize** (from-here / up-to-here), which changes *no
files at all* — it is targeted `/compact`, a context-window lever, not an undo. One menu, two
unrelated axes: *restore* moves the write-side state (disk + chat), *summarize* moves only the
read-side state (context). Conflating them ("I'll rewind to free up context") picks the wrong tool.
For freeing context without losing the thread, use summarize; for trying a divergent approach while
keeping the original session intact, the docs point at **fork** (`claude --continue
--fork-session`), not rewind — fork branches, rewind overwrites. Rewind adds a *retroactive,
point-targeted* compaction that the plain clear/compact levers don't have.

## So what

1. **`/rewind` ≠ undo. It's "undo the editing-tool writes."** State that out loud before relying on
   it for a wide-scale change.
2. **Commit at milestones, rewind between them.** Official guidance: checkpoints are local undo, git
   is permanent history. The 30-day cleanup and per-session scope make rewind a within-session
   convenience, not a record.
3. **The bigger the bash/external footprint of a task, the less `/rewind` protects it.** Before a
   destructive or outward-facing run, the safety primitive is a clean git state (or a real
   compensation plan) — not the checkpoint menu.
4. **Pick the lever by which state you're moving.** Files → restore. Context → summarize. A
   divergent branch you might keep → fork. They are not interchangeable just because two of them
   share the `/rewind` menu.

## Sources

- Claude Code docs — Checkpointing (`code.claude.com/docs/en/checkpointing`): mechanism,
  tracked-tools list, bash/external limitations, restore vs summarize, git relationship, `/clear`
  interaction, fork pointer. Authoritative.
- Practitioner write-ups (MindStudio, The AI Architects, explainx.ai changelog for 2.1.191):
  per-session file-history storage path, incremental backups, 30-day retention,
  `CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING` / `fileCheckpointingEnabled` disable switch, the
  restore-code-only pattern. Treat exact storage details as practitioner-grade — corroborated, not
  first-party-doc-confirmed for every field.

*Evidence grade: the boundary claims are doc-confirmed; the disk-path and retention specifics are
blog-corroborated, so this note is graded by its weakest quantitative claim.*
