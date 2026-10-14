// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A switch's own click (Space on a focused switch, or a mouse click when it
// takes pointer events) bubbles to a clickable row around it. If the switch
// toggles too, the value toggles twice, so such a switch stops its click.
const ROOTS = ["components", "layouts", "pages"];
const TAG = /<(\/?)([A-Za-z][\w.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const VOID = new Set(["input", "img", "br", "hr", "meta", "link"]);

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return vueFiles(path);
    }
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

function bubblingSwitches(path: string) {
  const source = readFileSync(path, "utf8");
  const start = source.indexOf("<template>");
  const end = source.lastIndexOf("</template>");
  if (start === -1 || end === -1) {
    return [];
  }

  const found: string[] = [];
  const open: Array<{ name: string; attrs: string }> = [];
  for (const match of source.slice(start, end).matchAll(TAG)) {
    const [, closing, name, attrs, selfClosing] = match;
    if (name === "Switch" && !closing) {
      const inClickableRow = open.some(({ attrs }) => /@click\b/.test(attrs));
      const toggles = /@update:model-value|v-model/.test(attrs);
      if (inClickableRow && toggles && !/@click\.stop\b/.test(attrs)) {
        const line = source.slice(0, start + match.index!).split("\n").length;
        found.push(`${path}:${line}`);
      }
    }
    if (closing) {
      const index = open.map((tag) => tag.name).lastIndexOf(name);
      if (index !== -1) {
        open.length = index;
      }
    } else if (!selfClosing && !VOID.has(name.toLowerCase())) {
      open.push({ name, attrs });
    }
  }
  return found;
}

describe("switches in clickable rows", () => {
  it("keep their own click from reaching the row", () => {
    expect(ROOTS.flatMap(vueFiles).flatMap(bubblingSwitches)).toEqual([]);
  });
});
