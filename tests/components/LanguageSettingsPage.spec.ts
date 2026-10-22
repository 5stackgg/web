import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import LanguageSettings from "~/pages/settings/application/language.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

const saved = () =>
  mutate.mock.calls.map(
    ([{ mutation }]) => mutation?.insert_settings_one?.[0]?.object,
  );

describe("language settings", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [];
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
  });

  const mountPage = async () => {
    mutate = vi.fn().mockResolvedValue({ data: {} });
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);

    const wrapper = await mountSuspended(LanguageSettings, {
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    unmount = () => wrapper.unmount();
    return wrapper;
  };

  it("starts on English when no default is set", async () => {
    const wrapper = await mountPage();

    expect((wrapper.vm as any).form.values.public.default_language).toBe("en");
  });

  it("shows the saved default", async () => {
    useApplicationSettingsStore().settings = [
      { name: "public.default_language", value: "pt" },
    ];
    const wrapper = await mountPage();

    expect((wrapper.vm as any).form.values.public.default_language).toBe("pt");
  });

  it("saves the chosen default", async () => {
    const wrapper = await mountPage();

    (wrapper.vm as any).form.setFieldValue("public.default_language", "ja");
    await nextTick();
    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual([{ name: "public.default_language", value: "ja" }]);
  });
});
