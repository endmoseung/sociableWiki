import MiniSearch from "minisearch";
import type { KnowledgeDoc } from "./docs.js";

/** Hangul, CJK ideographs, kana */
const CJK = /[ᄀ-ᇿ㄰-㆏가-힯一-鿿぀-ヿ]/;

/**
 * Default word-split plus character bigrams for CJK tokens, so Korean queries
 * match without a language-specific stemmer.
 */
export function tokenize(text: string): string[] {
  const base = text
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter(Boolean);
  const tokens: string[] = [];
  for (const token of base) {
    tokens.push(token);
    if (CJK.test(token) && token.length > 1) {
      for (let i = 0; i < token.length - 1; i++) {
        tokens.push(token.slice(i, i + 2));
      }
    }
  }
  return tokens;
}

export interface SearchHit {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  date: string;
  score: number;
}

/**
 * Index English (canonical) and Korean docs together so queries in either
 * language hit the matching-language body. Each doc gets a language-prefixed
 * index key; results collapse back to the English concept for presentation, so
 * a hit always points at a stable concept id regardless of which language matched.
 */
export function buildIndex(en: KnowledgeDoc[], ko: KnowledgeDoc[] = []) {
  const enById = new Map(en.map((d) => [d.id, d]));
  const mini = new MiniSearch({
    fields: ["title", "description", "tagText", "body"],
    storeFields: ["conceptId"],
    tokenize,
    searchOptions: {
      boost: { title: 3, description: 2, tagText: 2 },
      prefix: true,
      fuzzy: 0.15,
    },
  });
  const indexed = [
    ...en.map((d) => ({ ...d, key: `en:${d.id}`, conceptId: d.id })),
    // Only index a Korean doc when its concept exists in English (English is canonical).
    ...ko
      .filter((d) => enById.has(d.id))
      .map((d) => ({ ...d, key: `ko:${d.id}`, conceptId: d.id })),
  ].map((d) => ({ ...d, id: d.key, tagText: d.tags.join(" ") }));
  mini.addAll(indexed);

  return {
    search(query: string, limit: number, tags?: string[]): SearchHit[] {
      const seen = new Set<string>();
      const hits: SearchHit[] = [];
      for (const r of mini.search(query)) {
        const conceptId = String(r.conceptId);
        if (seen.has(conceptId)) continue; // collapse en+ko matches of one concept
        const doc = enById.get(conceptId);
        if (!doc) continue;
        if (tags?.length && !tags.every((t) => doc.tags.includes(t))) continue;
        seen.add(conceptId);
        hits.push({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          type: doc.type,
          tags: doc.tags,
          date: doc.date,
          score: r.score,
        });
        if (hits.length >= limit) break;
      }
      return hits;
    },
  };
}
