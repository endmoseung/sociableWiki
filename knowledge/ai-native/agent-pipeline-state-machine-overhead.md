---
type: deep-dive
title: "An Autonomous Agent Pipeline's Overhead Lives in Its State Machine"
description: "In a multi-role agent pipeline the expensive failures come from the workflow graph, not the code: an outcome with no edge becomes an escalation, and a uniform gate charges a one-line edit the full ceremony."
tags: [agent-pipeline, state-machine, escalation, review-loop, circuit-breaker]
date: 2026-10-12
source: "External-derived — Cockroach Labs' write-up of its MOLT Sinai agent pipeline; see Sources."
relates: [ai-native/end-of-run-report-as-decision-queue, ai-native/fail-on-base-test-qualification, ai-native/agent-cost-economics-routing, ai-native/harness-ceiling-missing-reward-signal, dev-process/planner-generator-evaluator-loop]
---

# An Autonomous Agent Pipeline's Overhead Lives in Its State Machine

When a multi-agent pipeline gets expensive, my first instinct is to blame the model: it wrote bad code, it misread the task. The most detailed public post-mortem I have seen points somewhere else. **The costly failures were process-shape failures.** They came from the workflow graph — missing edges, uniform gates, loops with no exit — not from an agent writing bad code.

## The case

From April to September 2026, Cockroach Labs ran **MOLT Sinai**, a label-driven GitHub Actions pipeline modeled on a teaching hospital. Issues are "patients" and a merge is a "discharge." The roles are triage, a fellow who implements, a review attending, a discharge nurse who audits process, a charge nurse who sweeps stuck work, plus infection control, safety, and research. Each stage writes a structured note on the issue and applies the next label; rejections send work backward.

Their self-reported numbers (company blog, not independently audited):

| Metric | Value |
|---|---|
| Merged PRs / lines landed | 1,238 PRs / over 1M lines |
| Share of commits authored by the pipeline | about 85% of ~1,570 |
| Total token spend | about $135K, ~$84 per issue |
| Plan-review rejection rate | under 10% |
| One large feature (Db2 support) | under 2 days, 32 sub-issues, 55 rework cycles, 9 escalations (2 to humans), $4,172 |

## The failures were in the graph

| Reported symptom | Cause in the state machine |
|---|---|
| Closing a duplicate issue got escalated to a human | No terminal state for "no fix needed." An outcome without an edge falls through to the escalation edge. |
| A one-line copy edit took 5 rework rounds; another one-line fix took 11 | Every change takes the same review path, so review strictness does not scale with size or risk. |
| 3 complex issues used about $631 of a $1,046 spend window | The review-fix loop had no convergence check. |
| The process auditor loaded ~29K tokens of instructions on every run; 23% of ~100K words of role instructions could be deleted without changing any gate | Instructions grow per role and are paid on every transition. |
| The research role flooded the queue with proposals | A producer node with no back-pressure. |

## The structural fixes

1. **Every outcome needs an edge.** Enumerate terminal outcomes up front: fixed, duplicate, won't-fix, needs-info, obsolete, split. Any outcome you did not enumerate becomes an escalation, which is the most expensive edge in the graph.
2. **Route by change risk, not by stage.** Sending a typo and a data-path change through the same plan → review → implement → review → audit path is the uniform-gate anti-pattern. Price each gate by how reversible the step is and how visible an error would be downstream — the same test I use to decide where a *human* gate belongs.
3. **Put a convergence breaker on review loops.** Sinai escalates after 4 consecutive rounds that each raise *new* blocking findings, or after 6 substantive rounds. Counting *new* blockers rather than total rounds is the useful detail: it separates "converging slowly" from "the reviewer keeps finding fresh problems," and only the second signals a bad plan.
4. **Cap producers.** The research role went from every 3 hours to daily, with at most 10 unadmitted proposals. An agent that creates work needs a queue limit, or the pipeline consumes its own budget.
5. **Audit instruction text per role against gates.** If deleting a paragraph changes no gate's verdict, it is a recurring per-run cost and nothing more.

## Mechanisms worth borrowing

- **A precedent log as an escalation cache.** When a human rules on an escalation and the ruling generalizes, it goes into a log that agents must check before escalating. Human decisions become reusable case law. This pairs well with a batched end-of-run decision queue: the queue collects new decisions, and the log stops old ones from coming back. The risk is a precedent applied outside its original scope, which is a silent wrong decision — so write the scope next to each ruling.
- **Process records off the code branch.** Plans, reviews, handoffs, and per-stage cost live on a companion archive branch, so PR diffs stay code-only. The audit trail survives without inflating reviewer context.
- **Restated handoffs.** A stuck agent writes a structured handoff, and the receiver must **restate** it before working — a cheap check that the handoff was understood, not just delivered.
- **Reviews start by proving the tests.** The reviewer reverts the change and confirms the new tests fail before judging the fix.

## When this is wrong

- **At small scale the state machine is the overhead.** For a handful of agent tasks a day, a single session with a plan check and a test gate beats a nine-role graph. The structural failures above only dominate at hundreds of issues.
- **Throughput is not verified quality.** By Cockroach Labs' own account, the Db2 code was not reviewed during the autonomous run; human approval mode was switched on afterward. The numbers describe output, not correctness.

## Sources

- Cockroach Labs, "Five months treating bugs like patients and coding agents like a medical team" — https://www.cockroachlabs.com/blog/experiment-running-hospital-code/ (Hacker News item 50021899, October 2026)
- Counterpoint: Michael Lynch, "Why are coding agents so dumb?" — argues the agent layer (task splitting, model routing, plan readability) lags the model — https://mtlynch.io/why-are-coding-agents-so-dumb/ (Hacker News item 50020947)
