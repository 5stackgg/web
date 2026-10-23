import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchPauseButton from "~/components/match/MatchPauseButton.vue";
import socket from "~/web-sockets/Socket";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

let mutate: ReturnType<typeof vi.fn>;
let rcon: ReturnType<typeof vi.spyOn>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;
let current: ReturnType<typeof match>;

function match(mapStatus: string, overrides: Record<string, any> = {}) {
  return reactive({
    id: "m-1",
    status: "Live",
    is_organizer: true,
    is_in_lineup: false,
    is_coach: false,
    is_server_online: true,
    can_cancel: true,
    can_start: false,
    server_id: "server-1",
    server_plugin_runtime: null,
    min_players_per_lineup: 0,
    options: { type: "Competitive", map_veto: false, best_of: 1 },
    match_maps: [{ id: "map-1", is_current_map: true, status: mapStatus }],
    streams: [],
    lineup_1: { id: "l-1", name: "Northwind", lineup_players: [] },
    lineup_2: { id: "l-2", name: "Ember Six", lineup_players: [] },
    winning_lineup_id: null,
    ...overrides,
  });
}

async function mountActions(
  role: e_player_roles_enum,
  mapStatus: string,
  { dock = false, ...overrides }: Record<string, any> = {},
) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
  current = match(mapStatus, overrides);
  wrapper = await mountSuspended(MatchActions, {
    props: { match: current, dock },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

const pauseButton = () => wrapper!.findComponent(MatchPauseButton);

const shown = () =>
  pauseButton().exists() && (pauseButton().props("show") as boolean);

const toggle = async () => {
  pauseButton().vm.$emit("toggle");
  await flushPromises();
};

const flip = async (mapStatus: string) => {
  current.match_maps[0].status = mapStatus;
  await flushPromises();
};

const sentPauses = () =>
  mutate.mock.calls.filter(([{ mutation }]) =>
    print(mutation).includes("setMatchPaused"),
  );

// The api's answer, held back until the test lets it through.
const answerLater = () => {
  let answer = () => {};
  mutate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = () => resolve({ data: {} });
      }),
  );
  return async () => {
    answer();
    await flushPromises();
  };
};

const fakeTimers = () =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

const leave = () => {
  wrapper!.unmount();
  wrapper = undefined;
};

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
  rcon = vi.spyOn(socket, "event").mockImplementation(() => {});
  toast.mockClear();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("match actions pause and resume", () => {
  it.each([
    ["Live", true, "Paused", "Match paused"],
    ["Paused", false, "Live", "Match resumed"],
  ])(
    "lets an organizer without RCON toggle a %s map through setMatchPaused",
    async (mapStatus, paused, flipped, done) => {
      await mountActions(e_player_roles_enum.user, mapStatus);

      expect(shown()).toBe(true);

      await toggle();

      expect(sentPauses()).toHaveLength(1);
      expect(print(sentPauses()[0][0].mutation)).toContain(
        "setMatchPaused(match_id: $matchId, paused: $paused)",
      );
      expect(sentPauses()[0][0].variables).toEqual({ matchId: "m-1", paused });
      expect(rcon).not.toHaveBeenCalled();

      await flip(flipped);

      expect(toast).toHaveBeenCalledWith({ title: done });
    },
  );

  it("keeps the button busy until the map's status flips", async () => {
    await mountActions(e_player_roles_enum.user, "Live");

    await toggle();

    expect(pauseButton().props("loading")).toBe(true);
    expect(toast).not.toHaveBeenCalled();

    await flip("Paused");

    expect(pauseButton().props("loading")).toBe(false);
  });

  it("ignores another click while the first is still waiting", async () => {
    await mountActions(e_player_roles_enum.user, "Live");

    await toggle();
    await toggle();

    expect(sentPauses()).toHaveLength(1);
  });

  it.each([
    ["Live", "The server didn't pause the match"],
    ["Paused", "The server didn't resume the match"],
  ])(
    "says so when a %s map hasn't flipped after 8 seconds",
    async (mapStatus, message) => {
      await mountActions(e_player_roles_enum.user, mapStatus);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      await toggle();
      vi.advanceTimersByTime(7_999);
      expect(toast).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await flushPromises();

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: expect.stringContaining(message),
        }),
      );
      expect(pauseButton().props("loading")).toBe(false);
    },
  );

  it("frees the button at once when the api refuses", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mutate.mockRejectedValueOnce(new Error("there is no live map to pause"));

    await toggle();

    expect(pauseButton().props("loading")).toBe(false);
    vi.advanceTimersByTime(10_000);
    await flushPromises();
    expect(toast).not.toHaveBeenCalled();
  });

  it("keeps the button from anyone who doesn't organize the match", async () => {
    await mountActions(e_player_roles_enum.administrator, "Live", {
      is_organizer: false,
    });

    expect(shown()).toBe(false);
  });

  // The api refuses these the same way it refuses their restore or restart.
  it.each([
    ["is in a lineup", { is_in_lineup: true }],
    ["coaches a lineup", { is_coach: true }],
  ])(
    "keeps the button from an organizer below moderator who %s",
    async (_label, overrides) => {
      await mountActions(e_player_roles_enum.user, "Live", overrides);

      expect(shown()).toBe(false);
    },
  );

  it("still gives it to a moderator in a lineup", async () => {
    await mountActions(e_player_roles_enum.moderator, "Live", {
      is_in_lineup: true,
    });

    expect(shown()).toBe(true);
  });

  it.each(["Warmup", "Knife", "Finished"])(
    "has nothing to pause on a %s map",
    async (mapStatus) => {
      await mountActions(e_player_roles_enum.user, mapStatus);

      expect(shown()).toBe(false);
    },
  );

  it("pauses from the admin dock and holds its button until the map flips", async () => {
    await mountActions(e_player_roles_enum.user, "Live", { dock: true });
    const dockButton = () =>
      wrapper!
        .findAll("button")
        .find((button) => button.text().includes("Pause Match"));

    expect(dockButton()?.exists()).toBe(true);

    await dockButton()!.trigger("click");
    await flushPromises();

    expect(sentPauses()).toHaveLength(1);
    expect(dockButton()!.attributes("disabled")).toBeDefined();

    await flip("Paused");

    expect(toast).toHaveBeenCalledWith({ title: "Match paused" });
  });

  it("forgets a pause whose answer comes after the page closed", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    fakeTimers();
    const answer = answerLater();

    await toggle();
    leave();
    await answer();
    vi.advanceTimersByTime(10_000);

    expect(toast).not.toHaveBeenCalled();
  });

  it("stops waiting for the map when the page closes", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    fakeTimers();

    await toggle();
    expect((wrapper!.vm as any).pauseTimer).toBeDefined();

    leave();
    vi.advanceTimersByTime(10_000);

    expect(toast).not.toHaveBeenCalled();
  });

  it("waits no longer once the map flipped before the api answered", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    fakeTimers();
    const answer = answerLater();

    await toggle();
    await flip("Paused");
    await answer();

    expect((wrapper!.vm as any).pauseTimer).toBeUndefined();
    vi.advanceTimersByTime(10_000);
    expect(toast.mock.calls).toEqual([[{ title: "Match paused" }]]);
  });

  // A restart, a surrender or a winner moves the map on, and that is not the
  // server doing what was asked.
  it.each([
    ["Paused", "Warmup"],
    ["Paused", "Finished"],
    ["Live", "Warmup"],
    ["Live", "Finished"],
  ])(
    "stops waiting quietly when a %s map goes to %s instead",
    async (from, to) => {
      await mountActions(e_player_roles_enum.user, from);
      fakeTimers();

      await toggle();
      await flip(to);

      expect((wrapper!.vm as any).pausing).toBe(false);
      vi.advanceTimersByTime(10_000);
      expect(toast).not.toHaveBeenCalled();
    },
  );

  it("keeps waiting while a paused-for map moves between halves", async () => {
    await mountActions(e_player_roles_enum.user, "Live");

    await toggle();
    await flip("Overtime");

    expect(pauseButton().props("loading")).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it("never reports a pause it isn't waiting for", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    const actions = wrapper!.vm as any;

    actions.pauseNotApplied();

    expect(toast).not.toHaveBeenCalled();
  });

  it("replaces an earlier wait instead of keeping both", async () => {
    await mountActions(e_player_roles_enum.user, "Live");
    const actions = wrapper!.vm as any;
    fakeTimers();
    const stale = vi.fn();
    actions.pauseTimer = setTimeout(stale, 1_000);

    await toggle();
    vi.advanceTimersByTime(10_000);

    expect(stale).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
