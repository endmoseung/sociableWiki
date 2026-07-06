---
type: deep-dive
title: "Commit attribution is a write to shared history, not a credit line"
description: "The trailer choice (Co-Authored-By vs Assisted-by vs Generated-by) is a per-repo governance decision graded by who reads git history — and the real hazard is the default-on write, not the trailer itself."
tags: [commit-attribution, provenance, co-authored-by, git-blame, governance, ai-native]
date: 2026-06-20
source: "synthesis of external sources — see Sources"
relates: []
---

# Commit attribution is a write to shared history, not a credit line

## TL;DR

When an agent writes code, *who gets recorded as the author in git* is a separate
decision from "did the code get accepted" and from "should this code exist." It sits
after both, and it deserves its own reasoning because the thing you're writing is a
permanent, shared record — not a courtesy credit.

Three things I've come to hold firm on:

1. **`Co-Authored-By:` is being misused.** It was built for humans who swapped drafts.
   Stuffing a tool + model name into it breaks its format contract and pollutes the data
   it feeds — contribution graphs, `git blame`, avatar lists. The field is fragmenting
   toward purpose-built trailers: `Assisted-by:`, `Generated-by:`, `AI-assistant:`.
2. **The hazard is not the trailer, it's the *default-on write*.** Attribution that the
   tool silently appends to shared history — without the committer choosing it per-commit —
   is the failure mode. VS Code shipped exactly this and had to reverse it.
3. **Trailers are a coarse signal; line-level provenance is the finer one.** A commit
   trailer says "AI touched this commit." It does not say *which lines*. A second tooling
   layer (squash-safe line attribution) is emerging to answer the `git blame` question
   the trailer can't.

The reframe that carries the weight: a trailer is **a write to a shared, append-only,
audited artifact that other people and tools read** — not a courtesy credit. Grade the
decision by who reads that artifact and what breaks if the write is wrong, not by "should
the AI get credit."

## Why this is its own decision, not part of intake or review

Most discussion of AI-assisted code covers the *producing* end (how the agent
writes/tests/self-corrects) and the *receiving* end (should this PR even be in the queue;
should this code exist at all). Attribution sits **after** both: the code is accepted, it
should exist — now, *how is its origin recorded in the permanent record*.

That record is read by: `git blame` during a future incident, the host's contribution
graph, release-provenance tooling, and (in regulated shops) an auditor. Each reader has a
different tolerance for noise and a different need for the signal, which is why there's no
single right answer — only a right answer *per reader*.

## The four trailer conventions, and what each optimizes for

These are conventions and blog/foundation policy — practitioner grade, not measured
outcomes.

| Trailer | Semantics | Optimizes for | Breaks |
|---|---|---|---|
| `Co-Authored-By: Name <email>` | "this entity co-wrote it" — human pair-programming origin | Zero new tooling; GitHub/GitLab/Bitbucket already render it | Pollutes contribution graphs (counts the bot as a contributor); the `<email>` slot forces a fake address; conflates *tool* with *author* |
| `Assisted-by: <tool>` | Human is the author, AI is the tool that helped | Matches the reality of most AI-assisted work; doesn't inflate contributor counts | Not rendered specially by hosts (yet); no standard field for *which* model |
| `Generated-by: <token>` | Machine-parsable provenance token for release tooling | Downstream release-provenance files (e.g. Apache's `Tooling-Provenance`) | Heavier; aimed at release automation, not day-to-day blame |
| `AI-assistant: tool vN (model)` | Tool + model in one field | Single-field simplicity | Tempts over-stuffing; the cautionary view is "keep it simple or it rots" |

**Decision shortcut:** if the reader is a *human doing blame/credit*, the human is the
author and the AI is a tool → `Assisted-by:` framing (or nothing). If the reader is
*release/audit automation*, you want a parseable token → the `Generated-by:` family.
Reaching for `Co-Authored-By:` because "the tool defaults to it" is choosing by authoring
cost, not by who reads the field. That's the same anti-pattern as writing the code comment
the tool makes easy instead of the one the reader actually needs.

## The real hazard: default-on writes to shared history

The sharpest signal wasn't a debate about which trailer is correct — it was VS Code
flipping its "add AI co-author" setting from off to `all` by default (a PM-submitted PR,
~April 2026), which appended `Co-authored-by: Copilot` to commits **including ones written
with no AI involvement at all**. The vendor reversed it after backlash. The reading that
stuck: AI provenance is a reasonable governance goal, but the implementation **crossed the
line by making attribution a default write to git history instead of an explicit,
reviewable per-commit decision**.

This is the transferable rule, and it generalizes past trailers: *any* metadata an agent
harness writes into a shared, audited artifact (commit trailers, PR footers, model names,
provider tags) should be **opt-in or per-commit-reviewable**, because some repos treat git
history + repo markdown as the *only* canonical record and cannot tolerate silent
runtime/provider metadata leaking into it. It's the same shape as an agent producing any
side artifact: *someone must decide its fate at the seam* rather than letting the default
leak it into the permanent record.

Interim workaround teams actually use when a tool won't make it configurable: a repo
instruction banning AI/provider/model attribution **plus** a local `commit-msg` hook that
rejects those patterns. Don't trust the prompt-level instruction alone — enforce at the
hook. The prompt is a request; the hook is the gate.

## Trailers are coarse; the `git blame` question needs a finer layer

A commit trailer marks *the commit*. It cannot answer "who wrote **this line**" — the
actual question during an incident. As agents author more of each commit, `git blame`
degrades: a blamed line might be model-authored, human-authored, or bot-merged, and the
trailer doesn't disambiguate. A second tooling layer is forming to fill this — line-level
AI attribution that is **squash-safe** (survives squash/rebase, where naive commit-trailer
provenance is destroyed). Treat "do we need line-level provenance" as a *separate* decision
from "which commit trailer" — most teams need neither, regulated teams may need both, and
the two are not substitutes.

## Tool defaults as of this window (so you know what you're overriding)

- **Claude Code** — `Co-Authored-By:` trailer on commits **and** a PR-description footer,
  both **on by default**, trailer includes the model name. Worth knowing it *is* a
  default-on write, per the hazard above.
- **OpenAI Codex CLI** — added `Co-authored-by:` via **prompt injection** (the model is
  told to write the trailer), not a git hook — shipped ~Feb 2026. Prompt-level = not
  guaranteed, unlike a hook.
- **Aider** — appends `(aider)` to the author name + the model as co-author.
- **GitHub Copilot, Cursor** — historically **no** automatic attribution (the VS Code
  setting above is the host-editor layer, separate from Copilot itself).

No universal standard exists. The practical posture: **pick the trailer by who reads your
git history, set it explicitly, and never let it be a silent default** — then decide
separately whether line-level provenance is worth a second tool.

## What would make this note wrong

If hosts (GitHub/GitLab) ship first-class rendering for a *dedicated* AI trailer that
doesn't pollute contribution graphs, the "`Co-Authored-By:` is misused" friction
disappears and the decision collapses to "use the standard one." That hasn't happened as
of mid-2026; until it does, the trailer choice stays a per-repo governance call.

## Sources

All practitioner / policy grade (blogs, foundation guidance, vendor docs, GitHub issues).
No measured outcome study on attribution-trailer ROI exists yet — treat nothing here as
benchmark-grade.

- fabiorehm.com — "Our coding agent commits deserve better than Co-Authored-By" (2026-03)
- allthingsopen.org — "Assisted-by: how open source projects are drawing the line on AI contributions"
- Apache Software Foundation Generative Tooling Guidance (`Generated-by:`, `Tooling-Provenance`); Fedora AI-Assisted Contribution Policy (`Assisted-by:`)
- microsoft/vscode #297204 + the `git.addAICoAuthor` default-flip reversal; penligent.ai security framing
- openai/codex #19799 + Codex CLI `commit_attribution` (PR #11617, ~2026-02-17)
- Claude Code git attribution guide (deployhq); jvt.me "How and why I attribute LLM-derived code" (2026-02)
- Agent Blame (mesa-dot-dev/agentblame) and Git AI (usegitai) — line-level, squash-safe provenance tooling
- openclaude #1326 — "make AI commit attribution opt-in / configurable" feature request
