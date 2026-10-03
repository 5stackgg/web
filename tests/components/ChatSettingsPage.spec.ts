import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatSettings from "~/pages/settings/application/chat.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import type { ChatAttachmentConfig } from "~/utilities/chatAttachments";
// @ts-expect-error only the mock below exports it
import { testConfig as config } from "~/composables/useChatAttachmentConfig";

vi.mock("~/composables/useChatAttachmentConfig", async () => {
  const { computed, shallowRef } = await import("vue");
  const config = shallowRef<ChatAttachmentConfig | null>(null);

  return {
    testConfig: config,
    useChatAttachmentConfig: () => ({
      config: computed(() => config.value),
      load: vi.fn(async () => {}),
    }),
  };
});

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

const LIMITS: ChatAttachmentConfig = {
  max_files: 4,
  max_file_bytes: 100 * 1024 * 1024,
  part_size: 8 * 1024 * 1024,
  mime_types: ["image/png"],
  gifs: false,
};

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

const saved = () =>
  mutate.mock.calls.flatMap(
    ([{ mutation }]) =>
      (mutation?.insert_settings?.[0]?.objects ?? []) as Array<{
        name: string;
        value: string;
      }>,
  );

describe("chat settings", () => {
  beforeEach(() => {
    config.value = { ...LIMITS };
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

    const wrapper = await mountSuspended(ChatSettings, {
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    unmount = () => wrapper.unmount();
    return wrapper;
  };

  it("saves the daily upload allowance and the GIPHY hourly limit with their defaults", async () => {
    const wrapper = await mountPage();

    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual(
      expect.arrayContaining([
        { name: "chat_attachment_max_mb", value: "100" },
        { name: "chat_attachment_daily_mb", value: "1024" },
        { name: "giphy_hourly_limit", value: "90" },
      ]),
    );
  });

  it("loads what the operator set", async () => {
    useApplicationSettingsStore().settings = [
      { name: "chat_attachment_daily_mb", value: "250" },
      { name: "giphy_hourly_limit", value: "40" },
    ];
    const wrapper = await mountPage();

    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual(
      expect.arrayContaining([
        { name: "chat_attachment_daily_mb", value: "250" },
        { name: "giphy_hourly_limit", value: "40" },
      ]),
    );
  });

  it("keeps the GIPHY key field out of password managers", async () => {
    const wrapper = await mountPage();
    const key = wrapper.get("input[type='password']");

    expect(key.attributes("autocomplete")).toBe("new-password");
    expect(key.attributes("data-1p-ignore")).toBeDefined();
    expect(key.attributes("data-lpignore")).toBeDefined();
    expect(key.attributes("data-bwignore")).toBeDefined();
  });

  it("links to where a GIPHY key is created", async () => {
    const wrapper = await mountPage();
    const link = wrapper.get(
      "a[href='https://developers.giphy.com/dashboard/']",
    );

    expect(link.text()).toContain("Get a key from GIPHY");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toContain("noopener");
  });

  it("shows the key as set the moment it is saved", async () => {
    const wrapper = await mountPage();

    await wrapper.get("input[type='password']").setValue("a-new-key");
    await (wrapper.vm as any).updateSettings();
    await flushPromises();

    expect(saved()).toEqual(
      expect.arrayContaining([{ name: "giphy_api_key", value: "a-new-key" }]),
    );
    expect(wrapper.text()).toContain("A key is set");
  });

  it("shows the key as gone the moment it is removed", async () => {
    config.value = { ...LIMITS, gifs: true };
    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("A key is set");

    await (wrapper.vm as any).removeGiphyKey();
    await flushPromises();

    expect(saved()).toEqual([{ name: "giphy_api_key", value: "" }]);
    expect(wrapper.text()).toContain("No key is set.");
  });
});
