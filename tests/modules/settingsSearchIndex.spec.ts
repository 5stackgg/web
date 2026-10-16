// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildSettingsSearchIndex,
  extractSettingsEntries,
} from "~/modules/settings-search/extract";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

// Dotless, so scripts/check-translations.js does not read them as app keys.
const messages = {
  section: "Section",
  section_description: "What the section is for",
  field: "Field",
  field_description: "What the field does",
  toggle: "Toggle",
  toggle_description: "What the toggle does",
  bare: "Bare",
  beside_switch: "Beside a switch",
  stat: "Stat",
  badge: "Badge",
  importing: "Importing",
  drop: "Drop",
  empty: "Nothing yet",
  empty_description: "Add one",
  row: "Row",
  child: "Child field",
  child_description: "From a child component",
  action: "Action",
  counted: "{count} things",
};

const fixtures = mkdtempSync(join(tmpdir(), "settings-search-"));
afterAll(() => rmSync(fixtures, { recursive: true, force: true }));

function extract(template: string, components: Record<string, string> = {}) {
  const page = join(fixtures, `page-${Math.random().toString(36).slice(2)}.vue`);
  const imports = Object.keys(components)
    .map((name) => `import ${name} from "./parts/${name}.vue";`)
    .join("\n");
  mkdirSync(join(fixtures, "parts"), { recursive: true });
  for (const [name, body] of Object.entries(components)) {
    writeFileSync(join(fixtures, "parts", `${name}.vue`), `<template>${body}</template>`);
  }
  writeFileSync(
    page,
    `<script setup lang="ts">\n${imports}\n</script>\n<template>${template}</template>`,
  );
  return extractSettingsEntries(fixtures, "/settings/x", page, messages).entries;
}

describe("extractSettingsEntries", () => {
  it("reads a section's title and description, and the fields inside it", () => {
    expect(
      extract(`
        <SettingsSection id="general" :title="$t('section')" :description="$t('section_description')">
          <FormField name="a">
            <FormItem>
              <FormLabel>{{ $t("field") }}</FormLabel>
              <FormDescription>{{ $t("field_description") }}</FormDescription>
            </FormItem>
          </FormField>
        </SettingsSection>
      `),
    ).toEqual([
      {
        path: "/settings/x",
        section: "general",
        label: "section",
        description: "section_description",
      },
      {
        path: "/settings/x",
        section: "general",
        label: "field",
        description: "field_description",
      },
    ]);
  });

  it("pairs a hand-rolled bold label with the muted line beside it", () => {
    expect(
      extract(`
        <div class="flex">
          <div class="space-y-0.5">
            <p class="text-sm font-medium">{{ $t("toggle") }}</p>
            <p class="text-xs text-muted-foreground">{{ $t("toggle_description") }}</p>
          </div>
          <Switch />
        </div>
      `),
    ).toEqual([
      { path: "/settings/x", label: "toggle", description: "toggle_description" },
    ]);
  });

  it("keeps bold text beside a control, and drops bold text on its own", () => {
    const labels = extract(`
      <div><p class="font-medium">{{ $t("beside_switch") }}</p><Switch /></div>
      <div><p class="font-medium">{{ $t("stat") }}</p><span>42</span></div>
      <FormItem><Label>{{ $t("bare") }}</Label></FormItem>
    `).map((entry) => entry.label);
    expect(labels).toEqual(["beside_switch", "bare"]);
  });

  it("skips status text: self-toggling badges, ternaries and empty states", () => {
    expect(
      extract(`
        <div>
          <span v-if="online" class="font-semibold">{{ $t("badge") }}</span>
          <Switch />
        </div>
        <div>
          <p class="font-medium">{{ busy ? $t("importing") : $t("drop") }}</p>
          <p class="text-muted-foreground">{{ $t("field_description") }}</p>
        </div>
        <div v-if="rows.length"><p class="font-medium" v-for="row in rows">{{ $t("row") }}</p></div>
        <div v-else>
          <p class="font-medium">{{ $t("empty") }}</p>
          <p class="text-muted-foreground">{{ $t("empty_description") }}</p>
        </div>
      `),
    ).toEqual([]);
  });

  it("skips buttons and anything with a {placeholder}", () => {
    expect(
      extract(`
        <Button><span class="font-medium">{{ $t("action") }}</span></Button>
        <FormItem><FormLabel>{{ $t("counted", { count }) }}</FormLabel></FormItem>
      `),
    ).toEqual([]);
  });

  it("reads local components into the section they render in", () => {
    expect(
      extract(
        `<SettingsSection id="general" :title="$t('section')"><ChildFields /></SettingsSection>`,
        {
          ChildFields: `
            <FormItem>
              <FormLabel>{{ $t("child") }}</FormLabel>
              <FormDescription>{{ $t("child_description") }}</FormDescription>
            </FormItem>
          `,
        },
      ),
    ).toContainEqual({
      path: "/settings/x",
      section: "general",
      label: "child",
      description: "child_description",
    });
  });
});

describe("buildSettingsSearchIndex", () => {
  const { entries } = buildSettingsSearchIndex(root);
  const en = JSON.parse(readFileSync(join(root, "i18n/locales/en.json"), "utf8"));
  const message = (key: string) =>
    key.split(".").reduce((value, part) => value?.[part], en);

  it("finds settings that live deep in a page", () => {
    expect(entries).toContainEqual({
      path: "/settings/application/matchmaking",
      section: "matchmaking",
      label: "pages.settings.application.veto_pick_timeout",
      description: "pages.settings.application.veto_pick_timeout_description",
    });
    expect(entries).toContainEqual({
      path: "/settings/application/cameras",
      section: "voice-chat",
      label: "pages.settings.application.cameras.voice_lobbies",
      description: "pages.settings.application.cameras.voice_lobbies_description",
    });
  });

  it("only holds keys that read as finished text", () => {
    for (const entry of entries) {
      for (const key of [entry.label, entry.description].filter(Boolean)) {
        expect(message(key!), key).toEqual(expect.any(String));
        expect(message(key!), key).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
