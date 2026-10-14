import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TwitchSettings from "~/pages/settings/application/twitch.vue";
import { useToast } from "~/components/ui/toast";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { SETTINGS_NAV_GROUPS } from "~/composables/useSettingsNav";

vi.mock("~/graphql/graphqlGen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/graphql/graphqlGen")>()),
  generateMutation: (mutation: unknown) => mutation,
}));

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

const secretInput = (wrapper: any) => wrapper.get("input[type='password']");

describe("Twitch application settings", () => {
  beforeEach(() => {
    useApplicationSettingsStore().settings = [];
  });

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
    useApplicationSettingsStore().settings = [];
  });

  const mountPage = async () => {
    mutate = vi.fn().mockResolvedValue({ data: {} });
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockImplementation(mutate);

    const wrapper = await mountSuspended(TwitchSettings, {
      global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  };

  it("sits next to Discord in the Integrations group", () => {
    const integrations = SETTINGS_NAV_GROUPS.flatMap(
      (group) => group.subgroups,
    ).find(
      (subgroup) =>
        subgroup.labelKey === "layouts.application_settings.groups.integrations",
    )!;
    const ordered = [...integrations.items].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999),
    );

    expect(ordered.slice(0, 2).map((item) => item.path)).toEqual([
      "/settings/application/discord",
      "/settings/application/twitch",
    ]);
  });

  it("loads the client ID and saves it without touching the secret", async () => {
    useApplicationSettingsStore().settings = [
      { name: "twitch_client_id", value: "abc123" },
    ];
    const wrapper = await mountPage();

    expect(
      (wrapper.get("input[name='twitch_client_id']").element as HTMLInputElement)
        .value,
    ).toBe("abc123");

    await (wrapper.vm as any).updateSettings();

    expect(saved()).toEqual([{ name: "twitch_client_id", value: "abc123" }]);
    expect(useToast().toasts.value[0]?.title).toBe("Updated Twitch settings");
  });

  it("never fills the secret in, whatever the settings hold", async () => {
    useApplicationSettingsStore().settings = [
      { name: "twitch_client_id", value: "abc123" },
      { name: "twitch_client_secret", value: "leaked" },
    ];
    const wrapper = await mountPage();

    expect((secretInput(wrapper).element as HTMLInputElement).value).toBe("");
  });

  it("keeps the secret field out of password managers", async () => {
    const wrapper = await mountPage();
    const secret = secretInput(wrapper);

    expect(secret.attributes("autocomplete")).toBe("new-password");
    expect(secret.attributes("data-1p-ignore")).toBeDefined();
    expect(secret.attributes("data-lpignore")).toBeDefined();
    expect(secret.attributes("data-bwignore")).toBeDefined();
  });

  it("writes a typed secret, empties the field and says one is set", async () => {
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain(
      "Twitch stays off until both a client ID and a secret are set.",
    );

    await wrapper.get("input[name='twitch_client_id']").setValue("abc123");
    await secretInput(wrapper).setValue("s3cr3t");
    await (wrapper.vm as any).updateSettings();
    await flushPromises();

    expect(saved()).toEqual([
      { name: "twitch_client_id", value: "abc123" },
      { name: "twitch_client_secret", value: "s3cr3t" },
    ]);
    expect((secretInput(wrapper).element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain(
      "A secret is set. Enter a new one to replace it.",
    );
  });

  it("reads whether a secret is set from public.supports_twitch, and can remove it", async () => {
    useApplicationSettingsStore().settings = [
      { name: "twitch_client_id", value: "abc123" },
      { name: "public.supports_twitch", value: "true" },
    ];
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain(
      "A secret is set. Enter a new one to replace it.",
    );

    await (wrapper.vm as any).removeSecret();
    await flushPromises();

    expect(saved()).toEqual([{ name: "twitch_client_secret", value: "" }]);
    expect(wrapper.text()).toContain(
      "Twitch stays off until both a client ID and a secret are set.",
    );
  });

  it("shows the redirect URL the Twitch application has to allow", async () => {
    const config = useRuntimeConfig().public;
    const webDomain = config.webDomain;
    config.webDomain = "5stack.test";
    try {
      const wrapper = await mountPage();

      expect(
        (wrapper.get("#twitch-redirect-url").element as HTMLInputElement).value,
      ).toBe("https://5stack.test/auth/twitch/callback");
      expect(
        wrapper.get("a[href='https://dev.twitch.tv/console/apps']").attributes(
          "target",
        ),
      ).toBe("_blank");
    } finally {
      config.webDomain = webDomain;
    }
  });
});
