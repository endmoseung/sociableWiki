---
type: pattern
title: "An Unqualified Agent-Written Test Is Negative Feedback — Qualify It Fail-on-Base First"
description: "An agent-written test that has not been shown to fail on the unfixed code is not weak feedback but a wrong target the repair loop optimizes toward, so require fail-on-base before it may drive a loop or count as evidence."
tags: [testing, coding-agents, verification, regression-tests, repair-loop]
date: 2026-10-11
source: "External-derived — ExecCritic (arXiv 2609.09133) and practitioner writing on tautological tests; see Sources."
relates: [ai-native/green-must-be-non-vacuous, ai-native/reward-hacking-held-out-gap, ai-native/disposable-implementation-durable-oracle, dev-process/completion-means-verification-output]
---

# An Unqualified Agent-Written Test Is Negative Feedback — Qualify It Fail-on-Base First

My old mental model was that agent-written tests are *weak* evidence: maybe tautological, but at worst harmless, and more tests can only help. A September 2026 paper measured the opposite. When a repair agent was steered by tests from an untrained test-writing agent, SWE-bench Verified resolution **dropped below the no-test baseline**, from 61.2% to 57.3%. Once the test agent was trained to write tests that separate correct from incorrect patches, and a fail-closed harness qualified and froze those tests before the repair agent saw them, the same pipeline reached 72.6% — 11.4 points above no tests at all (Tao et al., arXiv 2609.09133).

So the sign of the feedback depends on test quality. An unqualified test is not "less signal." It is a **wrong target the repair loop optimizes toward**.

## Why it goes negative

The inference chain, step by step:

1. A repair loop treats "tests pass" as its stop condition. It edits until green.
2. A test that already passes on the buggy code hands the loop a premature green, so it stops early. A test that encodes the agent's misreading of the issue makes the loop "fix" toward that misreading.
3. Either way the loop converges confidently on a wrong patch. With no feedback at all, the model would at least have to reason from the issue text.
4. Therefore an unchecked test does not dilute toward zero. It points the loop in a specific wrong direction.

## The qualification gate: mechanical, no semantics needed

There are two questions people usually ask about agent tests: *where does the oracle come from*, and *who is allowed to edit the test*. The fail-on-base gate is a cheap mechanical step that sits between them. Before an agent-written regression test may drive a loop or count as evidence in a PR:

| Check | Run against | Must be | If not |
|---|---|---|---|
| Fail-on-base | the parent commit (source reverted, new test kept) | **red** | The test proves nothing about this bug. Reject it as evidence. |
| Pass-on-fix | the patched tree | green | An ordinary failure. Keep iterating on the fix. |
| Freeze | after qualification | read-only to the repair agent | Otherwise the agent can edit the test to match its patch. |

A test that is green on both trees is the tautology class seen from outside. I do not have to read the assertion to know it carries no information about the change. Static approaches exist — labelling tests as tautology, characterization, negative-path, or property, and refusing a merge when production code grows but only tautologies were added. Fail-on-base is the dynamic version, and it needs no labels, no classifier, and no semantic judgement.

A practical shape for a PR gate:

```bash
# Run the PR's new or changed tests against the base commit's source.
git checkout origin/main -- <non-test source files touched by the PR>
<run the new tests>                   # expect: at least one fails
git checkout HEAD -- <source files>   # restore
```

A pure refactor legitimately has no fail-on-base test. Its evidence is characterization replay — behaviour unchanged — not new tests. The gate applies to bug-fix and feature PRs whose description claims "added a regression test."

## How I apply it

- **In review**, a claimed regression test counts as evidence only after fail-on-base is shown, either in a CI log or a pasted local run. "Tests added and green" alone is not evidence.
- **In autonomous fix loops**, put the fail-on-base check *between* test writing and fix writing. TDD already has a red phase, but the loop has to *observe* the red, not take the agent's word that it happened.

## When this is wrong

- **The base will not build.** If the parent commit cannot compile with the new test — because the test imports a new API, for example — "red" means a compile error, not a behavioural failure. Treat the test as unqualified and require one written against the pre-existing surface, or a behavioural assertion through an old entry point.
- **Flaky tests.** A flaky test can be red on base by chance. Run it two or three times on base before trusting the red.
- **The negative number is one model on one benchmark.** The 57.3% figure comes from a single untrained model at one size (Qwen-3.5-35B-A3B) on SWE-bench Verified. A stronger model's unqualified tests may land neutral rather than negative. The transferable part is the direction — quality decides the sign — not the magnitude.

## Sources

- Tao, Peng, Wang et al., "ExecCritic: Learn to Test, Test to Improve for Coding Agents," arXiv 2609.09133 (September 2026). Benchmark numbers are from the abstract; the exact qualification rule is in the full paper, which I have not read.
- Finley Zhou, "Tautologies Are Not Tests. Classify Agent Patches Before Merge," dev.to (September 2026). Static classification and merge rules.
- SpecStory learning page, "Tautological tests," and the no-mistakes project (kunchenguid/no-mistakes, PR #1305) — for the definition: an expected value derived from the code under test.
