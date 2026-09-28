import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useNuxtApp } from "#imports";
import MatchmakingConfirm from "~/components/matchmaking/MatchmakingConfirm.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
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
