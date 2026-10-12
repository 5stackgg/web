// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import mapLabel from "~/utilities/mapLabel";

// An official map has no label, so falling back to its name shows "de_ancient"
// where the rest of the app says "Ancient".
const ROOTS = [
  "components",
  "composables",
  "layouts",
  "pages",
  "server",
  "stores",
  "utilities",
];
const RAW_FALLBACK =
  /\bmap\??\.label\s*(?:\|\||\?\?)\s*[\w$.?[\]]*\bmap\??\.name\b/g;
const RAW_INTERPOLATION = /\{\{\s*[\w$.?[\]]*\bmap\??\.name\s*\}\}/g;
// The rotation editor prints the server's map id under the label on purpose.
const ALLOWED = new Set([
  "components/servers/ServerMapRotation.vue {{ row.map.name }}",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(vue|ts)$/.test(entry.name) ? [path] : [];
  });
}

function rawMapNames(path: string) {
  const source = readFileSync(path, "utf8");
  return [
    ...source.matchAll(RAW_FALLBACK),
    ...source.matchAll(RAW_INTERPOLATION),
  ]
    .filter((match) => !ALLOWED.has(`${path} ${match[0]}`))
    .map((match) => {
      const line = source.slice(0, match.index).split("\n").length;
      return `${path}:${line} ${match[0].replace(/\s+/g, " ")}`;
    });
}

describe("map names", () => {
  it("reads an official map as its label", () => {
    expect(mapLabel({ name: "de_ancient", label: null })).toBe("Ancient");
    expect(mapLabel({ name: "cs_office", label: null })).toBe("Office");
    expect(mapLabel({ name: "3070923343", label: "Rooftops" })).toBe(
      "Rooftops",
    );
  });

  it("go through mapLabel() instead of showing the raw name", () => {
    const offenders = ROOTS.flatMap((root) =>
      sourceFiles(root).flatMap(rawMapNames),
    );

    expect(offenders).toEqual([]);
  });
});
