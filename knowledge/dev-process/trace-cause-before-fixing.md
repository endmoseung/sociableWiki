---
type: principle
title: Trace the Cause Before You Fix — and Stop After the Same Error Twice
description: When an error hits, don't wrap the failing line; trace the bad value at least two hops back up the call path and name each with file:line, then decide where to fix.
tags: [debugging, root-cause, ai-agents, guardrails, procedure]
date: 2026-07-29
source: original
relates: []
---

# Trace the Cause Before You Fix — and Stop After the Same Error Twice

The fastest-looking fix when something throws is to reach for the line that threw and wrap it: add a null check, drop a `try/catch` around it, cast the value with `as any` to make the type stop complaining. It compiles, the red goes away, and you move on. This is the single most expensive habit I've broken myself of when working with AI coding agents — because the agent is even more eager to do it than I am. The crash site is where the symptom *surfaces*, almost never where the bug *lives*. Guard the symptom and you don't remove the bug; you move it one layer deeper and make the next occurrence harder to find.

So I follow a fixed procedure instead of improvising at the crash site. It has two rules that pair together.

## Rule 1 — trace two hops back before you touch anything

When an error appears, I run these steps in order and I don't skip ahead:

1. **Reproduce it.** Get the failure to happen on demand. If I can't make it recur, I'm not debugging yet — I'm guessing, and any "fix" is unfalsifiable.
2. **Trace the bad value at least two hops back up the call path**, naming each hop with `file:line`. Where did the wrong value enter this function? Who called that function, and what did *they* pass? Two hops is the floor, not the target — I go until I reach the point where the value is *born* wrong rather than merely *passed along* wrong.
3. **Then decide where to fix.** Only after I can point at the origin do I choose the fix location — and it's usually not the line that threw.

The discipline lives in step 2. "I'll just guard this" is what you say when you're standing at the crash site. "I found where the wrong value is born" is what you can say only after you've walked the call path. The rule exists to force the second sentence.

### A concrete trace

Say a component renders and blows up because a `price` field is `undefined` deep in the render tree:

```
CartTotal renders → reads order.items[0].price → undefined → throws
```

The crash-site fix is `order.items[0]?.price ?? 0`. It stops the throw. It also silently ships a cart that shows `$0` for a real product, and now the bug is a wrong number instead of a loud crash — strictly worse.

The traced fix walks back:

- **Hop 1** — `CartTotal.tsx:42` reads `price` off the item and it's `undefined`. Who built this item?
- **Hop 2** — `useCart.ts:88` maps the API response into cart items and reads `raw.unit_price`. The field on the wire is actually `unitPrice`. The map produced `undefined` for every row; hop 1 just happened to be where it first got read.

The real fix is at the mapping boundary (`useCart.ts:88`), and it fixes *every* downstream reader at once — not just the one line that happened to throw first. The `?.` at the crash site would have masked exactly this and left the other readers to fail later, one at a time, in places even further from the cause.

That's the whole argument in miniature: wrapping the symptom moves the bug; tracing to the source removes it.

## Rule 2 — same error twice, stop

The trace rule protects the *first* attempt. This one protects you from the death spiral that starts when the trace gets skipped: **if the same approach hits the same error twice, do not try a third variation.** Stop, report the situation, and get a direction check before touching it again.

The failure mode this kills is thrash — repeatedly patching around a symptom you never located, each patch quietly revealing or creating the next one. It looks like progress because something changes on every iteration, but you're circling the crash site instead of walking back from it. Two identical failures is the signal that the model of the problem is wrong, not that the patch needs another tweak. A third variation on a wrong model just spends more time and buries the real cause under more edits.

This rule matters *more* with an AI agent than with a human, because an agent will cheerfully generate the fourth, fifth, and sixth variation without the fatigue that eventually makes a person stop and think. The two-error stop is the external brake that the agent doesn't have on its own.

## The two rules together

| | Rule 1 — trace two hops back | Rule 2 — same error twice, stop |
|---|---|---|
| **Trigger** | Any error, first time | Same approach fails the same way twice |
| **Action** | Reproduce → trace to origin with `file:line` → then choose fix site | Halt, report, get a direction check |
| **Kills** | Symptom-wrapping at the crash site | Thrash — endless patching around an unlocated cause |

Rule 1 keeps a single fix honest. Rule 2 keeps a sequence of fixes from spiraling. Skip Rule 1 often enough and you *will* trigger Rule 2 — the two-hop trace is precisely what converts "let me guard this and see" into "I know where the wrong value comes from."

## When this is the wrong default

- **Genuine boundary hardening.** A null check or `try/catch` at a real trust boundary — untrusted input, a network edge, a third-party callback — isn't symptom-wrapping; it's the correct fix *at the origin*, because the boundary is where the value is born uncertain. The rule is against guarding an *internal* line to silence a symptom, not against defensive code where uncertainty actually enters.
- **A true one-liner with an obvious, local cause.** If reproduction and the origin are the same visible line — a typo'd constant, an off-by-one in the loop right there — the "trace" collapses to zero hops and that's fine. Don't perform ceremony when the cause is already in front of you.
- **Time-boxed triage during an incident.** When production is down, a deliberate symptom-guard to stop the bleeding is legitimate *as a stopgap you've named as such* — followed by the real trace once the fire is out. The anti-pattern is when the stopgap silently becomes the fix and the trace never happens.

The through-line: the procedure buys correctness by making you locate the cause before you spend edits on it. Reserve the shortcut for the cases where the cause is already located.
