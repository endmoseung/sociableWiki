---
type: pattern
title: The fan-out scope gate — freeze a filter into a manifest before spawning a batch
description: Before spawning N workers, resolve the filter to an exact list, get the human to confirm it, and freeze it into a claim manifest — workers never see a live filter.
tags: [agent-orchestration, fan-out, human-in-the-loop, batch-safety, prompt-injection]
date: 2026-06-10
source: original
relates: []
---

# The fan-out scope gate — freeze a filter into a manifest before spawning a batch

## TL;DR

The most dangerous moment in fleet work isn't *during* the run — it's the **single
transition from a filter to an action set**. A human asks "fix all the open lint PRs"
and a coordinator agent is one tool call away from spawning N workers against whatever
that filter happens to resolve to *right now*. The cheap, load-bearing control is an
**interview gate**: before any worker spawns, the coordinator (1) runs the filter, (2)
shows the **exact resolved list** back to the human, (3) makes the human confirm that
list, and only then (4) freezes it into a **claim manifest** — batch ID, per-worker
lane, branch/worktree, and an expiry — that every worker reads from. No worker is
spawned against a live filter; they're spawned against a frozen list.

## Why a filter is the unsafe primitive

A filter (`label:lint`, `is:open author:bot`, `all files in src/`) has three properties
that make it the wrong thing to hand a fan-out:

1. **It's unbounded at authoring time.** You don't know the cardinality. "All open lint
   PRs" is 3 today, 40 after a dependency bump tomorrow. The blast radius is whatever the
   query returns when the workers fire — not what the human pictured.
2. **It's live, not frozen.** Two workers can re-evaluate the same filter and both claim
   the same item (double work, merge conflict), or an item can slip in/out between the
   human's "yes" and the spawn.
3. **It's attacker-reachable.** If the filter's inputs are issue/PR/comment content — and
   for batch-over-GitHub work they usually are — then untrusted text decides how many
   workers run and on what. This is the same untrusted-input boundary that prompt-injection
   guardrails police, but here the injection doesn't change *one* agent's action, it
   changes the *count* of agents. The right stance is explicit: treat GitHub
   issue/PR/comment content and PR branch changes as untrusted input that **cannot override
   your agent config or sandbox settings**.

The gate's whole job is to collapse the filter to a list **once**, in front of the human,
and never let a worker see the live filter again.

## What the interview actually elicits

The interview isn't "are you sure? (y/n)". It materializes the things that are implicit
in a terse request and that workers will collide on if left implicit:

| Field | What it pins down | Failure if skipped |
|-------|-------------------|--------------------|
| **Exact target list** | filter → enumerated issue/PR IDs; wildcards allowed only for *discovery*, never for the action set | unbounded fan-out; human approved a number they never saw |
| **Lane assignment** | which worker owns which item + **write-scope exclusions** | two workers edit the same files → merge thrash |
| **Branch / worktree** | one branch + one worktree per worker | shared working tree → corrupted state |
| **Claim metadata** | batch ID, session/thread ID, **expiry (2–4 h typical)** | stale claims never released; a crashed worker's items stay locked forever |
| **Approved goal prompt** | the exact goal text every worker runs, reviewed *before* spawn | N workers confidently execute a misphrased instruction — one underspecified brief, multiplied by N |

The expiry is the part people forget. A claim without a TTL is a deadlock waiting to
happen: the worker that crashed at 30% holds its items until someone manually unsticks
the batch. The manifest is a **lease, not a lock** — the same checkpoint-by-consequence
discipline you'd apply to progress, applied to *ownership* instead.

## Where this sits relative to fleet orchestration

This is a distinct layer from the usual fleet notes — it's the *upstream* gate:

- **Before** the in-flight patterns. ReAct / plan-and-execute / delegation govern behavior
  *once the fleet is running*. The scope gate governs **whether and against what** it
  starts.
- **A different axis than** underspecified briefs. That failure is a single
  orchestrator→worker brief being too terse — a *quality* problem in one lane. The scope
  gate lives at the **human→coordinator** boundary, and its failure is *quantity* (wrong
  number of workers). They compound: a vague brief sent to the wrong *count* of workers is
  the worst case.
- **Refines** the "should I spawn?" decision. That question becomes "I will spawn —
  against *this frozen list*, with *these lanes*, expiring *then*."

## The rule

> A filter is for **discovery**, never for **action**. Resolve the filter → show the
> human the exact list → freeze it into a manifest (batch ID, per-worker lane,
> branch/worktree, expiry) → spawn workers against the manifest. No worker ever
> re-evaluates a live filter.

Two operational corollaries:

- **Workers don't create issues.** Only the coordinator does, and it **deduplicates** —
  otherwise N workers file N copies of the same finding. Any side effect that can fan out
  gets routed back through the single coordinator.
- **Review findings are triaged, not auto-merged.** A human must explicitly waive
  actionable findings to proceed past a blocker. The gate at the front (scope) has a
  matching gate at the back (merge) — both are human-confirm points around the autonomous
  middle.

## Cost / when to skip

The interview is one extra round-trip before the batch. Worth it the moment the action set
is (a) derived from a filter, (b) larger than ~3 items, or (c) sourced from untrusted
content. Skip it only for a hand-typed, fully-enumerated list of 1–2 known targets — at
which point there's no filter to freeze and the gate is a no-op.

## Sources

- The `pr-batch` skill in [shakacode/react_on_rails#3729](https://github.com/shakacode/react_on_rails/pull/3729)
  (2026-06) — turns a terse batch request into an interview-driven launch plan, and
  requires exact target confirmation before spawning workers. This pattern is the field
  anchor for the gate described above.
