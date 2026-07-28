---
type: principle
title: "\"Done\" means you ran the check and pasted the output"
description: "You may only claim a task is complete after running its verification command and citing the actual output — no output, no done."
tags: [verification, completion-gate, agent-discipline, evidence, definition-of-done]
date: 2026-07-29
source: original
---

# "Done" means you ran the check and pasted the output

The rule I follow is narrow and non-negotiable: **I may only say a task is done after I have actually run its verification command — build, test, gate — and cited the output.** No output, no done. If I can't show the green, the task is not finished; it is *believed* finished, which is a different and much weaker state.

The point of writing it this way is to convert a judgment call into a mechanical trigger. "Looks complete" is a feeling, and feelings scale with how careful, rested, or rushed you are at that moment. "Here is the passing test output" is a fact that reads the same regardless of who is looking or how confident they felt. When you're building with an AI coding agent, this matters even more: the agent has no fatigue signal and no shame, so it will happily announce success on a wiring change it never ran. A gate phrased as a *feeling* ("does this look right?") gives it nothing to fail against. A gate phrased as an *artifact* ("paste the exit-0 output") does.

## The failure mode this kills

There is one specific bad outcome this rule exists to prevent: **declaring success on work that was never actually run.** Concretely —

- The test that would have failed, because the claim was never executed against it.
- The lint or type gate that would have blocked, but nobody invoked it.
- The "it handles the empty cart" claim that was reasoned about but never exercised.

In every case the work *looks* finished. The diff is plausible, the reasoning is coherent, the change compiles in your head. And none of that is evidence, because none of it touched reality. A tired human ships this the same way an over-eager agent does — the mechanism is identical: confidence stood in for a check.

## Why the artifact, not the confidence

"Done" is a claim about the state of the world: *this code passes, this behavior holds.* A claim about reality has to be backed by evidence *from* reality — the output of a process that actually ran against the actual code. Confidence is evidence about your internal state, not about the code's. The two are routinely uncorrelated; the whole reason the rule is mechanical is that the correlation is exactly what you can't trust in the moment you most want to.

So the gate is not "are you sure?" It is "run it and show me." The distance between those two questions is the entire value of the rule.

## It applies to non-code too

The instinct is to read this as a testing rule, but it's broader. The general form is: **whatever the acceptance criteria are, re-derive them against the actual artifact before claiming they hold.**

- For code, the artifact is the build / lint / test / type-check output.
- For a written document, it's re-reading the finished text against its stated acceptance criteria, line by line — not remembering that you *intended* to satisfy them.
- For a config or infra change, it's the command that observes the new state (a health check, a status query), not the fact that you edited the file.

The common shape is: an external observation of the finished thing, replacing an internal memory of your intent for it.

## What to do when the check fails

The rule has a second half that's easy to drop, and dropping it quietly reintroduces the failure mode:

1. **If verification fails, say so plainly — and paste the failing output.** A red result reported honestly is worth more than a green feeling. It's the actual state, and it's actionable.
2. **If you skipped a step, say that you skipped it.** "I did not run the integration suite" is a legitimate status. "Done" while omitting that is a lie by rounding.
3. **Never launder a green feeling into a "done."** The moment you're tempted to write "done" without the output in front of you is exactly the moment the rule is protecting you from. That temptation is the signal, not the exception.

## When this is the wrong amount of rigor

This is a floor for *completion claims*, not a tax on every keystroke. It does not mean run the full suite after every character — that's a cadence question, and over-running a slow gate has real cost. It means: at the moment you assert the work is finished, that assertion carries output. Mid-flight, iterate however you like. The gate fires at the boundary where you hand the work off as done — to a reviewer, to the next task, to yourself tomorrow.

It also assumes the verification is meaningful. A check that passes vacuously (a test suite with no assertions, a build that skips the changed module) satisfies the letter and defeats the purpose. "Paste the output" is the mechanism; "the output actually exercises the claim" is the thing the mechanism is standing in for. If the two come apart, fix the check — don't celebrate the green.

## TL;DR

- You may only say **done** after running the verification command (build / test / gate) and **citing its output**. No output, no done.
- This converts a **feeling** ("looks complete") into a **mechanical trigger** that doesn't depend on how careful you feel — which is exactly what an AI agent, or a tired human, can't be trusted to supply on its own.
- The failure mode it kills: **declaring success on work that was never run** — a test that would fail, a gate that would block, a claim that was never exercised.
- Applies to **non-code** too: re-read the artifact against its acceptance criteria instead of remembering your intent for it.
- Second half of the rule: if verification **fails, say so with the output**; if you **skipped** a step, say so; never **launder a green feeling into a done**.
