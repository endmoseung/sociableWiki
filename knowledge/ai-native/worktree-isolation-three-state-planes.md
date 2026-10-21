---
type: reference
title: "Worktree isolation splits harness state three ways"
description: "A git worktree fences tracked file edits, not the session — in Claude Code, approvals and memory cross the fence, gitignored local instructions stay behind it, and hook paths stay pinned to the launch point."
tags: [worktrees, parallel-agents, permissions, agent-memory, claude-code]
date: 2026-10-11
source: "External-derived — Claude Code worktree and memory docs, Anthropic power-user tips; see Sources."
relates: [ai-native/sandboxing-enables-autonomy, ai-native/agent-memory-architecture, ai-native/configured-is-not-effective, ai-native/harness-self-knowledge-version-skew]
---

## TL;DR

The dominant parallel-agent advice right now is "run three to five sessions at once, one git worktree each." Several third-party guides then add that plan mode, memory, hooks, permissions, and the transcript "all attach to the worktree, not the original repo." **The official Claude Code docs say otherwise for most of that list.** A worktree isolates *tracked file edits*. The harness's own state splits into three planes, and the split is not intuitive:

| Plane | What lives there | Consequence |
|---|---|---|
| **Shared with the main checkout** (crosses the fence) | auto memory (keyed by git repo), `.git`, project-scope plugins, **"don't ask again" permission approvals** (saved to the *main* checkout's `.claude/settings.local.json`), untracked `.claude/skills` / `agents` / `commands` (read through when the worktree has none) | One session's grant or learned note is live in every sibling worktree, and survives worktree removal |
| **Per-worktree** (stays behind the fence) | tracked files; `CLAUDE.md` and `.claude/rules/` at the worktree root; every *gitignored* file — `.env`, **`CLAUDE.local.md`** — unless copied in by `.worktreeinclude`; the transcript (recorded under the session's current directory) | Personal instructions and secrets silently go missing in the new session |
| **Pinned to the launch point** | `${CLAUDE_PROJECT_DIR}` in hook commands stays at the original root (only the hook input's `cwd` follows); in desktop worktree sessions, settings, hooks, skills, and `.mcp.json` are read from the main root | A hook script that resolves paths from `CLAUDE_PROJECT_DIR` operates on the main checkout, not on the files being edited |

The working rule: **treat a worktree as a filesystem fence around tracked files, not as a session boundary.** Anything you want scoped to "this experiment only" — a permission, a memory, a local instruction — needs its own decision.

## Why "everything attaches to the worktree" is wrong, and why it matters

It is a natural inference. A worktree is a different directory, and transcripts really are recorded by directory. But the two pieces of state with the largest blast radius are deliberately keyed to the repository.

1. **Permission approvals widen globally.** In older versions an approval granted inside a worktree was saved there and died with it, so a throwaway worktree made a natural sandbox for "yes, don't ask again." Now it lands in the main checkout's local settings. Clicking "always allow" for `rm -rf build/` in a scratch worktree is a repo-wide, persistent grant. The allowlist you accumulate across N parallel sessions is the union of all of them.
2. **Auto memory has N concurrent writers.** All worktrees of one repo share one memory directory. Five parallel sessions, each learning something about *its own* branch, write into the same index that every future session loads. A lesson that was true on an abandoned experimental branch becomes ambient context for the main line.

Going the other way, the state people *expect* to follow them does not:

3. **`CLAUDE.local.md` doesn't exist in a new worktree.** It's gitignored, so a fresh checkout lacks it. The documented fix is to `@import` a file from your home directory instead of keeping personal instructions in the gitignored file. `.worktreeinclude` can also copy it in, but that is a per-repo opt-in most people haven't written.
4. **Subagent worktrees skip their own root instructions.** A subagent with `isolation: worktree` takes its instruction files from the parent conversation. In the default worktree location it does *not* load the worktree root's `CLAUDE.md` or `.claude/rules/`, even if that branch changed them. Edit the rules on a branch, delegate the verification to an isolated subagent, and you have tested the old rules.

## The isolation checks are narrower than "isolated"

While a session is inside a worktree, Claude Code blocks Edit/Write that target the main checkout, Bash whose working directory resolves there, and git redirected into it (`git -C`, `GIT_DIR`, `cd` followed by git, and command shapes it can't parse). It explicitly **does not track what a shell command writes**: `cp file ../main/...` or a `>` redirect into the main checkout passes these checks and falls back to ordinary permission and sandbox rules. So the fence is edit tools, git, and working directory. Writes from arbitrary shell commands are only fenced if the sandbox is on.

## Checklist before fanning out N worktree sessions

```
[ ] Personal instructions live in an @import from your home directory,
    not only in CLAUDE.local.md
[ ] .worktreeinclude lists the gitignored files each session needs (.env, local config)
[ ] Hook scripts read the hook input's `cwd`, not ${CLAUDE_PROJECT_DIR}, for edited files
[ ] Answer "don't ask again" as if for the whole repo, because it is
[ ] Expect auto memory written in a scratch worktree to show up on main;
    prune after the experiment, or turn auto memory off for exploratory sessions
[ ] Changed CLAUDE.md or rules on the branch? Verify in the session, not in an isolated subagent
[ ] Sandbox on if shell writes outside the worktree must be blocked, not just edits and git
```

## When this is wrong

If you create worktrees outside Claude Code's default layout with a `WorktreeCreate` hook (for a non-git VCS), on Windows, or in other cases where Claude Code doesn't use the repository root, approvals stay with that worktree and the transcript stays at the launch directory. The three-plane split above describes git worktrees on macOS and Linux. These behaviors are version-gated in the docs (as of October 2026, thresholds span roughly v2.1.198 to v2.1.277), so re-check them after an upgrade.

## Sources

- Claude Code docs, "Run parallel sessions with worktrees" — what worktrees share with the main checkout, the isolation checks, subagent instruction loading, `.worktreeinclude`, and hook `CLAUDE_PROJECT_DIR` versus `cwd`: https://code.claude.com/docs/en/worktrees
- Claude Code docs, "How Claude remembers your project" — auto memory is per repository and shared across worktrees; `CLAUDE.local.md` exists only in the worktree that created it; use a home-directory `@import` to share it: https://code.claude.com/docs/en/memory
- Anthropic support, "Claude Code power user tips" — three to five parallel sessions, each in its own worktree: https://support.claude.com/en/articles/14554000-claude-code-power-user-tips
- Third-party worktree guides (claudefa.st, developersdigest.tech, September–October 2026) that repeat the "memory, hooks, and permissions attach to the worktree" claim — cited here as the counter-example.
