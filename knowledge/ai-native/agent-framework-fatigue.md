---
type: deep-dive
title: "Agent framework fatigue: when to skip the framework and use raw APIs or vendor SDKs"
description: "Reach for LangGraph/CrewAI only when the problem is graph-shaped, cross-session, or genuinely multi-agent — otherwise a raw API or vendor SDK ships faster with less lock-in."
tags: [agent-frameworks, langgraph, crewai, vendor-sdk, mcp, orchestration]
date: 2026-06-10
source: "synthesis of external reports (see Sources)"
relates: []
---

## TL;DR

By mid-2026 the "skip frameworks entirely" camp moved from niche to mainstream. The reason is not that frameworks (LangGraph, CrewAI, AutoGen) are bad — it's that teams reach for them by *default* on problems that aren't framework-shaped, and then pay the setup cost, upgrade churn, and mental-model tax with no matching payoff.

My default now: **start on the raw API or a vendor SDK, and only add framework complexity when you hit a specific wall.** The wall is one of exactly three things — a graph-shaped control flow, cross-session state, or three-plus coordinating agents. Absent all three, a framework is overhead pretending to be architecture.

## The failure pattern

The trap is predictable. A team wins one demo with a framework, adopts it as the house default, and only discovers the overhead in production — specifically, once iteration speed starts to matter.

> "I wrapped a linear pipeline with one branch in a state machine framework that required me to maintain type definitions, node signatures, and graph topology every time I wanted to tweak a prompt or adjust a threshold. The overhead of the framework exceeded the complexity of the actual problem."

That is the whole anti-framework case in one sentence: the framework's overhead exceeded the problem's complexity. A framework earns its keep only when the problem is *genuinely* framework-shaped. Most agent problems in production are not.

## The decision heuristic: three questions

Before reaching for a framework, answer these. If all three are "no," you don't need one.

**1. Is the control flow graph-shaped?**
A chatbot is a pipeline. A document processor is a pipeline. A cron job is a pipeline. Control flow is only "graph-shaped" when you have genuine conditional branching, loops that carry state, or dynamic routing between heterogeneous agents. A pipeline with one `if` is still a pipeline — it does not need LangGraph.

**2. Do you need cross-session state?**
If the agent starts and finishes inside one context window with no state that must persist across runs, you don't need a framework's persistence and checkpointing machinery. Structured outputs off the raw API cover it.

**3. Are there more than two agents coordinating?**
This is where frameworks actually pay off. One agent + tools → raw API or vendor SDK. Two agents with a defined handoff → a vendor SDK is usually enough. Three-plus agents with a real topology → now the framework overhead starts to justify itself.

## The "skip frameworks" stack

- **Single agent + 1–2 tools** → raw API (Anthropic / OpenAI) + structured outputs. No framework overhead at all.
- **Single-model agent with tool use** → a vendor SDK (Claude Agent SDK / OpenAI Agents SDK). It handles the tool loop, tracing, and MCP for you.
- **TypeScript app that needs a structured workflow** → the Vercel AI SDK, ideally behind a hexagonal boundary so LLM providers are interchangeable adapters rather than hard dependencies.
- **Python, want minimal magic** → smolagents (HuggingFace): roughly 1,000 readable lines, its CodeAgent writes Python instead of JSON tool calls (which cuts LLM calls by ~30%), no built-in checkpointing. Good for research workflows and HuggingFace-ecosystem teams.

## When a framework *is* the right call

The trend is a reaction to *overuse*, not a blanket rejection. Frameworks earn their overhead in these cases:

| Scenario | Right choice |
|---|---|
| Long-running agentic tasks (hours+) that need checkpointing | LangGraph |
| Audit trails + rollback required (regulated industries) | LangGraph |
| 3+ agents with dynamic routing and shared state | LangGraph or CrewAI |
| Role-based multi-agent with clear decomposition | CrewAI |
| TypeScript-native, full-stack agent app | Mastra |
| Anthropic-native, managed agents, MCP-heavy | Claude Agent SDK |

## Why the vendor-SDK moment is the real structural change

The "skip frameworks" camp only became viable because vendor SDKs matured into production-grade tools:

- **OpenAI Agents SDK** — GA March 2026. Handoffs, guardrails, tracing, streaming. Replaces Swarm.
- **Claude Agent SDK** — GA April 2026. Powers Claude Code internally; treats MCP, A2A, hooks, and computer use as first-class primitives.
- **Google ADK** — GA April 2026. Multimodal, Gemini-native.

These handle the 80% case — single agent + tools, well-defined task — at lower setup cost than any framework. "Reach for CrewAI or LangGraph only when you need multi-agent coordination or graph-shaped control flow" is now mainstream advice, not a contrarian take.

## MCP dissolves the lock-in argument

The historical argument for framework lock-in was: "we can't switch, all our tool integrations are framework-specific." MCP (Model Context Protocol) kills that. A tool integration built as an MCP server is portable across frameworks *and* vendor SDKs — build once, run anywhere.

That's what makes the "start on a vendor SDK, migrate to a framework when complexity warrants" path safe. Previously, switching frameworks meant rewriting every tool integration; now the tools survive the migration. **Build tools as MCP servers from day one** and you keep that optionality for free.

## The overhead that doesn't show up in a demo

- **LangGraph** — steepest learning curve; node/edge/state schema has to be maintained for *every* iteration; the graph topology reshapes whenever requirements shift.
- **CrewAI** — no built-in checkpointing, so a server restart mid-run loses everything; roughly 80% agent success rate in production and ~18% token overhead vs. a comparable LangGraph build; hierarchical crews can fall into circular delegation.
- **AutoGen** — a 4-agent × 5-round GroupChat is 20+ LLM calls minimum; effectively in maintenance mode for new work.

## The honest trade-off table

| Approach | Setup cost | Iteration speed | Complexity ceiling | Lock-in |
|---|---|---|---|---|
| Raw API + structured outputs | Lowest | Fastest | Low | None |
| Vendor SDK | Low | Fast | Medium | Provider |
| smolagents | Low | Fast | Medium | None |
| CrewAI | Medium | Fast to prototype | Medium | Framework |
| LangGraph | High | Slower | High | LangChain ecosystem |
| Mastra | Medium | Fast (TS) | High | Framework |

## My recommendation for a new project

1. **Start with the raw API or a vendor SDK.** Get something working that proves the problem is real before you architect for it.
2. **Add framework complexity only when you hit a specific wall** — a checkpointing need, multi-agent coordination that's genuinely hard, or graph-shaped control flow. Not before.
3. **Build tools as MCP servers from day one.** This is the cheapest insurance against a painful migration later.
4. **If you start on CrewAI for speed, plan the LangGraph migration before you need it.** The migration is non-trivial; the failure mode is discovering that under deadline.

## Sources

- [Why I Stopped Using LangGraph — DEV Community](https://dev.to/deadlocker/why-i-stopped-using-langgraph-4jo2)
- [LangGraph vs CrewAI vs AutoGen in 2026 — DEV Community](https://dev.to/cristian_iridon_286794874/langgraph-vs-crewai-vs-autogen-in-2026-pick-the-right-ai-agent-framework-or-4m2c)
- [Best AI Agent Frameworks 2026 (production rankings) — AliceLabs](https://alicelabs.ai/en/insights/best-ai-agent-frameworks-2026)
- [2026 on-device agents — Hacker News](https://news.ycombinator.com/item?id=46471524)
