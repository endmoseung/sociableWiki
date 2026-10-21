---
type: pattern
title: "A style rule loses to the agent's own transcript"
description: "In long sessions the agent's own recent replies become the nearest few-shot examples and out-vote a style rule placed at the start, so re-inject a short copy of the rule at the tail every turn and prefer lexical bans over judged categories."
tags: [claude-code, prompting, style-drift, hooks, few-shot, instruction-decay]
date: 2026-10-12
source: "External-derived — the terse Claude Code plugin and its published benchmark; see Sources."
relates: [ai-native/llm-judged-hook-polarity, ai-native/clear-vs-compact-vs-autocompact, ai-native/cache-stable-harness-design, ai-native/enforcement-floor-vs-drift-detector]
---

# A style rule loses to the agent's own transcript

## TL;DR

A writing-style rule placed at session start (system prompt, output style, CLAUDE.md) holds for the first few turns and then fades. "The rule is far away" is only part of the reason. By turn 20 or 30 the context holds dozens of the model's **own replies**, and those are the nearest and most numerous style examples it has. They act as an implicit few-shot set that the model keeps imitating.

So once one reply slips — a recap paragraph, a slogan, an em dash — that slip becomes an example for the next reply. Style drift **feeds itself**, which ordinary task-instruction decay does not. It is the same self-conditioning that keeps an agent stuck in an error loop, applied to form instead of correctness. The fix differs, though: instead of shrinking history, you keep the window and move the rule to the tail.

Two practical consequences:

1. **Re-inject a condensed copy of the rule at the tail of every turn** (a `UserPromptSubmit` hook), and **hand subagents their own copy** (a `SubagentStart` hook). Subagents start from their own system prompt and do not inherit the main session's output style.
2. **Prefer lexical bans over judged categories.** A concrete, string-checkable ban ("no em dashes", "no first person") holds wherever you put it. A fuzzy category ("no metaphors", "no slogans") moves only with the right wording and placement, or not at all.

## Evidence: one practitioner benchmark

The author of `terse`, a Claude Code plugin shown on Hacker News in October 2026, published a benchmark: 8 rule texts and placements, 20–40 prompts, one run each through `claude -p`, on the Opus 5.5 and Fable 5.1 models current at the time, scored by a regex counter plus an LLM judge.

| Observation | Figure (single run, author-measured) |
|---|---|
| Median chat reply, no rules vs rules | 636 → 181 words |
| Output tokens over 12 prompts | −45% |
| Em dashes across 120 chat replies and 57 documents, in **every** configuration | 0 |
| Judged categories (reframes, cadence) across placements and wordings | moved 15–60% |
| Judged "metaphor" across all configurations | did not move in any |
| Cost of the per-turn tail reminder | about 145 input tokens |

The baseline was the same rule set placed only in CLAUDE.md, with no re-injection; the plugin's output style plus tail reminder roughly halved reply length against it. I treat the numbers as directional: one run per prompt, an LLM judge, and a plugin author grading their own plugin.

## Mechanism

```
turn 1:  [system: style rules] [user] → reply follows the rules
turn 25: [system: style rules] ... [24 own replies, some drifted] [user]
                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                     nearest examples → imitated
fix:     ... [24 own replies] [user + <condensed rules>]   ← tail re-injection
```

- A rule at the start of context competes with the **recency** and the **volume** of in-context examples. The transcript wins on both.
- The tail reminder works for the same positional reason that re-reading a progress file works. It is a position lever, not a durability fix: it does not repair replies that already drifted. Clearing or compacting the session does that.
- Subagents leak separately. In the benchmark, subagent style mostly followed the **subagent's model**, not the main session's rules, until the rules were handed in at `SubagentStart`.

## How I apply it

- When a rule is about **form** (length, tone, punctuation), I do not trust a one-time placement in a long session. I add a short tail reminder and keep it small, because it is paid on every turn. Since it sits at the tail, it does not disturb the cached prefix.
- I write the rule as a positive form plus a lexical ban: "The last sentence states a fact. No closing offers." Lexical bans are checkable and sticky; categories need a judge and still leak.
- I verify with a counter, not by reading: a regex over N replies for the banned strings, before and after the change.
- If subagent output reaches a human, I pass the rule to subagents explicitly.

## When this is wrong

- **Short sessions** (under about 10 turns). The start-of-context rule never loses to the transcript, and the tail reminder is pure overhead.
- **When length is doing real work.** Shorter replies can drop the evidence and uncertainty a reviewer needs. Compress narration, not evidence. A tight word cap suits an expert reader; it is not a default for every audience.
- **When thinking tokens dominate the bill.** Reply-length rules cut visible words more than cost. In the benchmark, Opus replies lost 54% of their words but only 32% of their cost.

## Sources

- lowenbjer/claude-terse on GitHub — README and `docs/benchmark.md` (read October 2026).
- "Show HN: Terse, a Claude Code plugin that halves reply length by cutting filler" (Hacker News, October 2026).
