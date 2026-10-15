import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import type { RouteLocationNormalized } from "vue-router";
import twitchLinkResult from "~/middleware/twitch-link-result.global";

const { toast, navigate } = vi.hoisted(() => ({
  toast: vi.fn(),
  navigate: vi.fn((to: unknown, options: unknown) => ({ to, options })),
}));

vi.mock("~/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/components/ui/toast")>()),
  toast,
}));

mockNuxtImport("navigateTo", () => navigate);

function arrive(path: string, query: Record<string, string>) {
  return twitchLinkResult(
    { path, query, hash: "" } as unknown as RouteLocationNormalized,
    { path: "/" } as RouteLocationNormalized,
  );
}

beforeEach(() => {
  toast.mockClear();
  navigate.mockClear();
});

describe("coming back from Twitch", () => {
  it("confirms the link and strips the flag in the same navigation", () => {
    const redirect = arrive("/settings/linked-accounts", {
      twitch: "linked",
      tab: "links",
    });

    expect(toast).toHaveBeenCalledWith({ title: "Twitch linked" });
    expect(redirect).toEqual({
      to: {
        path: "/settings/linked-accounts",
        query: { tab: "links" },
        hash: "",
      },
      options: { replace: true },
    });
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
  ])("explains %s once, wherever it lands", (code, message) => {
    const redirect = arrive("/", { twitch_error: code });

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: "Couldn't link Twitch",
      description: message,
      variant: "destructive",
    });
    expect(redirect).toEqual({
      to: { path: "/", query: {}, hash: "" },
      options: { replace: true },
    });
  });

  it("strips a malformed result without a toast", () => {
    const redirect = arrive("/watch", { twitch: "maybe" });

    expect(toast).not.toHaveBeenCalled();
    expect(redirect).toEqual({
      to: { path: "/watch", query: {}, hash: "" },
      options: { replace: true },
    });
  });

  it("leaves every other navigation alone", () => {
    expect(arrive("/watch", { tab: "live" })).toBeUndefined();
    expect(toast).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("coming back from Twitch, through the router", () => {
  beforeEach(async () => {
    await useRouter().replace("/watch");
    await flushPromises();
  });

  afterEach(async () => {
    await useRouter().replace("/watch");
    await flushPromises();
  });

  it("lands on the page it started from without the flag", async () => {
    await useRouter().push("/watch?twitch=linked&tab=links");

    expect(useRoute().fullPath).toBe("/watch?tab=links");
  });

  it("lands home without the error, leaving nothing in flight to undo the home page's own redirect", async () => {
    await useRouter().push("/?twitch_error=invalid_state");
    expect(useRoute().fullPath).toBe("/");

    await useRouter().replace("/watch");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await flushPromises();

    expect(useRoute().fullPath).toBe("/watch");
  });
});
