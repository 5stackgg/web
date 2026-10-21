// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const outline = read("composables/useFaq.ts");
const outlineIds = new Set(
  [...outline.matchAll(/\bid: "([a-z0-9-]+)"/g)].map((match) => match[1]),
);
const sectionIds = [...outline.matchAll(/^ {10}id: "([a-z0-9-]+)",$/gm)].map(
  (match) => match[1],
);

function vueFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(
    (entry) =>
      entry.isDirectory()
        ? vueFiles(join(dir, entry.name))
        : entry.name.endsWith(".vue")
          ? [join(dir, entry.name)]
          : [],
  );
}

const sources = ["components", "pages", "layouts"].flatMap(vueFiles);

describe("the FAQ's anchors", () => {
  it("only links to sections the outline has", () => {
    const linked = sources.flatMap((file) =>
      [
        ...read(file).matchAll(
          /<Faq(?:Link|Sub|Section)[^>]*?\b(?:to|id)="([a-z0-9-]+)"|<FaqHelpGlyph[^>]*?section="([a-z0-9-]+)"|\bto: ["']([a-z0-9-]+)["']/g,
        ),
      ].map((match) => ({ file, id: match[1] ?? match[2] ?? match[3] })),
    );
    expect(linked.length).toBeGreaterThan(20);
    expect(linked.filter(({ id }) => !outlineIds.has(id))).toEqual([]);
  });

  it("draws every section of the outline", () => {
    const content = read("components/faq/FaqContent.vue");
    const drawn = new Set(
      [...content.matchAll(/<FaqSection id="([a-z0-9-]+)"/g)].map(
        (match) => match[1],
      ),
    );
    const qaParts = ["playing", "about", "hosting"];
    const qaSections = new Set<string>();
    for (const part of qaParts) {
      const start = outline.indexOf(`id: "${part}",`);
      const end = outline.indexOf("\n    },\n", start);
      for (const match of outline
        .slice(start, end)
        .matchAll(/^ {10}id: "([a-z0-9-]+)",$/gm)) {
        qaSections.add(match[1]);
      }
    }
    expect(
      sectionIds.filter((id) => !drawn.has(id) && !qaSections.has(id)),
    ).toEqual([]);
  });
});
