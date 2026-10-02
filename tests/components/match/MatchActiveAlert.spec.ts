import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchActiveAlert from "~/components/match/MatchActiveAlert.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const steamId = "76561198000000001";
const acknowledgedStorageKey =
  `5stack:match-ready-modal:acknowledged:${steamId}`;

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function setMatch(status = "Live", id = "m-1") {
  useMatchLobbyStore().myMatches = [
    { id, status, lineup_1: { name: "A" }, lineup_2: { name: "B" } },
  ] as any;
}

function stubMatchPage() {
  return useNuxtApp().$router.addRoute({
    path: "/matches/m-1",
    component: { render: () => null },
  });
}

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
}

async function openTab(path = "/") {
  wrapper?.unmount();
  wrapper = await mountSuspended(MatchActiveAlert, { route: path });
  await flushPromises();
  return wrapper.vm as any;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore().me = {
    steam_id: steamId,
    show_match_ready_modal: true,
  } as any;
  setMatch();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useMatchLobbyStore().myMatches = [];
  useAuthStore().me = undefined;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("MatchActiveAlert memory", () => {
  it("stays closed in a new tab once dismissed", async () => {
    const tab = await openTab();
    expect(tab.shouldShow).toBe(true);

    tab.acknowledge();
    await flushPromises();
    expect(tab.shouldShow).toBeFalsy();

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("stays closed in a new tab once the player has been on the match page", async () => {
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    removeRoute();

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("shows again in a new tab once a match visited early moves to check-in", async () => {
    setMatch("Scheduled");
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    removeRoute();

    setMatch("WaitingForCheckIn");

    expect((await openTab()).shouldShow).toBe(true);
  });

  it("shows again when the match moves on after the player left its page", async () => {
    setMatch("Veto");
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    removeRoute();
    const tab = await openTab();
    expect(tab.shouldShow).toBeFalsy();

    setMatch("Live");
    await flushPromises();

    expect(tab.shouldShow).toBe(true);
  });

  it("stays closed after leaving the page when the match moved on while it was open", async () => {
    setMatch("Veto");
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    setMatch("Live");
    await flushPromises();
    removeRoute();

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("is not quieted by a hidden tab sitting on the match page", async () => {
    setVisibility("hidden");
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    removeRoute();

    setVisibility("visible");

    expect((await openTab()).shouldShow).toBe(true);
  });

  it("counts a visit once the hidden tab on the match page is brought forward", async () => {
    setVisibility("hidden");
    const removeRoute = stubMatchPage();
    await openTab("/matches/m-1");
    setVisibility("visible");
    await flushPromises();
    removeRoute();

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("keeps the visible tab's visit when a hidden tab saves after it", async () => {
    setMatch("WaitingForCheckIn");
    const removeRoute = stubMatchPage();
    const visible = await mountSuspended(MatchActiveAlert, {
      route: "/matches/m-1",
    });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const hidden = await mountSuspended(MatchActiveAlert, {
      route: "/matches/m-1",
    });
    await flushPromises();

    const writes: Array<[string, string]> = [];
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      writes.push([key, value]);
      setItem(key, value);
    });

    setMatch("Veto");
    await flushPromises();
    for (const [key, newValue] of writes) {
      window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
    }
    await flushPromises();

    hidden.unmount();
    visible.unmount();
    removeRoute();
    visibility.mockReturnValue("visible");

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("closes when another tab dismisses it", async () => {
    const tab = await openTab();
    expect(tab.shouldShow).toBe(true);

    localStorage.setItem(acknowledgedStorageKey, "m-1:Live");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: acknowledgedStorageKey,
        newValue: "m-1:Live",
      }),
    );
    await flushPromises();

    expect(tab.shouldShow).toBeFalsy();
  });

  it("shows again when the match moves to a new status", async () => {
    setMatch("Veto");
    const tab = await openTab();
    tab.acknowledge();

    setMatch("Live");
    await flushPromises();

    expect(tab.shouldShow).toBe(true);
    expect((await openTab()).shouldShow).toBe(true);
  });

  it("does not carry one player's dismissal to another", async () => {
    (await openTab()).acknowledge();

    useAuthStore().me = {
      steam_id: "76561198000000002",
      show_match_ready_modal: true,
    } as any;

    expect((await openTab()).shouldShow).toBe(true);
  });

  it("still works when storage is blocked", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => localStorage.getItem(acknowledgedStorageKey)).toThrow(
      "blocked",
    );
    const tab = await openTab();
    expect(tab.shouldShow).toBe(true);

    tab.acknowledge();
    await flushPromises();

    expect(tab.shouldShow).toBeFalsy();
  });
});
