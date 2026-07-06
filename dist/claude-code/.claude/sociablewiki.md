# sociableWiki — operating guide for your agent

This repo is a **personal knowledge wiki that is also an MCP server**. You (the AI
agent) help the human maintain it and search it. This file is the contract; it is
agent-neutral. Claude Code, Cursor, Codex, Gemini, Copilot — all read this same guide.

## What the wiki is

- Each doc is **one concept** — a single sharp claim, decision rule, or pattern.
- A doc's **id** is its path under `knowledge/` without `.md`
  (e.g. `knowledge/ai-native/fan-out-scope-gate.md` → id `ai-native/fan-out-scope-gate`).
- English under `knowledge/` is canonical. An optional translation lives under a language
  folder at the same path (e.g. `ko/ai-native/fan-out-scope-gate.md`).
- `knowledge/index.md` is the human-readable topic map.
- Config lives in `.sociablewiki/config.json` (author, repo name, areas, optional secret
  patterns). If it's missing, fall back to `.sociablewiki/config.example.json` and ask the
  human to run **new** (init).

## Frontmatter contract (every doc)

```yaml
---
type: pattern | deep-dive | reference | principle   # required
title: <clean title>                                 # required
description: <one sentence — the core claim>          # required
tags: [3-6 kebab-case tags]
date: <YYYY-MM-DD>
source: <"original" or a short external attribution>
relates: [<other concept ids that exist in this repo>]
---
```

External-derived docs end with a `## Sources` section listing the real references.

## The three verbs

Invoke the matching skill. Each skill file spells out the steps.

| Verb | Skill | What it does |
|---|---|---|
| **get** | `knowledge-get` | Search and read. Prefer the MCP tools if the server is connected; otherwise read `knowledge/` directly. |
| **set** | `knowledge-set` | Add or update one concept doc, then run the portable quality gate before it lands. |
| **new** | `knowledge-new` | Make this repo *yours*: set author/repo/config, clear the example content, start empty. Run once after cloning. |

## Portable quality gate (run inside `set`)

Language-neutral. No external scripts required — you perform these checks yourself:

1. **Required frontmatter** — `type`, `title`, `description` all present and non-empty.
2. **Live relates** — every id in `relates:` is an existing doc in this repo. No dead links.
3. **No duplicate id** — the new slug doesn't collide with an existing doc.
4. **Secret sweep (opt-in)** — if `.sociablewiki/config.json` has `secretPatterns`, none of
   them appear in the new doc. This is where the human lists their employer / internal names
   so private context never gets committed to a public wiki.
5. **Index updated** — the new concept is added to `knowledge/index.md`.

If any check fails, fix it before writing — never land a doc that fails the gate.

## House rules

- One concept per file. If a doc grows two claims, split it.
- The human commits and merges. You prepare the change; you do not push to `main` on your own.
- Keep the writing sharp and specific. This wiki is a personal brand surface — generic filler
  weakens it.
