import type { Plugin } from "vite";
import { defineVitestConfig } from "@nuxt/test-utils/config";

// generated/zeus is ~20MB of codegen, and its inline sourcemap comes to ~29MB
// more. Every test file that boots Nuxt loads it, so the map is shipped to and
// parsed by every one of them, for stack frames nobody reads.
const dropZeusSourcemaps: Plugin = {
  name: "test:drop-zeus-sourcemaps",
  enforce: "post",
  transform(code, id) {
    if (id.includes("/generated/zeus/")) {
      return { code, map: { mappings: "" } };
    }
  },
};

// Outside a production build, locale files compile to message ASTs carrying
// every token's source location, and a test run is never a production build.
// en.json then comes to ~5MB, which every test file copies into vue-i18n's
// reactive store as Nuxt boots -- and again for each locale a test switches
// to. Compiled the way a production build compiles them, they are a fifth of
// that. The flag only decides how messages are compiled.
const compileLocalesForProduction: Plugin = {
  name: "test:compile-locales-for-production",
  enforce: "pre",
  config(config) {
    const i18n = (config.plugins ?? [])
      .flat(Infinity as 1)
      .find(
        (plugin): plugin is Plugin =>
          !!plugin &&
          typeof plugin === "object" &&
          "name" in plugin &&
          plugin.name === "unplugin-vue-i18n:resource",
      );
    const hook = i18n?.configResolved;
    const configResolved = typeof hook === "object" ? hook.handler : hook;
    if (!i18n || !configResolved) {
      throw new Error(
        "unplugin-vue-i18n:resource not found -- update vitest.config.ts",
      );
    }
    i18n.configResolved = function (resolved) {
      return configResolved.call(this, { ...resolved, isProduction: true });
    };
  },
};

// The routes module imports every page as `?macro=true` to read its
// definePageMeta, inlines what it could read without running it, and leaves
// most of those imports unread. A production build tree-shakes them; a test run
// compiles each of those pages to evaluate them, then loads them in every test
// file that boots Nuxt.
const PAGE_META_IMPORT = /^import \{ default as (\w+) \} from "[^"]+\?macro=true";?\n/gm;
const dropUnreadPageMeta: Plugin = {
  name: "test:drop-unread-page-meta",
  enforce: "post",
  transform(code, id) {
    if (!decodeURIComponent(id).endsWith("/.nuxt/vitest/routes.mjs")) {
      return;
    }
    const body = code.replace(PAGE_META_IMPORT, "");
    return {
      code: code.replace(PAGE_META_IMPORT, (line, name: string) =>
        new RegExp(`\\b${name}\\b`).test(body) ? line : "",
      ),
      map: { mappings: "" },
    };
  },
};

export default defineVitestConfig({
  plugins: [dropZeusSourcemaps, compileLocalesForProduction, dropUnreadPageMeta],
  test: {
    include: ["tests/**/*.spec.ts"],
    setupFiles: ["tests/setup.ts"],
    // The first test in a file pays for the Nuxt boot.
    testTimeout: 30000,
    // Any other default splits into two projects that boot Nuxt in one process
    // and randomly lose auto-imports; opt out per file with @vitest-environment.
    // A file that needs neither Nuxt nor the DOM should: the boot is most of
    // what a test file costs.
    environment: "nuxt",
    environmentOptions: {
      nuxt: {
        overrides: {
          // Keeps the test boot from regenerating the dev server's .nuxt.
          buildDir: ".nuxt/vitest",
        },
      },
    },
  },
});
