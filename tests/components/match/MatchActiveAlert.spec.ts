import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchActiveAlert from "~/components/match/MatchActiveAlert.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const steamId = "76561198000000001";
const storageKey = `5stack:match-ready-modal:${steamId}`;

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function setMatch(status = "Live", id = "m-1") {
  useMatchLobbyStore().myMatches = [
    { id, status, lineup_1: { name: "A" }, lineup_2: { name: "B" } },
  ] as any;
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
    const removeRoute = useNuxtApp().$router.addRoute({
      path: "/matches/m-1",
      component: { render: () => null },
    });
    await openTab("/matches/m-1");
    removeRoute();

    expect((await openTab()).shouldShow).toBeFalsy();
  });

  it("closes when another tab dismisses it", async () => {
    const tab = await openTab();
    expect(tab.shouldShow).toBe(true);

    const value = JSON.stringify({ acknowledgedKey: "m-1:Live" });
    localStorage.setItem(storageKey, value);
    window.dispatchEvent(
      new StorageEvent("storage", { key: storageKey, newValue: value }),
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
    expect(() => localStorage.getItem(storageKey)).toThrow("blocked");
    const tab = await openTab();
    expect(tab.shouldShow).toBe(true);

    tab.acknowledge();
    await flushPromises();

    expect(tab.shouldShow).toBeFalsy();
  });
});
