---
type: principle
title: "Configured is not effective: a capability ladder for harness claims"
description: "A capability that is installed, declared or configured keeps getting reported as if it were enforced or used; harnesses that stay honest split the claim into rungs and cap it at the highest rung actually witnessed on this host."
tags: [harness-design, capabilities, enforcement, evidence, cross-harness]
date: 2026-10-20
source: "External-derived — synthesis across open-source agent-harness repos; see Sources."
relates: [ai-native/agent-writable-trace-is-testimony, ai-native/enforcement-floor-vs-drift-detector, ai-native/harness-self-knowledge-version-skew, ai-native/cross-agent-rule-single-source, ai-native/green-must-be-non-vacuous, dev-process/completion-means-verification-output]
---

# Configured is not effective: a capability ladder for harness claims

Here are sentences I've caught myself writing about my own agent setup: "the reviewer subagent is read-only", "Playwright is set up for this repo", "the workers run on the cheap model", "network egress is blocked", "the rule is ported to the other CLI too". Each was true of a config file. None of them said anything about what the host actually did, in this run, with that config.

Reading through independent open-source agent harnesses, I kept finding the same failure and, in the better ones, the same fix. The failure: **a capability that is present, declared or configured gets reported as if it were enforced or exercised.** The fix: split the claim into rungs, and never let a claim climb higher than the rung you witnessed.

## The ladder

Different repos name the rungs differently. Merged, they look like this:

| Rung | What it means | What witnesses it | What it does *not* prove |
|---|---|---|---|
| 1. Present | The file or config entry exists | A scan of disk and config | That anything can see it |
| 2. Wired / advertised | The host exposes it to the model, or routes this task to it | Host config, tool list, routing table | That it reached the model's context |
| 3. Loaded / demonstrated | A runtime event shows it was injected, or it was shown working on this host | A hook event, a recorded run | That *this* episode used it |
| 4. Exercised / invoked | This run executed it, with identity | A tool-use event or run artifact tied to this run | That it helped |
| 5. Outcome-supported | Later comparable work improved | Before/after on comparable episodes | — |

Two more states sit beside the ladder, not on it. **Unobserved** means the evidence channel was unavailable — you don't know. **Not applicable** means the subject doesn't exist here. Neither is "missing", and neither is "pass".

There's also a second axis that the ladder alone doesn't capture: the **enforcement ceiling**. A deny rule can be wired and loaded and still only partly enforced, because the host blocks one way of doing the thing and not another. A claim like "the reviewer can't write" needs both a rung and a ceiling.

## Why it keeps happening

- **Config is the only thing the harness author owns.** A skill pack or protocol defines who should do what. The host owns model execution, permissions, the filesystem and scheduling. The pack literally can't witness what the host did, so it reports what it can see: its own config.
- **Reading config is cheap and deterministic; witnessing behavior needs instrumentation.** The first is a file read. The second needs hooks, event capture and somewhere to put them.
- **Shared names imply parity.** Two CLIs both have "permissions" and "hooks", so a rule ported between them is assumed to mean the same thing on both. It usually doesn't.
- **Silence reads as absence.** A collector with no heartbeat can't tell "never used" from "not captured". Zero events looks like zero use.
- **A same-window re-run looks like effectiveness.** Fix a gate, run it once, see green — that proves the repair, not that the gate now catches what it should.

## The rule

**Cap every claim at the highest rung you witnessed, on this host, for this run — and state the enforcement ceiling next to it.** "Present" is a fine thing to report. It just has to be reported as "present".

## How the harnesses implement it

### Better Harness — evidence state caps the score

Its rungs are Present, Wired, Exercised and Outcome-supported, kept separate from pass/fail, plus Missing, Unobserved and Not applicable. A configured capability, a count of assets read or a count of tools never gets promoted to behavior evidence. Validating a repair in the same window only updates the repair's state; raising the effectiveness score needs a later, comparable task episode.

### harness-lint — the four rungs, and time as a denominator

It tracks skills, MCP servers, tools and agents as installed → advertised → loaded → invoked, and refuses to promote any rung to the next. The interesting part is time. It records when a capability existed and, separately, when hook capture was *confirmed* by real delivery — installing the hook doesn't open that window. Usage is only counted over the overlap. Even a positive overlap is reported as `partial`, because without a heartbeat it can't rule out silent gaps; `complete` is reserved and rejected. Signals one runtime doesn't emit are marked unavailable, not filled with `false` or `0`.

### Eclipse Harness — intent, configuration and effect are different fields

A model named in a role file is **intent**, not the identity of the child that actually ran. The effective model is filled in only from trusted host metadata; a mismatch is `broken`, and no metadata is `unverified`. Permissions get the same split: desired, effective, and enforcement level. "The reviewer is read-only" stays `unverified` until the host shows it blocked writes.

### Everruns — don't advertise what this host can't run

A capability ID can stay in persisted config, but if the current host can't execute it, the runtime adds no prompt text, no tool and no behavior for it. That's fail-closed advertisement: the model is never told it has something it doesn't. Its pre-run inspection also uses the same assembly path as real execution, so the preview can't drift from what actually runs.

### HarnessDesk — declared versus demonstrated

Adapters report what each runtime *declares* it supports, and the UI draws only the intersection. Claims about what an agent actually did come separately, from signed-in live recordings, each linked in a ledger to the test that keeps it alive. The recording date, the test link and current proof are distinct evidence — a demonstration from last month isn't proof about today's build.

### Tuff — publish the ceiling and refuse false installs

Tuff compiles one shared policy into several CLIs' native configs, and each adapter marks every `{effect, subject}` pair as `full`, `partial` or `unsupported`, with the mechanism and caveat. As of September 2026 that meant, for example, Claude Code's command and file rules marked partial because alternate invocations slip past, and Codex enforcing only command-prefix rules, partially, with read, edit and MCP rules unsupported. If the selected host can't enforce a rule, installation fails by default. An explicit human override accepts the gap — but not when the host enforces none of the rules. Accepted gaps live in the lockfile, are reprinted on every check, turn CI red under `--strict`, and are recomputed when the adapter changes. Shared policies can only `deny` or `ask`, never `allow`, so the worst a bad policy can do is be visibly too strict.

### SimpleFlowHarness — Enforced or BestEffort

One registry holds each agent adapter's flags, version floor and known gaps. If a CLI doesn't actually guarantee a whole-class boundary for an access mode like read-only, the harness labels it `BestEffort` instead of `Enforced`.

### Belay — a named policy that admits it can't see

Its file-level presets (no-create, no-delete, tests-read-only) are grounded in observed filesystem deltas. Its network-egress preset exists by name but always returns `UNVERIFIED`, because the harness doesn't observe egress bytes — and an operator can't declare it grounded. Unknown presets fail closed. When almost no turns are verifiable, it reports the instrument as suspect rather than a clean 0%.

## What a claim looks like after this

I now write capability claims as a small record rather than a sentence: the claim, the rung witnessed, the host and version, the enforcement ceiling, a pointer to the evidence, and the gap. "Reviewer read-only — wired, ceiling partial, no blocked-write event this run" is less satisfying than "reviewer is read-only", and much more useful when something goes wrong.

## When this is wrong

- **Nothing depends on the claim.** For a throwaway personal setup where no review, report or decision reads the claim, the bookkeeping is overhead.
- **Zero behavior can hide a missing capability.** Everruns' own caveat: silently not advertising an unsupported capability is right, but if the task needs it, preflight should fail loudly with "not available" instead of running without it.
- **Strictness invites bypass.** If every partial ceiling blocks work, people turn the gate off. Tuff's middle path — accept the gap explicitly, keep it visible, fail only in strict CI — is the version I'd copy.
- **The witness is configured too.** The hook that proves "invoked" is itself a capability that may not be running. That's exactly why harness-lint opens its capture window only on confirmed delivery: the regress stops at something you actually observed, not at another config file.

## Sources

- [QoderAI/better-harness](https://github.com/QoderAI/better-harness) — Present / Wired / Exercised / Outcome-supported, Unobserved vs Missing.
- [kespineira/harness-lint](https://github.com/kespineira/harness-lint) — installed / advertised / loaded / invoked; capture and presence epochs; partial-only coverage.
- [benedictdavon/eclipse-harness](https://github.com/benedictdavon/eclipse-harness) — requested / configured / effective model route; desired / effective / enforcement permissions.
- [everruns/everruns](https://github.com/everruns/everruns) — fail-closed advertisement of capabilities the host can't run.
- [HarnessDesk/HarnessDesk](https://github.com/HarnessDesk/HarnessDesk) — declared capability vs demonstrated claims ledger.
- [kannandreams/tuff](https://github.com/kannandreams/tuff) — full / partial / unsupported enforcement matrix, fail-closed install, persisted accepted gaps.
- [Aero123421/SimpleFlowHarness](https://github.com/Aero123421/SimpleFlowHarness) — Enforced vs BestEffort access per adapter.
- [haqaliz/belay](https://github.com/haqaliz/belay) — grounded vs always-UNVERIFIED policy presets.
