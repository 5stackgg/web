import { resolve } from "node:path";
import { addTemplate, defineNuxtModule, updateTemplates } from "@nuxt/kit";
import { buildSettingsSearchIndex, SETTINGS_PAGES_DIR } from "./extract";

const FILENAME = "settings-search-index.ts";

// Builds the application settings search index from the settings pages
// themselves, so a new setting is searchable without anyone registering it.
// Imported as `#build/settings-search-index`.
export default defineNuxtModule({
  meta: { name: "settings-search" },

  setup(_options, nuxt) {
    const rootDir = nuxt.options.srcDir;
    let files = new Set<string>();

    addTemplate({
      filename: FILENAME,
      write: true,
      getContents() {
        const index = buildSettingsSearchIndex(rootDir);
        files = index.files;
        return [
          "export type SettingsSearchEntry = {",
          "  path: string;",
          "  section?: string;",
          "  label: string;",
          "  description?: string;",
          "};",
          "",
          `const entries: SettingsSearchEntry[] = ${JSON.stringify(index.entries)};`,
          "",
          "export default entries;",
          "",
        ].join("\n");
      },
    });

    nuxt.hook("builder:watch", async (_event, path) => {
      const file = resolve(rootDir, path);
      if (
        files.has(file) ||
        file.startsWith(resolve(rootDir, SETTINGS_PAGES_DIR))
      ) {
        await updateTemplates({
          filter: (template) => template.filename === FILENAME,
        });
      }
    });
  },
});
