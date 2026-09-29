// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

const ADMIN_PAGES = [
  "pages/database/index.vue",
  "pages/dedicated-servers/index.vue",
  "pages/dedicated-servers/create.vue",
  "pages/dedicated-servers/[serverId]/files.vue",
  "pages/game-server-nodes/index.vue",
  "pages/game-server-nodes/[nodeId]/files.vue",
  "pages/regions/index.vue",
  "pages/system-logs.vue",
  "pages/system-metrics.vue",
];

const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const OPTIONS_SETUP = /^\s*(?:async\s+)?setup\s*(?:\(|:)/m;
const STRING_LITERAL = /"([^"]*)"|'([^']*)'/g;
const NAMED_MIDDLEWARE = /\bmiddleware\s*:\s*("[^"]*"|'[^']*'|\[[^\]]*\])/;

function pageFiles(): string[] {
  return readdirSync(join(root, "pages"), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".vue"))
    .map((file) => join(root, "pages", file));
}

function namedMiddlewareFiles(): string[] {
  return readdirSync(join(root, "middleware"))
    .filter(
      (file) => /\.(ts|js)$/.test(file) && !/\.global\.(ts|js)$/.test(file),
    )
    .map((file) => file.replace(/\.(ts|js)$/, ""));
}

function callArguments(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;

  for (let index = start; index < source.length; index++) {
    const char = source[index];

    if (quote) {
      if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (source.startsWith("//", index)) {
      index = source.indexOf("\n", index);
      if (index === -1) {
        break;
      }
    } else if (source.startsWith("/*", index)) {
      index = source.indexOf("*/", index) + 1;
      if (index === 0) {
        break;
      }
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return source.slice(start);
}

function pageMiddleware(source: string): string[] {
  const start = source.indexOf("definePageMeta(");
  if (start === -1) {
    return [];
  }

  const match = callArguments(source, start).match(NAMED_MIDDLEWARE);
  if (!match) {
    return [];
  }

  return Array.from(match[1].matchAll(STRING_LITERAL)).map(
    (literal) => literal[1] ?? literal[2],
  );
}

function mixesSetupStyles(source: string): boolean {
  const blocks = Array.from(source.matchAll(SCRIPT_BLOCK));
  const hasScriptSetup = blocks.some((block) => /\bsetup\b/.test(block[1]));

  return (
    hasScriptSetup &&
    blocks.some(
      (block) => !/\bsetup\b/.test(block[1]) && OPTIONS_SETUP.test(block[2]),
    )
  );
}

describe("page middleware", () => {
  it("reads the forms definePageMeta takes", () => {
    const single = `definePageMeta({ middleware: "admin" });`;
    expect(pageMiddleware(single)).toEqual(["admin"]);
    expect(
      pageMiddleware(
        `definePageMeta({\n  // (a comment)\n  middleware: ["auth", 'moderator'],\n});`,
      ),
    ).toEqual(["auth", "moderator"]);
    expect(
      pageMiddleware(
        `definePageMeta({ middleware(to) { return navigateTo("/"); } });\nconst x = { middleware: "nope" };`,
      ),
    ).toEqual([]);
  });

  it("only names middleware that exists", () => {
    const known = new Set(namedMiddlewareFiles());
    const unknown = pageFiles().flatMap((file) =>
      pageMiddleware(readFileSync(file, "utf8"))
        .filter((name) => !known.has(name))
        .map((name) => `${relative(root, file)} -> ${name}`),
    );

    expect(unknown).toEqual([]);
  });

  it.each(ADMIN_PAGES)("gates %s behind admin", (page) => {
    expect(pageMiddleware(readFileSync(join(root, page), "utf8"))).toContain(
      "admin",
    );
  });

  it("gates tournament creation", () => {
    expect(
      pageMiddleware(
        readFileSync(join(root, "pages/tournaments/create.vue"), "utf8"),
      ),
    ).toContain("tournament-create");
  });

  it("never pairs <script setup> with an Options API setup()", () => {
    expect(
      mixesSetupStyles(
        `<script setup lang="ts">\n</script>\n<script lang="ts">\nexport default {\n  setup() {\n    return {};\n  },\n};\n</script>`,
      ),
    ).toBe(true);

    const mixed = pageFiles()
      .filter((file) => mixesSetupStyles(readFileSync(file, "utf8")))
      .map((file) => relative(root, file));

    expect(mixed).toEqual([]);
  });
});
