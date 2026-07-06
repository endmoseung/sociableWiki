---
type: pattern
title: "/clear vs /compact vs autocompact — decide at the task seam, not at a token threshold"
description: The context write-action you pick is chosen at the boundary between sub-tasks, not when the fill gauge crosses a percentage.
tags: [context-management, claude-code, compaction, agent-workflow, prompt-context]
date: 2026-06-16
source: "Synthesis of practitioner blog posts (see Sources)"
relates: []
---

# /clear vs /compact vs autocompact — the write-side decision at the task seam

Steering an agent's context has a **read** side and a **write** side. The read side is the fill gauge — the little "context used" meter is your instrument, not decoration; you watch it to know how close you are to the cliff. The write side is the set of actions that actually change what's in the window: `/compact`, starting a new session (`/clear`), and spawning a subagent. Most advice covers the read side and the *timing* of compaction, then stops. This note fills the gap it leaves: **once you decide to act, which write action do you pick, and on what signal?**

## The signal is the task seam, not the percentage

Autocompact fires on a clock the model **cannot see**: the window crosses some fill threshold and the harness summarizes mid-turn, with no knowledge of whether you are mid-hypothesis, mid-debug-loop, or at a clean handoff point. Practitioners call the result **"lobotomization"** — post-compaction the agent loses track of which files it already edited, forgets a constraint you stated twice, and drops a skill you invoked. (An invoked skill is not pinned in context; a compaction pass can truncate it right back out.) The failure is not that the summary is lossy in general; it is that the **cut lands at a token-arbitrary point instead of a task-arbitrary one.**

So the operating rule inverts the default: **don't wait for the threshold to choose the moment — let the task boundary choose it.** Act at the seam between sub-tasks (feature done, bug fixed, refactor landed), the same checkpoint logic as a git commit. You don't wait until the working tree is a mess; you commit at logical breakpoints.

## The three actions differ on a cost × fidelity axis

| Action | Token cost of the act | Window after | When it's right |
|---|---|---|---|
| **`/clear`** | **~0** (drops history, fresh full window) | clean, empty | **At a task seam, *after* you've persisted what matters** to a file / memory file / instructions file. The next task doesn't need this one's transcript. |
| **`/compact`** | pays tokens to write a **lossy summary**, then carries it | summarized, same thread | **Mid-task**, same goal, when you're near the recency-bias zone but still need the gist of what just happened and don't want to reload everything. |
| **let autocompact fire** | pays for the summary **and** for the bloat that triggered it | summarized at a blind point | **Almost never by choice** — it's the seatbelt, not the steering wheel. If it fires, treat it as a signal you missed a seam. |

Two non-obvious points:

1. **`/compact` is not free and `/clear` is.** `/compact` spends tokens summarizing; `/clear` costs zero and hands back a full window. So at a *boundary* (unrelated next task) `/clear` strictly dominates `/compact` — you were going to discard the transcript anyway, so don't pay to summarize it. `/compact` keeps a real use **only mid-task**, where the summary is the point.

2. **`/clear` has a precondition `/compact` doesn't: you must externalize first.** Because `/clear` is total amnesia, the durable state has to already live *outside* the window. That is the "intentional compaction" move — the human writes the summary to a file rather than letting the model summarize itself. `/clear` without that step throws away work; `/clear` after it is the cleanest possible handoff. The two are a pair: write the summary to disk, *then* clear.

## How to apply

- **Steer by the seam, not the gauge alone.** Use the gauge as the *read* (am I near the cliff?), but trigger the *write* at the nearest task boundary, not at the % itself.
- **Default at a boundary: persist → `/clear`.** Flush the durable delta to a file, then wipe. A zero-token clean window beats a paid lossy summary you didn't need.
- **`/compact` is the mid-task tool only** — same goal, want to keep going, don't want to re-establish context.
- **Treat an autocompact event as a miss**, not a save: it means a seam went by unclaimed. Compaction is least-bad when *you* place the cut, not the clock.

## Caveat on the numbers

Community reports float specific autocompact thresholds (fires "around 80%", "earlier than before at ~64-75%", and large-window misfires) and per-compaction token figures. Those are **practitioner estimates, version-dependent, and not first-party-measured** — the harness has also shipped timing changes, so any single number is a moving target. The *decision rule* (act at the seam; `/clear` at boundaries, `/compact` mid-task) is robust to the exact threshold; do not hardcode a percentage from a blog post.

## Sources

- "Stop Claude Code from Lobotomizing Itself Mid-Task" — ianlpaterson.com (the refactor-killed-mid-task account; the "lobotomization" framing).
- "Never Let Claude Code Auto-Compact Again" — nathanonn.com.
- "How Claude Code Got Better by Protecting More Context" — hyperdev.matsuoka.com (auto-compact timing improvements; the ~64-75% hypothesis).
- Claude Code Compaction course notes — stevekinney.com; CometAPI, "What Is Auto Compact in Claude Code" (`/clear` = zero-token clean window vs `/compact` = lossy summary; `/clear` between unrelated tasks).

All figures above are practitioner estimates, not benchmark- or paper-measured. Specific thresholds are deliberately not asserted as fact.
