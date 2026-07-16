import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const concepts = [
  "dependency-clustered-code-review",
  "independent-verification-of-review-findings",
];

const index = await readFile("knowledge/index.md", "utf8");

for (const concept of concepts) {
  const englishPath = `knowledge/ai-native/${concept}.md`;
  const koreanPath = `ko/ai-native/${concept}.md`;
  const [english, korean] = await Promise.all([
    readFile(englishPath, "utf8"),
    readFile(koreanPath, "utf8"),
  ]);

  assert.match(english, /^---\n[\s\S]+?\n---\n/);
  assert.match(korean, /^---\n[\s\S]+?\n---\n/);
  assert.match(
    index,
    new RegExp(`\\(ai-native/${concept.replaceAll("-", "\\-")}\\.md\\)`),
  );
}

console.log("review concept pairs and index entries are present");
