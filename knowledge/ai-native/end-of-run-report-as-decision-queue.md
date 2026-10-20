---
type: pattern
title: "The end-of-run report is a decision queue, and silent assumptions are its leak"
description: "Once an agent is told to keep going past non-blocking choices, its final report becomes the only place a human can veto those choices — so the report must list the assumptions it made, not just what it needs."
tags: [agent-autonomy, reporting, human-in-the-loop, claude-md, long-running-agents]
date: 2026-10-11
source: "External-derived — Anthropic's Opus 5.5 guidance for Claude Code; see Sources."
relates: [ai-native/agent-writable-trace-is-testimony, dev-process/completion-means-verification-output, dev-process/planner-generator-evaluator-loop, ai-native/suggested-prompt-self-authored-instruction]
---

# The end-of-run report is a decision queue, and silent assumptions are its leak

## TL;DR

Anthropic's guidance for getting long runs out of Opus 5.5 in Claude Code (October 2026) pairs two pieces of advice: a CLAUDE.md rule telling the agent to keep going unless it is truly blocked or about to do something destructive, and a reading tip — check the "needs from you" part of the final summary first.

I read those as one design move, not two tips. A keep-going rule does not remove the human's decisions from a run. It **moves the non-blocking ones to the end and batches them**. The final report stops being a status recap and becomes the human's **decision queue**.

That queue has a structural leak the guidance does not mention. An agent that keeps going past a non-blocking choice has to pick something. If that pick never reaches the report, the decision was made silently, and nobody had a chance to veto it.

(How to bound and resume the run itself is a separate topic. This note is only about what the report at the end has to carry.)

## Where human decisions go under a keep-going rule

```
Check-in cadence                      Keep-going cadence
──────────────────────                ─────────────────────────────────────
step → ask → wait → step → ask        step → step → (assume) → step → … → REPORT
human decides inline, N times         human decides once, from the report
```

A long run has three kinds of decision moment:

| Moment | What the agent does | Where the human sees it |
|---|---|---|
| Blocking (cannot continue) | Stops and asks | Mid-run question |
| Destructive (delete, force-push, outside the repo) | Stops and asks | Mid-run permission prompt |
| Non-blocking choice (a name, a fallback, a scope edge) | **Picks a default and continues** | The final report — *only if the agent writes it down* |

The third row is the one that changed. It used to be an interruption. Now it is a default the agent chose on your behalf, and the report is the only place you can still reverse it.

## Why "needs from you" leaks

A "needs from you" section lists what the agent *knows* is still open. A choice it already resolved does not feel open to it anymore. That is exactly the class of decision the keep-going rule created. So the resolved-by-assumption items fall out of the queue precisely because the agent stopped experiencing them as decisions.

This is the same self-report problem as a subagent's return summary, only aimed at the human: the completeness of the report rests on the agent's own testimony. You cannot fix that by asking the agent to "be thorough". You fix it by giving assumptions their own named slot, so leaving one out becomes a visible omission rather than an invisible one.

## The report contract I put next to the stop rule

I keep the report shape in the same CLAUDE.md block as the keep-going rule, ordered by what costs me most to miss:

```
End every long run with, in this order:
1. Needs from you — decisions only I can make, each with your default if I don't answer.
2. Assumptions made instead of asking — each non-blocking choice, what you picked,
   how to reverse it.
3. Not verified — what you changed but could not prove (no test, no run, no repro).
4. Done — what changed, with evidence (test output, file:line).
```

- **Section 2 plugs the leak.** It turns silent defaults into reviewable items.
- **"Your default if I don't answer"** in section 1 makes the queue safe to leave unread for a while, without making it safe to ignore.
- **Section 3 keeps "done" honest.** Unproven changes cannot hide inside the success list.
- **"Done" comes last on purpose.** It is the section I need least; the agent will have told me plenty about it already.

The ordering matters more than the wording. If the report opens with a long success recap, I skim, and the two sections that actually need me get skimmed with it.

## When this is wrong

- **Short, interactive runs.** If I am reading every reply, a mid-run question costs almost nothing and the report contract is pure overhead.
- **A bloated assumptions list.** If section 2 grows to dozens of trivial items, I start skimming it, and the queue degrades into the same unread recap it was supposed to replace. Trim it to choices that change behavior or a public surface (an API shape, a file name other code imports, a user-visible string).

## Sources

- Anthropic, "Getting the most out of Opus 5.5 in Claude and Claude Code" (claude.dev blog, October 2026) — the keep-going stop rule for CLAUDE.md, the advice to read the "needs from you" part of the summary first, and the expectation of longer autonomous runs. Also discussed on Hacker News.
- The three-moment table, the assumption-leak argument, and the four-section report contract are my own inference from that guidance, not claims made by the source.
