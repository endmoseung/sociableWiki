---
type: principle
title: "Five core software principles, re-derived for when an agent writes the code"
description: "Boundary owns the mess, illegal states unrepresentable, optimize for deletion, intent over implementation, and setup-cost-yes-per-task-cost-no — with the meta-shift that reshapes all five when an AI agent is the primary author."
tags: [software-principles, ai-native, type-safety, code-review, deletability, automation]
date: 2026-07-29
source: original
relates: []
---

# Five core software principles, re-derived for when an agent writes the code

These are the five cross-project rules I actually reach for, not a canon I inherited. What
makes them worth re-stating is the world they now run in: an AI agent is usually the primary
author of the code, and I am the reviewer. That single shift re-weights every rule below, so
before the five, three pieces of meta-context that reshape them.

**The meta-shift, in three moves:**

- **Setup cost amortizes; per-task cost is paid every task.** A one-time rule encoded into a
  tool is paid once and collected forever. A rule that lives only as "remember to do X" is
  paid, and can be forgotten, on every task. So automation always beats discipline — more so
  when the author has no memory of yesterday's task.
- **Code must reveal intent on a cold read.** A human author has muscle memory: they wrote
  `processItem` last week and still know what it does. An agent starting a fresh session has
  none. Names, tests, and comments have to carry the *why* on the first read, because there
  is no accumulated context to fall back on.
- **Deletability beats extensibility.** The next change to a module is now more likely a
  *rewrite* than a careful extension — an agent will happily regenerate a whole file. So
  "easy to delete and replace" is worth more than "easy to extend in place."

Hold those three in mind; they explain why each rule leans the way it does.

## 1. Boundary owns the mess

Side effects, validation, and dependency direction all live at the **system boundary**. The
core stays pure.

The concrete move: parse external input **once**, at the boundary, into a typed value. From
that point inward, the type *is* the proof of validity. Use branded or nominal types so the
"this has been parsed and checked" fact travels into deep functions in the type itself — and
you never re-validate defensively three layers down.

```ts
// boundary: the ONLY place a raw string becomes a trusted value
type Email = string & { readonly __brand: "Email" };
function parseEmail(raw: string): Email { /* validate once, then brand */ }

// core: the signature guarantees it was already checked
function sendReceipt(to: Email) { /* no re-validation, no defensive `if` */ }
```

Once `parseEmail` has run at the edge, nothing inside the core asks "but is this really an
email?" — the type already answered. The mess (I/O, malformed input, missing fields) is
quarantined at the rim; the middle is boring and pure.

**When this is wrong:** a throwaway script that reads one trusted file and prints a number
does not need a boundary layer. Don't pay the parsing-and-branding cost for code that has no
untrusted edge.

## 2. Illegal states unrepresentable

Prefer a **discriminated union** over a bag of booleans. Model errors as **values**
(`Result<T, E>`) rather than thrown exceptions in the core; keep `try/catch` at the outer
shell only.

A flag bag — `{ isLoading, isError, data, error }` — lets you express states that can't
actually happen (`isLoading` *and* `isError` both true). A union makes those unrepresentable:

```ts
type Fetch<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };
```

Now "loading with an error message" simply cannot be constructed, so no downstream code has
to guard against it.

**When this is wrong — and this is the important boundary:** apply this to the **stabilized**
core. A state machine you are *still discovering* — a checkout flow whose steps are changing
every release — should stay loose for a release or two. Locking a union around a shape you
don't understand yet just means fighting the type system while you learn. Tighten *after* the
shape stops moving, not before.

## 3. Optimize for deletion

The right metric for a module is "**easy to delete**," not "easy to extend." Greg Young's
one-week rule is the yardstick: no module should take an unfamiliar contributor more than a
week to rewrite from scratch. If it would, it's too entangled.

The priority ladder, in order:

**Delete > Abstract > Duplicate > Generalize.**

Note where duplication sits: I allow **two copies** before abstracting — the rule of three.
The first time you see a shared shape it's a coincidence; the second, a hunch; only the third
occurrence earns an abstraction. Premature abstraction is harder to delete than the
duplication it replaced.

The test I apply before adding any abstraction: *to remove this feature in three months, how
many files would I have to touch?* If the answer is "one, and it's this one," good. If it's
"nine, spread across shared helpers," the abstraction is a liability, not an asset.

**When this is wrong:** a genuinely stable, widely-shared primitive (a money type, a date
util) is *supposed* to be extended in place, and the rule of three has long since passed.
Don't invoke "optimize for deletion" to justify a fourth copy of code that has clearly earned
its abstraction.

## 4. Intent over implementation

Names, tests, and comments carry the **why**, not the **how**.

- **Names describe intent, not mechanics.** `eligibleItems`, not `itemList`. `applyDiscount`,
  not `processOrder`. The reader — human or agent on a cold session — should learn *what this
  is for* from the name, not have to read the body.
- **Tests assert observable behavior, not internal calls.** A test that checks "the cart total
  drops by 10% when a coupon applies" survives a refactor. A test that checks "`applyCoupon`
  called `recalculateTotals` once" breaks the moment you restructure internals, even though
  behavior is identical. Implementation-coupled tests become a tax that compounds on **every**
  refactor — and when an agent refactors freely, that tax is charged constantly.
- **Comments explain why, never what.** `// clamp to 0: upstream can send negative stock during
  a race` earns its place. `// increment i` does not. If the code says *what*, a comment
  repeating it is dead weight; reserve comments for the constraint, the workaround, the
  non-obvious reason.

**When this is wrong:** genuinely tricky mechanics — a bit-twiddling hot loop, a subtle
algorithm — sometimes *do* warrant a "how" comment, because the how is the hard part. The rule
bans redundant "what" comments, not necessary explanation.

## 5. Setup cost yes, per-task cost no

Spend **unlimited one-time setup** to encode a rule into automation; demand **zero per-task
overhead** to comply with it.

If a rule can be enforced by a tool — lint, typecheck, formatter, test, a CI gate — then it
**must** be. A rule that lives only in a document is a rule that gets skipped under deadline.
This is the direct consequence of the amortization point: setup is paid once, per-task
compliance is paid forever, so push every rule down into a wall.

Two corollaries:

- **Every dependency is a liability.** Before adding one, justify why not write it directly.
  Boring, well-understood tech is the default; a new dependency has to earn its place against
  the cost of owning it.
- **When the author is an AI, walls beat hints.** A hint — a rules file the author is supposed
  to read — relies on the author remembering and recovering from drift. An agent has no muscle
  memory to recover with, so a *wall* (a hook, a gate, a lint rule that fails the build) is
  categorically more reliable than a hint. Encode the rule where it *blocks*, not where it
  *advises*.

**When this is wrong:** don't set up a CI pipeline for code that won't outlive the week. The
setup-cost-yes math assumes the code has a future to amortize over; a one-off spike or a
scratch prototype doesn't, so the automation never pays back. Match the wall to the code's
expected lifespan.

## The thread through all five

Each principle has a "when this is wrong" boundary on purpose — a principle you apply
unconditionally has become a superstition. But there is one thread: **push the cost to the
place that pays it once.** Validation to the boundary (parsed once, trusted forever). Illegal
states out of existence (unrepresentable, so never guarded). Deletion over extension (rewrite
cheaply instead of maintaining forever). Intent into names (understood on read, not re-derived
each time). Rules into walls (enforced once, not remembered every task). When a design decision
feels arbitrary, check whether one of these five settles it before you debate it further.

## TL;DR

- **Boundary owns the mess** — parse external input once at the edge into a branded type; the
  core is pure and never re-validates. Skip it for trusted throwaway scripts.
- **Illegal states unrepresentable** — discriminated unions over flag bags, `Result` over
  exceptions in the core. Apply to the *stabilized* core; leave a still-changing state machine
  loose.
- **Optimize for deletion** — "easy to delete" beats "easy to extend"; Delete > Abstract >
  Duplicate > Generalize; two copies before abstracting. Ask "how many files to remove this in
  three months?"
- **Intent over implementation** — names/tests/comments carry the *why*; tests assert behavior
  not internal calls; comments explain why, never what.
- **Setup cost yes, per-task cost no** — encode every enforceable rule into a tool; when an AI
  writes the code, walls (hooks/gates/lint) beat hints (a rules file), because the author has
  no muscle memory. Skip automation for code that won't outlive the week.
