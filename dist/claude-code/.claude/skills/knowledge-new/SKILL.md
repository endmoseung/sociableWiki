---
name: knowledge-new
description: Turn a freshly cloned sociableWiki into YOUR wiki. Use once after cloning (or when the human says "make this mine", "init", "내 걸로 만들어"). Sets author/repo/config, clears the example knowledge, and leaves you an empty wiki ready to fill.
---

# knowledge-new — make this repo yours

sociableWiki ships with the original author's knowledge as a **working example**. This verb
strips the example and rewires the repo to the new owner. Run it once, right after cloning.

## Steps

1. **Gather identity from the human:**
   - author name + GitHub handle
   - repo name (their fork/repo, e.g. `github.com/<them>/<repo>`)
   - MCP server name they want (default: their repo name)
   - areas they'll organize under (default: keep `ai-native`, `dev`, `principles`)
   - optional: secret patterns (their employer / internal names) for the set-time sweep

2. **Write `.sociablewiki/config.json`** from `config.example.json`, filled with the above.

3. **Rewire identity** across the repo:
   - `package.json` — `name`, `bin` key, `repository.url`, `author`
   - `README.md` — title, author line, all `npx github:<owner>/<repo>` install commands, the
     `claude mcp add <name> …` line
   - MCP server name in `mcp/src/index.ts` (the `new McpServer({ name })` value)

4. **Clear the example knowledge:**
   - Move the shipped `knowledge/` + language mirrors to `examples/` (so the human can learn
     the format from them), OR delete them if the human prefers a clean slate.
   - Reset `knowledge/index.md` to an empty topic map.

5. **Verify it still builds and boots:**
   - `npm install && npm run build`
   - Confirm the MCP server starts and `list_topics` returns an empty (not broken) wiki.

6. **Tell the human what's next:** they add their first concept with `knowledge-set`, then
   commit. From here the repo is theirs — their brand surface, their MCP server.

## Note

Don't touch the original author's git remote. After `new`, the human points the repo at
their own remote (`git remote set-url origin …`) and pushes their version.
