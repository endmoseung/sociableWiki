---
type: pattern
title: "A proof is bound to its subject — and expires when the subject moves"
description: "A green check means something only for the exact tree, execution closure, and rubric it ran against, so receipts are keyed to digests, approvals to revisions, freshness is tracked as a state, and resume re-verifies before reuse."
tags: [verification, provenance, receipts, freshness, resume]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/agent-eval-tool-receipt-pattern, dev-process/completion-means-verification-output, ai-native/green-must-be-non-vacuous, ai-native/agent-writable-trace-is-testimony, ai-native/harness-is-the-eval-unit]
---

# A proof is bound to its subject

Two older rules sit underneath this one. "Done means you ran the check and pasted the output" makes sure a check exists. The tool-receipt pattern makes sure a claimed tool call actually happened. Neither says what the green is *about*. A receipt that says "tests passed" is incomplete until it also says "on this tree, with this toolchain, against this rubric" — and once any of those move, the receipt stops being evidence about the thing in front of you.

The part that's easy to miss: proofs don't fail loudly when they go stale. They keep looking green.

## The failure pattern

- CI is green on a branch. The agent pushes two more commits, and a merge gate that asks "is the latest run on this branch green?" answers yes from the earlier run.
- Tests pass on a commit, but the working tree was dirty. An untracked file or an uncommitted edit means what was tested is not what the commit contains.
- A review is approved, the patch is then edited "just a little," and the approval travels with the pull request, not with the patch it actually read.
- An interrupted run resumes after the prompt, a config overlay, or a tool version changed. The earlier steps' passes get reused for what is now a different execution.
- An evaluation image is tagged as the current commit but was built from an older one.

## Why it recurs

**Proofs are filed under names that move.** Branches, pull request numbers, "the build," image tags — friendly handles are mutable by design. A receipt keyed to a handle silently re-targets when the handle moves.

**The subject is bigger than the code.** What a check certifies includes the toolchain, the environment, the dataset, the prompt or rubric that judged it, and the harness version. Change any of them and the same code can earn a different verdict.

**Reuse is cheap and rerunning is expensive.** Every pipeline feels pressure to skip a 30-minute suite when "nothing important changed." Without an explicit freshness rule, that call is made ad hoc — often by the agent, and often from a transcript line that said "tests passed" two hours and several edits ago.

## The design rule: four habits

1. **Key receipts by content digest, not by name.** Use a tree hash that includes dirty and untracked state, an image digest, a dataset revision, a config hash. A commit alone isn't enough if the tree can be dirty; a tag alone isn't enough if it can be repointed.
2. **Bind approvals and reviews to the exact artifact revision.** An approval names the digest it approved. When the digest changes, the approval becomes history rather than authority, and approving a review doesn't silently extend to applying or pushing it.
3. **Track freshness as a state; neither delete nor reuse.** A pass that ran is a historical fact and stays recorded. Whether it still applies is a separate, computed state: exact match, relevant files unchanged, relevant files changed, environment changed, unknown.
4. **Re-verify the closure before trusting earlier evidence.** Resume, apply, and release steps recompute the subject's identity and compare it with what the evidence was bound to. A mismatch refuses by default; overriding it is an explicit, recorded act.

## How the harnesses implement it

**Tree-hash receipts.** HAR names its full-verification record after the Git tree hash, and its commit gate checks that the current tree equals the validated tree; change one line and the receipt can't be reused. VeriHarness binds the verification subject to commit plus tree digest plus clean or dirty state, writes the tree from a temporary index so untracked files count, and re-checks the binding after QA — which catches drift in a dirty tree under an unchanged commit.

**The closure, not just the code.** agent-evals binds each result to the framework commit, container image digest, dataset revision, and gateway configuration hash. During a run on a fresh cloud account it found an image whose tag looked current while its baked-in SHA was older; that provenance failure became a rebuild guard. Verdict, a QA-memory harness, records the harness path and version, the prompt hash, and the exact commit range next to each verdict, so you can always recover which measurer and which rubric produced it.

**Approvals bound to digests.** Eclipse Harness rejects a reviewer packet unless both the current task-contract digest and the exact result digest match, so a stale plan or an earlier result can't be reviewed in place of the latest diff. Agent Arena binds each review decision to the base commit, contestant, prompt, and exact patch digest. The later apply step re-verifies the accepted digest, the base commit, a clean worktree, and `git apply --check`, and delivery to GitHub needs a separate approval on top of that.

**Freshness as an explicit state.** Agent Engineering Toolkit keeps the fact that a test passed even after the source changes, and separately computes whether that proof still applies, with states such as `EXACT_MATCH`, `RELEVANT_FILES_MATCH`, `RELEVANT_FILES_CHANGED`, `ARTIFACT_CHANGED`, `ENVIRONMENT_CHANGED`, and `UNKNOWN`. A stale proof is neither a pass nor a failure, and `UNKNOWN` never falls back to success. Verdict's release gate uses separate exit codes for no state, stale state, and hand-written state, and reuses an earlier verdict only if it clears a maximum age, a minimum run number, and a maximum number of commits behind, all at once.

**Resume re-verifies.** SimpleFlowHarness records a run's external inputs at start — profile overlays, context bytes, tool versions, workspace and base commit, accepted risks — as canonical JSON with a SHA-256, then diffs them on resume. A mismatch refuses by default. Accepting a changed closure and adopting a changed workspace are separate flags, so one escape hatch can't open the other trust boundary.

## When the rule is wrong

- **Exact-tree binding can be too strict for slow suites.** Invalidating a 40-minute suite because a comment changed is waste. Relevant-path freshness is the usual relaxation, but it's only as good as the path declarations; if they miss a dependency, a stale proof reads as fresh. Treat it as a weaker state than an exact match.
- **For cheap checks, just rerun.** Freshness bookkeeping is overhead. When a check costs seconds, rerunning it at every boundary is simpler than proving its old result still applies.
- **Identity is not correctness.** A perfectly fresh, exactly bound proof is only as good as the check behind it — which still has to be one that could have failed. Binding answers "is this about the current thing?", not "is the current thing right?"
- **Non-hermetic checks can't be fully bound.** Anything that touches the network, the clock, or a live service has inputs no digest captures. Record those as environment-dependent instead of pretending the hash covers them.

## Sources

- HAR (os-factory/har) — https://github.com/os-factory/har
- VeriHarness (SKZL-AI/veriharness) — https://github.com/SKZL-AI/veriharness
- agent-evals (psdhali/agent-evals) — https://github.com/psdhali/agent-evals
- Verdict (ArtJack/verdict) — https://github.com/ArtJack/verdict
- Eclipse Harness (benedictdavon/eclipse-harness) — https://github.com/benedictdavon/eclipse-harness
- Agent Arena (JDKrasnick/agentarena) — https://github.com/JDKrasnick/agentarena
- Agent Engineering Toolkit (AdvancingTitans/agent-engineering-toolkit) — https://github.com/AdvancingTitans/agent-engineering-toolkit
- SimpleFlowHarness (Aero123421/SimpleFlowHarness) — https://github.com/Aero123421/SimpleFlowHarness
