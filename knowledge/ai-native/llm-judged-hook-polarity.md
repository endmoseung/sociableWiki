---
type: pattern
title: "An LLM-judged hook's polarity is a reading, not a rule"
description: "A prompt or agent hook's policy is an English sentence a model maps onto ok:true/false, so its verdict direction can invert silently — phrase it as a verdict condition, canary it, and keep irreversible blocks in code that runs before the side effect."
tags: [hooks, prompt-hooks, gates, fail-open, canary, claude-code]
date: 2026-10-11
source: "External-derived — Claude Code changelog and hooks docs (October 2026); see Sources."
relates: [ai-native/enforcement-floor-vs-drift-detector, ai-native/configured-is-not-effective, ai-native/green-must-be-non-vacuous, ai-native/gate-outbound-channel-not-tool-call, ai-native/harness-self-knowledge-version-skew]
---

## TL;DR

A `command` hook's policy is code: `exit 2` means block, and nothing reinterprets it. A `prompt` or `agent` hook's policy is **an English sentence that a model reads and then maps onto `{ "ok": true | false }`**. That mapping is an inference step, and it can invert. A wrong-direction gate looks exactly like a quiet, passing gate, so you will not notice until the thing it was supposed to stop has happened.

The rule I follow: **write the policy as a verdict condition, not a command; canary every blocking hook; and put anything irreversible in code that decides before the side effect runs.**

## The evidence: the harness kept fixing this

Claude Code's changelog in early October 2026 shows the problem in the vendor's own words:

- **2.1.294** fixed `prompt` and `agent` hooks written as instructions ("Block commands that…") *allowing* what they should block.
- The same release changed how `Stop` / `SubagentStop` prompt hooks written as instructions ("Carry on if the build is broken") are judged, so the agent is less likely to stop early.

So before that release, the most natural sentence an author could write silently did the opposite of its intent. The fix narrows the bug. It does not change the structure: the verdict direction of an LLM-judged hook is whatever the judge reads into your sentence, and that reading can move between versions.

## Why imperative phrasing is the trap

The judge is not asked to obey your instruction. It is asked to emit a verdict about the *hook input*. An imperative sentence forces two hops:

1. Work out what the author wants done ("block X").
2. Translate that into the verdict vocabulary ("block" becomes `ok: false`).

Hop 2 is where polarity breaks, and it depends on the event, because the same `ok: false` means different things:

| Event | `ok: false` means | Trap |
|---|---|---|
| `PreToolUse` | deny the tool call | "Block X" must become `false` |
| `Stop` / `SubagentStop` | **keep working** (reason is fed back) | "Carry on if the build is broken" must become `false`, though "carry on" sounds like approval |
| `UserPromptSubmit` / `PostToolUse` | end the turn | — |

A judge that pattern-matches "carry on" to "continue = ok" returns `ok: true`, and the agent stops with a broken build.

## Writing a policy that survives

1. **Phrase it as a verdict condition.** Name both outcomes in the verdict's own vocabulary.
   - Weak: `Block commands that touch production.`
   - Strong: `Return ok:false if the command reads or writes a production host or credential; otherwise ok:true.`
   - Stop hook: `Return ok:false (keep working) if the last build or test run in the transcript failed or never ran; return ok:true only if a passing run is visible.`
2. **State the default for the uncertain case.** For a safety gate, "if unsure, ok:false" turns ambiguity into a block instead of a pass.
3. **Canary it.** Keep one known-bad input per hook (a fake destructive command, a transcript that ends in a failing test) and assert it yields `ok: false` after every harness upgrade or policy edit. A gate you have never seen fire is untested.
4. **Prefer `command` when the rule is decidable.** If a regex or path check can decide it, the model hop buys you nothing except a polarity risk and latency. Save LLM-judged hooks for rules that genuinely need judgment.

## A second soft spot: a deny that arrives after the effect

The same month exposed a related trap in Claude Code's TypeScript plugin hooks ("mods"), which work as middleware: a hook receives the event `e` and a `next(e)` continuation. That shape gives "deny" two meanings.

| Where the deny sits | What it does | What it really is |
|---|---|---|
| **before** `next(e)` (never call it) | the call never runs | a **gate** — prevents the side effect |
| **after** `next(e)` | the call already ran; you can only withhold or alter what comes back | a **filter** — hides the result, cannot undo the effect |

The changelog spent a week pulling these apart. In 2.1.290, a deny on a process spawn that arrived after the child had run started reporting that the call ran and a plugin withheld its result. In 2.1.292, a late deny on config, state, env, or agent-spawn hooks started being reported as a hook *failure* rather than a refusal, and a hook that called `next(e)` and then failed during an interrupted turn stopped letting the call through. In other words, the harness now says outright that a late deny is a broken hook, not a successful block.

It is the same lesson in a different costume: code that *looks* like a block can be, operationally, a report on something that already happened. So:

- When a hook must **prevent** something (secret egress, a destructive shell command, a spawn), decide and deny **before** calling `next(e)`. Count any deny after it as redaction, never as protection.
- When the hooked operation is read-only or idempotent, a filter after `next(e)` is enough. The gate/filter distinction only matters when the call has a side effect.

## Adjacent changes on the same seam (as of October 2026)

- 2.1.295 added `onFailure: "block"` for **command and HTTP** hooks, so a hook that can't start or times out blocks instead of failing open. The entry does not mention `prompt` / `agent` hooks. Whether they get an equivalent fail-closed switch is unverified; my working hypothesis is that they still depend on the judge returning a verdict.
- 2.1.296 fixed managed `prompt` hooks that refused a call but did not end the turn — another case where "the hook said no" and the effect the author expected came apart.

These behaviors changed several times in one week. Pin the version you tested on, and re-run the canaries after every upgrade.

## When this is wrong

If prompt hooks move to a structured policy schema (explicit `deny_if` / `allow_if` fields) instead of free text, the polarity hop disappears and "phrase it as a verdict condition" becomes redundant. Until then, I treat every free-text hook policy as an untested classifier.

## Sources

- Claude Code changelog, entries 2.1.288–2.1.296 — https://code.claude.com/docs/en/changelog (fetched October 2026)
- Claude Code hooks documentation, prompt-based and agent-based hooks (per-event `ok` / `reason` semantics)
