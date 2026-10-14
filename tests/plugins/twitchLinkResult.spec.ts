import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import twitchLinkResultPlugin from "~/plugins/twitch-link-result.client";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("~/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/components/ui/toast")>()),
  toast,
}));

function runPlugin() {
  let mounted: (() => void) | undefined;
  const nuxtApp = {
    hook: (name: string, callback: () => void) => {
      if (name === "app:mounted") {
        mounted = callback;
      }
    },
    runWithContext: (fn: () => unknown) => useNuxtApp().runWithContext(fn),
  };
  (twitchLinkResultPlugin as unknown as (app: typeof nuxtApp) => void)(
    nuxtApp,
  );
  mounted!();
}

const twitchToasts = () =>
  toast.mock.calls
    .map(([entry]) => entry)
    .filter((entry) => String(entry.title).includes("Twitch"));

beforeEach(async () => {
  await useRouter().replace("/");
  await flushPromises();
  toast.mockClear();
  runPlugin();
});

afterEach(async () => {
  await useRouter().replace("/");
  await flushPromises();
});

describe("coming back from Twitch, on any page", () => {
  it("confirms the link and takes the flag out of the address", async () => {
    await useRouter().push("/?twitch=linked&tab=links");

    await vi.waitFor(() => expect(useRoute().query).toEqual({ tab: "links" }));
    expect(twitchToasts().map((entry) => entry.title)).toEqual([
      "Twitch linked",
    ]);
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
  ])("explains %s once and takes it out of the address", async (code, message) => {
    await useRouter().push(`/?twitch_error=${code}`);

    await vi.waitFor(() => expect(useRoute().query).toEqual({}));
    expect(twitchToasts()).toEqual([
      expect.objectContaining({
        title: "Couldn't link Twitch",
        description: message,
        variant: "destructive",
      }),
    ]);
  });

  it("installs once however many times it is asked to", async () => {
    runPlugin();
    runPlugin();
    await useRouter().push("/?twitch_error=denied");

    await vi.waitFor(() => expect(useRoute().query).toEqual({}));
    expect(twitchToasts()).toHaveLength(1);
  });
});
