import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchPauseButton from "~/components/match/MatchPauseButton.vue";
import socket from "~/web-sockets/Socket";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

let mutate: ReturnType<typeof vi.fn>;
let rcon: ReturnType<typeof vi.spyOn>;
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function match(mapStatus: string, overrides: Record<string, any> = {}) {
  return {
    id: "m-1",
    status: "Live",
    is_organizer: true,
    is_in_lineup: false,
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
  };
}

async function mountActions(
  role: e_player_roles_enum,
  mapStatus: string,
  overrides: Record<string, any> = {},
) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
  wrapper = await mountSuspended(MatchActions, {
    props: { match: match(mapStatus, overrides) },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

const pauseButton = () => {
  const button = wrapper!.findComponent(MatchPauseButton);
  return button.exists() && (button.props("show") as boolean);
};

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
  rcon = vi.spyOn(socket, "event").mockImplementation(() => {});
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("match actions pause and resume", () => {
  it.each([
    ["Live", true],
    ["Paused", false],
  ])(
    "lets an organizer without RCON toggle a %s map through setMatchPaused",
    async (mapStatus, paused) => {
      await mountActions(e_player_roles_enum.user, mapStatus);

      expect(pauseButton()).toBe(true);

      wrapper!.findComponent(MatchPauseButton).vm.$emit("toggle");
      await flushPromises();

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(print(mutate.mock.calls[0][0].mutation)).toContain(
        "setMatchPaused(match_id: $matchId, paused: $paused)",
      );
      expect(mutate.mock.calls[0][0].variables).toEqual({
        matchId: "m-1",
        paused,
      });
      expect(rcon).not.toHaveBeenCalled();
    },
  );

  it("keeps the button from anyone who doesn't organize the match", async () => {
    await mountActions(e_player_roles_enum.administrator, "Live", {
      is_organizer: false,
    });

    expect(pauseButton()).toBe(false);
  });

  it.each(["Warmup", "Knife", "Finished"])(
    "has nothing to pause on a %s map",
    async (mapStatus) => {
      await mountActions(e_player_roles_enum.user, mapStatus);

      expect(pauseButton()).toBe(false);
    },
  );
});
