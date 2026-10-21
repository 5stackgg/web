// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Chrome keeps a finished animation that still fills (`forwards`/`both`) active,
// so every character it ran on keeps its own compositor layer, along with
// whatever overlaps it. A finished match page mounts hundreds of these.
const source = readFileSync(
  resolve(__dirname, "../../components/AnimatedStat.vue"),
  "utf8",
);
const css = source.slice(source.indexOf("<style"));

function block(selector: RegExp) {
  return css.match(selector)?.[1] ?? "";
}

function declarations(body: string) {
  return Object.fromEntries(
    body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(";")
      .map((declaration) => declaration.split(":"))
      .filter((parts) => parts.length >= 2)
      .map(([property, ...value]) => [
        property.trim(),
        value.join(":").trim(),
      ]),
  );
}

const char = declarations(block(/\n\.flip-stat__char\s*\{([^}]*)\}/));
const lastFrame = declarations(
  block(/@keyframes flip-char\s*\{[\s\S]*?100%\s*\{([^}]*)\}/),
);

describe("AnimatedStat", () => {
  it("lets each character's flip end instead of filling forever", () => {
    const keywords = (char.animation ?? "")
      .replace(/\([^)]*\)/g, "")
      .split(/[\s,]+/);

    expect(char.animation).toMatch(/^flip-char\b/);
    expect(keywords).not.toContain("forwards");
    expect(keywords).not.toContain("both");
    expect(char["animation-fill-mode"]).toBeUndefined();
  });

  it("does not hold a layer per character at rest", () => {
    expect(char["backface-visibility"]).toBeUndefined();
    expect(char["will-change"]).toBeUndefined();
  });

  it("ends the flip on the resting style, so letting it go is invisible", () => {
    expect(lastFrame).toEqual({ transform: "rotateX(0deg)", opacity: "1" });
    expect(char.transform).toBeUndefined();
    expect(char.opacity).toBeUndefined();
  });

  it("keeps the reduced-motion opt-out", () => {
    expect(
      block(
        /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.flip-stat__char\s*\{([^}]*)\}/,
      ),
    ).toMatch(/animation:\s*none/);
  });
});
