import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

export interface KnowledgeDoc {
  /** Concept id: path relative to knowledge/ (or ko/), without .md */
  id: string;
  lang: "en" | "ko";
  title: string;
  description: string;
  type: string;
  tags: string[];
  date: string;
  source?: string;
  relates: string[];
  body: string;
}

/** Repo root: mcp/dist/docs.js → mcp/dist → mcp → root */
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

/** YAML dates come through gray-matter as Date objects; normalize to YYYY-MM-DD. */
function normalizeDate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value).slice(0, 10);
  }
  return "";
}

function parseDoc(
  filePath: string,
  baseDir: string,
  lang: "en" | "ko"
): KnowledgeDoc {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const rel = path.relative(baseDir, filePath).replace(/\.md$/, "");
  const id = rel.split(path.sep).join("/");
  return {
    id,
    lang,
    title: typeof data.title === "string" ? data.title : id,
    description: typeof data.description === "string" ? data.description : "",
    type: typeof data.type === "string" ? data.type : "reference",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    date: normalizeDate(data.date),
    source: typeof data.source === "string" ? data.source : undefined,
    relates: Array.isArray(data.relates) ? data.relates.map(String) : [],
    body: content.trim(),
  };
}

export interface Library {
  en: KnowledgeDoc[];
  ko: Map<string, KnowledgeDoc>;
}

export function loadDocs(): Library {
  const enDir = path.join(ROOT, "knowledge");
  const koDir = path.join(ROOT, "ko");
  const en = walk(enDir)
    .filter((f) => path.basename(f) !== "index.md")
    .map((f) => parseDoc(f, enDir, "en"));
  const ko = new Map(
    walk(koDir)
      .filter((f) => path.basename(f) !== "index.md")
      .map((f) => {
        const doc = parseDoc(f, koDir, "ko");
        return [doc.id, doc] as const;
      })
  );
  return { en, ko };
}

export function readTopicIndex(): string | null {
  const p = path.join(ROOT, "knowledge", "index.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}
