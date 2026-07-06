---
name: knowledge-get
description: Search and read your sociableWiki knowledge base. Use when the human asks a question the wiki might answer, or says "찾아", "search the wiki", "what did I write about X". Prefers the MCP server if connected; falls back to reading knowledge/ directly.
---

# knowledge-get — search & read the wiki

Answer from the wiki, not from your own memory. Retrieve first, then respond.

## Steps

1. **Prefer the MCP server.** If a `sociable-wiki` (or equivalently named) MCP server is
   connected, use its tools:
   - `search_knowledge(query, tags?, limit?)` — ranked matches. Works across languages.
   - `read_doc(id, lang?)` — full text of one concept by id.
   - `list_topics()` — browse everything, grouped by area.

2. **No MCP? Read the files directly.**
   - Browse: read `knowledge/index.md` for the topic map.
   - Search: grep titles/descriptions/body under `knowledge/` for the query terms, then
     read the top matching files in full.
   - A doc's id is its path under `knowledge/` without `.md`.

3. **Answer, grounded.** Lead with the conclusion the wiki supports, then cite the concept
   id(s) you used (e.g. "per `ai-native/fan-out-scope-gate`…"). If the wiki has nothing
   relevant, say so plainly — do not invent an answer and attribute it to the wiki.

## Notes

- The English doc under `knowledge/` is canonical; a translation may exist at the same path
  under a language folder (e.g. `ko/`). Read the language the human is working in.
- Don't dump whole files back at the human unless they ask — synthesize and cite.
