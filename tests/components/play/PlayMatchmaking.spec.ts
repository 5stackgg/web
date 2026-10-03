import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayMatchmaking from "~/components/play/PlayMatchmaking.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

// The hero's subscriptions (tournament cooldown, the found match) stay quiet.
vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useSubscription: () => ({ result: ref(undefined) }),
}));

afterEach(() => {
  useAuthStore().me = undefined as any;
  useApplicationSettingsStore().settings = [];
  useMatchmakingStore().joinedMatchmakingQueues = {} as any;
});

describe("PlayMatchmaking", () => {
  it("shows a guest every mode and a Steam sign-in", async () => {
    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(4);
    expect(wrapper.text()).toContain("Sign in with Steam");
    expect(wrapper.text()).not.toContain("in queue");
  });

  it("drops a mode the admin turned off", async () => {
    useApplicationSettingsStore().settings = [
      { name: "public.matchmaking_rush", value: "false" },
    ] as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(3);
    expect(wrapper.text()).not.toContain("Rush");
  });

  it("offers a signed-in player Find match", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: "user",
    } as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.text()).toContain("Find match");
    expect(wrapper.text()).toContain("Queue solo, teams are balanced for you");
    expect(wrapper.text()).not.toContain("Sign in with Steam");
  });

  it("doesn't pick a mode for a solo player", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: "user",
    } as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.find('[role="radio"][aria-checked="true"]').exists()).toBe(
      false,
    );
    const findMatch = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Find match"));
    expect(findMatch?.attributes("disabled")).toBeDefined();
  });

  it("picks the mode when it's the only one", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: "user",
    } as any;
    useApplicationSettingsStore().settings = [
      { name: "public.matchmaking_duel", value: "false" },
      { name: "public.matchmaking_wingman", value: "false" },
      { name: "public.matchmaking_rush", value: "false" },
    ] as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    const checked = wrapper.findAll('[role="radio"][aria-checked="true"]');
    expect(checked).toHaveLength(1);
    expect(checked[0].text()).toContain("Competitive");
  });

  it("turns into the search clock while queued", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: "user",
    } as any;
    useMatchmakingStore().joinedMatchmakingQueues = {
      details: {
        type: "Competitive",
        regions: [],
        totalInQueue: 0,
        joinedAt: new Date().toISOString(),
      },
    } as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.find('[role="timer"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Searching for a Competitive match");
    expect(wrapper.text()).toContain("Cancel");
  });

  it("says a ready check is waiting when a match is found", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: "user",
    } as any;
    useMatchmakingStore().joinedMatchmakingQueues = {
      details: {
        type: "Competitive",
        regions: [],
        totalInQueue: 10,
        joinedAt: new Date().toISOString(),
      },
      confirmation: {
        confirmationId: "c1",
        type: "Competitive",
        region: "us-east",
        expiresAt: new Date(Date.now() + 30000).toISOString(),
        confirmed: 3,
        players: 10,
        isReady: false,
      },
    } as any;

    const wrapper = await mountSuspended(PlayMatchmaking);

    expect(wrapper.text()).toContain("Match found · accept in the ready check");
    expect(wrapper.text()).not.toContain("Cancel");
  });
});
