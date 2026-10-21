---
type: reference
title: "A Harness Component Has No Fixed Value"
description: "The same harness component does a different job on a different model — planning is an accuracy scaffold for weak models and a cost cutter for strong ones — so ablate per model and report both success and cost."
tags: [agent-harness, ablation, coding-agents, planning, context-management, eval]
date: 2026-10-11
source: "External-derived — Fan et al., an empirical study of harness design for coding agents (arXiv 2609.20804), plus HN discussion; see Sources."
relates: [ai-native/harness-knobs-are-earned-not-designed, ai-native/model-upgrade-is-a-deletion-event, ai-native/harness-is-the-eval-unit, ai-native/agent-cost-economics-routing, ai-native/effort-resweep-on-model-upgrade]
---

# A Harness Component Has No Fixed Value

Most harness debates I get pulled into assume a component is simply good or bad. Is planning worth it? Do we need custom tools, or is bash enough? Should compacted context be recoverable? A component-level ablation published in September 2026 (Fan et al., arXiv 2609.20804) shows that the answer flips with the model. It ran 176 matched settings across 4 models on SWE-Bench Verified and Terminal-Bench 2.1, kept the execution loop fixed, and varied only **planning**, **action space**, and **context management**.

The same component does a different job on a different model. A verdict like "planning helps" is incomplete until it names a model, a context budget, and both a success column and a cost column.

## The three flips

| Component | Weak model (Nemotron-3 30B) | Strong, bash-fluent model | What it actually moves |
|---|---|---|---|
| **Planning** | Accuracy scaffold. Without it, 68.6% of SWE-Bench runs end with no edit at all (27.8% with it). Cost goes *up* 75% on Terminal-Bench because runs live longer | Cost cutter. It trims redundant post-edit verification: Terminal-Bench cost −26% on a 120B model and about −40% on Mistral-Medium-3.5, with small success drops | **Where the trajectory stops** |
| **Predefined tools vs. bash-only** | Tools raise success by 15.0 points (SWE) and 10.1 (TB). Bash-only collapses: 66% of TB runs end after the model emits actions outside the interface | Bash-only can raise success *and* lower cost (550B model), but not uniformly: Mistral bash-only lost 23.2 points, and 32.8% of its runs never edited a file (1.2% with tools) | **Code-writing granularity** — bash-only shifts writes toward coarse create-or-replace (28% → 64%) |
| **Context management** | Value grows as the window budget shrinks; most of the benefit is preventing overflow failures | Same | **Trajectory length**, not behaviour |

## Two findings that bit my own assumptions

**1. Recoverable elision bought nothing.** I had treated "elided content can be fetched back" as a feature. In the paper, making it re-fetchable added machinery that models rarely used and gave no accuracy gain. The cheapest policy was also the best: rule-based elision first, LLM summarization only if still needed. It had the lowest mean cost per task at every window budget and the lowest cost in 7 of 8 model×benchmark panels, at comparable success. A back-pointer is a durability property. It turns into accuracy only if the model actually reads the bytes back, so check read-back frequency before you count recoverability as a win.

**2. "Strong model, delete the scaffolding" is only half true.** I agree that a stronger model outgrows scaffolding that existed to prop up accuracy. But on the strong models here, planning stopped buying accuracy and kept cutting cost, because it truncates the long tail of runs that keep re-verifying. Judge a component on accuracy alone and you will delete a cost saver.

## How I apply it

- **Ablate per model, report two columns.** I don't write "component X helps" without the model, the context budget, success Δ, and cost Δ. A component that is accuracy-neutral but saves cost is a keeper. One that helps only the weak tier is a routing decision, not a global default.
- **Diagnose by stop-point, not just pass rate.** Classify failed runs by where they ended: no edit, stuck in localization, out-of-interface action, or a post-edit verification loop. Planning moves the first; tools move the second and third. A component's value shows up as a shift in that distribution.
- **Re-run the ablation on every model swap or routing change.** A subagent routed to a cheaper model inherits harness defaults that were tuned for the strong one, and the planning and tool verdicts can invert.
- **Treat bash-only as a capability bet.** It pays on shell-centric tasks for models that are fluent in the shell. It hurts localization when the model cannot navigate a repo through the shell. Gate it by model, not by taste.

## The counter-signal

Practitioners discussing a companion site that compares coding harnesses on cost argued that much of the weight in full-featured harnesses is security and guardrails — and a cost-only benchmark scores those as pure overhead. That is fair. The ablation measures success and cost only; sandboxing, permission prompts, and audit trails are outside its scope. I would not use these numbers to justify removing a safety surface.

## When this is wrong

The paper's models are Nemotron-3 and Mistral-Medium-3.5, not frontier Claude or GPT models. I treat the *direction* of each flip as transferable and the *sizes* as specific to those models. Measure your own model before reusing any number above.

## Sources

- Fan et al., "An Empirical Study of Harness Design for Coding Agents", arXiv 2609.20804 (September 2026). All numbers above come from its abstract and tables.
- Hacker News: "An empirical study of harness design for coding agents" (item 49753878) and "HarnessTax: How Much Does the Harness Matter for Coding Agents?" (item 49733726) — used only for the qualitative counter-signal.
