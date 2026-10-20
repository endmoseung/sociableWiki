---
type: principle
title: "\"Treat Earlier Answers as Settled\" Is a Self-Review Off-Switch"
description: "An instruction that freezes earlier answers buys faster follow-ups by disabling the model's in-chat self-correction, so scope it per task and never put it in a global instruction file."
tags: [prompting, self-correction, long-chat, instruction-scope, latency]
date: 2026-10-12
source: "External-derived — a vendor prompting guide for Opus 5.5 (October 2026); see Sources."
relates: [ai-native/harness-component-value-is-model-dependent, ai-native/effort-resweep-on-model-upgrade, ai-native/clear-vs-compact-vs-autocompact, ai-native/style-drift-own-transcript-few-shot, ai-native/solver-verifier-context-starvation]
---

# "Treat Earlier Answers as Settled" Is a Self-Review Off-Switch

As of October 2026, the vendor guide for Opus 5.5 describes a new long-chat behaviour: while answering a follow-up, the model **re-examines its earlier answers**, which slows replies down. The suggested fix is a project instruction saying earlier answers are settled. In the same breath, the guide warns you to leave that instruction out of long analyses where a later step may need to catch an earlier mistake.

That caveat is the whole story. The instruction does not remove waste. It **turns off a self-correction channel.** I treat it as a per-task switch with a known failure mode, not as a hygiene rule to paste into every project.

## What the switch trades

| Without the instruction | With "earlier answers are settled" |
|---|---|
| A follow-up may reopen prior turns | Prior turns become fixed premises |
| Slower first token, more tokens per reply | Faster, cheaper follow-ups |
| A wrong earlier answer can still get caught late | A wrong earlier answer is inherited by every later turn |
| Cost grows with chat length | Cost stays flat; the error propagates instead |

My reasoning, step by step:

1. If the earlier answer was right, re-examining it is pure latency.
2. If it was wrong, re-examination is the only mechanism inside the chat that catches it without a human noticing first.
3. The instruction gives up case 2 to save case 1.

So its expected value depends on how likely an earlier answer is to be wrong, multiplied by the cost of building on it. That is a property of the **task**, not of the model.

## Where it fits and where it bites

- **Good fit** — independent Q&A, lookup chains, drafting where a human checks each turn anyway, pair work where the human is the reviewer.
- **Bad fit** — multi-step analysis, debugging chains, research synthesis, plan-then-audit sequences. In any chat where turn N is *evidence* for turn N+k, freezing turn N turns an early mistake into a load-bearing premise. It is the same shape as a lossy summary that keeps a hypothesis but drops the evidence that refuted it.
- **Worst fit** — a global instruction file that loads into every session. The rule then applies silently to exactly the analysis sessions where it hurts, and nobody sees the missing correction because a correction that never happened leaves no trace.

## How I use it

1. **Scope it.** Put it in a task-specific project, a per-session prompt, or a "quick Q&A mode" command. Keep it out of the always-loaded instruction file.
2. **Add a reopen hatch:** "Earlier answers are settled unless new evidence contradicts one — then say which and why." This should keep contradiction-driven correction while dropping idle re-checking. This variant is my hypothesis; the guide does not test it, so check it on your own workload.
3. **In analysis chats, do the opposite.** Keep re-examination, but move it to explicit checkpoints — "before the final answer, re-verify the conclusions from steps 1–3" — so the cost is paid once at a seam instead of on every follow-up.
4. **Re-check on every model upgrade.** The behaviour is reported for this model, not earlier ones. Like any harness knob, its value moves with the model.

## When this is wrong

If the re-examination is mostly *re-reading* rather than *re-deciding* — it rarely changes an answer — then its correction value is close to zero and a global "settled" rule is fine. You can measure this: sample some long chats and count how often a follow-up actually revised an earlier conclusion. Near zero means you can globalize it. Anything more than that means keep it scoped.

Also note the evidence level. The guide's claims are anecdotal — based on internal testing and early testers — and it gives no measurements of either the latency saved or the corrections lost.

## Sources

- Vendor blog post, "Getting the most out of Opus 5.5 in Claude and Claude Code" (2026-10-03), and its Hacker News discussion.
