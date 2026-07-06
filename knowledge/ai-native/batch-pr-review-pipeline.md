---
type: pattern
title: Batch PR Review with a Parallel Subagent Pipeline
description: Review many open PRs at once with one subagent per PR, then map inline comments using the files-API patch — not the pr-diff line numbers — or GitHub rejects them.
tags: [ai-native, code-review, subagents, github-api, automation, inline-comments]
date: 2026-06-15
source: original
relates: []
---

# Batch PR Review with a Parallel Subagent Pipeline

When I needed to drop a code review on a dozen-plus open PRs in one pass, I built
a pipeline: one read-only subagent per PR does the analysis, and a single lead
process handles line mapping and posting. It worked cleanly — but it exposed two
traps in GitHub's inline-comment API that are easy to get wrong and hard to debug.
The procedure and the traps transfer to any GitHub review automation.

## Key conclusions (first)

1. **Compute inline comment line numbers from the `patch` in `gh api .../pulls/N/files`.**
   If you trust the lines that `gh pr diff` prints, GitHub rejects the comment
   with `422 "Line could not be resolved"` — the two disagree because they pick
   different bases, so the line numbers drift apart.
2. **When you locate a line by anchor text, make the anchor specific enough.**
   Generic tokens like `Suspense`, a text-input component, or a query hook match
   the file's `import { ... }` line *before* the JSX you meant, so the comment
   lands on the wrong line.
3. One subagent per PR for **parallel read-only review → structured result →
   lead does line mapping + language gate + batch post** scaled well.
4. **You can't approve / request-changes on a PR you authored** — only
   `event: "COMMENT"` is allowed. Check your login first with
   `gh api user --jq .login` before posting.

## Trap 1 — `gh pr diff` lines ≠ GitHub API inline lines (the core delta)

Inline comments only attach to the lines GitHub actually rendered in the diff.
But the line numbers in the unified diff that `gh pr diff N` prints can drift
from the file lines the review API (`comments[].line` in
`POST .../pulls/N/reviews`) recognizes.

Measured, on a newly added file: `gh pr diff` showed its hunk header as
`@@ -0,0 +1,285 @@` (285 lines), while the `patch` from `gh api .../files`
showed `@@ -0,0 +1,224 @@` (224 lines). A `line: 218` computed off the
`gh pr diff` numbering was rejected with
`422 Unprocessable Entity / "Line could not be resolved"`; recomputed against the
files-API patch, `line: 159` was accepted. (They differ because they pick a
different base / merge-base, or because `gh pr diff` merges other file blocks
into what it shows.)

→ **Rule:** always compute inline lines from the files API.

```bash
gh api repos/<owner>/<repo>/pulls/<N>/files --paginate \
  --jq '.[] | select(.filename | test("<file>$")) | .patch' > /tmp/file.patch
# Read the +start line from the @@ header, then count +/context lines to get the RIGHT-side file line.
```

Line-counting logic (unified diff → new-file line): from `@@ ... +S,n @@` take
the start value `S`, then for each `+` (added) or ` ` (context) line increment by
1; `-` (deletion) lines do **not** advance the new-file line.

Review post payload (inline + body + COMMENT):

```bash
# payload.json: {commit_id, event:"COMMENT", body:"<summary>", comments:[{path,line,side:"RIGHT",body}]}
gh api repos/<owner>/<repo>/pulls/<N>/reviews -X POST --input payload.json \
  --jq '.state + " " + .html_url'
```

Setting `side: "RIGHT"` explicitly reduces ambiguity. Lines this PR didn't touch
can't take an inline comment, so fold those remarks into the review **body** as
`file:context` instead — a clean fallback.

## Trap 2 — an anchor that's too generic matches the import line

The robust way to have a subagent point at a line is to return the **code text
(anchor)** rather than a line number, and let the lead find that text's line in
the diff (the line numbers a subagent sees are against a cumulative diff, so they
can't be trusted). But if the anchor is a generic token — `Suspense`, a
text-input component name, a query hook — that also appears in the top-of-file
`import { ... }`, it matches the **import line first** and the comment lands on
the wrong line (I hit this three times).

→ **Rule:** make the anchor a form that only appears on the target line. E.g.
a bare query-hook name (❌, also in the import) → the hook name *with its call
argument* (✅). Also order matching to prefer `+` (added) lines over context, so
it avoids the import block when it can.

## The pipeline (many PRs in one pass)

```
1. Select targets   gh pr list --state open --json number,title,author,isDraft
                    + gh api user (.login) to detect self-authored PRs
                    + skip PRs you already reviewed (is your login in .../pulls/N/reviews?)
2. Parallel review  One subagent per PR (general-purpose), READ-ONLY.
                    Prompt carries repo rules (architecture, type-safety, design tokens,
                    review voice) + diff-shaped suspicion points. Fixed result schema:
                    { verdict, summary, inline:[{path, anchor, severity, body}], VERIFIED }
3. Line mapping     Lead converts anchor → files-API patch line (Traps 1 & 2).
                    Falls back to the body when it can't find it.
4. Gate             It's human-read output, so pass the language-quality gate.
5. Batch post       reviews API with event:COMMENT per PR. Post one small PR first
                    to verify line acceptance, then batch the rest.
```

The subagent **analyzes only; the lead posts** — this prevents wasted API calls
on wrong lines and keeps the language gate and duplicate check in one place.
(If you let a subagent run cleanup commands like `git branch -D`, deny rules
warn on it — pin it read-only.)

## Side lessons

- **Make the subagent verify its suspicion with code.** Asking it to reproduce
  "does a deep object convert break an id-keyed map?" with `node -e` split the
  false positives from the real signal. Bake "read the actual code / interceptor /
  types to confirm before you claim" into the prompt.
- **Local working tree ≠ PR HEAD.** If you're on a different branch, `yarn test`
  results are stale. Review against `git show <PR-SHA>:<path>` / `gh pr diff`.
- **The verdict distribution reveals priority.** Of the batch, only one PR was a
  real blocker (an unconverted nested camelCase key + a missing response envelope);
  the rest were low severity. On the blocker, I left a dependency note — "a
  preceding PR's merge resolves this, so order them" — so the author could act
  immediately.

## Sources

- Firsthand: a session posting reviews across ~13 open PRs (2026-06-15). The
  `422 Line could not be resolved` reproduction came from a newly added modal
  file where `gh pr diff` reported 285 lines vs. 224 in the files API.
- GitHub REST: `POST /repos/{o}/{r}/pulls/{n}/reviews` (`comments[].line`/`side`),
  `GET .../pulls/{n}/files`.
