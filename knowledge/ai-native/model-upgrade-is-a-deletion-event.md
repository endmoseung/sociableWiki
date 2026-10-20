---
type: principle
title: "A Model Upgrade Is a Deletion Event"
description: "A stronger model moves the delete/keep line for harness instructions, so much of yesterday's load-bearing doctrine becomes dead scaffolding that actively hurts — the upgrade should trigger a deletion audit, not new rules."
tags: [agent-harness, model-upgrade, prompting, context-engineering, claude-md]
date: 2026-08-04
source: "External-derived — Anthropic's Claude 5 context-engineering write-up and community pruning reports; see Sources."
relates: [ai-native/effort-resweep-on-model-upgrade, ai-native/harness-knobs-are-earned-not-designed, ai-native/agent-primitive-selection-map, ai-native/harness-component-value-is-model-dependent, ai-native/cache-stable-harness-design]
---

# A Model Upgrade Is a Deletion Event

When the model gets stronger, the right amount of harness instruction goes **down**, not up. In its July 2026 write-up on re-tuning Claude Code for the Claude 5 family, Anthropic reported deleting **over 80% of Claude Code's own system prompt with no measurable loss on its coding evals**. Community reports landed in the same range: one `CLAUDE.md` cut from 260 to 165 lines (~37%), one 18-agent fleet cut from 8,798 to 664 lines (~92.5%), with the largest single agent going from 951 lines to 91.

The lesson isn't "write less prose." It's that **an upgrade moves the boundary between what to keep and what to delete.** Instructions that were load-bearing on the old model become dead scaffolding on the new one — and dead scaffolding isn't neutral. It actively degrades the stronger model (over-verification, over-caution). So the maintenance action a new release should trigger is a **re-audit of what to delete**, not a rewrite of what to add.

## One test, run against every line

The whole rule collapses into a single question:

> Would a strong model behave *worse* without this line? If not, delete it.

Applied honestly, this removes about half of a typical instructions file. It removes so much because most instructions were written to patch a *weaker* model's failure modes, and the patch outlives the failure. Four families reliably fail the test:

1. **Persona theater** — "You are a senior engineer…". Costs tokens, changes nothing a capable model does.
2. **Restated general knowledge** — anything the model already knows from pretraining.
3. **Emphasis scaffolding** — `IMPORTANT`, ALL CAPS, emoji, repetition for weight. On a strong model this is noise that skews attention, not a lever.
4. **Redundant verification demands** — "double-check your work". On Claude Opus 5 this measurably triggers over-verification, burning tokens with no quality gain. Removing it was a net win.

What *survives* the test is small and specific:

- **Operator opinions** the model can't infer (automate vs. do by hand, house style choices).
- **Surprising project facts** (generated files, deploy-day gotchas, non-obvious environment).
- **Routing rules with real numeric thresholds.**
- **Named integrations** (specific services, endpoints, env var names).

The pattern is the point: what survives is exactly what a model *can't derive* — your preferences and your local facts. That's the durable layer of a harness no model release will absorb. Everything a model can work out for itself is on borrowed time.

## It's a question of which surface owns the rule, not a diet

Every rule has a correct home: the always-on instructions file, an on-demand skill, a hook, a subagent, or a permission. A model upgrade sharpens how much belongs in the **always-on** layer, because that layer is the most expensive surface — it's paid on every turn, and it's where emphasis scaffolding does the most attention damage. Anthropic named six shifts behind its deletion, and each one is really "stop paying for this on the always-on surface":

| Shift | From | To | Effect on the always-on prompt |
|---|---|---|---|
| Rules → judgment | prescriptive steps | criteria, decision left to the model | fewer branches to spell out |
| Examples → interface | few-shot demos in prose | tool and file-structure design that conveys intent | examples move into the tool schema |
| Upfront load → progressive disclosure | everything in context now | occasional content behind skills or rules files | only the routing pointer stays |
| Repetition → single statement | same rule in several layers | stated once | de-duplication across surfaces |
| Hand-kept memory → auto-memory | a manually maintained doc | system-managed context | manual memory shrinks |
| Thin spec → rich reference | prose spec | tests, code, mockups as the artifact | intent carried by high-fidelity artifacts |

Content isn't necessarily destroyed — it's **relocated to a cheaper, on-demand surface** (a skill, a rules file, a test) or dropped because the model now covers it. The fixed, always-loaded part of the context budget is where you cut first.

## Two traps this closes

- **Additive drift.** The reflex on a bad output is to *add* a line — "be more careful", "always verify". On a strong model the fix is often the opposite: an existing over-instruction is *causing* the bad output. Before adding, run the delete test on what's already there.
- **Relocation isn't deletion — and it can fail quietly.** Moving a rule from the always-on file into a skill is right for anything used occasionally, because it stops paying the per-turn tax. But the relocated rule must stay *reachable*: a skill that never gets invoked is just a dead capability instead of dead scaffolding.

## The operating rule

For each new frontier model:

1. Run the "would a strong model behave worse without this?" pass over the always-on instructions file, agent definitions, and skill bodies.
2. Delete persona theater, restated knowledge, emphasis scaffolding, and redundant verify demands.
3. Relocate occasional content into skills or rules files, and check that it's still reachable.
4. Keep operator opinions, surprising local facts, numeric routing thresholds, and named integrations.

Expect to remove on the order of half of a mature instructions file, and much more from an over-specified agent fleet.

**When this is wrong:** if you downgrade or route some traffic to a smaller model, the deleted scaffolding may still be load-bearing there — the delete test is per model, not universal. And the reported numbers come from coding evals; a domain the vendor didn't evaluate may still need lines the coding evals say are dead. Re-check on your own tasks before trusting a deletion.

## Sources

- Anthropic, "Context engineering for the Claude 5 family" write-up (2026-07-24) — the 80%+ system-prompt deletion with no coding-eval regression; the six shifts; the over-verification finding.
- Community pruning reports and practitioner roundups, July–August 2026 — the 260→165, 8,798→664, and 951→91 line reductions.
