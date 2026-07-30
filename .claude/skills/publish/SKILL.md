---
name: publish
description: Curate and publish new knowledge docs into sociableWiki from a private source wiki. Use when adding docs to the public repo — scans candidates, transforms private notes into standalone public EN+KO docs, runs the confidentiality + Korean-quality gates, and opens a PR. Trigger — "/publish", "새 지식 발행", "sociableWiki에 올려".
---

# publish — the sociableWiki发行 loop

Turns private working notes into public, agent-searchable knowledge docs. Every doc
goes through the same gauntlet so the public repo stays clean and useful.

## The pipeline (per doc)

```
private source doc
   │  1. curate    — is this evergreen, original/attributable, and publishable?
   ▼
   │  2. transform — strip ALL confidentiality, rewrite standalone, EN canonical + KO
   ▼
   │  3. gate      — ban-list sweep (grep) + korean-quality-gate on the KO file
   ▼
   │  4. index     — add to knowledge/index.md topic map
   ▼
   PR to main (human merges — never auto-merge)
```

## Curation rubric

A doc is a **candidate** only if all hold:

- **Evergreen** — still true and useful in a year. Time-bound news digests, model
  release trackers, "landscape 2026-06" → reject.
- **Original or attributable** — your own synthesis, OR derived from external sources
  you can cite. A close paraphrase of one external source with no citation → reject.
- **Value ≥ 3/5** — teaches a mid-level reader something sharp, not generic advice.
- **No unremovable confidentiality** — see below.

## Confidentiality — the hard gate (zero tolerance)

Nothing identifying an employer or internal work ships. Ban-list (any case):

- Company names, internal product/repo/system names, ticket ids, internal design
  systems, internal infra, private wiki paths, colleague personal names.

Transform rewrites "in our repo we did X (ticket #123)" → "in one project I …".
Keep the **knowledge**, drop the **coordinates**. The grep sweep in step 3 is the
backstop — if a ban-list term survives, the doc does NOT ship.

The ordinary English word "remember" is fine; only a company/product reference is a hit.

## Doc format

One concept per file. Frontmatter:

```yaml
---
type: pattern | deep-dive | reference | principle
title: <clean title>
description: <one sentence — the core claim>
tags: [3-6 kebab-case tags]
date: <YYYY-MM-DD>
source: <"original" or a short external attribution>
relates: [<other published concept ids>]
---
```

Concept id = path under `knowledge/` without `.md`. The Korean version lives at the
same path under `ko/`. External-derived docs end with a `## Sources` section.

## Steps

1. **Scan** the private source wiki for new evergreen candidates not already in
   `knowledge/`. Score by the rubric.
2. **Present** the shortlist to the human and get approval before publishing. This
   is a hard human-in-the-loop gate — the public repo is a personal brand surface.
3. **Transform** each approved doc: write `knowledge/<id>.md` (EN) and `ko/<id>.md`
   (KO). KO must be natural Korean 존댓말, not translationese.
4. **Gate** each doc:
   - `grep -inE '<banlist>' knowledge/<id>.md ko/<id>.md` → must be clean.
   - `python3 <korean-quality-gate>/check_korean.py ko/<id>.md` → must exit 0.
5. **Index** — add the new concepts to `knowledge/index.md`.
6. **Final evidence** — after the last edit, capture the exact revision/worktree
   fingerprint and rerun the checks below. A receipt from before the last edit is stale
   for the publish candidate.
7. **PR** — branch, commit, open a PR to `main`. **The human merges.** Never merge
   automatically, even on a personal repo.

## Verify before "done"

- Record `git rev-parse HEAD`, `git status --short`, and `git diff --stat` with the
  verification receipt. If the worktree is dirty, name the exact changed files in the
  receipt; the commit hash alone does not identify the artifact.
- Treat any edit after verification as evidence-invalidating for the touched artifact.
  Rerun the relevant checks after that edit before saying "done".
- `npm run build` passes after the final edit.
- Through the MCP server, verify `list_topics`, one EN `read_doc`/search path, and one KO
  `read_doc`/search path for the new or changed concepts.
- If publishing changes installer behavior, run behavioral QA in a temporary target project:
  install once, verify the managed import/loaded file, reinstall for idempotency, and test
  a conflicting managed file for prompt/failure semantics.
