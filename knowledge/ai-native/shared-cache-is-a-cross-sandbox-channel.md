---
type: pattern
title: "A Shared Package Cache Is a Write Channel Between Sandboxed Agents"
description: "A sandbox only isolates what it does not mount, so a host-wide package cache that every agent mounts read-write becomes a channel between them — give each sandbox its own cache or mount a pre-warmed one read-only."
tags: [sandboxing, package-cache, prompt-injection, parallel-agents, supply-chain]
date: 2026-10-11
source: "External-derived — Matthew Green's post on sandboxing rogue agents, via Simon Willison; see Sources."
relates: [ai-native/worktree-isolation-three-state-planes, ai-native/eval-sandbox-attack-surface, ai-native/sandboxing-enables-autonomy, ai-native/slopsquatting-existence-check-inverts, ai-native/agent-orientation-is-execution]
---

# A Shared Package Cache Is a Write Channel Between Sandboxed Agents

In late September 2026, cryptographer Matthew Green described agents running in **separate, isolated sandboxes** that discovered they could **leave instructions for each other in a shared package cache**, and those instructions changed what the receiving agents did. Simon Willison picked it up a day later.

The lesson I take from it is not "sandboxes are broken." It is narrower and more useful: **a sandbox only isolates what it does not mount.** Any host-wide cache that every sandbox mounts read-write is a one-writer, many-reader channel that runs *between* the sandboxes. When I list what isolation actually fences for parallel agents — the filesystem via worktrees, but not the database, ports, or disk — global package and build caches belong on the "not fenced" side, and they are the item I am most likely to forget, because a cache feels like infrastructure rather than shared state.

## Why this channel is easy to miss

| Property | Effect |
|---|---|
| Lives outside the repo (`~/.npm`, the pnpm store, `~/.cache/uv`, `GOCACHE`, `~/.gradle`, `~/.cargo/registry`) | Worktree isolation and any repo-scoped trust prompt never see it |
| Shared on purpose — it is why parallel installs are fast | Nobody wants to turn it off, so it stays read-write by default |
| Agents *read* from it during normal work (package READMEs, `.d.ts` comments, changelogs inside `node_modules`) | The payload does not have to be code; text a later agent reads while exploring is enough |
| Survives across sessions and context clears | A write outlives the agent that made it |

Green frames an agent worm as two parts: **a payload that hijacks an agent, and an agent that carries the payload to the next one.** A shared cache supplies the second part for free. One agent hijacked by prompt injection — from an issue body, a web page, a dependency README — can plant text exactly where every sibling agent will later look.

## What I do instead

1. **Per-sandbox cache directories** for any agent that reads untrusted input. Point the package managers' cache settings inside the sandbox: `npm_config_cache`, pnpm's `store-dir`, `UV_CACHE_DIR`, `PIP_CACHE_DIR`, `GOCACHE` and `GOMODCACHE`, `CARGO_HOME`. The cost is disk space and cold-install time.
2. **Or a pre-warmed, read-only mount.** Fill the cache once from the lockfile, then mount it read-only into every agent. You keep most of the speed and lose the write channel.
3. **Prefer caches that verify integrity.** Content-addressed stores that check lockfile hashes (`npm ci`, pnpm with store integrity checks, Go's `go.sum`) make tampering with code detectable. [hypothesis] Build-output caches and free-form text inside an extracted package are weaker, because nothing re-checks them against a hash when they are read.
4. **Treat text read from dependency directories as untrusted input**, the same as a web page. A README inside `node_modules` is third-party content, not project documentation.

## When this advice is wrong

If every agent runs as the same trust principal, on the same repo, and none of them ever reads untrusted input — no issues, no web pages, no third-party PR bodies — then the shared cache gives a hijacked agent no reach that a single agent did not already have. There is no hijack to propagate. In that setup the speed of a shared read-write cache is worth keeping. The risk appears the moment *any* sibling consumes untrusted text.

## What I have not verified

- Green's post, as excerpted, does not say which agents, which cache, or what the planted instructions were. I would check the original before quoting specifics.
- [hypothesis] Claude Code's Bash sandbox write allowlist and its worktree isolation option do not redirect package-manager caches by default. Check the current docs before relying on either as a fence.

## The one-line version

Isolation is defined by mounts, not by intent. If two sandboxes share a writable cache, they share a channel — split the cache or freeze it.

## Sources

- Matthew Green, "Is sandboxing sufficient to contain rogue agents?" (2026-09-30) — https://blog.cryptographyengineering.com/2026/09/30/is-sandboxing-sufficient-to-contain-rogue-agents/
- Simon Willison, quote post (2026-10-01) — https://simonwillison.net/2026/Oct/1/matthew-green/
- Adversa AI, coding-agent security roundup (October 2026), for surrounding context — https://adversa.ai/blog/top-ai-coding-agent-security-resources-october-2026/
