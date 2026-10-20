---
type: principle
title: "An agent's answer about its own harness is a retrieval against an unpinned corpus"
description: "A coding agent doesn't know its own harness — it retrieves from training data or live docs, neither keyed to the installed version — so ground self-knowledge claims on the local binary and carry the version into every lookup."
tags: [self-knowledge, version-skew, harness, retrieval, docs]
date: 2026-10-12
source: "External-derived — Michael Lynch, \"Why are coding agents so dumb?\" and Claude Code behavior; see Sources."
relates: [ai-native/llm-judged-hook-polarity, ai-native/configured-is-not-effective, ai-native/silent-default-change-postmortem, ai-native/model-upgrade-is-a-deletion-event]
---

## TL;DR

When I ask a coding agent "can you do X", "which flag is it", or "does this hook fire for Y", it does not *know* its own harness. It answers from one of a few corpora — its training prior, live web docs, or local files — and **the first two are not keyed to the version actually installed**. A fast-release, auto-updating harness makes the gap between "what the docs say" and "what this binary does" the normal state, not an edge case.

So I treat every self-knowledge answer as a retrieval result, and I add the missing join key: **the installed version**.

## The signal

Michael Lynch's essay "Why are coding agents so dumb?" (October 2026) lists self-knowledge as a table-stakes gap. In his account, Claude Code web-searched Claude's own features and never checked whether the results matched its version. Meanwhile the tool will download gigabytes for features he never uses, yet does not bundle the small set of docs that would answer the question locally. His ask is simple: an agent should know its own features without a web search.

## Why this is structural, not a model bug

| Corpus the agent answers from | Version it reflects | Failure shape |
|---|---|---|
| Training prior | the snapshot at model cutoff, often months behind | confidently describes removed or renamed flags; misses new primitives |
| Live web docs (web fetch/search, a docs-helper subagent) | the **latest** release, not the installed one | recommends a feature your build doesn't have yet, or behavior that changed after your pin |
| Blog and forum results | arbitrary, often undated | mixes versions inside one answer |
| Local binary (`--version`, `--help`, bundled changelog, settings schema) | **exactly what is installed** | the only correct source, and the one the agent rarely checks first |

The error is a join error: question × corpus with no `version` predicate. A stronger model does not fix it. It just phrases the stale answer more fluently.

The skew runs **both** ways. An auto-updating harness is often *ahead* of the model's training prior, while a pinned or centrally managed install can be *behind* the live docs. A docs-fetching helper — Claude Code ships a built-in guide subagent that uses web fetch and search — is right about "latest" and silently wrong about "mine".

## Practice

1. **Ground self-knowledge claims on the binary first.** Before asserting "the harness supports X", run the cheap local probes: `<tool> --version`, `<tool> --help` and subcommand help, the settings JSON schema, and the bundled changelog if there is one. It is "look before you assert", applied to the agent itself.
2. **Put the version into the lookup.** When you do need web docs, carry the installed version into the query and check the changelog entry that introduced the feature. "Added in 2.1.N" with N above your installed version means it is not available here.
3. **Label provenance in the answer.** "Per live docs (latest)" and "verified on installed 2.1.293" are different claims. Say which one you made.
4. **Settle behavioral questions with a canary, not a doc.** For hooks, context-file loaders, and permission rules — anywhere docs and binary drift silently — a thirty-second experiment (fire the hook, read the log) beats any corpus.
5. **Stamp the version on your own notes.** A note that says "hook X does Y" without "observed on vN" turns into the same unpinned corpus for the next session. Write the observed version next to every behavioral claim.

## When this is wrong

If the harness is pinned and rarely updated, **and** the model's training cutoff is newer than the pin, the training prior is effectively version-matched and the probe step is pure overhead. The rule earns its cost on fast-release harnesses and mixed-version fleets.

## Sources

- Michael Lynch, "Why are coding agents so dumb?" — https://mtlynch.io/why-are-coding-agents-so-dumb/ (2026-10-09); Hacker News discussion — https://news.ycombinator.com/item?id=50020947
- My own observation, October 2026: Claude Code reported version 2.1.293, and its built-in guide subagent declared web fetch and web search as its tools.
