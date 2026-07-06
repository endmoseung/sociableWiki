# sociableWiki

A public, agent-searchable knowledge base about **AI-native software development** —
working with coding agents, designing harnesses, orchestrating subagents, evaluating
LLM systems. These are my own working notes, curated and rewritten to stand on their own.

The name is the point: this wiki is **sociable** — it's built to be plugged into
*your* agent, not just read by you. Browse it as plain markdown here, or connect it
as an MCP server and let your AI search it while it works.

> 한국어 안내는 아래 [한국어](#한국어)에 있습니다. 모든 문서는 영어(정본)와 한국어 두 버전으로 제공됩니다.

## Plug it into your agent (MCP)

The repo ships a [Model Context Protocol](https://modelcontextprotocol.io) server.
No API keys, no external service — it reads the markdown in this repo and serves it
over three tools: `search_knowledge`, `read_doc`, `list_topics`.

**Claude Code:**

```bash
claude mcp add sociable-wiki -- npx -y github:endmoseung/sociableWiki
```

**Any MCP client** (Claude Desktop, Cursor, …) — add to your MCP config:

```json
{
  "mcpServers": {
    "sociable-wiki": {
      "command": "npx",
      "args": ["-y", "github:endmoseung/sociableWiki"]
    }
  }
}
```

Then ask your agent things like *"search the sociable-wiki for how to decide subagent
fan-out width"* — it will call `search_knowledge`, then `read_doc` on the hit.

### Tools

| Tool | What it does |
|---|---|
| `search_knowledge(query, tags?, limit?)` | Full-text search over every doc. Works in English **and Korean**. |
| `read_doc(id, lang?)` | Read one doc in full by concept id. `lang: "ko"` for the Korean version. |
| `list_topics()` | Browse everything, grouped by area. |

## Browse without an agent

Everything lives as plain markdown:

- [`knowledge/`](knowledge) — English (canonical). Start at [`knowledge/index.md`](knowledge/index.md).
- [`ko/`](ko) — Korean mirror, same paths.

## How it's organized

Each doc is one **concept** — a single sharp claim or decision rule, with a bit of
frontmatter for search and a body that explains it. Concept ids are just the file
path without `.md` (`ai-native/fan-out-scope-gate`). Areas:

- **`ai-native/`** — agents, harnesses, orchestration, LLM evaluation, context management.
- **`dev/`** — general engineering that isn't AI-specific.
- **`principles/`** — durable judgment calls and design principles.

Docs derived from external sources (papers, posts, talks) carry a `## Sources`
section; the analysis and framing are mine, the underlying findings are credited.

## Run the server locally

```bash
git clone https://github.com/endmoseung/sociableWiki
cd sociableWiki
npm install && npm run build
node mcp/dist/index.js   # speaks MCP over stdio
```

---

## 한국어

**AI 네이티브 개발**에 관한 공개 지식 베이스입니다 — 코딩 에이전트와 일하는 법,
하네스 설계, 서브에이전트 오케스트레이션, LLM 시스템 평가. 제가 실제로 쓰며 정리한
노트를 골라내고 홀로 읽어도 이해되게 다시 썼습니다.

이름 그대로 이 위키는 **sociable**합니다 — 혼자 읽는 문서가 아니라 *당신의*
에이전트에 꽂아 쓰라고 만들었습니다. 여기서 마크다운으로 읽어도 되고, MCP 서버로
연결해 AI가 작업 중에 직접 검색하게 해도 됩니다.

**Claude Code에 연결:**

```bash
claude mcp add sociable-wiki -- npx -y github:endmoseung/sociableWiki
```

API 키도, 외부 서비스도 필요 없습니다. 레포 안의 마크다운을 그대로 읽어 세 가지
도구(`search_knowledge`·`read_doc`·`list_topics`)로 제공합니다. 검색은 영어와
한국어 모두 됩니다. 모든 문서는 영어 정본과 한국어판이 짝을 이룹니다.

## License

- Code (the MCP server): [MIT](LICENSE).
- Knowledge content (`knowledge/`, `ko/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — share and adapt with attribution.

Author: **Seungmo Kim** · [github.com/endmoseung](https://github.com/endmoseung)
