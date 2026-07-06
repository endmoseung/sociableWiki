---
name: knowledge-set
description: Add or update one concept in your sociableWiki. Use when the human says "이거 위키에 넣어", "add this to the wiki", "save this pattern", or hands you a note/finding worth keeping. Writes one markdown doc with the frontmatter contract, then runs the portable quality gate before it lands.
---

# knowledge-set — add or update a concept

One concept per doc. Capture the durable insight, not a raw transcript.

## Steps

1. **Decide: new doc or update an existing one?**
   Search first (`knowledge-get` logic). If a doc already owns this concept, update it in
   place — don't create a near-duplicate.

2. **Pick area + slug.** Choose an area folder under `knowledge/` (see `.sociablewiki/config.json`
   `areas`, e.g. `ai-native`, `dev`, `principles`). Slug = short, durable, kebab-case,
   English, date-free. Id = `<area>/<slug>`.

3. **Write `knowledge/<area>/<slug>.md`** with the frontmatter contract:
   ```yaml
   ---
   type: pattern | deep-dive | reference | principle
   title: <clean title>
   description: <one sentence — the core claim>
   tags: [3-6 kebab-case tags]
   date: <YYYY-MM-DD>
   source: <"original" or a short external attribution>
   relates: [<existing concept ids>]
   ---
   ```
   Body: explain the claim sharply. If it's derived from external sources, add a `## Sources`
   section with real links/titles. If the human keeps translations, also write
   `<lang>/<area>/<slug>.md`.

4. **Run the portable quality gate (all must pass):**
   1. `type`, `title`, `description` present and non-empty.
   2. Every `relates:` id is an existing doc — no dead links.
   3. Slug doesn't collide with an existing doc.
   4. If `.sociablewiki/config.json` has `secretPatterns`, grep the new doc(s) for each —
      **zero matches**. (This keeps employer/internal names out of a public wiki.)
   5. Add the concept to `knowledge/index.md`.
   Fix any failure before the doc lands. Never commit a doc that fails the gate.

5. **Hand off.** Summarize what you added/updated. The human commits and merges — you don't
   push to `main` yourself.

## Anti-patterns

- Two claims in one doc → split into two.
- Pasting a whole chat log → distill the one durable takeaway.
- Vague generic advice → this is a brand surface; keep it specific and earned.
