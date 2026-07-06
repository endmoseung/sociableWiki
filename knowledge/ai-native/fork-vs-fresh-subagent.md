---
type: reference
title: "Fork vs fresh subagent: the cache-reuse gate after isolation pays off"
description: "Once you've decided to spawn, forking the parent vs opening a fresh subagent is a prompt-cache economics decision, not a capability one."
tags: [subagents, fork-mode, prompt-caching, orchestration, token-economics]
date: 2026-06-09
source: original
relates: []
---

## TL;DR

Deciding *whether* to isolate work into a subagent is its own question — two gates: is the context disposable, and does the task clear the ~2–3K-token spawn floor. This note is about the **third gate, which only fires after isolation has already won**: once you're spawning, do you **fork** the parent or open a **fresh subagent**?

The distinction is pure cache economics, not capability:

- **Fork** = the child inherits the parent's system prompt and tool definitions *byte-for-byte*. Its first request therefore **hits the parent's prompt cache** — the shared prefix is billed at ~0.1× (10%) instead of full price. You pay full price only for the new task-specific tail.
- **Fresh subagent** = a different system prompt and (usually) a different tool list. The prefix doesn't match any cached entry, so the worker **re-pays the full floor** and cold-gathers its own context.

Rule of thumb I default to: **same role + same tools as the parent → fork. Genuinely different role or tool set → fresh.** Forking is the cheaper of two already-justified spawns; it is not a reason to spawn when staying inline would have done.

## Why the cache prefix is the whole game

Prompt caching bills a matched, stable prefix at 10% of input price — but the cache matches a prefix *byte-for-byte, or it misses entirely*. That all-or-nothing matching is exactly what makes fork-vs-fresh a real decision rather than a vibe:

| | Fork | Fresh subagent |
|---|---|---|
| System prompt | identical to parent → **cache hit** | different → cache miss |
| Tool definitions | identical to parent → **cache hit** | usually different → cache miss |
| Task tail | new, full price | new, full price |
| Effective entry cost | ~10% of the shared prefix + tail | full prefix + tail |

The savings scale with **how big the shared prefix is**. A parent loaded with a long system prompt plus 20 tool schemas has an expensive prefix; forking turns that from a full-price reprocess into a 10% one on every child's first turn. A thin parent has little prefix to save, so the fork advantage shrinks toward zero.

## The decision, as a gate after the floor

Run it *only* once the two earlier gates have already said "spawn":

1. **Does the child need the parent's exact system prompt + tools?**
   Yes → **fork.** You get the work isolated *and* the prefix at 10%.
   No (different specialist role, narrower or different tool list) → **fresh.**
2. **Will the child mutate files that must not touch the parent's checkout?**
   Yes → fork with worktree isolation (the fork's edits land in a separate git worktree). This is orthogonal to the cache question — a fork can both reuse the cache *and* sandbox its writes.

The trap to avoid: **forking to "save tokens" on work that should have stayed inline.** A fork is still a spawn — it still pays the latency floor and a re-gather tail. The cache discount only applies to the *prefix*, not to the cold-start work. So fork-vs-fresh is strictly *downstream* of the floor gate; it never resurrects a spawn the floor gate killed.

## How this connects to the multi-agent cost multiplier

Multi-agent runs have been measured at roughly 4–15× the tokens of a single agent, and the reason is the spawn floor: each worker re-pays a fixed entry cost, and those costs **add, not amortize**. Fork mode is the one lever that *partially* amortizes them — by sharing the parent's cached prefix, a fleet of forks pays the expensive prefix once at full price (the parent's own turn) and ~10% on each fork's first turn, instead of full price N times. It doesn't remove the multiplier, but on a parent with a heavy prefix it meaningfully bends it down. Same-role fan-out (N identical reviewers, N identical file-readers) is where forking pays the most; a fleet of *distinct* specialists gets little from it because each one needs its own prefix anyway.

## One-line heuristic

After the two spawn gates say "go": **fork when the child is the parent minus the task; go fresh when the child is a different agent.** The cache prefix decides — and it only ever discounts an *already-justified* spawn.
