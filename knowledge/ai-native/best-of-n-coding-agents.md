---
type: pattern
title: "Best-of-N coding agents — spend tokens to buy variance, then discard"
description: "Run the same task in N isolated worktrees, keep exactly one output, and throw the other N−1 away — you pay N× tokens to buy variance, not to merge."
tags: [best-of-n, parallel-agents, worktrees, coding-agents, cross-model, agent-orchestration]
date: 2026-06-16
source: "Synthesis of published practitioner sources (Warp, Claude Code docs, MindStudio, Towards Data Science)"
relates: []
---

# Best-of-N coding agents — spend tokens to buy variance, then discard

Most writing about parallel coding agents is really about **dividing** work: split one
task across agents and re-converge the pieces. This note is about a **different**
parallel pattern that the 2026 field has named and tooled separately: **best-of-N** —
run the *same* prompt redundantly across N isolated worktrees, then **keep exactly one
output and discard the other N−1.** No merge, no decomposition. You are deliberately
paying N× tokens to buy *variance*, then throwing most of it away.

## The three parallel patterns are not the same thing

The single most common mistake is collapsing everything into "running agents in
parallel." These patterns have opposite economics and opposite merge stories:

| Pattern | What's parallel | What you do with the outputs |
|---|---|---|
| **Independent features** | Different *tasks* | Merge all — each is a separate feature |
| **Split-and-merge** | Different *parts of one task* | Merge all into one result |
| **Best-of-N** (this note) | The *same task*, N times | **Keep ONE, discard the rest** |

Best-of-N is the only one where the merge step is "select, don't merge." Warp's docs
frame it precisely: run the same task in different worktrees with different agents, then
**compare the diffs side-by-side and pick a winner** — *not* combine them. Trying to
merge two independent solutions to the same problem is how you get a Frankenstein diff
that neither agent would have written.

## Why it works: non-determinism is the feature, not the bug

For decomposition, LLM non-determinism is a liability — two agents make conflicting
implicit choices. Best-of-N **inverts that**: the same prompt produces different valid
solutions, and you exploit the spread. The practitioner payoff, repeated across sources:
one agent produces cleaner code while another catches an edge case the first missed. You
are sampling the solution distribution and taking the max, instead of betting the whole
task on one draw.

This is why best-of-N pairs naturally with **cross-model** runs — the same prompt to two
different vendors' agents, not just temperature variance on one model. Different models
have different blind spots, so the spread of solutions is wider and the max is higher.
That overlaps with the general case for vendor diversity, but the goal here is different:
cross-checking is "two agents verify one answer for correctness"; best-of-N is "N agents
*generate* and you keep the best one."

## Worktrees are load-bearing — the same isolation, different purpose

The execution substrate is identical to decomposition: each run gets its own git
worktree (separate dir, branch, HEAD, dev-server port over one shared `.git`) so the N
runs never collide. Most agent tooling now auto-places each dispatched session in its own
worktree, and the extreme form is fanning a single change out into many worktree-isolated
subagents, each opening a PR. But note the difference in *intent*: in decomposition,
worktrees defer conflicts to a real merge; in best-of-N, **there is no merge to defer
to** — N−1 worktrees are deleted unmerged. Cleanup is the same unsolved chore (worktrees
never self-remove), it just applies to the losers.

## The economics: you pay N×, and the cost is real

Best-of-N is the most expensive parallel pattern per unit of shipped code, because the
discard is built in:

- **Token cost scales linearly with N**, and N−1 of those token-spends produce nothing
  you keep. This is a *deliberate* trade — variance is not free.
- **The operator becomes the bottleneck.** Once you fan out beyond ~2–4, the constraint
  stops being the model and becomes *you*, reviewing diffs to pick the winner. The
  comparison/selection step does not parallelize the way generation does.
- **Selection needs a real criterion.** "Pick the one that looks nicer" doesn't scale
  past a couple of candidates. For larger N, rank by *pairwise comparison* — ask a judge
  which of two diffs is better, run a small tournament — rather than asking for absolute
  scores, which LLM judges calibrate poorly. And gate the winner behind a validator agent
  or integration tests before merge: a green diff in isolation is not a correct diff.

## When best-of-N is worth it (and when it isn't)

- **Worth it:** high-stakes, hard-to-specify tasks where the *best* solution matters more
  than throughput — a tricky refactor, an ambiguous bug fix, a design-sensitive API. Also
  good unattended/overnight: kick off N headless runs, review the spread in the morning.
- **Not worth it:** routine, well-specified changes where any correct solution is fine —
  there best-of-N just burns N× tokens for a result one run would have produced. I default
  to single-agent (a Princeton study found a single agent matches multi-agent setups on
  ~64% of tasks) and escalate to best-of-N only when the cost of a mediocre solution
  exceeds N× the token cost.

## The one-line rule

Decomposition divides work and merges everything; best-of-N **duplicates** work and
keeps one. If you find yourself trying to *merge* two outputs of the same prompt, you
picked the wrong pattern — best-of-N's merge step is `git worktree remove` on the losers.

## Sources

- [How to run multiple AI coding agents — Warp docs](https://docs.warp.dev/guides/agent-workflows/how-to-run-multiple-ai-coding-agents/)
- [Run parallel sessions with worktrees — Claude Code docs](https://code.claude.com/docs/en/worktrees)
- [Parallel Agentic Development — MindStudio](https://www.mindstudio.ai/blog/parallel-agentic-development-claude-code-worktrees)
- [How to Run Claude Code Agents in Parallel — Towards Data Science](https://towardsdatascience.com/how-to-run-claude-code-agents-in-parallel/)
