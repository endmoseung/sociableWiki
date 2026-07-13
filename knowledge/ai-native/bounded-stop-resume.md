---
type: pattern
title: "Bounded stop/resume — pause with a receipt, not an infinite loop"
description: "A long agent run should stop at a named boundary with a resume packet; it should not silently auto-resume forever."
tags: [coding-agents, orchestration, persistence, verification, agent-safety]
date: 2026-07-13
source: original
relates: [ai-native/clear-vs-compact-vs-autocompact, ai-native/dynamic-workflow-anti-trigger]
---

# Bounded stop/resume

The right answer to "keep working" is not an unbounded self-resuming loop. It is a
**bounded stop/resume protocol**: the agent stops at a named boundary, writes enough
state for the next run to continue safely, and resumes only under an explicit budget or
explicit human instruction.

The boundary matters because long-running agents fail in boring ways: context drift,
stale verification, repeated attempts against the same blocker, and background work whose
latest state nobody can reconstruct. Auto-resume hides those failures by turning "I need a
new attempt" into "I silently started another one."

## The stop packet

When the agent stops, it should leave a compact packet:

- **Goal** — the user's current request in one sentence.
- **State** — completed work, remaining work, and the exact files changed.
- **Evidence** — commands/tests/smokes already run, with revision/worktree fingerprint.
- **Blockers** — only real blockers, with the attempt count and the last observed failure.
- **Next action** — the first command or edit the next run should perform.
- **Budget** — the maximum time, tokens, retries, or attempts allowed after resume.

That packet is the handoff. If it is missing, "resume" is really "start over with stale
confidence."

## Resume rules

Resume is allowed when one of these is true:

1. The human explicitly says to resume.
2. The harness has a predeclared bounded continuation budget.
3. A deterministic job runner restarts a known step from a recorded state file.

Resume is not allowed when the only reason is "the agent wants to keep going." A loop with
no attempt cap, no revised hypothesis, and no fresh evidence is just failure amplification.

## Verification rule

Evidence is scoped to the revision and attempt that produced it. If the resumed run edits a
file after the last build, test, MCP smoke, or behavioral QA receipt, that receipt is stale
for the final artifact. The resumed run must rerun the relevant checks before claiming
completion.

## Practical default

For interactive coding agents: stop after a real blocker repeats three times, after the
declared budget is exhausted, or at a clean handoff boundary. Leave the stop packet. On
resume, read the packet first, verify the worktree fingerprint, then continue from the next
action. Do not implement an unbounded auto-resume mechanism just to appear persistent.
