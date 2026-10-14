import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useNuxtApp } from "#imports";
import MatchmakingConfirm from "~/components/matchmaking/MatchmakingConfirm.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { fakeServiceWorker } from "../helpers/fakeServiceWorker";

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({
    playCountdownSound: vi.fn(),
    playMatchFoundSound: vi.fn(),
    playTickSound: vi.fn(),
  }),
}));

function confirmation(overrides: Record<string, unknown> = {}) {
  return {
    matchId: undefined,
    isReady: false,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    confirmed: 3,
    confirmationId: "c-1",
    type: "Competitive",
    region: "USE",
    players: 10,
    ...overrides,
  } as any;
}

function setConfirmation(value: ReturnType<typeof confirmation> | undefined) {
  useMatchmakingStore().joinedMatchmakingQueues = {
    details: undefined,
    confirmation: value,
  };
}

let worker: ReturnType<typeof fakeServiceWorker>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

beforeEach(() => {
  worker = fakeServiceWorker({
    tags: ["MatchFound:c-1", "MatchFound:c-2", "chat:lobby:abc"],
  });
  setConfirmation(undefined);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  worker.restore();
});

describe("MatchmakingConfirm countdown", () => {
  afterEach(() => {
    useMatchmakingStore().serverClockOffsetMs = null;
  });

  it("counts down on the api's clock when the device clock runs ahead", async () => {
    useMatchmakingStore().serverClockOffsetMs = -120_000;
    setConfirmation(
      confirmation({
        expiresAt: new Date(Date.now() - 120_000 + 30_000).toISOString(),
      }),
    );
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    expect((wrapper.vm as any).formattedCountdown).toMatch(/^00:(29|30)$/);
  });
});

describe("MatchmakingConfirm for screen readers", () => {
  const dialog = () =>
    document.body.querySelector<HTMLElement>("[role='alertdialog']")!;
  const announcement = () =>
    dialog().querySelector("[aria-live='polite']")?.textContent?.trim();

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the dialog by its heading and describes what to do", async () => {
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    const labelledBy = dialog().getAttribute("aria-labelledby")!;
    const describedBy = dialog().getAttribute("aria-describedby")!;
    expect(document.getElementById(labelledBy)?.textContent?.trim()).toBe(
      "Match Found",
    );
    expect(document.getElementById(describedBy)?.textContent?.trim()).toBe(
      "Press Ready to accept the match before the timer runs out.",
    );
  });

  it("reads the countdown out every ten seconds and at five, not every second", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    const heard = [announcement()];
    for (let second = 0; second < 30; second++) {
      vi.advanceTimersByTime(1000);
      await flushPromises();
      if (announcement() !== heard.at(-1)) {
        heard.push(announcement());
      }
    }

    expect(heard).toEqual([
      "Seconds left: 30",
      "Seconds left: 20",
      "Seconds left: 10",
      "Seconds left: 5",
    ]);
  });
});

describe("MatchmakingConfirm ring", () => {
  it("keeps ringing until the player accepts, then closes only this ready check's ring", async () => {
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    setConfirmation(confirmation({ confirmed: 4 }));
    await flushPromises();

    expect(worker.closed()).toEqual([]);

    setConfirmation(confirmation({ confirmed: 5, isReady: true }));
    await flushPromises();

    expect(worker.closed()).toEqual(["MatchFound:c-1"]);
  });

  it("closes a ring that lands after the player has already accepted", async () => {
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    setConfirmation(confirmation({ confirmed: 4, isReady: true }));
    await flushPromises();

    const late = worker.show("MatchFound:c-1");

    setConfirmation(confirmation({ confirmed: 5, isReady: true }));
    await flushPromises();

    expect(late.close).toHaveBeenCalled();
  });

  it("closes the ring when the ready check ends without the player", async () => {
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    setConfirmation(undefined);
    await flushPromises();

    expect(worker.closed()).toEqual(["MatchFound:c-1"]);
  });

  it("closes the old ring when a new ready check replaces it", async () => {
    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    setConfirmation(confirmation({ confirmationId: "c-2" }));
    await flushPromises();

    expect(worker.closed()).toEqual(["MatchFound:c-1"]);
  });

  it("closes the ring once the match is created", async () => {
    const push = vi
      .spyOn(useNuxtApp().$router, "push")
      .mockResolvedValue(undefined);

    setConfirmation(confirmation());
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    setConfirmation(confirmation({ confirmed: 10, matchId: "m-1" }));
    await flushPromises();

    expect(worker.closed()).toEqual(["MatchFound:c-1"]);
    expect(push).toHaveBeenCalledWith("/matches/m-1");

    push.mockRestore();
  });

  it("closes the ring on mount when the player has already accepted", async () => {
    setConfirmation(confirmation({ confirmationId: "c-2", isReady: true }));
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();

    expect(worker.closed()).toEqual(["MatchFound:c-2"]);
  });
});

describe("MatchmakingConfirm auto-route memory", () => {
  const steamId = "76561198000000001";
  const routedKey = `5stack:matchmaking-routed-match:${steamId}`;
  let push: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    useAuthStore().me = { steam_id: steamId } as any;
    push = vi
      .spyOn(useNuxtApp().$router, "push")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore().me = undefined;
    localStorage.clear();
  });

  async function reload() {
    wrapper?.unmount();
    wrapper = await mountSuspended(MatchmakingConfirm);
    await flushPromises();
  }

  it("does not send the player back to the match after a reload", async () => {
    setConfirmation(confirmation({ confirmed: 10, matchId: "m-1" }));
    await reload();
    expect(push).toHaveBeenCalledTimes(1);

    await reload();

    expect(push).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(routedKey)).toBe("m-1");
  });

  it("still routes an open tab when another tab routed first", async () => {
    setConfirmation(confirmation());
    await reload();

    localStorage.setItem(routedKey, "m-1");
    window.dispatchEvent(
      new StorageEvent("storage", { key: routedKey, newValue: "m-1" }),
    );
    setConfirmation(confirmation({ confirmed: 10, matchId: "m-1" }));
    await flushPromises();

    expect(push).toHaveBeenCalledWith("/matches/m-1");
  });

  it("still routes to a new match", async () => {
    localStorage.setItem(routedKey, "m-1");
    setConfirmation(confirmation({ confirmed: 10, matchId: "m-2" }));
    await reload();

    expect(push).toHaveBeenCalledWith("/matches/m-2");
  });

  it("remembers per player", async () => {
    localStorage.setItem(
      "5stack:matchmaking-routed-match:76561198000000002",
      "m-1",
    );
    setConfirmation(confirmation({ confirmed: 10, matchId: "m-1" }));
    await reload();

    expect(push).toHaveBeenCalledWith("/matches/m-1");
  });

  it("still routes when storage is blocked", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => localStorage.getItem(routedKey)).toThrow("blocked");
    setConfirmation(confirmation({ confirmed: 10, matchId: "m-1" }));
    await reload();

    expect(push).toHaveBeenCalledWith("/matches/m-1");
  });
});
