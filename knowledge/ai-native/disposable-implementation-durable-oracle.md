---
type: principle
title: "When Code Is Cheap, the Implementation Is Disposable — the Oracle and the Spec Are What Last"
description: "Rebuilding a module with an agent is only safe when a behavioral test suite the rebuild cannot edit, and a spec that carries what each build taught you, outlive the code."
tags: [coding-agents, rebuild, end-to-end-tests, living-spec, test-oracle]
date: 2026-10-12
source: "External-derived — a practitioner essay on agentic coding plus community discussion; see Sources."
relates: [ai-native/best-of-n-coding-agents, ai-native/reward-hacking-held-out-gap, ai-native/green-must-be-non-vacuous]
---

# When Code Is Cheap, the Implementation Is Disposable — the Oracle and the Spec Are What Last

A piece of practitioner advice keeps coming up in 2026: **rebuild often.** When an agent can re-implement a module in minutes, the first implementation is best treated as a reconnaissance probe. You build it, find out where the hard parts actually are, then throw it away and build again with what you learned.

I agree with the slogan, but it skips the part that makes it safe. A rebuild is only a rebuild if something **survives it and judges it**. Without that, "rebuild" just means "replace working code with different code and hope". Taking the advice seriously flips which artifacts in a project are long-lived.

## The lifecycle inversion

| Artifact | Traditional lifecycle | Cheap-code lifecycle |
|---|---|---|
| Implementation | Durable; refactored in place | Disposable; regenerable |
| End-to-end / behavioral tests | Support for the code | **The durable oracle** — the definition of "still works" |
| Spec | Written up front, then frozen and left to rot | **Living** — updated with what each build taught you, and fed into the next build |

Drew Breunig's framing is the cleanest version of this: test *what* the product does, not *how* it does it. Behavior-level tests are the contract that lets you swap the internals freely. A frozen spec misses everything the implementation taught you; a living one makes each rebuild cheaper than the last.

## Why the oracle has to be independent of the rebuild

The trap is letting the agent regenerate the tests together with the code. Then the oracle moves with the thing it is supposed to judge, and the rebuild "passes" by construction. A test suite the agent just wrote describes what the agent built, not what the product was supposed to do. That is not a check; it is a mirror.

Three rules follow from that.

1. **Freeze the behavioral suite across a rebuild.** The agent may *add* tests, but it may not edit or delete existing behavioral tests while rebuilding. Enforce this mechanically — a hook or a path-scoped deny rule on the test directory — not with a sentence in the prompt. A prompt rule is the first thing an agent under pressure to get green will rationalize around.
2. **Keep the tests implementation-agnostic.** Tests that mock internal modules or assert on private structure break on every rebuild. Someone then "fixes" them, and the oracle gets quietly rewritten to match the new internals. Prefer assertions at the public API, HTTP, or UI level — the layers a rebuild is not supposed to change.
3. **Treat the spec delta as the rebuild's real output.** After a probe build, write down what changed in your understanding *before* you discard the code: the edge case you didn't know about, the dependency that turned out to be the bottleneck, the requirement that was ambiguous. Skip this and the next build relearns the same lessons. This is different from an agent's session plan file, which is scaffolding you decide about at merge time. The living spec is product-level and outlives every session.

## How it relates to best-of-N

Best-of-N spends tokens on *parallel* variance: several candidates for one attempt, then pick the best. Rebuild-often spends tokens on *serial* variance: one attempt after another, with learning carried between them by the spec. They look like different strategies, but both depend on the same precondition — **an external judge the candidates cannot modify.** Without it, best-of-N picks the candidate that gamed the check most convincingly, and rebuild-often converges on whatever the latest tests happen to describe.

## When this is wrong

- **Stateful systems with migrations or data contracts.** The schema and the stored data are durable even when the code isn't, so a rebuild can cost far more than it looks. "Disposable implementation" applies to logic layers, not persistence layers.
- **When there is no cheap behavioral oracle.** Taste-heavy UI and maintainability-sensitive internals are the obvious cases. Behavioral tests cannot see code-quality regressions, so a series of rebuilds can drift into code that still passes and is steadily worse to live with.

## How solid this is

This is a qualitative synthesis. It rests mainly on one practitioner essay plus community discussion, not on any measurement. The lifecycle inversion and the "frozen oracle" rules are my reading of what the advice requires to be safe; I have not run a controlled comparison of rebuild-often against refactor-in-place.

## Sources

- Drew Breunig, "10 Lessons for Agentic Coding" (2026-05-04): https://www.dbreunig.com/2026/05/04/10-lessons-for-agentic-coding.html
- Developers Digest, "What Hacker News Gets Right About AI Coding Agents in 2026": https://www.developersdigest.tech/blog/what-hacker-news-gets-right-about-ai-coding-agents-2026
