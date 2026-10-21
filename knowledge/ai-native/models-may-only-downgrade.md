---
type: pattern
title: "Monotone composition — models may only downgrade a deterministic verdict"
description: "When deterministic checks and LLM judgment are combined, the model may add suspicion or pull a pass down, but it can never upgrade a fail, relax a deny, or create a PASS — and layered policy may only narrow authority."
tags: [llm-as-judge, policy, verification, guardrails, authority]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/llm-judged-hook-polarity, ai-native/green-must-be-non-vacuous, ai-native/enforcement-floor-vs-drift-detector, ai-native/agent-eval-tool-receipt-pattern, ai-native/harness-is-the-eval-unit]
---

# Monotone composition: models may only downgrade

Most agent harnesses I read now mix two kinds of judgment: deterministic checks (a path rule, a command pattern, a test exit code, a DOM query) and a model (an LLM judge, a vision model, a semantic policy check). The question that decides whether the mix is safe is not "which one is more accurate?" It is **"which direction is each layer allowed to move the verdict?"**

Independently built harnesses keep landing on the same answer, and it is one-directional. Mechanical rules run first and own the hard verdicts. The model may pull a pass down, add suspicion, or write a check for the harness to execute — but it can never upgrade a fail, relax a deny, or mint a PASS on its own say-so. Policy follows the same shape: when configurations are layered, each layer may only narrow authority.

## The failure pattern

The bug is any path where a model can turn "no" into "yes":

- A security judge consulted after a deterministic deny that can override it when the action "looks legitimate."
- A vision model says the button is visible, so a failed DOM check gets waved through. Or the reverse: the DOM node exists, so an overlap the model flagged is dismissed.
- A reviewer model grades a sample whose tests already failed and gives wrong code a high quality score.
- A shared policy package ships an `allow` rule and quietly widens what the host permitted.
- A revision under review edits the review config in the same diff and lowers its own floor.

Each looks reasonable alone. Together they mean the strongest guarantee in the system is only as strong as its most persuadable component.

## Why it recurs

**The model is the persuadable layer.** It reads the very input it is judging. An action can carry its own justification ("the operator approved this," "this is only a test"), and tool output can carry injected instructions. Any path where the model can raise a verdict is a path that an attacker, or just a confused agent, can push on.

**Errors are asymmetric.** A false deny is loud: someone hits it, complains, and it gets fixed. A false allow is silent: the bad action simply happens. Letting the persuadable layer convert deny into allow converts loud errors into silent ones.

**Authority accretes unless the schema forbids it.** Each configuration layer is written by someone with a local reason to loosen something. Without a rule that layers can only intersect, the effective permission becomes the union of everyone's exceptions.

## The design rule

Treat verdicts as an ordered scale — `fail < inconclusive < pass`, `deny < ask < allow` — and combine layers with *min*, never *max*.

1. **Deterministic rules run first and own the hard verdicts.** Anything mechanically decidable — path, command, exit code, count, schema — is settled without asking the model.
2. **The model may only lower or annotate.** It can pull a pass down, add suspicion, escalate to a human, or propose a check. It cannot raise a fail or reverse a deny.
3. **A model's "yes" is a proposal, not a PASS.** If the model wants to assert a positive, it writes a check for the harness to run. The result is recorded as model-sourced evidence; it can support a verdict the deterministic layer already reached, but it never creates a PASS that layer withheld.
4. **An unavailable model is not a pass.** Timeouts, provider errors, and exhausted budgets are recorded as their own outcome, under an explicit fail mode.
5. **Policy layers intersect.** Shared, child, or reviewed configurations may add `deny` or `ask`; they may not add `allow`. A child's reach is the parent's reach intersected with its own rules.

The test for whether you actually built this: **switch the model off and confirm every deterministic verdict is unchanged.** If removing the model ever flips a fail to a pass, the model had upgrade power.

## How the harnesses implement it

**Grounding that only subtracts.** frontend-visualqa lets a computer-use model judge pixel-level visibility and layout, then runs DOM grounding on narrow claims such as a heading, a modal title, or a progress fill. The DOM check can downgrade a model pass; it cannot upgrade a model fail. That keeps DOM presence from excusing overlay or clipping problems while still catching obvious model false positives. Note the direction: here the model is the primary perceiver and the deterministic layer is the one that only subtracts. The rule is not "deterministic always wins." It is "no layer adds back a pass that another layer took away."

**Suspicion is additive.** CyVisGuard, an MCP security control plane, states it as a design principle: the learned judge can add suspicion but cannot remove a deny produced by the deterministic baseline of identity, capability, and taint checks. dsh-write-gate splits operator commitments by decidability. Path globs and command patterns go to a synchronous guard installed in a slot that later listeners cannot override with an allow. Only semantic scope drift goes to a bounded LLM judge, which has a timeout, a step budget, and an explicit fail mode recorded whenever the judge is unavailable.

**The model writes checks, not verdicts.** Belay's optional model axis can author a command that tests a claim. The harness runs that command in containment against the final state and judges by exit code. Even a successful exit does not create a new PASS, and a refutation test asserts that turning the model axis off leaves every deterministic verdict identical.

**Correctness before quality.** paired-eval runs exact or programmatic checks first whenever ground truth exists. A sample that fails gets a score of zero and the judge is never called; the judge scores quality only on samples that already cleared correctness.

**Policy by intersection.** Tuff projects skills, hooks, and policies into several agent hosts, and its shared policy accepts only `deny` and `ask` — `allow` is rejected at schema validation, so a third-party package's worst case is "too strict, and visibly so." A rule the target host can't enforce fails the install by default, and the human override is refused outright for a host that enforces none of the rules. claude-kit reads review policy from both the base and HEAD and applies the immutable minimum, so the revision under review can't lower its own review depth. SCP, a cross-harness messaging protocol, computes an agent's reach as its rules intersected with its capabilities along the spawn lineage: an ancestor can't grant beyond its own reach, and a worker can't widen itself.

## When the rule is wrong

- **It locks in deterministic false positives.** If a mechanical rule fires wrongly, the model can't rescue it — by design. That puts the burden on keeping hard rules low in false positives and on measuring false blocks, not just escaped violations; dsh-write-gate's evaluation tracks both. The override belongs to a human with a recorded reason, not to the model.
- **Some properties only the model can see.** Visual polish, tone, layout taste. There the model's pass is the only positive evidence available. Keep it, but label it as a model-lane claim and don't let it count toward a deterministic gate.
- **Intersection can starve legitimate work.** Stack enough narrowing layers and the effective permission set goes empty. That failure is visible, which is the point, but the fix is to revisit a layer, not to add an allow-path from below.
- **It assumes the deterministic layer is actually enforced.** A deny the host cannot enforce is configuration, not a verdict. Monotone composition over unenforced rules gives a false sense of safety.

## Sources

- frontend-visualqa (yutori-ai/frontend-visualqa) — https://github.com/yutori-ai/frontend-visualqa
- CyVisGuard (flankerhqd/cyvisguard) — https://github.com/flankerhqd/cyvisguard
- dsh-write-gate (couldbeme/dsh-write-gate) — https://github.com/couldbeme/dsh-write-gate
- Belay (haqaliz/belay) — https://github.com/haqaliz/belay
- paired-eval (alloevil/paired-eval) — https://github.com/alloevil/paired-eval
- Tuff (kannandreams/tuff) — https://github.com/kannandreams/tuff
- claude-kit (buildproven/claude-kit) — https://github.com/buildproven/claude-kit
- SCP, Swarm Communication Protocol (scphq/scp) — https://github.com/scphq/scp
