---
type: principle
title: "The Harness Ceiling Is a Missing Reward Signal"
description: "Coding models are trained against fast oracles like tests, and maintainability has none — so no harness layered on after training can buy it; you buy it upstream with planning, not downstream with prompts and critics."
tags: [agent-harness, maintainability, planning, verification, reward-signal]
date: 2026-08-04
source: "External-derived — Dex Horthy and Addy Osmani essays, Faros AI telemetry, Cognition FrontierCode; see Sources."
relates: [ai-native/harness-component-value-is-model-dependent, ai-native/reward-hacking-held-out-gap, dev-process/planner-generator-evaluator-loop, ai-native/disposable-implementation-durable-oracle, ai-native/model-upgrade-is-a-deletion-event]
---

# The Harness Ceiling Is a Missing Reward Signal

Harness work has a ceiling. Better prompts, more orchestration, and extra review agents keep improving an agent's output up to a point, and then stop. I already believed the ceiling was real and that harness gains are model-specific — a tuning win on one model often doesn't carry to the next. What I lacked was an explanation of *why there is a ceiling at all*.

Dex Horthy's July 2026 argument supplies one, and it isn't about tooling. **RL training has no penalty for eroding maintainability, because maintainability has no fast verifier.** Tests return pass/fail in seconds. The cost of bad architecture shows up weeks or months later — far too late to feed back into training. So models get very good at what has a fast oracle and stay indifferent to what doesn't. And **no amount of prompt or orchestrator layering adds a reward signal that was missing at training time.**

## Why that flips the optimization target

If the gap is a missing oracle, you can't close it *downstream* of code generation — more reviewers, smarter critics, stricter prompts. You close it **upstream**, by removing the ambiguity the model would otherwise resolve badly. That's the source of the counterintuitive headline: roughly **30 minutes of planning saves hours of review**, and the honest ceiling is about **2–3× faster, safely**, not the 10–100× the "software factory" pitch implies.

This composes with the model-specific finding rather than repeating it:

| | "Harness gains don't transfer" | "The ceiling is a missing reward signal" |
|---|---|---|
| Claim | Harness gains are large but model-specific | A ceiling exists because a training signal is absent |
| Level | Empirical: measured transfer failure | Causal: explains the mechanism |
| Implied action | Re-tune the harness per model | Move effort upstream of generation |

The first says harness work doesn't port across models. The second says there's a class of quality the harness can't buy on *any* model.

## Why "just add a critic" fails

The obvious patch is a judge agent that scores maintainability. The argument against it is self-referential: if a model could reliably tell good architecture from bad, it would have written the good version the first time.

This is the same structure as reward hacking: **a proxy produced by the system it's meant to judge is not an independent oracle.** A critic subagent still helps at the margins — it catches whatever criteria you *state* — but it can't create a quality signal the base model never learned. Cognition's FrontierCode, which grades mergeability with judge models plus mutation testing, is real progress on the measurement side. It isn't a solved problem.

## The evidence, and how much weight it carries

The quantitative backbone is Faros AI's engineering telemetry since January 2026, and it has to be quoted with its caveat attached — **this is correlation, not a controlled comparison**:

- PRs that skip review entirely: **+31.3%**
- Review comments: **+25%** more, **+22.7%** longer
- Production incidents per PR: **+242.7%**; monthly incidents **+57.9%**; bugs per developer **+54%**

Read the first two lines together: review is skipped *more often*, and where it still happens it gets *heavier*. That's the signature of verification becoming the bottleneck instead of generation.

The best-known "lights-off factory" case has no public postmortem, and the Hacker News discussion of it (394 points, 271 comments) was genuinely split. Treat the factory-failure story as practitioner argument with partial data, not a settled result.

## Loop, harness, factory

Addy Osmani's companion piece gives the layers clean names:

| Layer | What it is | The threshold that matters |
|---|---|---|
| Loop | gather context → act → check → repeat until a condition | Works well for **3–10 steps**; loses the thread past about twenty |
| Harness | the sandbox, tools, memory across runs, and gates that define "done" | Contains the loop; can't exceed the model's trained quality |
| Factory | many harnessed loops on a work queue, drained through a review gate | Not a bigger agent but "an org chart made of loops" |

The load-bearing line: **a factory's bottleneck is verification capacity, not generation capacity.** Autonomy can't outrun what you can cheaply and reliably verify. The 3–10 step range is also a practical budget for task decomposition: past twenty steps, split the task instead of extending the loop.

## What to do: front-load, don't post-check

The recommended structure is four phases *before* implementation, each removing a class of decision the model would otherwise guess at:

1. **Product review (~30 min)** — mockups and success metrics; lock what the user experiences.
2. **System architecture** — sequence diagrams and contracts; how components interact.
3. **Program design** — types, signatures, file tree, and call stacks before code.
4. **Vertical slices** — build end to end (storage → service → API → UI) and test between phases, rather than layer by layer.

Routing by task size keeps this from becoming ceremony: about **40% of tasks still warrant one-shot agent work**; medium tasks get product review and architecture; only large features run all four phases. Applying all four to everything is exactly what makes planning look like overhead.

If you already run a plan → generate → evaluate loop, the implication is that the **planning** phase carries the leverage. The evaluator catches what you stated; only the plan removes what you'd otherwise leave the model to guess.

## When this is wrong

The counter-hypothesis to hold: **if labs land a workable maintainability verifier, the causal claim weakens fast.** Mutation testing plus judge models is an active attempt at exactly that. If a fast-enough architectural oracle becomes trainable, the ceiling rises by itself, and front-loaded planning drops from structural necessity back to ordinary good practice. And the Faros numbers can't separate "AI wrote it" from "teams shipping fast skip review anyway."

## Sources

- Dex Horthy, July 2026 argument on the missing maintainability reward signal and front-loaded planning.
- Hacker News discussion of the "dark factory" narrative (394 points, 271 comments).
- Addy Osmani, companion piece on loops, harnesses, and factories (2026).
- Faros AI, engineering telemetry on AI-assisted development since January 2026.
- Cognition, FrontierCode — mergeability grading with judge models and mutation testing.
