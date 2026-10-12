// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const locale = (name: string) =>
  JSON.parse(readFileSync(`i18n/locales/${name}.json`, "utf8"));

function strings(node: unknown, path = ""): Array<[string, string]> {
  if (typeof node === "string") {
    return [[path, node]];
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) =>
      strings(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("locale wording", () => {
  // "أفضل من" reads as "better than"; this locale keeps Best Of as the term.
  it("ar_SA says Best Of wherever English says best of", () => {
    const en = new Map(strings(locale("en")));
    const bestOf = strings(locale("ar_SA")).filter(([key]) =>
      /best[ -]of/i.test(en.get(key) ?? ""),
    );

    expect(bestOf.length).toBeGreaterThan(10);
    expect(
      bestOf.filter(
        ([, text]) => text.includes("أفضل من") || !text.includes("Best Of"),
      ),
    ).toEqual([]);
  });

  it("sv_SE asks to join with a team without a doubled word", () => {
    const sv = new Map(strings(locale("sv_SE")));

    expect(
      sv.get("team.search.tournament_join_requires_owner_or_captain"),
    ).not.toMatch(/\bmed med\b/);
  });
});
