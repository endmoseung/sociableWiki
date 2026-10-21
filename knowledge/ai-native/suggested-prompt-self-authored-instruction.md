---
type: principle
title: "A suggested next prompt is the agent writing its own instruction"
description: "Accepting the agent's suggested next prompt means the agent authored the instruction it will execute — fine for mechanical steps, wrong at a verification seam where the human is supposed to be the outside check."
tags: [claude-code, human-in-the-loop, verification, prompting, self-approval]
date: 2026-10-11
source: "External-derived — an October 2026 blog post on Claude Code's suggested prompts and its Hacker News discussion; see Sources."
relates: [ai-native/symptom-not-diagnosis-prompting, dev-process/planner-generator-evaluator-loop, ai-native/end-of-run-report-as-decision-queue, ai-native/side-question-read-without-write]
---

# A suggested next prompt is the agent writing its own instruction

## The feature

When a turn finishes, Claude Code pre-fills the prompt box with a greyed-out suggestion for your next message: "run the tests", "commit this", "can you verify it works". One key accepts it; typing over it discards it. It can be turned off in settings.

In October 2026 a widely discussed blog post argued the feature is really a cheap labeling channel for training (accept as a positive label, edit as a preference pair). An engineer on the Claude Code team replied that this is not the case: suggestions exist to keep people in flow and to remind returning users of a next step, and only the acceptance rate is tracked. I treat the data-collection reading as refuted. The useful lesson is on the user's side anyway.

## What accepting it actually does

A suggestion is **the model's prediction of your next instruction, built from its own view of the session**. When you accept it, the next instruction was written by the same agent that will carry it out.

The chain of reasoning:

1. In an interactive loop, the human turn is the only point where an outside view enters: scope, priorities, "that's not what I meant".
2. A suggested prompt comes from the agent's model of the task. Accepting it adds no outside view. The loop quietly becomes agent → agent.
3. People in the discussion reported that the pull is real. Several said the suggestion interrupts them and they sometimes just go with it, which makes it less a prediction than something closer to a self-fulfilling one.
4. So at a **verification seam** (accept or reject a fix, confirm scope, decide "done"), an accepted suggestion turns a human gate into self-approval. It is the same failure as agent-written tests grading agent-written code.

This mirrors the advice to hand an agent the symptom rather than your diagnosis. There, the human's guess anchors the agent and skips its search. Here, the agent's guess anchors the human and skips the human's judgment.

## Rule of thumb

| The next turn is… | Accept the suggestion? | Why |
|---|---|---|
| Mechanical and already decided (run tests, format, commit after a green check) | Fine | No judgment is being handed over |
| A verification ask ("verify it", "looks done?") | Rewrite it | Say *what* to verify and the evidence you want (`file:line`, command output) |
| Scope or direction (next feature, which bug next) | Write your own | Your outside view is the whole value of this turn |
| Picking up an old session | Read it as a reminder, not a plan | It reflects the agent's view of where it stopped, which may be stale |

The cheapest habit I have found: when a suggestion is close but not quite right, **edit it into a sharper instruction** instead of accepting or ignoring it. "Run the tests" becomes "run only the auth tests; the full suite takes ten minutes". The edit is where my knowledge of the project gets in.

If the ghost text breaks your concentration (several commenters said so), turn it off. Nothing else depends on it.

## When this is wrong

If the next step was fixed in an approved plan before execution started — say, a planner → generator → evaluator flow with written acceptance criteria — the suggestion only echoes a decision a human already made. Accepting it costs no independence. The risk is specific to unplanned, conversational loops where the next step was never decided by anyone but the agent.

## Sources

- Z. Ansari, "The smartest Claude code feature is not for its users" (zohaib.cc, October 2026), including the post's update quoting the Claude Code engineer's reply.
- Hacker News discussion of that post, item 49981905 (October 2026). One commenter dates the feature to a specific Claude Code release; I have not verified that.
