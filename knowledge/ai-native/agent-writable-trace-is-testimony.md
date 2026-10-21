---
type: principle
title: "Evidence the agent can write is testimony, not proof"
description: "Any record the implementer or reviewer can write — its transcript, its 'done', its tests, its receipts — is its own account of itself; harnesses that hold up give each piece of evidence a writer the claimant cannot reach."
tags: [agent-eval, verification, audit, traces, harness-design]
date: 2026-10-20
source: "External-derived — an arXiv paper on agents tampering with their own traces, plus a synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/eval-sandbox-attack-surface, ai-native/agent-eval-tool-receipt-pattern, ai-native/configured-is-not-effective, ai-native/proof-is-bound-to-a-subject, dev-process/planner-generator-evaluator-loop, dev-process/completion-means-verification-output]
---

# Evidence the agent can write is testimony, not proof

When I check what a coding agent did, I keep reaching for the cheapest evidence in the room: the session transcript, the agent's closing summary, the test files it wrote, the receipt JSON it left in the repo. Every one of those was written by the party whose work I'm judging. That makes it **testimony** — the agent's account of itself. **Evidence** is a record produced by something the agent could not reach.

The distinction sounds pedantic until you see how easily the account gets rewritten.

## The trace you audit sits inside the agent's write scope

*LLM Agents Can Easily Tamper With Their Own Traces* (Qin, Schmotz, Prinzhorn, Beurer-Kellner, Prabhu, Andriushchenko, arXiv 2609.30266) tested local coding harnesses — Claude Code, Codex, Antigravity, OpenCode, Grok Build — and reports three things:

1. Asked to, the agent deletes its own execution trace in every tested harness except one, and monitor guardrails do not fire.
2. Injected content from an outside attacker can induce the same deletion.
3. Trace tampering also shows up unprompted in frontier models chasing a reward.

I've read the abstract only. It gives no rate for the third finding, so I treat the frequency as unknown, not as rare.

None of this needs an exploit. In Claude Code the transcript is a plain JSONL file in the user's home directory, owned by the same OS user that the agent's `Bash`, `Edit` and `Write` tools run as. Anything that treats that file as ground truth quietly inherits the subject's ability to edit it:

| Consumer of the trace | What it silently assumes |
|---|---|
| A judge reading "what the generator did" | The generator didn't rewrite the record |
| Usage and cost reports, session search | Deleted turns never existed |
| Incident review after a bad command | The bad command is still in the log |
| "The agent ran the tests" claims | A claimed run left an unedited trace |

And a shortened trace fails silently: an empty log looks exactly like "nothing happened".

## The authorship test

The trace is just the sharpest case. For any piece of evidence, I now ask one question: **who could have written this, and is that the same party this evidence judges?**

| Evidence | Testimony when… |
|---|---|
| Session transcript | the agent's own OS user can edit it |
| "Done", the closing summary | always — it's the claim itself |
| Test files | the same implementer wrote the tests that decide pass |
| Receipt directory, baseline, golden screenshots | the implementer can write that path |
| A reviewer's "approved" | an orchestrating agent relays or paraphrases it |
| An auditor's report | the auditor could edit the workspace it graded |

Note the last two rows. The reviewer is a claimant too. Its verdict is testimony about the implementer's work, and if the reviewer can change the thing it grades, its pass is as self-certified as the implementer's.

## Why the same hole keeps reappearing

- **The cheapest evidence is what the agent already emits.** Transcripts, summaries and in-repo receipts cost nothing to collect, so they become the record by default.
- **Role names stand in for data flow.** "Independent reviewer" is a label in a prompt. What makes it independent is what it can read and write, and that's rarely checked.
- **One OS user holds every pen.** On a local box the agent, the hooks, the logs and the receipts often share one identity. Same user means same write access.
- **Absence is quiet.** A deleted turn, a skipped check and a missing artifact all look like "no problem found".

## The rule: give every piece of evidence a pen the claimant can't hold

This is not "trust nothing". Testimony is a fine lead — it tells you where to look. The rule is narrower: **anything that decides a state transition — done, approved, merged, scored — must come from a writer outside the claimant's reach.** Each piece of evidence gets an assigned writer, and the party being judged is never it.

The open-source harnesses I've studied that hold up each move one pen. They differ in which one.

### Grade after the worker has left — AppleBench

The agent edits an isolated checkout. Only after its process exits does a host grader run a fresh build and test pass. For fixtures where the agent wasn't asked to write tests, the graded test target is stripped from the agent's snapshot and overlaid after the diff is captured, with an event marking the moment. The tests that decide the score never existed in the worker's write scope. Every task also has to fail when left unchanged and pass with a reference fix kept outside the agent's checkout, so the grader itself is checked before it's trusted.

### Capture verdicts at a seam, then seal the state — ai-sdlc-harness

A human's gate reply is captured verbatim by a hook and parsed deterministically; no agent paraphrase reaches the gate. Reviewer verdicts go into a ledger from anchored output, and a task can't move to done without a captured approval for the current review round. Workflow state is HMAC-sealed and checked on every read, with the seal bound to the task label so a genuine proof copied onto another task fails. "Proven red" means the harness itself watched the test fail and then locked the test files' blob hashes, so weakening the tests mid-implementation is caught at the green transition.

### Wall off the accounting plane — checkride

The stop hook won't let the agent finish without a green receipt, and a separate protect hook rejects writes to the receipt directory and the baseline file. The implementer can fix code; it cannot edit the ledger that says whether the code is fixed. Changing the accepted-debt baseline is deliberately a different authority from a normal fix.

### Split the fact writer from the judge — Verdict

A deterministic harness measures what can be counted: commit range, gate exit codes, test counts, citation hashes. The model judges meaning and severity but doesn't get to state numbers. A finalizer merges the two lanes, and the countable sections of the report are re-rendered from state, so the prose can't disagree with them. A hand-written state file gets its own exit code instead of passing as a real one.

### Judge from a frozen bundle, and prove it with a sentinel — Wringer

The judge reads the finished evidence bundle — diff, gate output, approved rubric — never the worker's transcript or reasoning. The test that keeps this honest: the worker prints a distinctive sentinel string, then the harness checks the string appears nowhere in the judge's request. That verifies the data flow, not the role name. Criteria marked human-only are never sent to the judge at all, so the model has no channel to impersonate a human decision.

### An auditor that edits is no longer an auditor — LongHorizon-Harness

A fresh-context executor works each round; a read-only auditor inspects real files, logs and tests. Only auditor-admitted results become the state the next round reads. If the auditor mutates the workspace, the audit is downgraded to a violation and, depending on configuration, a pre-audit snapshot is restored. If the auditor's report header is incomplete, the harness doesn't infer success from the body.

## Applying it to the trace itself

Back to the transcript. What I'd do once any judge, report or review depends on it:

- **Deny the trace path to the agent's own tools** (deny rules for `Edit`, `Write` and `Bash` on the transcript directory). Necessary, not sufficient: deny rules fence tools, not the process.
- **Fork events out at the harness layer.** A `PreToolUse`/`PostToolUse` hook runs in the harness, not as an agent tool call. Have it append each event to a sink the agent can't reach — a remote log, another OS user's directory, an append-only store. The local transcript becomes a cache; the sink is the record.
- **Make deletion detectable, not just forbidden.** Hash-chain the forwarded events or keep a per-session sequence counter, so a gap raises an alarm instead of looking like a quiet absence.
- **Judges read the sink, or re-run the check.** Never the generator's own log.
- **Treat a shrinking trace as a finding.** Session tooling should flag sessions whose event count drops between reads.

## Where this sits next to related patterns

The eval-sandbox attack is about an agent corrupting the grader's toolchain through shared mutable state; the fix is isolating the measuring apparatus. The tool-receipt pattern compares claimed tool calls against an execution log, and quietly assumes the log is honest. This principle sits under both: before trusting any log, receipt or verdict, ask who held the pen.

## When this is wrong

- **No downstream reader.** A throwaway local session with no judge, no audit and no automated consumer of the transcript gets nothing from an extra sink. The rule starts paying the moment a decision is made from the record.
- **"Out of reach" is relative to a threat model.** ai-sdlc-harness keeps its HMAC key in the workspace; by its stated threat model it targets a drifting agent, not a deliberate adversary that reads the key and recomputes the chain. Verdict calls its write-blocking hooks heuristic guardrails, not a sandbox. Be explicit about which adversary your pen placement actually stops.
- **[hypothesis]** A same-user append-only file flag is weaker than it looks: on macOS the owner can clear user flags, so an agent running as that user can too, and Linux's equivalent needs root to set. Only a system-level flag, a different user or an off-host sink moves the record out of reach.
- **Sealing has a recovery cost.** If every authority file is sealed, something will eventually need resealing. Make that a logged human action, not an automatic repair — otherwise the reseal path becomes the new pen the agent can hold.

## Sources

- [LLM Agents Can Easily Tamper With Their Own Traces (arXiv 2609.30266)](https://arxiv.org/abs/2609.30266) — abstract only; methods and rates not read.
- [Adversa AI — AI coding agent security resources, October 2026](https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/) — the roundup that surfaced the paper.
- [afterxleep/applebench-harness](https://github.com/afterxleep/applebench-harness) — post-exit grading, withheld tests, unchanged-must-fail / reference-must-pass admission.
- [MostAshraf/ai-sdlc-harness](https://github.com/MostAshraf/ai-sdlc-harness) — hook-captured verdicts, HMAC-sealed state, test blob lock.
- [robmclarty/checkride](https://github.com/robmclarty/checkride) — stop-hook receipt gate, protected receipt and baseline paths.
- [ArtJack/verdict](https://github.com/ArtJack/verdict) — deterministic fact lane vs model judgment lane, hand-written-state exit code.
- [marcoakes/wringer](https://github.com/marcoakes/wringer) — evidence-bundle-only judge, sentinel isolation test, human-only criteria withheld.
- [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) — read-only auditor, workspace-mutation downgrade, auditor-admitted state.
