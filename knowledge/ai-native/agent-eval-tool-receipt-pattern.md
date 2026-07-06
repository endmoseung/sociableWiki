---
type: deep-dive
title: The Tool Receipt Pattern and Why Rubric Quality Is the Eval Bottleneck
description: In agent evaluation, the limiting factor is rubric design, not judge model strength — and the sharpest hallucination catcher is verifying that claimed tool calls actually ran.
tags: [agent-eval, llm-as-judge, rubric-design, tool-receipts, trajectory-evaluation]
date: 2026-06-13
source: "Synthesis of two 2026 practitioner writeups (Vinod Rane; Adnan Masood) plus HealthBench — see Sources"
relates: []
---

# The Tool Receipt Pattern and Why Rubric Quality Is the Eval Bottleneck

Two independent practitioner writeups from April–May 2026 land on the same two claims. First: the limiting factor in LLM-as-judge evaluation is the *rubric*, not the judge model. Second: the most effective hallucination catcher in agentic systems is the **tool receipt pattern** — proving that the tool calls an agent claims it made actually executed.

Both are worth internalizing because they redirect effort. The instinct when evals feel noisy is to reach for a bigger judge model. That's usually the wrong knob.

## Finding 1: Rubric quality beats judge model capability

The sharpest version of this claim:

> Weaker judges operating under well-designed rubrics outperform stronger judges with poor rubrics.

The evidence that makes it concrete: the HealthBench dataset paired physician-authored rubrics — 48,562 unique criteria across 5,000 clinical conversations — with LLM judges, and the judges reached physician-level agreement. Not because the models were smarter, but because the rubrics were specific enough to remove ambiguity. The judge had almost nothing left to guess at.

I take four rules from this for writing rubrics:

- **Specificity** — score measurable behaviors, not vague labels. "The response must cite the relevant statute by number" beats "the response is legally accurate."
- **Measurability** — each criterion must be objectively observable from the text alone, without needing domain expertise to assess.
- **Independence** — no overlapping criteria. If two criteria both fire on the same error, you're penalizing it twice and distorting the score.
- **Anchor examples** — give concrete examples of what a 1, a 3, and a 5 look like on each criterion. This is what prevents central-tendency bias, where every score quietly drifts toward the middle.

The practical takeaway: **before upgrading your judge model, audit your rubric's specificity.** In almost every case the rubric is the bottleneck, and a better model won't fix an ambiguous rubric — it'll just be confidently inconsistent instead of weakly inconsistent.

## Finding 2: The tool receipt pattern

The single most effective hallucination catcher I know of in agentic systems is deceptively simple: **verify that claimed tool executions actually ran.**

The failure mode it targets is different from ordinary factual hallucination. An agent can report "I ran `search_database()` and found X" when no such call appears in the execution log. This is a *process* hallucination — the claimed workflow never happened — and semantic evaluation of the output can't catch it, because the output text reads perfectly plausibly.

The pattern:

1. Instrument every tool call to emit a structured execution receipt: timestamp, input, output, status.
2. After each agent turn, compare the agent's *claimed* tool use against the *actual* execution log.
3. Flag any claimed tool call with no matching receipt.

This catches fabricated results at the source, before they propagate downstream into later reasoning. It's cheap, deterministic, and it plugs a hole that no amount of output-quality scoring will find.

## The 4-tier eval pyramid

A layering that keeps cost sane while still catching the failures that matter:

| Tier | Method | Coverage | When to use |
|------|--------|----------|-------------|
| 1 | Deterministic checks (regex, schema validation, tool receipts) | 100% | Always — fast, cheap, catches structural failures |
| 2 | Lightweight fine-tuned classifiers | ~60–80% | High-frequency eval where an LLM judge is too expensive per call |
| 3 | Full LLM judge | 10–20% sampling | Quality, nuance, rubric scoring |
| 4 | Human annotation | 2–5% targeted | High-uncertainty cases, calibration set, validating a new rubric |

Two numbers I'd hold onto:

- **Data split: 60% happy-path, 40% adversarial.** Most teams over-index on happy-path and only discover the adversarial failures in production.
- **Judge deployment gate: Krippendorff's α ≥ 0.80** before trusting a judge in production (0.70 is the floor). Calibrate it against 200–500 human-verified examples first.

## Biases that quietly degrade LLM judges

Three systematic biases, each with a cheap detection and a mitigation:

| Bias | Detection | Mitigation |
|------|-----------|------------|
| Position bias | Present the same pair twice with the order swapped; count verdict flips | Swap-and-average — run both orderings, average the scores |
| Verbosity bias | Longer responses score higher independent of quality | Length-controlled metrics; add a conciseness criterion to the rubric |
| Self-preference bias | A model judge favors outputs from its own family | Cross-evaluate with a different model family |

The most robust production setup is a panel of three diverse judges voting by majority — the diversity is what cancels the biases rather than averaging them.

## Evaluate trajectories, not just outcomes

A principle that sits underneath all of the above: **score the trajectory, not only the final answer.**

An agent that reaches the right answer through a fabricated reasoning chain or by skipping steps is *more* dangerous than one that fails cleanly, because it looks correct and will fail unpredictably later. Trajectory scoring assigns dense, per-step rewards:

- Step correctness
- Tool selection accuracy
- Argument recall (no hallucinated arguments)
- Sequencing accuracy (Kendall's tau τ ≥ 0.85)
- Reasoning coherence

**Counterfactual credit assignment** is the technique that makes this actionable: ask "if the agent had decided differently at step X, would the final outcome change?" That separates the load-bearing steps from the incidental ones and tells you where to focus. In practitioner reports, an LLM judge doing this attribution reaches roughly 70–75% agreement with human raters — useful, not authoritative, so treat it as a triage signal rather than ground truth.

## Sources

- Vinod Rane (Senior SWE, BBC), Medium, May 2026 — tool receipt pattern, 4-tier pyramid, trajectory scoring (practitioner writeup, production experience, not a controlled study).
- Adnan Masood, PhD, Medium, April 2026 — rubric quality, judge biases, citing the Prometheus line of research (practitioner writeup citing the Prometheus paper).
- HealthBench (OpenAI, 2026) — physician-authored rubrics reaching physician-level judge agreement (benchmark, cited via Masood, not independently reproduced here).
- Berkeley RDI, April 2026 — benchmark contamination findings on SWE-bench / WebArena (referenced).
