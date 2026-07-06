---
type: deep-dive
title: "Enforcement stacking is a floor, not a ceiling — long-horizon drift needs its own detector"
description: "A full hook + memory + skill stack raises the per-turn floor but does not cap multi-day architectural drift, which needs a separate periodic conformance check."
tags: [agentic-harness, architectural-drift, long-horizon, hooks, conformance-check, guardrails]
date: 2026-06-16
source: "original — analysis anchored on a public Claude Code issue (#60506)"
relates: []
---

# Enforcement stacking is a floor, not a ceiling — long-horizon drift needs its own detector

There is an implicit promise behind the standard agent-hardening recipe: wire up hooks
(PreToolUse gates, PostToolUse checks), pin a memory layer, install skills that fire the
right discipline — and the agent will *stay on the rails*. The promise is half true. The
recipe raises the **floor** of any single turn. It does not put a **ceiling** on how far the
agent can wander over a multi-day run. Those are different guarantees, and conflating them is
the trap.

## The field evidence

A 2026-05-19 practitioner self-report on the Claude Code issue tracker
([anthropics/claude-code#60506](https://github.com/anthropics/claude-code/issues/60506)) is
titled almost as a confession: *"six days of architectural drift on a customer project despite
full hook + memory + skill enforcement."* The setup was not thin — it was the full stack,
exactly what you'd recommend. And it still drifted, slowly, over six days, in a way no
individual hook or skill invocation caught. That is the whole point: every turn passed its
local checks, and the *aggregate trajectory* still left the intended architecture behind.

## Why a per-turn gate can't catch drift

A PreToolUse gate, a skill trigger, an acceptance-criteria check — these are all **local,
per-turn** instruments. They answer "is *this* edit/tool-call allowed / correct?" Drift is
not a property of any one turn. It is a property of the *sequence*: each edit is individually
defensible, but turn 40 has quietly redefined a boundary that turn 3 set, and turn 80 builds
on turn 40's version. No local check fires, because at no single step did anything obviously
illegal happen.

This is a granularity mismatch, and it is the same reason an independent per-run validator
beats per-turn rubrics: a rubric can pass at every step while the run as a whole fails. Drift
is that mismatch on the *architecture* axis instead of the *correctness* axis.

## The missing mechanism: a drift detector as its own loop

The fix is not "more hooks" — adding local gates does not sum to a global guarantee. The
missing piece is a **separate, periodic conformance check** that compares the current state of
the codebase against the *frozen architectural intent* (the approved plan, the ADR, the
boundary rules), and runs on a different cadence than the turn loop:

- **Different input** — it reads the accumulated diff / current module graph, not the single
  pending tool call.
- **Different cadence** — every N tasks, or at each task seam, not every tool call. Drift is
  cheap to let accrue for a few turns and expensive to check every turn.
- **Different oracle** — it checks against the plan/ADR as the source of truth. This is why
  architectural decisions belong on the plan, not buried in the code: if the intent never got
  written down in a stable place, there is nothing for the detector to diff against, and drift
  is undetectable by construction.
- **Different action on failure** — not "block this edit" but "the trajectory has bent; stop
  and re-anchor / re-plan." That is a rewind at the architecture grain, not a per-edit veto.

If you want to go further than a binary pass/fail, you can treat drift as a measurable index
over a run rather than an event. But the operational takeaway is narrower: **you must run a
check whose unit of analysis is the run, not the turn.**

## The boundary this clarifies

Sort harness mechanisms into two piles. Per-turn deterministic enforcement — the hooks and
gates — is durable and necessary, but it is scoped to *"this operation is allowed."*
Long-horizon architectural coherence is a *third* thing: not a per-turn policy, and not
something the model reliably self-maintains over days. It needs an explicit, scheduled
detector. Treating "I wired up hooks + memory + skills" as if it also bought you
drift-resistance is the category error — you bought a higher floor, and the ceiling is still
open.

## TL;DR

- A full hook + memory + skill stack raises the **per-turn floor**; it does **not** cap
  **long-horizon architectural drift**. Field report: six days of drift under the full stack
  ([#60506](https://github.com/anthropics/claude-code/issues/60506)).
- Per-turn gates are **local** instruments; drift is a property of the **sequence** — every
  turn passes, the trajectory still bends. Same granularity mismatch as per-turn rubrics
  passing while the whole run fails.
- The missing mechanism is a **separate, periodic conformance check**: it reads the accumulated
  state, runs at task seams, diffs against the *frozen plan/ADR*, and on failure re-anchors /
  re-plans rather than blocking a single edit.
- Precondition: the architectural intent must be written to a stable place (plan/ADR) or there
  is nothing to diff against — drift becomes undetectable by construction.

## Sources

- [anthropics/claude-code#60506](https://github.com/anthropics/claude-code/issues/60506) —
  practitioner self-report: "six days of architectural drift on a customer project despite full
  hook + memory + skill enforcement" (2026-05-19).
