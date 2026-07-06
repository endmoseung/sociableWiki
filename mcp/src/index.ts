#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadDocs, readTopicIndex, type KnowledgeDoc } from "./docs.js";
import { buildIndex } from "./search.js";

const { en, ko } = loadDocs();
const index = buildIndex(en, [...ko.values()]);
const byId = new Map(en.map((d) => [d.id, d]));

const server = new McpServer({ name: "sociable-wiki", version: "0.1.0" });

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function renderDoc(doc: KnowledgeDoc, note?: string): string {
  const meta = [
    `type: ${doc.type}`,
    doc.tags.length ? `tags: ${doc.tags.join(", ")}` : null,
    doc.date ? `date: ${doc.date}` : null,
    doc.source ? `source: ${doc.source}` : null,
    doc.relates.length ? `related: ${doc.relates.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const parts = [
    `# ${doc.title}`,
    doc.description ? `> ${doc.description}` : null,
    meta ? `_${meta}_` : null,
    doc.body,
    note ?? null,
  ];
  return parts.filter(Boolean).join("\n\n");
}

server.registerTool(
  "search_knowledge",
  {
    title: "Search the wiki",
    description:
      "Full-text search over the sociableWiki knowledge base (AI-native development, " +
      "agent/harness engineering, dev practice). Works in English and Korean. " +
      "Returns ranked matches with concept ids — call read_doc with an id for the full text.",
    inputSchema: {
      query: z.string().describe("Search query (English or Korean)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Only return docs carrying ALL of these tags"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe("Max results (default 8)"),
    },
  },
  async ({ query, tags, limit }) => {
    const hits = index.search(query, limit ?? 8, tags);
    if (hits.length === 0) {
      return text(
        `No matches for "${query}". Try broader terms, or list_topics to browse.`
      );
    }
    const lines = hits.map(
      (h) =>
        `- **${h.title}**\n  id: \`${h.id}\` · ${h.type}` +
        (h.tags.length ? ` · ${h.tags.join(", ")}` : "") +
        (h.description ? `\n  ${h.description}` : "")
    );
    return text(`${hits.length} result(s) for "${query}":\n\n${lines.join("\n")}`);
  }
);

server.registerTool(
  "read_doc",
  {
    title: "Read a doc",
    description:
      "Read one knowledge doc in full by concept id (as returned by search_knowledge " +
      "or list_topics). English is canonical; pass lang: 'ko' for the Korean version when available.",
    inputSchema: {
      id: z.string().describe("Concept id, e.g. 'ai-native/context-compaction'"),
      lang: z.enum(["en", "ko"]).optional().describe("Language (default en)"),
    },
  },
  async ({ id, lang }) => {
    const enDoc = byId.get(id);
    const koDoc = ko.get(id);
    if (!enDoc && !koDoc) {
      return text(
        `No doc with id "${id}". Use search_knowledge or list_topics to find valid ids.`
      );
    }
    if (lang === "ko") {
      if (koDoc) return text(renderDoc(koDoc));
      return text(
        renderDoc(
          enDoc!,
          "> Korean version not available for this doc yet — English canonical shown."
        )
      );
    }
    return text(renderDoc(enDoc ?? koDoc!));
  }
);

server.registerTool(
  "list_topics",
  {
    title: "Browse topics",
    description:
      "Overview of everything in the wiki: the human-curated topic map when present, " +
      "otherwise a generated listing grouped by area. Good first call to see what's here.",
    inputSchema: {},
  },
  async () => {
    const curated = readTopicIndex();
    if (curated) return text(curated);
    const groups = new Map<string, KnowledgeDoc[]>();
    for (const doc of en) {
      const area = doc.id.includes("/") ? doc.id.split("/")[0] : "(root)";
      const list = groups.get(area) ?? [];
      list.push(doc);
      groups.set(area, list);
    }
    const sections = [...groups.entries()].map(([area, docs]) => {
      const lines = docs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((d) => `- \`${d.id}\` — ${d.title}`);
      return `## ${area} (${docs.length})\n${lines.join("\n")}`;
    });
    return text(`# Topics\n\n${sections.join("\n\n")}`);
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
