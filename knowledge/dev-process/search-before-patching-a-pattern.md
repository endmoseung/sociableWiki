---
type: principle
title: "Search before patching — an anti-pattern is a class, not the one instance in front of you"
description: "When you spot (or get told about) an anti-pattern, grep the whole codebase for the same shape and agree on scope before fixing — patching only the visible instance leaves the same bug scattered and turns the reviewer into your linter."
tags: [code-review, anti-patterns, grep-first, codify-the-rule, agent-workflow, discipline]
date: 2026-07-29
source: original
relates: []
---

# Search before patching — an anti-pattern is a class, not the one instance in front of you

Someone points at a line in review: "this array access isn't guarded — if the list is
empty this throws." The reflex — mine, and every coding agent's — is to fix *that* line,
push, and move on. That reflex is the bug. The line you were shown is one member of a
**class**: the same unguarded shape almost certainly exists in a dozen other files, and
you just fixed exactly one of them.

The rule I follow: **when an anti-pattern is named, don't patch the instance — sweep the
class.** Grep the codebase for the same shape first, report the count, agree on scope,
*then* fix. The instance is a symptom; the pattern is the diagnosis.

## Why the single-instance fix is a trap

Fixing only what you were shown fails in two directions at once.

**It leaves the bug in place.** The reviewer caught one occurrence because it happened to
be in the diff they were reading. The other occurrences didn't disappear — they're just
not on screen. If `items[0]` without a length check crashes on an empty cart, then every
other `results[0]`, `rows[0]`, `matches[0]` of the same shape is a latent crash you now
know about and chose not to look for. You've converted a discoverable class of bug into a
set of individually-rediscovered incidents.

**It trains the human to be your linter.** This is the subtler cost. If you fix instance A,
the reviewer finds instance B next week and points at it; you fix B, they find C. You've
put a person in a loop that a `grep` would close in one pass. Every "you did this here too"
is a review round-trip that shouldn't exist — the reviewer is doing pattern-matching that
belongs to a tool, and doing it one node at a time. Using a human as a linter is a process
smell, not a favor they're doing you.

## The sweep, as a procedure

The fix isn't judgment ("be thorough"); it's a fixed sequence you run every time an
anti-pattern is named:

1. **Characterize the shape.** Turn the one instance into a searchable pattern. "Unguarded
   first-element access" → `grep -rn '\[0\]'` and filter, or an AST/lint query if the shape
   is structural. Name what makes it wrong, not just the one string.
2. **Grep the whole tree. Report the count.** Not "I'll fix it" — "*this shape appears N
   times across M files; here they are.*" The count is the deliverable of this step.
3. **Agree on scope before touching anything.** Some of the N are true positives, some are
   safe by construction, some are out of scope for this change. Decide the set *with the
   reviewer* before editing — a 40-file sweep inside a one-line bugfix PR is its own problem.
4. **Fix the agreed set in one pass**, so the pattern is gone as a class, not knocked down
   one instance at a time across future reviews.

Steps 2 and 3 are the ones the instinct skips. Reporting the count *before* fixing is what
separates a sweep from a reflex: it makes the scope a shared decision instead of a
surprise.

A concrete pass: you're told a session-token read assumes the cookie exists and NPEs when
it's absent. Don't just add a null check on that line. Grep for every place the code reads
that cookie (or any request-scoped value of the same shape), list them, and note which are
already inside a guarded path. Now the "missing guard" is a decision about a known set, not
a whack-a-mole you'll replay in the next three PRs.

## The paired rule: when a human repeats a correction, codify it

The sweep handles one pattern once. But if the *same class* of correction keeps coming back
— across PRs, across people — sweeping each time is still using humans as the detector. The
second signal is a person repeating the same correction two or three times. That repetition
is not "they're picky"; it's **the trigger to stop fixing instances and move the check into
a machine.**

Codify it where the machine catches it next time, not the human:

- a **lint rule** (custom ESLint/analyzer rule) if the shape is statically detectable —
  this is the ideal endpoint, because it fires on every future instance for free;
- a **project rule file** the coding agent reads on every task, if the pattern is a
  convention the linter can't express;
- a **pre-commit / CI hook**, if it needs to run at a gate rather than in the editor.

The economics are the whole argument: a rule is a one-time setup cost that eliminates a
recurring per-review cost. Every time a person re-flags the same thing, they're paying the
per-instance cost again — and the fix (write the rule once) has been available the whole
time. Rule of thumb: **first occurrence, sweep it; second or third repeat of the same
correction, codify it.**

## When to *not* generalize

The rule has a real boundary, and ignoring it produces the opposite failure — a reviewer
who says "guard this one" and gets a 40-file refactor back.

- **The pattern is genuinely local.** If the shape only makes sense in the one place it
  appears, there is no class to sweep. Not every fix is an instance of something.
- **Scope discipline overrides.** Even when the class is real, dumping the whole sweep into
  an unrelated PR is wrong — the sweep might be its own change. "Grep and report the count"
  still applies; "fix all N in *this* PR" is the part that needs the scope agreement in
  step 3.
- **The cost of a false rule.** Codifying too eagerly produces lint rules that flag safe
  code, and a noisy linter gets ignored — which is worse than no rule. Codify when the
  pattern has actually recurred (the two-or-three-repeats trigger), not on the first sight
  of something that *might* recur.

## TL;DR

- An anti-pattern you're shown is one member of a **class**. Fixing only the visible
  instance leaves the same bug scattered and makes the reviewer re-find it one node at a
  time — using a human as a linter.
- **Sweep, don't patch:** characterize the shape → grep the whole tree → *report the count*
  → agree on scope → fix the agreed set in one pass. Reporting the count before fixing is
  the step the reflex skips.
- **Paired rule:** when a human repeats the same correction two or three times, stop fixing
  instances and **codify it** — lint rule > project rule file > hook — so the machine
  catches the next one, not the person.
- **Boundaries:** don't generalize a genuinely local fix, don't smuggle a big sweep into an
  unrelated PR (grep and report anyway, but scope the fix), and don't codify a rule that
  will flag safe code — a noisy linter gets ignored.
