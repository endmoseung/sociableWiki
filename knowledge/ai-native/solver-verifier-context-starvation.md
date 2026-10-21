---
type: deep-dive
title: "Who Solves, Who Verifies: Starve the Verifier of the Solver's Context"
description: "Main-solves/subagents-verify beats the reverse, but only because the verifier does not hold the answer as its own thought — hand a verifier the generation context and it reviews worse than plain self-review."
tags: [verification, subagents, self-correction, llm-as-judge, orchestration, context]
date: 2026-08-08
source: "External-derived — synthesizes papers on self-correction, verification, and multi-agent topologies (arXiv); see Sources."
relates: [ai-native/fork-vs-fresh-subagent, ai-native/best-of-n-coding-agents, ai-native/harness-is-the-eval-unit, ai-native/settled-answers-disables-self-review, dev-process/completion-means-verification-output]
---

# Who Solves, Who Verifies: Starve the Verifier of the Solver's Context

When I orchestrate coding agents I keep facing the same layout choice:

- **Layout A** — several subagents each produce a solution, and the main agent picks and checks.
- **Layout B** — the main agent produces one solution, and subagents verify it.

The literature points to B. But "main vs. sub" is not the variable that matters. The variable is **whether the judge holds the answer as its own thought.** A judge that produced the answer, or that inherited the reasoning that produced it, is a weak judge no matter which process it runs in. The part I did not expect: done naively, B loses too.

## Why self-review is structurally weak

One study took a wrong chain of reasoning, left it byte-identical, and only moved where it sat: inside the model's own thought block versus inside a memory block or a user message. Explicit error-flagging went up by roughly 23 to 93 percentage points once the same text was framed as external (arXiv:2606.05976). The authors call this *addressability*: an error inside your own stream of thought has no referent to point at, while labelled external content does. Detection ability is intact; the handle to act on it is missing.

The older self-correction results line up with that:

- GPT-4's intrinsic self-correction on GSM8K went from 95.5% to 89.0%. It flipped slightly more right answers to wrong than wrong to right. Given an external correctness signal, the sign reversed (Huang et al., arXiv:2310.01798).
- In code repair, the bottleneck was *finding* the bug, not fixing it: swapping the model's self-feedback for human feedback raised passing programs by about 57% with the same repairer and the same code (Olausson et al., arXiv:2306.09896).
- Self-Correction Bench reported that most of a model's own errors survive its own check but get caught when the same content is presented as external.

So Layout A has a hidden flaw. The moment the main agent decides which subagent result to adopt, it is already a reviewer, and its own preferences ride along into that choice.

## Layout A has a ceiling set by the judge, not the fan-out

Generation scales; selection does not. With repeated sampling, coverage (some sample is correct) climbed to 95.3% at 10,000 samples, while majority vote and best-of-N plateaued around 40% after roughly 100 samples (Brown et al., arXiv:2407.21787). Adding solvers past a handful mostly enlarges a pile the judge cannot sort.

And a judge that resembles the solver gains less. Across 37 models and 9 benchmarks, cross-family verification beat same-family, which beat self-verification. Self-verification false positives *rose* as models got larger (arXiv:2512.02304). "The main agent is stronger, so let it judge" does not hold.

## The finding that changes how I spawn reviewers

A study ran Claude Opus 4.6 through Claude Code's Agent tool on 30 artifacts with 150 injected errors, 360 reviews in total (arXiv:2603.12123):

| Review condition | F1 |
|---|---|
| Fresh session, artifact only | **28.6%** |
| Same-session self-review | 24.6% |
| **Subagent that inherited the generation prompt** | **23.8%** |
| Same session, reviewed twice | 21.7% |

A subagent that knows how the artifact was produced did *worse* than plain self-review. Spawning a reviewer is not the active ingredient; **context absence** is. It is also cheaper: the fresh reviewer used around 5K tokens against roughly 50K for the producing session, because it does not re-pay accumulated history.

An honest caveat the authors acknowledge: the self-review runs were in Korean and the fresh runs in English, so part of the 28.6-vs-24.6 gap may be a language effect. The 23.8-vs-28.6 comparison is English on both sides, and the addressability work supports the direction independently.

The design rule I took from this is not "spawn a subagent." It is **"starve the verifier of the production context."**

## Should the verifier see the reasoning trace?

It depends on the judge, and the effect is persuasion, not information. On Natural Questions, showing the reasoning dropped a small judge (Qwen3-8B) from 58.2% to 33.2% accuracy, left GPT-4o flat, and lifted Claude Sonnet 4.5 from 75.8% to 84.0% (arXiv:2604.06756). Irrelevant and counterfactual reasoning also moved the verdicts, and a trace placed before the answer hurt far more than one placed after it — the fingerprint of anchoring. Separately, relabelling a source as "expert" shifted verdicts by about 18%, and the judge never mentioned the label; it rationalized on content quality (arXiv:2509.26072).

The axis that matters is **order of commitment**. Having the verifier write down its own expectation *before* reading the trace raised failure detection by about 25 points (arXiv:2507.11662). If I pass a trace at all, it goes in after that step, as a lead to investigate rather than a basis for the verdict.

## When verification goes net-negative

- **Homogeneous debate.** Adding debate to a small model scored below its own zero-shot, and in a control, irrelevant noise beat genuine critique (arXiv:2605.00914). What worked was perturbation, not critique.
- **Critique that never routes back.** In one math study, a reviewer with 0.861 precision lost to one with 0.644. The low-precision reviewer's critiques were adopted 93.5% of the time against 33.6%, and the final pass rate was higher (arXiv:2607.15388). The binding constraint is whether the critique gets back into the solver's context and changes the next output. Delivering it as peer context instead of an authoritative verdict tripled uptake.
- **Easy tasks.** When single-pass success is already above roughly 0.9, the sources I read agreed the gain is near zero while token cost multiplies.

## When Layout A wins

Read-only, decomposable work with no inter-agent dependencies, where **context volume is the bottleneck** — research being the typical case. Anthropic's write-up on its multi-agent research system reported a 90.2% gain there and explicitly said most coding tasks parallelize less well. A controlled study found a single agent matched or beat six multi-agent topologies at fixed thinking budget except at the smallest budget. Masking 70% of the single agent's context flipped the result (Tran & Kiela, arXiv:2604.02460). Multi-agent wins are a context-degradation phenomenon: if one agent can use its context well, extra topology costs more than it returns.

## The rules I run

1. **Writing stays in the main thread.** Parallel readers are safe; parallel writers make conflicting implicit choices.
2. **Verification goes to a subagent with the artifact only.** No main reasoning trace, no spec or plan, and no self-assessment or confidence language.
3. **The verifier commits its expectation before it sees any trace.**
4. **Findings route back to the main context, and the main agent fixes them.**
5. **Two retries at most.** Beyond that, loops saturate or oscillate.

Before adding a verification layer at all, two checks: if single-pass success already exceeds about 0.9, skip it. If solving costs less than about 2.5 times what verifying costs, just make more attempts. Measure that ratio on 20 to 30 samples of your own tasks. The figure comes from search tasks; for coding it is unmeasured.

## When this is wrong

- **No-oracle tasks.** When correctness cannot be checked mechanically — planning, design, prose — LLM judges agree with humans far less than on objective tasks, and Layout B becomes expensive noise. I use verification there only to hold the floor (facts, consistency), not to raise the ceiling.
- **The direct experiment does not exist.** I found no paper comparing one solver with N verifiers against N solvers with one verifier at a fixed token budget. Everything above is triangulation, not a direct measurement.
- **Possibly a transitional technique.** Some results suggest critique value drops as the generator improves, independent of reviewer strength.

## Sources

- [Addressability of errors in own thought vs. external content (arXiv:2606.05976)](https://arxiv.org/abs/2606.05976)
- [Huang et al., intrinsic self-correction on reasoning, ICLR 2024 (arXiv:2310.01798)](https://arxiv.org/abs/2310.01798)
- [Olausson et al., self-repair in code generation, ICLR 2024 (arXiv:2306.09896)](https://arxiv.org/abs/2306.09896)
- Self-Correction Bench (COLM 2026)
- [Brown et al., repeated sampling — coverage vs. selection (arXiv:2407.21787)](https://arxiv.org/abs/2407.21787)
- [Solver–verifier similarity across 37 models and 9 benchmarks (arXiv:2512.02304)](https://arxiv.org/abs/2512.02304)
- [Fresh-context vs. self-review with Claude Code subagents (arXiv:2603.12123)](https://arxiv.org/abs/2603.12123)
- [Showing reasoning traces to LLM judges, ACL 2026 (arXiv:2604.06756)](https://arxiv.org/html/2604.06756)
- [Silent Judge — source-label bias in LLM judges (arXiv:2509.26072)](https://arxiv.org/abs/2509.26072)
- [SGV — verifier commits expectations before reading the trace (arXiv:2507.11662)](https://arxiv.org/abs/2507.11662)
- [Debate on small homogeneous models; noise vs. critique control (arXiv:2605.00914)](https://arxiv.org/abs/2605.00914)
- [Reviewer precision vs. critique uptake (arXiv:2607.15388)](https://arxiv.org/abs/2607.15388)
- [Tran & Kiela, single agent vs. multi-agent at fixed thinking budget (arXiv:2604.02460)](https://arxiv.org/abs/2604.02460)
- Anthropic engineering blog — multi-agent research system write-up
