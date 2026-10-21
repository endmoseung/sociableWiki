---
type: principle
title: "Green must be non-vacuous — a check that could not have failed proves nothing"
description: "Zero findings, exit 0, and all-pass look identical to 'nothing ran' unless the harness shows the check was able to fail on this subject."
tags: [verification, non-vacuous, agent-eval, gates, false-green]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [dev-process/completion-means-verification-output, ai-native/agent-eval-tool-receipt-pattern, ai-native/fail-on-base-test-qualification, ai-native/proof-is-bound-to-a-subject, ai-native/models-may-only-downgrade]
---

# Green must be non-vacuous

My completion rule is "run the check and paste the output." It ends with a caveat I used to treat as a footnote: a check that passes vacuously satisfies the letter of the rule and defeats its purpose. After reading how a dozen open-source agent harnesses handle verification, I think that footnote is the main event. The output can be green because the check never had a chance to be red — and if all you look at is the exit code, that is indistinguishable from real success.

So the question I now ask of any green is not "did it run?" but **"could it have failed?"** If I can't show that it could, the green is a statement about the check, not about the code.

## The failure pattern

Green is the absence of red. Absence is also exactly what a check produces when it never touches the thing it is supposed to test. The same shapes show up in harnesses built for very different stacks:

- **Empty selection.** A `--changed` flag, a glob, or a skip list narrows the run until nothing executes. "0 failed" is true; so is "0 ran."
- **Unreached subject.** A UI probe lands on a redirect, an error page, or a login wall. The page it actually checked is clean.
- **Missing tool counted as a skip.** The scanner or browser binary isn't installed; the harness logs a skip, and the skip rolls up into pass.
- **Assertion already satisfied.** A test passes before and after the change, so "green after" says nothing about whether the change did anything. A no-op "refactor" passes every behavioral test.
- **A rule that cannot fire.** "Zero false positives" from a rule that never triggered is not precision. It is silence.

## Why it keeps recurring

**An exit code is one bit.** It can say pass or fail. It cannot say "didn't run," "couldn't see," or "the harness broke." Anything that isn't a failure gets rounded to pass at the first boundary that only speaks exit codes.

**Setup failures look like clean results.** The most common way for a check to see nothing is an environment problem — a missing browser, a wrong route, an absent credential — and those fail quietly, by producing an empty observation instead of an error.

**Coding agents drift toward green.** Not out of malice. The cheapest way to make a red gate go away is often to narrow it, skip it, or satisfy it trivially, and an agent told "make the checks pass" will find that path. The gate has to make the vacuous route visible, because the agent won't flag it.

## The design rule

A green counts only when the harness can show four things:

1. **The check discriminates.** Before a task or gate is admitted, a known-bad case must fail it and a known-good case must pass it. A gate that passes the known-bad case is broken, not lenient.
2. **Something went from red to green.** For a claim that a change did something, at least one check must have been red on the predecessor and green on the candidate. All green before and after proves preservation, not the change. (Requiring an agent-written test to fail on the unfixed code first is one instance of this.)
3. **The run is counted.** Report how many checks executed, what selection was applied, and what coverage was reached — routes visited, steps taken, rules that fired. Zero executed is its own state.
4. **Non-pass states stay non-pass.** `not_run`, `not_testable`, `inconclusive`, and `harness_error` are first-class outcomes. They never fold into pass — and they don't fold into "product failure" either, because a broken verifier is a different problem from broken code.

## How the harnesses implement it

**Admission pairs.** AppleBench admits a task only if a no-op agent that leaves the fixture unchanged *fails* it and an agent applying the withheld reference solution *passes* it. Unchanged-passes is a free mark, reference-fails is an impossible task, and both are excluded. frontend-visualqa's own CI demo succeeds only when the honest claims pass *and* a deliberately planted progress-bar bug fails. VeriHarness goes one level up and falsifies its release metrics: each critical metric must catch a deliberately broken build, and a metric that misses it reports `NOT_RUN`, not PASS.

**Change witnesses.** VeriHarness won't accept a candidate whose receipts are all green unless at least one criterion carries proof that it was red on the predecessor. Checks that were green both times are kept and carried forward to the next iteration, but they don't count as evidence of the change. engineering-protocols turns TDD into a fact predicate — the first test result must precede the first diff in the event log — rather than a prose instruction. open-agent-harness documents the refactor version of the trap: when the original code already satisfies the behavioral tests, "no change at all" is green, so a refactor needs a structural or diff witness alongside the tests.

**Counting what ran.** checkride keeps `ok: true` and `checks_run: 0` as separate fields. In strict gate mode, zero executed checks becomes a harness-error exit, a missing tool is a failure rather than a skip, and any narrowing flag is recorded as a partial run, so a focused run can't pass for a full one. Mischief, a browser monkey-tester, won't call a run clean from an empty findings list. It wants witnesses that the requested route was reached, that effective steps executed, and that there were clickable candidates to exercise; without them the result is `NOT VERIFIED` with its own exit code. a11ign makes the same point about precision: a rule that never fired has no false positives and no evidence, so its gates pair conformant controls, inaccessible controls, and known-bad fixtures, with fire counts on the record.

**Keeping non-pass states.** checkride exits 0 for pass, 1 for product failure, and 2 for harness, config, or environment failure, so a red product and a broken verifier never share a code. engineering-protocols evaluates predicates as `true / false / unknown` and lets only `true` advance a transition — "zero tests failed" and "tests not run" are different facts. frontend-visualqa treats an unreachable dev server or a missing browser as `not_testable`, which is neither a product failure nor a pass.

## When this is the wrong amount of rigor

- **Known-bad fixtures cost upkeep.** Every gate with a planted defect carries a second artifact that can drift. For a cheap local check with low stakes, breaking it once by hand and watching it go red may be enough. The fixture earns its place when the gate blocks merges or scores agents.
- **Not every check should flip.** Regression checks are supposed to be green before and after. The change witness applies to the claim being made, not to every check in the suite.
- **Some properties have no natural red case.** On clean code, a security scanner should find nothing. Plant a canary to prove it can fire; don't demand that the product contain a real defect.
- **[hypothesis]** A gate tuned against the same small known-bad set may learn to catch exactly those fixtures and little else. None of the harnesses I read measure this. Adding fixtures from real misses is my guess at the counter, not something I've seen tested.

## TL;DR

- Before trusting a green, ask whether the check could have failed here.
- Admit a gate only when known-bad fails and known-good passes; require at least one before-red, after-green witness for a change claim.
- Count executed checks, the selection applied, and the coverage reached. Zero executed is not pass.
- Keep `not_run`, `not_testable`, `inconclusive`, and `harness_error` as their own states — never pass, and not product failure either.

## Sources

- AppleBench harness (afterxleep/applebench-harness) — https://github.com/afterxleep/applebench-harness
- VeriHarness (SKZL-AI/veriharness) — https://github.com/SKZL-AI/veriharness
- checkride (robmclarty/checkride) — https://github.com/robmclarty/checkride
- Mischief (ca1773130n/Mischief) — https://github.com/ca1773130n/Mischief
- frontend-visualqa (yutori-ai/frontend-visualqa) — https://github.com/yutori-ai/frontend-visualqa
- engineering-protocols (codewandler/engineering-protocols) — https://github.com/codewandler/engineering-protocols
- a11ign, formerly a11y-witness (DanBeckDev/a11y-witness) — https://github.com/DanBeckDev/a11y-witness
- open-agent-harness (tsushanth/open-agent-harness) — https://github.com/tsushanth/open-agent-harness
