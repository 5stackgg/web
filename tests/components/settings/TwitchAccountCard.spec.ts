import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import TwitchAccountCard from "~/components/settings/TwitchAccountCard.vue";
import { toast, useToast } from "~/components/ui/toast";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

mockNuxtImport("navigateTo", () => navigate);

const ME = "76561198000000001";

const account = (overrides: Record<string, unknown> = {}) => ({
  twitch_user_id: "4242",
  login: "kappa_cs",
  display_name: "kappa_cs",
  is_live: true,
  title: "FACEIT grind then scrims",
  game_name: "Counter-Strike",
  viewer_count: 1204,
  started_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  thumbnail_url: null,
  checked_at: new Date().toISOString(),
  linked_at: "2026-10-01T12:00:00Z",
  ...overrides,
});

let me: () => Promise<unknown>;
let fetched: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

function mePayload(value: unknown) {
  me = () => Promise.resolve(value);
}

async function mountCard(route = "/") {
  const wrapper = await mountSuspended(TwitchAccountCard, {
    route,
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const latestToast = () => useToast().toasts.value[0];

beforeEach(async () => {
  navigate.mockReset();
  useApplicationSettingsStore().settings = [
    { name: "public.supports_twitch", value: "true" },
  ];
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  mePayload({ enabled: true, account: null });
  fetched = vi.fn((url: string, options: { method?: string } = {}) => {
    if (url.endsWith("/twitch/me") && options.method === "DELETE") {
      mePayload({ enabled: true, account: null });
      return Promise.resolve({ success: true });
    }
    if (url.endsWith("/twitch/me")) {
      return me();
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("$fetch", fetched);
  await flushPromises();
  toast({ title: "earlier" });
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  await useRouter().replace("/");
  await flushPromises();
});

describe("Twitch card, not linked", () => {
  it("offers to link Twitch", async () => {
    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("Twitch");
    expect(wrapper.text()).toContain(
      "Show your stream on the matches you play",
    );
    expect(wrapper.text()).toContain("Link Twitch");
  });

  it("sends the player to Twitch's own sign-in on the web domain, coming back here", async () => {
    const config = useRuntimeConfig().public;
    const webDomain = config.webDomain;
    config.webDomain = "5stack.test";
    onTestFinished(() => {
      config.webDomain = webDomain;
    });
    const wrapper = await mountCard("/?tab=links");
    const button = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Link Twitch"))!;

    await button.trigger("click");

    expect(navigate).toHaveBeenCalledTimes(1);
    const [url, options] = navigate.mock.calls[0];
    const target = new URL(url);
    expect(target.origin).toBe("https://5stack.test");
    expect(target.pathname).toBe("/auth/twitch");
    expect(new URL(target.searchParams.get("redirect")!).search).toBe(
      "?tab=links",
    );
    expect(options).toEqual({ external: true });
  });
});

describe("Twitch card, linked", () => {
  it("shows the channel live, with a way to open it on Twitch", async () => {
    mePayload({ enabled: true, account: account() });
    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("twitch.tv/kappa_cs");
    expect(wrapper.get("[data-test='twitch-status']").text()).toBe(
      "Live · Counter-Strike",
    );
    expect(
      wrapper.get("a[href='https://www.twitch.tv/kappa_cs']").attributes(
        "aria-label",
      ),
    ).toBe("Open on Twitch");
    expect(wrapper.find("[data-test='twitch-stale']").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Link Twitch");
  });

  it("shows the channel offline", async () => {
    mePayload({
      enabled: true,
      account: account({ is_live: false, game_name: null, viewer_count: null }),
    });
    const wrapper = await mountCard();

    expect(wrapper.get("[data-test='twitch-status']").text()).toBe("Offline");
  });

  it("warns behind a triangle when Twitch has not confirmed the status lately", async () => {
    mePayload({
      enabled: true,
      account: account({
        is_live: false,
        checked_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
    });
    const wrapper = await mountCard();

    expect(
      wrapper.get("[data-test='twitch-stale']").attributes("aria-label"),
    ).toBe(
      "Twitch didn't answer the last status check, so this may be out of date.",
    );
  });

  it("unlinks after confirming, and offers to link again", async () => {
    mePayload({ enabled: true, account: account() });
    const wrapper = await mountCard();

    await wrapper.get("button[aria-label='Unlink Twitch']").trigger("click");
    await flushPromises();
    const confirm = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Unlink",
    )!;
    confirm.click();
    await flushPromises();

    expect(fetched).toHaveBeenCalledWith(
      expect.stringMatching(/\/twitch\/me$/),
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(latestToast()?.title).toBe("Twitch unlinked");
    expect(wrapper.text()).toContain("Link Twitch");
  });
});

describe("Twitch card, coming back from Twitch", () => {
  it("confirms the link and takes the flag out of the address", async () => {
    mePayload({ enabled: true, account: account() });
    await mountCard("/?twitch=linked&tab=links");

    expect(latestToast()?.title).toBe("Twitch linked");
    await vi.waitFor(() => expect(useRoute().query).toEqual({ tab: "links" }));
  });

  it.each([
    ["not_configured", "Twitch isn't set up on this site yet."],
    [
      "invalid_state",
      "The Twitch sign-in expired or was already used. Please try again.",
    ],
    ["denied", "The Twitch sign-in was canceled."],
    [
      "already_linked",
      "That Twitch account is already linked to another player.",
    ],
    [
      "twitch_unavailable",
      "Twitch didn't respond. Please try again in a moment.",
    ],
    ["something_new", "Something went wrong. Please try again."],
  ])("explains %s and takes it out of the address", async (code, message) => {
    await mountCard(`/?twitch_error=${code}`);

    expect(latestToast()).toEqual(
      expect.objectContaining({
        title: "Couldn't link Twitch",
        description: message,
        variant: "destructive",
      }),
    );
    await vi.waitFor(() => expect(useRoute().query).toEqual({}));
  });
});

describe("Twitch card, hidden and degraded", () => {
  it("shows nothing when the api says Twitch is not set up", async () => {
    mePayload({ enabled: false, account: null });
    const wrapper = await mountCard();

    expect(wrapper.text()).toBe("");
  });

  it("says behind a triangle that the link can't be checked when the api fails", async () => {
    me = () => Promise.reject(new Error("Bad Gateway"));
    const wrapper = await mountCard();

    expect(
      wrapper.get("[data-test='twitch-unavailable']").attributes("aria-label"),
    ).toBe("Your Twitch link can't be checked right now. Try again later.");
    expect(wrapper.text()).not.toContain("Link Twitch");
  });
});
