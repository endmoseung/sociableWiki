---
type: principle
title: "Harness Knobs Are Earned by a Past Failure, Not Designed in Advance"
description: "A coding-agent harness is high-leverage, so every knob should trace to a real failure or a hard constraint — and most thresholds in circulation (fan-out 3–5, maxTurns 30, retry 5) are undefended defaults."
tags: [agent-harness, configuration, thresholds, guardrails, eval-driven]
date: 2026-08-08
source: "External-derived — synthesizes harness-evolution benchmarks, vendor guides, and practitioner posts; see Sources."
relates: [ai-native/model-upgrade-is-a-deletion-event, ai-native/harness-is-the-eval-unit, ai-native/configured-is-not-effective, ai-native/fan-out-width-ceiling, ai-native/reward-hacking-held-out-gap]
---

# Harness Knobs Are Earned by a Past Failure, Not Designed in Advance

I went looking for how good engineers *tune* their agent-harness parameters — effort levels, fan-out width, retry counts, turn limits, per-task profiles. The honest answer after a wide sweep of papers, vendor docs, and practitioner posts: they mostly don't tune them. They **earn** them from a specific failure, and they **delete** them when the failure stops happening.

## Two results that bound everyone's confidence

Two measurements, read together, are the whole argument:

- **The harness matters a lot.** On a SWE-bench Verified subset, variance caused by the harness was about **7.8×** the variance caused by the model (18.48 vs 2.37 pp²).
- **Iterating on it blindly doesn't help.** Across **35 sequential releases** of one open-source coding CLI, with the model held fixed (3,500 runs), resolve rate showed **no significant trend** — it bounced between 23% and 39%, and an early release sometimes beat later ones — while **token use grew about 70%**.

So professional harness authors, iterating continuously, could not show improvement while cost nearly doubled. The harness is high-leverage, which is exactly why churning it without evals is expensive. Gate config changes on an eval, or don't make them.

## Should this knob exist at all?

Several independent sources converge on a rule stricter than "hardcode until it hurts": a rule or setting should trace to **a specific past failure or a hard external constraint**; otherwise it is noise. Addy Osmani's phrasing is the one I keep: "Ratchet; don't brainstorm." Hamel Husain says the same about evals — write them for errors you found, not errors you imagined. Anthropic's agent guidance says to add complexity only when it demonstrably improves outcomes.

The best test for a *good* knob comes from Amp, which deleted its model picker and published adoption numbers: the "smart" mode went from carrying 55% of new threads to zero within a week, 69% of users never moved the new dial off its default, and a provider switch underneath drew no complaints. Their reframing generalizes: a model picker asks the user which model is best for a task; a difficulty dial asks something only the user knows — *how hard is this?*

**A legitimate knob asks the user something only the user knows.** If the system can infer it, the knob is dead on arrival. Augment, which went the other way and kept a picker, stated the condition under which that's right: expose a choice only when the options are **genuinely non-dominating** (e.g. two good models at different latency/quality points). If one option always wins, hardcode it.

## Forbid instead of parameterize

Some things shouldn't be tunable at all:

- **Risk axes, not dials.** OpenAI's agent guide rates each tool on read-only vs write, reversibility, required permissions, and financial impact; high-risk actions go to a human — and that gate is meant to loosen only as evidence of reliability accumulates.
- **Avoid dangerous combinations structurally.** Simon Willison's "lethal trifecta" (private data + untrusted content + an outbound channel) is not something to tune to 95% safety; you avoid the combination.
- **A fake gate is worse than none.** Amp declined an ignore-file feature because a model blocked from a file will route around it with a shell tool — a false sense of security.
- **Move review upstream.** HumanLayer's point: a bad line of code is one bad line; a bad line of plan becomes hundreds. Human review earns more on research and plans than on edits.

## How to pick a number, when you must

The only documented method I found is a measurement procedure, not a value: **run a representative sample with no limit, record the per-task distribution, start at p99, then tune.**

Visibility matters more than size. In one browsing benchmark, a ReAct baseline plateaued at its budget and could not use more even with context to spare; giving the model a *visible* countdown cut search calls about 40% and cost about 31% at comparable accuracy. But other work shows models overshoot stated budgets and that a one-shot budget decays unless re-injected. So: a visible budget for allocation quality, a hard cap for the guarantee. You need both.

## Knobs the evidence says not to build

| Tempting knob | What kills it |
|---|---|
| Per-task router / difficulty classifier | One team built and retired one: difficulty can't be read from the prompt — context arrives through tool calls — and switching profiles breaks the prompt cache. |
| Prose profile per task type | In Vercel's evals the skill went uninvoked in most runs and scored no better than baseline; a static instructions file did better. |
| Many rules per profile | Instruction-following benchmarks show sharp drops past a handful of constraints, primacy bias, and decay over turns. |
| "Double-check your work" by default | Triggers over-verification on newer models. Against cheating, one benchmark found hardening the environment cut reward hacking 87.7% (relative) without hurting task success — harden, don't add rules. |
| A config key nothing reads | A loader with no caller misleads anyone who expects the value to change behavior. A harness can only enforce what it mediates. |
| More effort as a quality dial | With the model fixed, LangChain measured the highest effort tier scoring *below* the next one down, via timeouts. |

The convergent minimum across independent designs is small: a reasoning-effort ladder, a few ordered autonomy tiers, and a small fixed tool surface. In Databricks' comparison on their own large codebase, a harness with four tools and no MCP, subagents, or plan mode had the highest pass rate and was about 2× cheaper, because it sent roughly a third of the context per turn. Don't confuse the two axes: style and verbosity parameters are where the rot is; **capability** (tool surface) is where the gains are.

## Honest limits

- **No measured basis exists for fan-out, retry, or max-turn defaults.** Every number in circulation — fan-out 3–5, maxTurns 30, "stop after 5 tries", context-percentage thresholds, line limits — is asserted, not benchmarked.
- **"Just measure it" is harder than it sounds.** Anthropic's own postmortem admits their evals missed degradation users reported. Evaluation criteria also drift once humans see outputs, and judge-agreement figures are not comparable across protocols.
- The small-knob minimum is my inference from convergent designs plus one benchmark, not a published curve.

## The procedure

1. Did a real failure happen? If not, don't add the knob.
2. Does it ask something only the user knows? If the system can infer it, drop it.
3. Are the options genuinely non-dominating? If one always wins, hardcode it.
4. Is the action irreversible? Then it's a human gate, not a knob.
5. Can it be bypassed? Then make it architecture, or omit it.
6. Pick the number by measuring: no limit → distribution → p99 → tune.
7. Plan its deletion. A model upgrade is a good moment to re-audit every knob.

A maintenance metric worth stealing from feature-flag practice: track **flag half-life** (median time from creation to deletion), not knob count. Stale config is a known incident source — one cloud-incident study attributes about a quarter of generative-AI service incidents to configuration, some from one component's config update breaking another.

**When this is wrong:** for hard external constraints (cost ceilings, compliance, irreversible actions) you set the gate before any failure, by design. "Earned by failure" governs tuning knobs, not safety floors.

## Sources

- "Harness evolution of a coding agent across 35 releases" — arXiv:2607.03691.
- "Harness vs. model variance on SWE-bench Verified" — arXiv:2605.23950.
- BATS (visible budget) — arXiv:2511.17006.
- Agreement metrics for LLM judges — arXiv:2606.00093.
- GenAI cloud incident study — arXiv:2504.08865.
- IFScale — arXiv:2507.11538; "AI Agents That Matter" — arXiv:2407.01502.
- Addy Osmani, harness engineering posts; Hamel Husain, evals FAQ; Philipp Schmid, agent harness 2026.
- Anthropic, "Building effective agents", "Effective harnesses for long-running agents", context engineering, task-budget docs.
- OpenAI, "A practical guide to building agents".
- Simon Willison, "The lethal trifecta".
- HumanLayer, advanced context engineering for coding agents.
- Amp, model-dial adoption post; Augment, model-picker post.
- Databricks harness benchmark; LangChain deep-agents harness engineering; Vercel AGENTS.md-vs-skills evals; Manifest LLM-router deprecation.
