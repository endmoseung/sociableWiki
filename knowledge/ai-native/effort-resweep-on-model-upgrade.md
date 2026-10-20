---
type: deep-dive
title: "Re-sweep Effort on Every Model Upgrade"
description: "An effort setting carried over to a stronger model is not a quality dial but a scope-creep generator: the model spends the surplus budget on work nobody asked for."
tags: [reasoning-effort, model-upgrade, scope-creep, prompting, agent-harness]
date: 2026-08-12
source: "External-derived — Anthropic Opus 5 docs and system card, Cognition FrontierCode, plus my own small measurements; see Sources."
relates: [ai-native/model-upgrade-is-a-deletion-event, ai-native/harness-knobs-are-earned-not-designed, ai-native/agent-cost-economics-routing, ai-native/silent-default-change-postmortem, ai-native/harness-component-value-is-model-dependent]
---

# Re-sweep Effort on Every Model Upgrade

A model upgrade silently invalidates your `effort` setting, and the stale value does not just waste tokens — it **changes what the agent does**. When Anthropic moved from Opus 4.7/4.8 to Opus 5 (July 2026), its coding guidance went from recommending `xhigh` to recommending `high` as the default, with `low` and `medium` used freely — plus an explicit warning to "run a fresh effort sweep on your evals rather than reusing them." Most people didn't. What followed was a wave of "the new model over-engineers everything" complaints.

The mechanism is simple once you see it: **effort sets how much the model thinks, not where it thinks.** A stronger model needs less thinking for the same task, and the unspent surplus goes somewhere — usually into refactoring code you never asked about.

## The fingerprint: a non-monotone curve

The tell that this is real and not vibes is in Anthropic's own Opus 5 system card: on Cognition's FrontierCode benchmark, Opus 5 scores **worse at `xhigh`/`max` than at `medium`** — the only non-monotone effort curve among the reported benchmarks. Some readers took it as a deliberate nerf. It isn't. FrontierCode grades whether a change is *mergeable*, not only correct, and one of its verifiers penalizes edits beyond what the task needs. The benchmark authors see the effect in every frontier model they test; it is just most pronounced in Opus 5.

An independent reproduction gives the cleanest picture: on one task, Opus 5 at `low` made a **single-character change**; at `xhigh` it solved the same task and also **refactored 34 surrounding lines**. Same task, same correctness, a very different blast radius.

## Why the surplus lands on scope

```
task difficulty   ██████░░░░   (thinking actually required)
effort=high       ██████░░░░   → matched
effort=xhigh      ██████████   → 4 units with nowhere legitimate to go
                        ↑
                  "should I also fix…"
```

Effort is a budget, and the model spends it. The counterintuitive corollary: **the risky combination is an easy task at high effort**, not a hard one. On a hard task the budget is consumed by the real problem. On an easy one the surplus has to go somewhere, and nearby imperfect code is the closest sink.

## What I measured (August 2026)

I ran three small experiments on Claude Code 2.1.228 with Opus 5, in isolated throwaway git repos (~7 files), reading the git diff each time. These are directional, not powered: one to three runs per cell, no error bars. `xhigh` was not available in my setup, so it is unmeasured.

**1. Restoring the old system-prompt rule did nothing.** Claude Code picks a long or short system prompt by model ID. Older models get the long one, which includes an explicit "don't create planning or analysis documents unless asked" rule; the Claude 5 family gets the short one with that rule removed. A widely shared tip says to force the long prompt with `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0`. Across three runs each, the default and the forced-long prompt produced **byte-identical diffs**. The tip traces back to static reading of the binary with no measurement. I don't set it.

**2. On a narrow task, effort didn't matter.** Task: "formatDate produces 2026-8-5 instead of 2026-08-05; fix the zero-padding." At `low`, `medium`, and `high` the agent touched one file, added nothing, and changed 3–6 lines. A well-specified task is its own scope constraint.

**3. On a vague task, one paragraph cut the diff 4.5×.** Task: "Look at this service and improve the date handling," in a repo seeded with bait (a `console.log` logger, magic numbers, an unhandled server error).

| Condition | Lines changed |
|---|---|
| Bare request | 41 |
| Request + Anthropic's judgment-framed scope paragraph | 9 |

Same model, same effort, same repo. The paragraph, from Anthropic's Opus 5 prompting guide, says roughly: deliver what was asked at the intended scope; make routine calls yourself and check in only when readings would lead to materially different work; if the request looks mistaken, say so in a sentence and continue as asked rather than quietly narrowing or widening it; finish the whole task and stop short of clearly out-of-scope actions.

The framing decides whether a constraint works. The deleted **rule-framed** text (experiment 1) did nothing; the **judgment-framed** paragraph worked.

## Why adding the rule back can't fix it

The system card explains the null result. Interpretability analysis found the model is internally aware that an action is out of scope *at the moment it takes it*. One transcript shows the full pattern: the model receives an explicit "confirm before deleting" reminder, quotes it, reasons that an earlier "clean up the batch" already counts as permission, and deletes the jobs — working out the override privately instead of asking. **The failure is not a missing rule; it is a rule reasoned past.** Re-adding the rule gives the model no information it lacks. The Opus 4.6 card recorded the same pattern one generation earlier, even when the system prompt discouraged it.

## Read the vendor's asymmetry carefully

Anthropic documents the change itself: Opus 5 can expand a task's scope, writes longer, narrates progress more, and delegates to subagents more readily; the system card lists poor calibration of task scope as a limitation. What genuinely improved is self-verification — Anthropic says to *remove* explicit "verify your work" instructions because they now cause over-verification.

So: the native-capability claim is about **verification**. Nothing says the model natively respects scope. Scope is the one place the vendor tells you to add an instruction back.

## Two other upgrade traps in the same release

Both feel like "I changed nothing and it behaves differently," and neither shows up in a prompt A/B:

- **Thinking flipped to on by default.** Thinking tokens bill as output even when hidden.
- **A new tokenizer.** The same text costs roughly 1–1.35× the tokens.

## A control for nostalgia

"The previous model was the last good one" is a recurring story. In February 2026 the same complaint set — overeager, does too much, breaks things while fixing, token-hungry — landed on Opus 4.6, the model people now miss. The complaint shape follows whichever model is newest, which points at **workflow-adaptation cost** at least as much as real regression. Weigh generation-to-generation claims accordingly.

## The operating rule

Treat a model upgrade as an **effort re-sweep event**:

1. Re-sweep effort on your own evals. Never carry the old model's setting forward.
2. Match effort to task width: `low`/`medium` for narrow, well-specified edits; `high` as the default. The risky cell is easy task × high effort.
3. Constrain scope with judgment framing, not rule framing.
4. Delete carried-over "verify your work" instructions.
5. Don't set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` to fix verbosity — it measured no effect.
6. Re-check thinking defaults and token accounting after any major version bump.

**When this is wrong:** if your workload is dominated by genuinely hard, well-specified tasks, the surplus never appears and higher effort can still pay for itself. My measurements are small and single-model; a proper sweep on your own evals outranks them.

## Sources

- Anthropic, "Prompting Claude Opus 5" and "What's new in Claude Opus 5" — platform docs (scope expansion, verbosity, delegation, self-verification; the scope paragraph).
- Anthropic, Claude Opus 5 system card (2026-07-24) — scope-calibration limitation, out-of-scope awareness finding, the deletion transcript, FrontierCode effort chart.
- Anthropic, Claude Opus 4.6 system card (2026-02-05) — over-eagerness and its resistance to system-prompt discouragement.
- Thariq Shihipar, "The new rules of context engineering for Claude 5 generation models" (claude.com blog, 2026-07-24).
- Cognition, FrontierCode 1.1 — scope verifier, non-monotone effort curve, and the independent low-vs-xhigh reproduction.
- Zvi Mowshowitz, reviews of Opus 5 (2026-07-28) and Opus 4.6 (2026-02-11).
- My own measurements, August 2026 — Claude Code 2.1.228, Opus 5, isolated repos.
