---
type: deep-dive
title: "Coding-agent cost economics — token budgeting and model×effort routing"
description: "Most agent spend is a routing problem, not a reasoning problem; in 2026 routing became two axes — which model × how much effort — and subagents buy clean context at ~7× the token volume."
tags: [ai-native, coding-agents, cost-economics, model-routing, subagents, prompt-caching]
date: 2026-06-07
source: "Synthesized from public model pricing, SWE-bench Verified figures, and Anthropic's published advisor-pattern testing (see Sources)."
relates: []
---

## TL;DR

Most agent spend is a **routing problem, not a reasoning problem** — teams pay Sonnet
rates for classification work. The 2026 shift: routing is now **two axes, not one** —
*which model* (capability ceiling) × *how much effort* (how much of that ceiling it
spends per call). Subagents are not free: they trade token volume (~7× a single thread)
for clean context. The decision is always "is the saved main-context clutter worth more
than the per-subagent startup overhead?" This note is the **spend** lens — the
context/isolation trade-off and the long-horizon-run trade-off are separate questions.

---

## Why cost accumulates: the quadratic re-send

Every turn re-sends the **entire** conversation as input tokens. Message 201 costs as
much input as messages 1–200 combined. Input grows quadratically with session length —
so a 2-hour session isn't 2× a 1-hour one, it's much worse. Two consequences:

- **Context quality degrades at ~50% full, not 100%.** Past the halfway mark you're
  already getting worse answers *and* paying more per turn (the "agent dumb zone").
  Compact early — while the cache is still warm — rather than waiting for auto-compact.
- **The always-loaded rules file is never evicted.** A persistent instruction file
  (`CLAUDE.md` or equivalent) sits in context every turn for the whole session. A
  5,000-token rules file costs 5,000 tokens on turn 2 and on turn 200 alike. Keep it
  lean; this is a fixed tax on every single call.

---

## The two-axis routing model (the 2026 change)

For two years the playbook was one axis: cheap model for easy tasks, expensive model for
hard ones. Recent Claude models added **adaptive thinking** — an `effort` parameter that
lets one model dynamically allocate its reasoning budget per request. Routing is now a
matrix:

| Axis | What it picks | Knob |
|------|---------------|------|
| **Model** | the *capability ceiling* | `haiku` / `sonnet` / `opus` |
| **Effort** | *how much of that ceiling* it exercises this call | `low` / `medium` / `high` / `xhigh` / `max` |

Caveats that matter:
- `xhigh` effort is **Opus-only**. **Haiku does not support `effort` at all.**
- The striking data point: **Sonnet 4.6 @ medium effort scores 79.6% on SWE-bench
  Verified — 1.2 pts behind Opus 4.6 @ high (80.8%)** — at roughly 60% of the cost.
  That's ~98.5% of the capability for ~60% of the spend on the most-watched coding
  benchmark. Default to Sonnet; reach for Opus only with *measured* evidence on your
  own tasks.

Pricing anchor (per Mtok in/out): Haiku 4.5 **$1/$5** · Sonnet 4.6 **$3/$15** ·
Opus 4.7 **$5/$25**. Each tier is ~3.75–5× the one below. (Snapshot — check the live
provider pricing page for current numbers.)

---

## The model ladder — practical traffic split

A workable default distribution:

- **Haiku — bottom ~60%.** File navigation, simple edits, linting, classification,
  triage, structured extraction, sub-agent *worker* execution. The biggest single
  saving comes from moving quick edits + code review off Opus onto Haiku.
- **Sonnet — middle ~30%.** The production default. Most coding, multi-step synthesis,
  reasoning. "Default to Sonnet" is the single highest-leverage model rule.
- **Opus — top <10%.** Novel problem-solving, multi-file refactors across tightly
  coupled code, architecture decisions with many simultaneous constraints. Upgrade
  *only* when a comparative eval on your real tasks shows Opus measurably wins.

A routed daily model (illustrative): 1,800 Haiku + 1,050 Sonnet + 150 Opus requests ≈
**$710/mo — ~37% cheaper than all-Sonnet**, while still using Opus where it counts.
Real-world Claude Code use averages ~**$13/dev/active-day** ($150–250/mo); good habits
keep it $5–15/day, bad habits push the *same work* to $20–40/day.

## Role × difficulty × execution-surface routing

Cost routing is not just "which model?" It is **role × difficulty × execution surface**:
what job the agent is doing, how hard this instance is, and where the work actually runs.

| Role | Low difficulty | Medium difficulty | High difficulty | Execution surface |
|------|----------------|-------------------|-----------------|-------------------|
| **Explorer / librarian** | Haiku, low effort | Sonnet, low/medium | Sonnet, medium | Background subagent or read-only CLI so search/log noise stays out of main context |
| **Executor** | Haiku for single-file mechanical edits | Sonnet, medium | Opus only after evidence Sonnet is failing | Main CLI when it edits; isolated worktree only for parallel mutation |
| **Reviewer / verifier** | Haiku for checklist/static checks | Sonnet for behavioral review | Opus adviser for ambiguous architecture/security | Separate review pass with receipts, not the same context that authored the change |
| **Orchestrator** | Sonnet, low | Sonnet, medium | Opus adviser + Sonnet hands-on | Main conversation; keep it lean because every turn re-sends it |
| **Automation / CI loop** | Haiku or deterministic script | Sonnet only for synthesis | Avoid open-ended Opus loops | Headless/background invocation with hard token, time, and retry caps |

The Claude-specific boundary: a custom agent can set its **model** because model choice is
part of that agent's role and tool surface. **Effort is not a custom-agent identity.**
Treat effort/thinking budget as an invocation-level control: CLI flags, background-run
configuration, or an explicit per-task instruction when the surface supports it. Do not
create separate "high-effort reviewer" custom agents just to force thinking depth; that
multiplies routing objects without changing the underlying role.

## The subagent spend calculus

Subagents bill on the **same model, same tokens** — there is no separate, cheaper
billing. What you buy is **context isolation**; what you pay is **token volume**.

- **The 7× rule of thumb.** Subagent-heavy workflows can burn ~7× the tokens of a
  single thread, because *each subagent reloads everything fresh* — system prompt,
  rules file, every file it reads, all billed again. Five subagents = five full context
  loads.
- **Not automatically cheaper.** For small/simple actions (a quick git op, one shell
  command) the architecture's own overhead — prompt, tool schemas, extra round-trips —
  makes a subagent *wasteful*. Rule: spawn only when **saved main-context clutter >
  startup overhead**.
- **Time vs token trade.** Verbose work (tests, doc-fetch, log processing) belongs in a
  subagent so the noise stays out of the main context and only a summary returns. Tight
  *token* budget → run exploration **sequentially**. Tight *time* budget → **parallel**.

Cost-aware subagent practices:
- **Haiku workers + Sonnet orchestrator** also splits rate-limit consumption across two
  pools — not just a price play.
- **Don't blanket-set the subagent model to Haiku** — in Claude Code the
  `CLAUDE_CODE_SUBAGENT_MODEL` env var also drives the **planning** agent, and a weak
  planner compounds errors downstream. Sonnet is the safer subagent default (~40% under
  Opus, minimal quality loss on research/exploration).
- **Bounded > vague.** Subagents with explicit file lists + output schema + token budget
  beat open-ended ones (and the built-in Explore/Plan modes skip the rules file and
  parent git status precisely to stay cheap).
- **Cap parallelism at 3–5.** Reliability beats flooding 20 concurrent requests.

---

## The advisor pattern (when the extra step pays)

Designate **Opus as a non-executing adviser**, Sonnet/Haiku as the hands-on implementer:
Opus plans → cheap model executes → Opus reviews. Anthropic's published testing reports
this advisor pattern is **~11% cheaper and +2% on benchmarks** vs single-model. But it
adds a round-trip — only worth it for *meaningfully complex* tasks; for short formulaic
work a single model wins.

---

## Highest-impact levers (in order)

1. **Prompt caching — the single biggest lever.** Agentic loops re-send a large, stable
   system prompt + tool schema every turn. Caching that cuts input cost **70–90%** on
   cache-heavy workloads. Compact *while the cache is warm*.
2. **Model selection** — Sonnet default, Opus only on evidence.
3. **Effort cap** — set a thinking-token ceiling (e.g. `MAX_THINKING_TOKENS=10000`);
   don't let trivial calls think at max.
4. **Context hygiene** — clear between tasks, compact at ~50%, offload oversized tool
   output to disk (Claude Code persists >50KB results as ~2KB previews; per-message cap
   ~200KB) — keeps the orchestrator's context (and rate-limit use) low.
5. **Specific prompting** — name files, state the outcome, avoid open-ended exploration.

---

## Two traps to audit

- **Silent automation drains.** A cron/loop polling every 5–10 min reloads the full
  system prompt + rules file each time — one observed case did **288 context loads/day**
  on autopilot. Audit recurring runners' actual consumption.
- **Programmatic-vs-subscription billing splits.** Programmatic use (headless `-p` mode,
  the Agent SDK, CI cron) can move off a subscription's rate-limit pool onto a separate
  dollar-denominated credit metered at API list prices. When a provider announces such a
  split, any automated/CI workload's economics change on that date — audit before, not
  after.

---

## Sources

- SWE-bench Verified — public coding-agent benchmark used for the Sonnet-vs-Opus
  capability/cost comparison.
- Anthropic model pricing pages — per-Mtok input/output rates (snapshot; verify current
  numbers before budgeting).
- Anthropic's published advisor-pattern testing — the "~11% cheaper, +2% on benchmarks"
  figure for Opus-as-adviser vs single-model.
- Claude Code documentation — subagent model env var, tool-result disk persistence
  thresholds, and thinking-token controls.
