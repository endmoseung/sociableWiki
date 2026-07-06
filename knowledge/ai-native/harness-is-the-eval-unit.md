---
type: reference
title: The Harness Is the Eval Unit
description: When you evaluate an LLM agent, the scaffold shifts benchmark scores as much as the model does — so hold the harness constant, and calibrate any LLM-as-judge with a cross-family model before trusting it.
tags: [eval, agent-harness, llm-as-judge, benchmarks, regression, reproducibility]
date: 2026-06-16
source: "External-derived — synthesizes agentic-eval papers (arXiv), a DeepEval maintainer post, and HN discussion; see Sources."
relates: []
---

# The Harness Is the Eval Unit

The mistake I keep seeing in agent evaluation is treating the model as the thing under test. It isn't. The **harness** — the scaffold, tool definitions, prompt format, and feedback loops that wrap the model — moves benchmark scores as much as the model choice does. If you don't pin the harness, you're measuring your setup, not the model.

Three problems compound, and they're worth separating because they need different fixes.

## 1. Benchmark confounders — the score is partly your setup

Re-run the *same* benchmark under a *common* scaffold and the scores move — sometimes a lot — versus the originally reported numbers. That gap isn't model capability. It's evaluation setup. A 2026 study re-ran seven major agentic benchmarks under a single fixed ReAct-style architecture and found much of the reported score spread was attributable to scaffolding choices, not model improvements.

The practical consequence: a headline like "model B beats model A by 4 points on benchmark X" is meaningless unless both ran under the same harness. Different tool schemas, a different system-prompt template, a different retry loop — any one of those can manufacture or erase a 4-point gap.

## 2. Incomparable protocols — no shared triplet

Benchmarks define tasks differently: different observation spaces, different tool availability, different success criteria. So cross-benchmark comparison is unreliable unless you force a common shape. The unit that makes tasks comparable is an explicit, versioned **(instruction, tools, environment) triplet**. If any of the three is implicit, two "same" tasks aren't the same task.

## 3. LLM-as-a-judge reliability — cheap, but biased until calibrated

Scoring agent outputs with an LLM is 500–5000x cheaper than human review, which is why it's the default at scale. But it ships with systematic biases:

- **Position bias** — in pairwise comparisons, the judge tends to prefer whichever option came first.
- **Flattery / same-family bias** — a model rates outputs from its own family higher.
- **Calibration drift** — agreement with humans erodes over time and across task types.

Properly calibrated, LLM judges report 80–90% agreement with human judgment. The word doing the work there is *calibrated*. Uncalibrated, the number is unearned.

## Why this is the real bottleneck

Two claims the field has converged on:

- **The full system is the unit under evaluation, not the model alone.** Changing tool definitions or prompt format can shift pass rates as much as upgrading the model. So an eval result is only meaningful relative to a named, frozen harness.
- **Eval infrastructure is a full-time engineering discipline.** Building a custom harness past the prototype stage is equivalent to building a testing framework. I reach for established tooling (Opik, DeepEval, and similar) rather than hand-rolling one, because the failure modes — flaky graders, silent config drift, ungrounded judges — are exactly the ones a mature framework has already paid for.

## How I run it

**Structuring benchmarks**
- Define each test as an explicit, versioned **(instruction, tools, environment)** triplet. Keep all three visible in the config, not baked into code.
- When comparing models, **hold the scaffold constant and change one variable at a time.** A model swap and a prompt tweak in the same run is a wasted run.
- Prefer **continuously-updated** benchmarks over static test sets. Agentic tasks get solved through contamination faster than static NLP tasks do, so a static set rots into a memorization check.

**LLM-as-a-judge**
- Use **pairwise comparison** ("which output is better?") over absolute scoring ("rate this 1–5"). Pairwise is more stable and sidesteps the worst of the absolute-scale drift — just remember to control for position bias (randomize order, or score both orderings).
- Use a **cross-family judge.** If the system under test is Claude, judge with GPT or Gemini, and vice versa. Same-family judging shows measurable flattery bias.
- **Calibrate against human labels** on 50–200 examples and target Cohen's kappa ≥ 0.6 before you trust the automated score. Below that, the judge is noise wearing a number.
- Let the judge **augment** human review, not replace it. I keep humans on edge cases and on periodic calibration refreshes; the judge handles scale.

**Avoiding harness confounders**
- Pin tool schemas and system-prompt templates as **versioned artifacts**, same as code.
- Log the full scaffold configuration — model, temperature, tool set, context-window size — alongside every eval run. A score without its config is not reproducible.
- When you report an improvement, include an **ablation**: how much of the gain is the model, and how much is the harness? If you can't answer that, you don't yet know what improved.

## The one-line version

Freeze the harness, version the (instruction, tools, environment) triplet, and never trust an uncalibrated same-family judge. Everything else in agent eval is downstream of getting those three right.

## Sources

- ["A Unified Framework for the Evaluation of LLM Agentic Capabilities" (arXiv:2605.27898)](https://arxiv.org/html/2605.27898v1) — benchmark-confounder evidence; benchmarks re-run under a fixed scaffold.
- ["A Survey on Evaluation of LLM-based Agents" (arXiv:2503.16416)](https://arxiv.org/abs/2503.16416) — evaluation perspectives and gap analysis.
- ["Towards More Standardized AI Evaluation" (arXiv:2602.18029)](https://arxiv.org/pdf/2602.18029) — unified-scaffold advocacy, HAL leaderboard.
- [DeepEval — LLM-as-a-judge](https://deepeval.com/blog/llm-as-a-judge) — 80–90% agreement figure, kappa calibration, pairwise vs. absolute scoring.
- [Hacker News — "About AI Evals" (item 44430117)](https://news.ycombinator.com/item?id=44430117) — the harness-as-unit-of-eval consensus and tooling recommendation.
