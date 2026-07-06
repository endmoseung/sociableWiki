---
type: deep-dive
title: "Cache-stable harness design — \"don't break the prefix\" as a cross-vendor discipline"
description: In a long agent loop the prompt cache is a structural property of how you rebuild the prompt every turn, not a flag — you preserve hits by construction, and small harness decisions silently bust them.
tags: [prompt-caching, agent-harness, prefix-cache, latency, cost-optimization, mcp-tools]
date: 2026-06-10
source: "Synthesizes the 'Don't Break the Cache' arXiv eval (2601.06007), the Unsloth changing-header finding, and OpenAI's Codex prefix discipline — see Sources."
relates: [ai-native/fork-vs-fresh-subagent]
---

## TL;DR

Prompt caching is usually filed under "API cost optimization" — a knob you turn on. The
2026 reframe: in a long agent loop, the cache is a **structural property of how you build
the prompt every turn**, not a flag. The single rule that governs the whole thing is *any
change to the prefix invalidates everything after it* — so cache hits are something you
**preserve by construction**, and a fleet of small, well-meaning harness decisions
(re-ordering tools, injecting a fresh timestamp, rebuilding the system prompt on compaction)
silently bust it every turn. This note is the **provider-agnostic discipline** —
"append, don't modify; volatile last; exclude tool results" — and why it now has hard
numbers behind it. The Claude-specific *syntax* (`cache_control`, TTL, `defer_loading`) is a
layer below this; this is the layer above: what to do regardless of vendor.

---

## Why this is a harness problem, not an API problem

The mechanism is the same across Claude, OpenAI Codex, and local prefix-caching backends
(vLLM / SGLang KV-cache reuse): the engine matches the **longest identical prefix** of the
request against what it already computed, and reuses that work. The prefix order is always
the same shape — `tools → system → messages` — and the rule is brutal and universal:

> **A single differing token anywhere in the prefix invalidates the cache from that token
> onward.** One character changed in a 5,000-token system prompt recomputes all 5,000.

That makes caching the use case agentic AI benefits from *most* — coding agents run 30–50+
tool calls per session, re-sending a large stable prefix every turn — and the one that
suffers *most* when a harness quietly mutates that prefix. The cost lever is real: on
cache-heavy workloads, caching is the single biggest lever available (70–90% savings). The
missing half is that you don't "turn it on" — you **stop breaking it**, turn after turn.

---

## The empirical case (Jan 2026): naive full-context caching can be *worse*

"Don't Break the Cache" (arXiv 2601.06007) is the first cross-provider evaluation
(OpenAI GPT-5.2/GPT-4o, Anthropic Claude Sonnet 4.5, Google Gemini 2.5 Pro) on
long-horizon agentic tasks. The headline numbers:

- **Cost savings: 41–80%** across providers.
- **TTFT (time-to-first-token) improvement: 13–31%** across providers.

But the decision-shaping finding is the counterintuitive one:

> **System-prompt-only caching beats naive full-context caching** — on both cost *and*
> latency, *and more consistently*.

Naive "cache everything" can **regress latency**, because dynamic tool calls and results
trigger cache *writes* for content that will never be reused across sessions — you pay the
1.25–2× write premium on garbage. The sharpest data point: GPT-4o saw a **+30.9% TTFT
improvement** with system-prompt-only caching but an **−8.8% TTFT regression** with
full-context caching. The fix is boundary placement, not more caching: **cache the stable
head, put dynamic content at the end of the system prompt, and explicitly exclude tool
results.**

So "should I cache more?" is the wrong question. The right one is "**where is my last stable
token, and is my breakpoint on it?**"

---

## The three invariants (vendor-agnostic)

These hold whether you're hand-rolling a harness, using the Claude API, or running a local
model behind SGLang:

1. **Append, don't modify.** When config changes mid-run (new working directory, approval
   mode flips, a memory loads), **append a new message** stating the change — never edit an
   earlier message or rebuild the system prompt. OpenAI's Codex CLI treats this as
   first-class: system instructions, tool definitions, sandbox config, and environment
   context are kept byte-identical and identically *ordered* between requests; runtime
   changes are appended. Editing the prefix to "keep it clean" is the classic
   self-inflicted miss.

2. **Volatile content goes last.** User input, per-request values, session-specific data —
   anything that differs between turns belongs *after* the cache breakpoint, never before
   it. A timestamp or session ID near the top of the prompt is a cache-buster on every
   single turn.

3. **Keep the tool surface stable.** Adding/removing/re-ordering a tool definition
   invalidates the prefix from that tool onward. This collides head-on with **dynamic MCP
   tool discovery**, where the available tool set varies by connected server. The escape
   hatch is deferred tool loading (e.g. Claude's `defer_loading` / a Tool Search Tool): keep
   a small fixed core in the cached prefix, and load discovered tools as appended references
   that don't touch the prefix. The general version of this rule: *a fixed set of reusable
   tools + dynamic capability via code-gen* beats a tool list that mutates per turn.

---

## The pitfall worth memorizing: the changing-header cache-buster

The most expensive cache miss is the one you can't see, because it's upstream of your
prompt. In early March 2026 the Unsloth team found that **Claude Code (post-Jan-2026
builds) prepended a per-message attribution header** — carrying a session ID / turn counter
/ timestamp — to the *very beginning* of every message. Because that changing text sat at
the front of the prefix, it **invalidated the cache on every single turn** for anyone
routing through it. Nothing in your own prompt was wrong; the harness in front of you was
mutating byte 0.

This is the debugging fingerprint to keep on file: **cache hit rate near zero despite a
"stable" prompt → something is injecting a varying value into the prefix head.** Suspects,
in order: a timestamp/UUID in the system prompt, a re-ordered tool array, a mid-conversation
system-prompt rebuild (often triggered by a memory-injection or compaction step), or an
upstream harness header you don't control. Provider cache-diagnostics (e.g. a
`cache_miss_reason` field) exist precisely to point at the divergence — use them before
guessing.

---

## The compaction collision (the non-obvious trap)

Two good practices fight each other. The standard long-horizon advice is *compact early,
while the cache is warm.* But compaction **rewrites the message history** — which is exactly
the prefix mutation that nukes the cache. The reconciliation:

- Compaction is a **deliberate, accounted-for cache reset**, not a leak. You pay one full
  recompute to buy a smaller, cheaper prefix for the *next* hundred turns. Time it for a
  natural boundary (task switch), not mid-step.
- What you must *not* do is the silent version: a memory layer that auto-rebuilds the
  system prompt "every N turns" busts the cache every N turns with no corresponding benefit
  — a real bug filed against agent frameworks in 2026. Rebuild on a *decision*, never on a
  *timer*.

This is the same boundary that governs the fork-vs-fresh subagent choice: fork to keep the
warm prefix, go fresh only when the new context is worth the cold start.

---

## So what — the checklist

- **Measure first.** Read `cache_read` vs `cache_creation` (or your backend's hit-rate
  metric) before optimizing anything. Near-zero read with a "stable" prompt = a prefix
  mutation hunt, not a tuning problem.
- **Default to system-prompt-only caching**, not cache-everything. The arXiv evidence says
  the naive maximum can cost you latency.
- **Append on config change. Volatile last. Tools fixed.** The three invariants above are
  vendor-agnostic; the per-provider syntax for them lives in each vendor's caching docs.
- **Treat compaction as a budgeted reset**, fired on a task boundary — never on a turn
  timer.
- **For 100+ tool libraries**, lean on deferred/searched tool loading so dynamic discovery
  doesn't touch the cached prefix.

---

## Sources

- [Don't Break the Cache — long-horizon agentic prompt caching eval (arXiv 2601.06007)](https://arxiv.org/abs/2601.06007)
- [Prompt caching for AI agents — boundaries without breaking context](https://medium.com/@arvisionlab/prompt-caching-for-ai-agents-how-to-cut-cost-and-latency-without-breaking-context-245dc2502b4b)
- [Unsloth: Claude Code changing-header cache invalidation finding (Mar 2026)](https://thinksmart.life/research/posts/kv-cache-local-inference/)
- [OpenAI Codex append-don't-modify prefix discipline](https://developers.openai.com/cookbook/examples/prompt_caching_201)
