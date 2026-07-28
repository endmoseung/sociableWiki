---
type: principle
title: The Planner → Generator → Evaluator Loop
description: Every task, even a one-liner, runs through three separated phases — plan, build, judge — and the agent that writes the code is never the one that signs it off.
tags: [workflow, ai-agents, code-review, self-approval, verification, planning]
date: 2026-07-29
source: original
relates: []
---

# The Planner → Generator → Evaluator Loop

The rule I follow on every task — a one-line copy change, a bug fix, a config tweak, a full feature — is that it passes through three separated phases and none of them can be skipped. Planner, then Generator, then Evaluator. The value isn't the three names; it's the **separation**. The phase that writes the code is not allowed to be the phase that decides the code is done.

Most of this discipline predates AI authors. What changed is who's holding the pen. An agent will produce plausible-but-wrong work cheerfully and at speed, and it will narrate that work as if it were correct. So the parts of the loop that used to be nice-to-have — a written plan, a skeptical read of the diff — became the load-bearing walls. They're what catch the drift between "what I asked for" and "what got built."

## Phase 1 — Planner (always first)

Before any code is written:

1. **Gather context.** Read the relevant files, search prior decisions, understand the actual shape of the problem — not the shape assumed from the one-line request.
2. **Draft a plan.** State what will change, in which files, and what "done" looks like as concrete criteria.
3. **Present it and wait for explicit approval.** Not "I'll go ahead unless you object" — an actual go.
4. **Write no code until approved.**

The plan is not ceremony. It becomes the **contract** the work is judged against in Phase 3. If there's no written plan, the Evaluator has nothing to check against except vibes, and "looks fine" is exactly the failure mode we're trying to avoid. A plan for a small task can be two sentences — but it must be said out loud, because an unstated plan can't be a contract.

## Phase 2 — Generator (only after approval)

Now, and only now, the code gets written:

1. **Implement task-by-task** against the approved plan. If reality forces a deviation, that's a signal to pause and re-plan, not to quietly improvise past the contract.
2. **Run verify before handing off** — build, lint, typecheck at minimum, tests where they exist. A handoff with a red build is not a handoff.

The Generator's job is to satisfy the contract, not to reinterpret it. When the plan turns out to be wrong mid-build — and it sometimes does — the honest move is to go back to Phase 1 with what you learned, not to ship something the Planner never agreed to.

## Phase 3 — Evaluator (always last, before any commit or "done" claim)

Before a commit, and before the word "done" is used at all:

1. **Read the diff as a skeptic.** Assume something is wrong and go find it. Read it the way you'd read a stranger's PR you were told to be tough on.
2. **Check each plan criterion** from Phase 1, one by one.
3. **Require evidence for any failure.** "I think it works" is not evidence; the passing verify output, the exercised path, the reproduced-then-fixed bug is.
4. **Permit the commit only when every criterion passes.**

## The one thing that makes it work: anti-self-approval

The core mechanic is that **the author does not grade its own homework.** A model that just wrote 200 lines is the worst possible judge of those 200 lines — it's primed to see what it intended, not what it typed. Splitting the Evaluator out, whether as a separate pass with a deliberately skeptical stance or a genuinely separate agent, is what breaks that bias. Same reason we don't let a developer approve their own PR: not distrust of the person, structural avoidance of the blind spot.

## When "just do it quickly" is the trap

The strongest pull to skip the loop shows up on exactly the tasks where skipping costs the most. "It's a one-liner, just change it." That one-liner is a config flag that flips behavior in production, or a boundary condition, or an auth check. The size of the diff is uncorrelated with the size of the blast radius. Small, urgent, and obvious is the profile of the change that quietly breaks things — so it's the profile that most needs the plan named and the diff read, not the one that earns an exemption.

## When lighter is genuinely OK

A true throwaway spike — code you will delete, on a branch nobody merges, to answer a question — can compress the loop. You don't need a formal approval gate to learn whether an API even returns what you think it does.

But *compress* is not *skip*. Even on a spike I still name the plan ("I'm going to hit this endpoint and print the shape") and name the check ("did it return what I expected?") out loud. The moment that spike's output starts influencing real code, it's no longer a spike, and the full loop is back on. The boundary isn't task size; it's whether anyone will ever depend on the result.

## The one-line version

Plan it, build it, judge it — as three separate acts, with the judge distinct from the builder, and never grant an exemption to the change that "obviously doesn't need one." That's the change that needs one most.
