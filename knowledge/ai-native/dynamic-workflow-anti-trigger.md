---
type: pattern
title: A Dynamic Workflow Is the Wrong Default — the Anti-Trigger Is Its Own Skill
description: Knowing when NOT to author a dynamic workflow is a distinct skill; default to the rung below one and let the task force you up.
tags: [dynamic-workflows, subagents, orchestration, cost-model, decision-ladder]
date: 2026-06-20
source: "synthesis of Anthropic Dynamic Workflows docs + field reports (links below)"
relates: []
---

# A Dynamic Workflow Is the Wrong Default — the Anti-Trigger Is Its Own Skill

Most writing about dynamic workflows explains the mechanism — an agent authors a short JavaScript coordinator script that fans out to many subagents — and the one load-bearing invariant: the coordinator does no I/O, the agents do all the side effects. Both answer *how a workflow works*. Neither answers the question that actually bites in daily use: **should this task be a workflow at all?**

That gap matters because the tooling nudges you toward "yes, often." With auto-authoring settings enabled, the agent decides on its own when to write a workflow — so the over-firing risk is structural, not a user mistake. Field reports from the last few weeks describe background and parallel agents crossing "from demo to daily workflow." Auto-triggering plus daily-habit adoption means the realistic failure mode in mid-2026 is **reaching for a workflow when a cheaper rung would have been correct** — not failing to reach for one.

## The cost shape that makes over-firing expensive

This is not "a workflow costs a bit more." The vendor guidance is blunt: a dynamic workflow consumes *substantially* more tokens than a normal session, and **one aggressive run can burn a month of normal usage.** The reason is the underlying cost model: you pay for **agent-occupancy** — how many agents are alive × how long — not for the spawn call itself. A workflow that fans 200 agents over an 11-day migration is the *justified* extreme; a workflow that fans 8 agents at a task one agent could have finished in two turns is pure waste running the same expensive machinery.

So the breakeven is not "is this task big?" It is: **does the task have enough independent, parallelizable work to amortize the coordination overhead, AND a verification need that a single context can't self-satisfy?** Both clauses, not either.

## The decision ladder — pick the lowest rung that covers the task

There are four rungs, in ascending cost. The skill is reaching for the *lowest* one that works, not the most powerful.

| Rung | Use when | Cost shape |
|---|---|---|
| **Single agent (this context)** | The work fits one coherent context; steps are sequential and depend on each other | Cheapest; one context's tokens |
| **A few subagent spawns (flat fan-out)** | 2–8 genuinely independent sub-tasks; you assemble the results yourself; no looping or branching over results | Pay per spawned context; you hold the join in *this* context |
| **Dynamic workflow** | Control flow itself must be deterministic — loops, branch-on-result, fan-out-then-fan-out, dedup across a result set, loop-until-dry — AND the run is long enough that holding intermediate state in your own context would drift or overflow | Occupancy × duration; checkpointable and resumable |
| **Several workflows in sequence** | A multi-phase effort (understand → design → implement → review) where you want to stay in the loop between phases | Sum of the above, deliberately staged |

The tell for "I've over-climbed": if you can describe the join in one sentence ("run these three, then I'll merge"), you didn't need a workflow — a flat fan-out plus your own merge is cheaper and keeps you in control. A workflow earns its cost only when the *script* has to make decisions the parallel results dictate — when the join is itself a program (filter, route, loop again), not a one-liner.

## Concrete anti-triggers — do NOT author a workflow when…

- **The steps are sequential.** A→B→C where B needs A's output is a single agent's job. Parallelism buys nothing; the coordinator is pure overhead.
- **The fan-out is small and the join is trivial.** Three independent lookups you'll concatenate → flat subagent calls, not a workflow.
- **You need to watch and steer mid-run.** Workflows run in the background and report on completion. If the task needs turn-by-turn human steering, a workflow *removes* the steering channel you wanted.
- **You haven't scoped it yet.** The discovery step ("which files? which surfaces? how big is the diff?") is cheap inline work. Do that *first*, then decide whether the discovered work-list is big enough to pipeline. Authoring a workflow to *find out* how big the task is inverts the order — the right hybrid is scout inline, then orchestrate over the result.
- **There's no independent verification need.** If correctness is self-evident from one agent's output, the adversarial-review machinery — a workflow's main quality dividend — is dead weight.

## Why this is a skill, not a setting

You cannot delegate this judgment to the auto-trigger. Auto-authoring optimizes for thoroughness, so its bias is to *climb* the ladder — exactly the direction over-firing runs. The human, or the orchestrating agent under an explicit budget, has to supply the downward pressure: "is the cheapest rung that covers this actually lower than where I'm about to reach?" This is a special case of a general fact about automatic triggers — a trigger keyword competes in a shared namespace and over-fires toward its most-capable interpretation. Here the over-fire is expensive in tokens, not just noisy.

The practical rule I default to: **start at the rung below a workflow, and let the task force you up — never start at the top.** A workflow is the right tool for widespread-bug hunts, large migrations, multi-surface security audits, and deep research with claim verification. It is the wrong tool for "do these few things and tell me." Treat the question "could a flat fan-out plus my own merge do this?" as the gate every workflow has to pass before you author it.

## Sources

- [Anthropic — Introducing Dynamic Workflows in Claude Code](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- [Claude Code Workflows documentation](https://code.claude.com/docs/en/workflows)
- [InfoQ — Dynamic Workflows coverage](https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/)
- [Security Boulevard — Background AI agents for async development (2026-06)](https://securityboulevard.com/2026/06/6-background-ai-agents-for-async-development/)
