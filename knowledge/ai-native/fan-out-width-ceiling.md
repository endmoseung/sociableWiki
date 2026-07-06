---
type: deep-dive
title: "Fan-out width has two ceilings — cost is linear, synthesis fidelity is the one that sets 3–5"
description: "The everyday 'spawn 3–5 subagents' rule is set by the lead's ability to reconcile divergent returns, not by token cost — and it only binds when the returns must be merged into one answer."
tags: [subagent, fan-out, orchestration, multi-agent, synthesis, cost]
date: 2026-06-25
source: "Synthesis of Anthropic's multi-agent research write-up + practitioner reports; original framing"
relates: []
---

## TL;DR

Every fan-out cost note I've seen prices the **money** side of width: the per-spawn
floor, the per-topology multiplier, the idle wall-clock, and where returned context
piles up in the orchestrator. All of them say the same thing — fan-out gets **more
expensive** as width grows. None of them answers the question you actually face when
you type `parallel(...)`:

> *"Why does adding the 6th, 8th, 20th parallel worker stop **improving the answer** —
> even if I were happy to pay for it?"*

This is that axis. **A fan-out has two independent ceilings:**

| Ceiling | What binds | Shape | Set by |
|---|---|---|---|
| **Cost** | tokens / quota | ~linear in worker count (6 workers ≈ 6× a single session) | rate limits + budget |
| **Synthesis fidelity** | answer quality | degrades **super-linearly** past a small N | the lead's ability to reconcile divergent returns |

The everyday **"3–5 subagents"** number is the **fidelity** ceiling, **not** the cost
one. You hit it long before you hit your token budget. And the fork that decides
whether it binds at all is one people rarely write down: **are the returns
independent, or must they be reconciled into one answer?**

---

## The two ceilings, and why they bind in different regimes

**Cost is the boring ceiling.** It's roughly linear and you can see it coming.
Anthropic's own multi-agent numbers: *"agents typically use about 4× more tokens than
chat interactions, and multi-agent systems use about 15× more tokens than chats."*
Practitioner reports settle the per-worker slope at ~linear — *"6 sub-agents cost ~6×
a single session's tokens."* If cost were the only ceiling, the rule would be "spawn as
many as your budget and rate limit allow," and a fan-out-to-hundreds capability would
simply mean "spend more." For some tasks it does — see the fork below.

**Fidelity is the ceiling that actually sets 3–5.** The lead doesn't just *pay* for N
returns — it has to **read, deconflict, and compress N divergent summaries into one
coherent answer**, and that job gets *harder*, not just pricier, as N grows. Two
mechanical reasons this degrades super-linearly:

1. **The lead runs workers synchronously and cannot steer them.** Anthropic, verbatim:
   *"Currently, our lead agents execute subagents synchronously, waiting for each set of
   subagents to complete before proceeding"* — and the consequence — *"the lead agent
   can't steer subagents, subagents can't coordinate, and the entire system can be
   blocked while waiting for a single subagent to finish."* So the lead commits to the
   full fan-out *up front*, blind, and only sees the divergence at merge time. More
   workers = more chance two of them went down incompatible paths the lead now has to
   reconcile after the fact, with no chance to have corrected either mid-flight.

2. **Reconciliation is N-to-1 compression under a fixed lead budget.** Each worker
   *"condens[es] the most important tokens for the lead research agent."* That's the
   feature — but the lead's own window and attention are finite. Past a handful of
   returns, the lead is doing lossy compression *of already-lossy summaries*, and the
   failure mode is **hallucinated consensus** — smoothing genuine disagreement between
   workers into a false agreement. Adding the 8th worker doesn't add 1/8 more signal; it
   adds one more thing the lead must not drop, on a budget that didn't grow.

So: cost says "you *can* run 20." Fidelity says "the lead can't faithfully *merge* 20."
The smaller number wins, and for reconciled tasks it's ~3–5 (coding fan-outs stretch to
~3–8 before rate limits and merge cost dominate — practitioner range, not measured).

---

## The load-bearing fork: independent returns vs. reconciled returns

The "3–5" ceiling **only binds when the returns must be merged into one answer.** This
is the distinction that decides whether a hundreds-of-agents capability applies to
*your* task:

| | **Reconciled returns** | **Independent returns** |
|---|---|---|
| Lead's job at merge | weave N divergent findings into ONE coherent answer | route N self-contained results to N slots; no cross-merge |
| Failure mode of width | hallucinated consensus, dropped dissent, lossy re-compression | none from width — each result stands alone |
| Width ceiling | **fidelity-bound, ~3–5** | **cost/rate-limit-bound, tens–hundreds** |
| Example | "research X across sources and tell me the answer"; "review this diff across 5 lenses → one verdict" | "run this benchmark across 80 model×prompt combos"; "transform each of 200 files independently" |
| Does a wider spawn cap lift the ceiling? | **No** — it lifts *spawn*, not *synthesis* | **Yes** — this is exactly its sweet spot |

Anthropic states the boundary directly: multi-agent *"excels at valuable tasks that
involve heavy parallelization,"* but *"some domains that require all agents to share the
same context or involve many dependencies between agents are not a good fit."* Read that
one layer deeper: the good-fit case is **independent returns**; the bad-fit case is
**tight reconciliation**. Scaling fan-out to hundreds (e.g. an 80-combo benchmark sweep)
is the *independent-returns* column — every result lands in its own cell, nothing gets
merged, so there's no fidelity ceiling to hit. It does **not** mean you should fan a
*reconciled* question (one answer expected) across 100 workers; the lead still can't
merge 100 divergent summaries faithfully.

---

## Why this isn't the same as the cost story

Don't collapse this into the cost axes — it's the **quality** axis, orthogonal to all of
them:

- **Topology cost** prices the *shape* (how much extra you pay for a given fan-out
  structure). This note is "at what width does the answer stop *improving*" — a different
  curve that bends down even when you're glad to pay.
- **Context accumulation** is the *closest* neighbor — the orchestrator's context grows
  monotonically as returns pile up, which is why distributing work across a *team* gets
  cheaper at scale. But that's still a **cost** argument (accumulated tokens re-billed
  each turn). This is the **fidelity** argument: even with infinite context, the lead's
  *reconciliation quality* degrades. Context-accumulation says "wide fan-out is
  expensive"; this says "wide *reconciled* fan-out is also *worse*."
- **Write-side merge** (parallel git branches that don't compose) is a different artifact.
  This is the **read-side** merge (summaries that don't reconcile). Same word "merge,"
  different object: code vs. findings.
- **Occupancy** prices idle *time*. This prices reconciliation *fidelity*. A worker can
  finish instantly and still cost the lead at merge.

## How to apply

1. **Before choosing fan-out width, classify the returns first.** Independent (route to
   slots, no merge) → width is cost-bound, fan wide. Reconciled (one answer expected) →
   width is fidelity-bound, **cap at 3–5** regardless of budget. This classification, not
   the token budget, is the first decision.
2. **If you need both width AND a merged answer, add a synthesis tier.** Don't ask one
   lead to reconcile 20 returns. Fan 20 → reduce in groups of ~4 via intermediate
   synthesizers → reconcile the ~5 group-summaries. You're trading the fidelity ceiling
   for one extra round-trip, not paying it.
3. **Structure returns so the lead can't smooth over dissent.** Typed/structured returns
   (each worker emits `{verdict, evidence, disagreements}`) make reconciliation mechanical
   instead of prose-merge — the documented guard against hallucinated consensus.
4. **Don't read "hundreds of agents" as "the 3–5 rule is dead."** It's dead *only* for the
   independent-returns column. For any task that ends in one merged answer, 3–5 still
   holds — the spawn ceiling moved, the synthesis ceiling didn't.

## Sources

- Anthropic Engineering, *How we built our multi-agent research system* — first-party:
  "3–5 subagents in parallel," "execute subagents synchronously … can't steer subagents,"
  "4× more tokens than chat … 15× more tokens than chats," "domains that require all
  agents to share the same context … are not a good fit," "condensing the most important
  tokens for the lead." (first-party on the multipliers, qualitative on the rest)
- Practitioner guides (CloudZero, Tembo, aibuilderclub, ksred, 2026): "~6 sub-agents ≈ 6×
  a single session," "3–8 sweet spot for coding, then rate limits queue them," "4
  sub-agents = best ROI." (estimates, not measured)

**Evidence grade: mixed** — the token multipliers and synchronous-execution caveat are
first-party Anthropic; the "3–5 / 3–8" width numbers and the per-worker linear cost slope
are practitioner estimates.
