---
type: pattern
title: "A review finding is a hypothesis until a different reviewer fails to disprove it"
description: "AI-generated review comments should pass an independent disconfirmation step before publication because plausible findings often collapse under surrounding code, callers, tests, or configuration."
tags: [ai-native, code-review, verification, false-positives, subagents]
date: 2026-07-16
source: original
relates: [ai-native/dependency-clustered-code-review, ai-native/agent-eval-tool-receipt-pattern]
---

# A Review Finding Is a Hypothesis Until a Different Reviewer Fails to Disprove It

An AI code reviewer produces plausible claims cheaply. That is useful for recall and
dangerous for publication. A comment can sound precise, cite a line, and still be wrong
because a caller normalizes the value, a test proves the opposite behavior, a feature
flag changes the path, or another file already handles the edge case.

Treat every proposed finding as a hypothesis, not a result.

## Separate discovery from verification

The reviewer that discovered a finding is anchored to its own explanation. Asking it
to “double-check” tends to produce a stronger version of the same argument. A different
reviewer should receive the claim and the relevant code, then try to reject it.

The verifier checks:

- surrounding code and all relevant callers,
- tests, types, schemas, and configuration,
- whether the failure condition is reachable,
- whether another changed file already handles the case,
- whether the claimed impact follows from the evidence,
- whether the comment points to a changed line that actually demonstrates the problem.

The output is one of three states:

| State | Meaning | Publication rule |
|---|---|---|
| `CONFIRM` | Evidence supports a reachable failure and its impact | May be published |
| `REJECT` | Code or contract disproves the claim | Do not publish; retain the reason |
| `UNVERIFIED` | Available evidence cannot settle the claim | Report as a coverage gap, not a defect |

## Why rejected findings should remain visible

Silently dropping false positives hides the quality of the review pipeline. Keeping the
rejection reason exposes recurring failure modes: missing context, stale assumptions,
misread framework behavior, or severity inflation. Those patterns can improve future
prompts and rubrics.

## Evidence shape

A publishable finding needs more than a line reference:

```text
claim → reachable failure condition → observable impact → supporting evidence
```

If one link is missing, the comment is advice or suspicion, not a verified defect.

## The cost boundary

Independent verification costs another review pass, so it is most valuable when false
positives are expensive: automated GitHub comments, large changes, unfamiliar code,
security claims, or review systems whose trust is hard to recover. For a small manual
review, the human author can provide the second look.

This is the review analogue of a tool receipt: a receipt proves the claimed action ran;
independent verification proves the claimed defect survives an attempt to disprove it.
