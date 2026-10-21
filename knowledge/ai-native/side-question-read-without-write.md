---
type: reference
title: "A side question is a read without a write"
description: "Every message to a running agent is a write into its context, so a 'quick question' is not free; a side channel like /btw reads the session without writing back — which also means a decision reached there never reaches the main agent."
tags: [claude-code, context-hygiene, side-question, subagents, conversation-history]
date: 2026-10-12
source: "External-derived — Claude Code docs on side questions (/btw); see Sources."
relates: [ai-native/clear-vs-compact-vs-autocompact, ai-native/fork-vs-fresh-subagent, ai-native/suggested-prompt-self-authored-instruction, ai-native/rewind-coverage-gap]
---

# A side question is a read without a write

## TL;DR

Every message you type into a running coding-agent session is a **write** into the agent's working context. A "quick question" — "what was that config file again?" — lands in history, competes for attention with the task, can survive into a compaction summary, and can be read as a redirect.

Claude Code's `/btw` is the first mainstream primitive I know of that separates the two operations. It gives you a **full read of the session context with no write back into it**, and no tools.

That split carries a rule people miss: **`/btw` is for reading, never for deciding.** Whatever you conclude in the side channel is invisible to the main agent. If the answer changes what the agent should do, you have to say it again as a normal turn.

## Four context operations, by what they read and write

| Operation | Reads the parent context | Has tools | Writes into parent history |
|---|---|---|---|
| Normal turn | Full | Yes | Yes (question, answer, tool results) |
| `/btw` side question | Full, minus the reply still being written | **No** | **No** |
| Subagent | Only its brief | Yes | Its summary only |
| Fork (from `/btw`, or a forked subagent) | A full copy | Yes | Its summary only |

I read the table as a decision procedure:

- To **recall** something already in the session (a file the agent read, a choice it made, a value it printed) → `/btw`. No pollution, and cheap while the prompt cache is warm.
- To **find out** something new → a subagent (scoped by its brief) or a fork (scoped by the whole context). `/btw` cannot read files or run commands. If the side answer contains what looks like tool calls written out as text, nothing actually ran.
- To **change the course** of the task → a normal turn. It is the only one of the four that writes.

## Why asking the main agent is not free

1. **A question is instruction-shaped.** Mid-refactor, "which test framework are we using?" can read as a hint that something about the test framework is wrong, and the agent may start re-checking it. A question steers whether you mean it to or not.
2. **It persists.** The exchange stays in history, and a later compaction may fold it into the summary as though it were a requirement of the task.
3. **It interrupts.** A normal turn either queues behind the running one or breaks into it. A side question runs alongside without interrupting.

## How the side channel itself fails

- **Decision leak.** You and the side answer agree that approach B beats the approach A the agent is executing. The agent never saw that conversation. Nothing changes until you type it as a real turn. I treat the side channel as read-only by policy, not just by mechanism.
- **Recollection, not verification.** Side answers come from what is in context, so they report what the session *believed*. That can be stale against disk: files edited since, a branch switched. For anything that gates an action, escalate to a fork so the claim gets re-read from the repo.
- **Blind to the reply in flight.** A side question asked during a turn sees everything except the reply still being written, so "what did you just change?" can miss the change in progress.
- **The side thread has its own memory.** As of October 2026 the docs say the most recent 20 side exchanges are replayed with each new side question until you clear them. Old side answers can anchor new ones, so clear the thread when you switch topics.

## When this is wrong

If the "side" question is really a course correction you are reluctant to make explicit, routing it through `/btw` hides the steer from the history where it belongs. In that case the pollution is the point, and a normal turn is the right tool.

## Sources

- Claude Code documentation, "Interactive mode — Side questions with /btw" (read October 2026): no history write, no tool access, recent side exchanges replayed, sees everything except the in-flight reply, and an option to fork into a tool-capable subagent.
- Practitioner roundups from 2026 that list `/btw` alongside `/clear`, `/compact`, and `/rewind` as context-hygiene moves (saascity.io, smartscope.blog).
