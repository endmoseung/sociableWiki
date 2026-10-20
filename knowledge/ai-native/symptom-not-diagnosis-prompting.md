---
type: pattern
title: "Hand the Agent the Symptom, Not Your Diagnosis"
description: "When a coding agent can observe the failure itself, give it expected vs. observed behaviour and a repro — a prescribed fix anchors the agent and skips its root-cause search."
tags: [prompting, debugging, coding-agents, root-cause, anchoring]
date: 2026-10-11
source: "External-derived — a 2026 practitioner write-up on Claude Code workflows (Sean Moran), plus a light web survey; see Sources."
relates: [dev-process/trace-cause-before-fixing, dev-process/completion-means-verification-output, ai-native/clear-vs-compact-vs-autocompact, ai-native/solver-verifier-context-starvation]
---

# Hand the Agent the Symptom, Not Your Diagnosis

When a coding agent can read files, run commands, and check logs on its own, a debugging prompt that says *"the bug is in X, change Y to Z"* usually does worse than one that says *"I expected A, I saw B, here is how to reproduce it."*

A prescribed fix is not neutral context. It **anchors** the agent. The agent skips its own evidence gathering and implements your hypothesis. If the hypothesis was wrong or only partly right, you get a confident patch to the wrong file — and it looks like a fix, because it compiles and touches the area you named.

Practitioner write-ups in 2026 list this as one of the clearest reversals of 2025 habits, next to "shorter prompts" and "longer sessions."

## Why it works

1. The diagnosis I write is built on *less* evidence than the agent can collect. Usually it is a guess from the last thing I looked at, not a trace.
2. A symptom statement leaves the search space open, so the agent traces the real execution path — which script actually ran, which config was loaded — before it edits anything.
3. So the symptom prompt turns "implement my guess" into "find the cause," which is the step a human-prescribed fix tends to skip.

The example in the source: a scheduled job stopped reflecting a recent change. Given only the symptom, the agent checked the config, found that a *different* script was the one actually running, fixed that file, and redeployed. "Edit the job script" would have produced a careful edit to a file that never runs.

## The prompt shape

| Part | Write this | Not this |
|---|---|---|
| Expected | What should happen | "The bug is in …" |
| Observed | What happened, with the exact error or output | Your paraphrase of the error |
| Repro | The command, input, or click path | "It sometimes breaks" |
| Constraints | "Keep it backward-compatible", "no new dependency" | Background the agent can read for itself |
| Done check | The test or command that must pass | "Make it work" |

Constraints and the done check still need precision. The short-prompt trend removes *background*, not *intent*. A vague request still gets a vague result.

## Guardrails that are easy to drop

- **Verify the diagnosis, not just the diff.** Before accepting the fix, ask for the traced cause with `file:line` evidence. The main failure of symptom-only delegation is a patched symptom — a null check, a retry — in place of the root cause.
- **If you have a lead, label it and put it after the symptom.** "My guess, unverified: …" makes it one candidate, not the instruction.
- **Restate hard constraints in long sessions.** Context compaction is lossy, so an exact limit you stated 200 turns ago may now survive only as a summary.

## When this is wrong

- **The agent cannot observe the failure.** Production-only data, a device it cannot reach, a race it cannot reproduce. Your diagnosis then carries information the agent cannot recover, so give it — labelled as your diagnosis — along with the evidence behind it.
- **You already proved the cause.** A bisect or a failing test that pinpoints it is evidence, not a guess. Withholding it only wastes a search.
- **The fix is a policy choice among several valid ones.** A symptom prompt lets the agent pick, but that decision belongs to you.

## Sources

- Sean Moran, "Effective Claude Code Workflows in 2026: What Changed and What Works Now", Data Science Collective (Medium), 2026-04-19 — practitioner account, no measurements.
- Claude Code best-practice posts from aiforthe1.com, SmartScope, and chudi.dev (surveyed October 2026) — these back the "require evidence before accepting a completion claim" guardrail; no quantitative data.
