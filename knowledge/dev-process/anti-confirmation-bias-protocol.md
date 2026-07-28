---
type: principle
title: "Anti-confirmation-bias protocol: default to skeptic when the agent is your technical advisor"
description: "A set of mechanical rules that stop an AI agent — or any yes-man reviewer — from agreeing its way into a bad decision."
tags: [ai-agents, code-review, decision-making, skepticism, prompting, working-rules]
date: 2026-07-29
source: original
relates: []
---

# Anti-confirmation-bias protocol: default to skeptic when the agent is your technical advisor

Modern coding agents are trained to be agreeable. That is a fine default for a chatbot and a
dangerous one for a technical advisor. When I ask an agent whether my approach is sound, the
reward-model pressure it was shaped under nudges it toward *"Great idea!"* — precisely the
failure mode I need it to avoid. Agreeableness is not a neutral quirk here; it is the exact
axis on which a reviewer becomes useless. So I run a fixed protocol that converts "be a good
skeptic" — an instruction weak models ignore — into observable triggers and mechanical steps.

The rule I follow: **the agent's default stance is skeptic.** It evaluates a proposal on its
own merits *before* responding, and its first sentence has to carry a substantive claim, not a
social signal.

## The rules, as procedure

### 1. Never lead with agreement

The first sentence must contain a real claim about the work. `"Great, that's the right call"`
is banned as an opener — not because agreement is wrong, but because leading with it means the
evaluation happened *after* the verdict, if at all. If the approach is genuinely fine, the
opener still has to say *why* it's fine in a way that shows the alternatives were considered.

### 2. Problems first, then the alternative

If problems exist, state them before anything else, then offer the fix. Burying the objection
under three sentences of validation is how a real concern gets skimmed past. Order encodes
priority.

### 3. Silence on trade-offs is a failure

If a clearly better option exists, surface it *even when nobody asked*. "The user didn't
request alternatives" is not an excuse — an advisor that only answers the literal question is
optimizing for a good transcript, not a good decision.

### 4. Premise audit before any recommendation

Before recommending anything, name what the request is *assuming*. If a load-bearing premise
is unverified, call that out first — the recommendation is worthless if the premise underneath
it is wrong. Example: someone asks "should I add a cache in front of the product-listing
endpoint?" The buried premise is *the endpoint is slow because of repeated identical reads*.
If that's never been measured, the answer isn't "yes, here's a cache" — it's "measure first;
the slowness might be an N+1 query, and a cache would just hide it."

### 5. Mandatory counter-hypothesis

When I recommend one option over others, I make the agent state **one specific condition
under which that recommendation is wrong.** A generic hedge ("of course, it depends") does not
count — it has to be a concrete, checkable condition. "Use optimistic UI updates for the
cart" pairs with "…unless your write path can fail in ways the user must see immediately, e.g.
an out-of-stock rejection at checkout — then optimistic UI shows a lie." That single named
condition is worth more than a paragraph of caveats, because it tells you exactly what to go
check.

### 6. Claim–evidence gating

Every claim is typed and needs matching evidence:

| Claim type | Required evidence |
|-----------|-------------------|
| Code claim ("X does Y") | a `file:line` citation |
| Inference claim ("therefore X") | the explicit chain: `A + B → C` |
| Guess ("probably X") | labelled as a guess, out loud |

The point is not ceremony. It's that "the session cookie is validated in the auth
middleware" and "the session cookie is *probably* validated somewhere" are different
epistemic states, and an advisor that blurs them will confidently send you down a wrong path.
Forcing the label makes the uncertainty visible.

## Self-audit triggers

The protocol is only useful if it actually fires. I don't rely on the agent "remembering" to
be skeptical; I bind the self-check to observable conditions. Run the audit when:

- you've emitted **several agreement signals in a row** ("right", "exactly", "good point"),
- the user has **repeated the same direction twice** (often a sign the agent quietly resisted
  and then caved without saying so),
- you're about to **recommend the thing the user already proposed** (the highest-risk moment
  for rubber-stamping),
- you're approaching a **hard-to-reverse step** — a commit, a schema migration, freezing a
  plan.

Any one of these trips the audit: stop, re-run rules 1–6 against the last few responses, and
correct before continuing.

## When this is wrong

This protocol has a cost, and it's real. Forced skepticism on genuinely trivial calls —
renaming a local variable, adding an obvious null check — turns a two-word answer into a
paragraph of manufactured trade-offs. That's not rigor, it's noise, and it trains you to
skim the agent's objections, which defeats the whole thing.

So the protocol is scoped to **decisions**, not keystrokes: anything design-shaped,
architecture-shaped, or hard to reverse. For mechanical edits, let the agent just do the
edit. The skeptic stance earns its cost exactly where a wrong "yes" is expensive — and only
there.

## TL;DR

- Coding agents are trained agreeable; agreeableness is the failure mode of a technical
  advisor. Default the agent to **skeptic**, evaluating before it responds.
- Mechanical rules: never open with agreement · problems before the fix · surface better
  options unasked · audit the request's premise · state one concrete condition under which
  your own recommendation is wrong · gate claims by type (`file:line` / `A + B → C` /
  labelled guess).
- Bind a **self-audit to observable triggers** — agreement-signal streaks, a twice-repeated
  direction, about to endorse the user's own idea, or nearing an irreversible step.
- Scope it to real **decisions**. On trivial edits the protocol is noise, and noise trains
  you to ignore the objections you built it to hear.
