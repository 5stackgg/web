// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// resolveDynamicComponent can't find "NuxtLink"; it renders an inert <nuxtlink>.
const root = fileURLToPath(new URL("../..", import.meta.url));
const scannedDirs = ["components", "pages", "layouts"];

const IS_ATTRIBUTE = /(?:^|\s)(:|v-bind:)?is\s*=\s*("([^"]*)"|'([^']*)')/g;
const NUXT_LINK_NAME = /^(NuxtLink|nuxt-link)$/;
const NUXT_LINK_STRING = /(["'`])(NuxtLink|nuxt-link)\1/;
const RENDER_FUNCTION_STRING =
  /\b(resolveDynamicComponent|h)\(\s*(["'`])(NuxtLink|nuxt-link)\2/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(vue|ts|tsx)$/.test(file))
    .map((file) => join(root, dir, file));
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function findStringNuxtLinks(file: string, source: string): string[] {
  const hits: string[] = [];
  const location = (index: number) =>
    `${relative(root, file)}:${lineOf(source, index)}`;

  for (const match of source.matchAll(IS_ATTRIBUTE)) {
    const bound = Boolean(match[1]);
    const value = match[3] ?? match[4] ?? "";
    if (
      bound ? NUXT_LINK_STRING.test(value) : NUXT_LINK_NAME.test(value.trim())
    ) {
      hits.push(`${location(match.index)} ${match[0].trim()}`);
    }
  }

  for (const match of source.matchAll(RENDER_FUNCTION_STRING)) {
    hits.push(`${location(match.index)} ${match[0]}`);
  }

  return hits;
}

describe("NuxtLink used as a dynamic component", () => {
  it("detects the string form it guards against", () => {
    expect(
      findStringNuxtLinks(
        "x.vue",
        `<component :is="team.id ? 'NuxtLink' : 'div'" />\n<component is="NuxtLink" />`,
      ),
    ).toHaveLength(2);
    expect(
      findStringNuxtLinks(
        "x.vue",
        `<component :is="team.id ? NuxtLink : 'div'" />`,
      ),
    ).toHaveLength(0);
  });

  it("is never referenced by name in components, pages or layouts", () => {
    const hits = scannedDirs
      .flatMap(sourceFiles)
      .flatMap((file) => findStringNuxtLinks(file, readFileSync(file, "utf8")));

    expect(hits).toEqual([]);
  });
});
