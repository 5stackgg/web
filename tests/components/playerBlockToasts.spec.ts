import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventMembershipPanel from "~/components/events/EventMembershipPanel.vue";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import TournamentInvites from "~/components/tournament/TournamentInvites.vue";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import LeagueSeasonPage from "~/pages/league/seasons/[seasonId]/index.vue";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

const { toastMock, mutate } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      mutate,
      query: vi.fn(() => new Promise(() => {})),
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
      watchQuery: () => ({
        subscribe: () => ({ unsubscribe() {} }),
        refetch: vi.fn(),
      }),
    },
  }),
}));

const NEUTRAL = "You can't do that with this player.";

function blocked() {
  return new Error("player_blocked");
}

function descriptions() {
  return toastMock.mock.calls.map(([options]) => options.description);
}

function optionsContext(extra: Record<string, unknown> = {}) {
  return {
    _: { provides: {} },
    $t: (key: string) => key,
    $route: { params: { tournamentId: "t-1" } },
    $apollo: {
      mutate: vi.fn().mockRejectedValue(blocked()),
      query: vi.fn().mockResolvedValue({
        data: {
          events_by_pk: {
            tournaments: [
              {
                tournament: {
                  teams: [
                    { roster: [{ player_steam_id: "76561198000000002" }] },
                  ],
                },
              },
            ],
          },
        },
      }),
    },
    event: { id: "event-1" },
    team: { id: "team-1" },
    attachedPlayerSteamIds: [],
    importingPlayers: false,
    ...extra,
  };
}

let mounted: { unmount: () => void } | null = null;

beforeEach(() => {
  toastMock.mockClear();
  mutate.mockReset();
  mutate.mockRejectedValue(blocked());
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe("player_blocked refusals in local toasts", () => {
  it("words an event organizer add without the raw code", async () => {
    const { methods } = EventMembershipPanel as any;

    await methods.attachOrganizer.call(optionsContext(), {
      steam_id: "76561198000000002",
    });

    expect(descriptions()).toEqual(["player_blocks.errors.player_blocked"]);
  });

  it("words an event player add without the raw code", async () => {
    const { methods } = EventMembershipPanel as any;

    await methods.attachPlayer.call(optionsContext(), {
      steam_id: "76561198000000002",
    });

    expect(descriptions()).toEqual(["player_blocks.errors.player_blocked"]);
  });

  it("words an event bulk import without the raw code", async () => {
    const { methods } = EventMembershipPanel as any;

    await methods.importPlayersFromTournaments.call(optionsContext());

    expect(descriptions()).toEqual([
      "player_blocks.errors.player_blocked_bulk",
    ]);
  });

  it("words a tournament team add without the raw code", async () => {
    const { methods } = TournamentTeam as any;

    await methods.addMember.call(optionsContext(), {
      steam_id: "76561198000000002",
      name: "Blocked",
    });

    expect(descriptions()).toEqual(["player_blocks.errors.player_blocked"]);
  });

  it("words a tournament invite without the raw code", async () => {
    const wrapper = await mountSuspended(TournamentInvites, {
      props: { tournament: { id: "t-1", teams: [] } },
      shallow: true,
    });
    mounted = wrapper;

    await (wrapper.vm as any).invitePlayer({ steam_id: "76561198000000002" });
    await flushPromises();

    expect(descriptions()).toEqual([NEUTRAL]);
  });

  it("words a draft room add without the raw code", async () => {
    const wrapper = await mountSuspended(DraftRoom, {
      props: { room: { id: "room-1", players: [], match_id: null } },
      shallow: true,
    });
    mounted = wrapper;
    vi.spyOn(useDraftGamesStore(), "add").mockRejectedValue(blocked());

    await (wrapper.vm as any).add("76561198000000002");

    expect(descriptions()).toEqual([NEUTRAL]);
  });

  it("words a league roster refusal without the raw code", async () => {
    const wrapper = await mountSuspended(LeagueSeasonPage, {
      shallow: true,
    });
    mounted = wrapper;

    (wrapper.vm as any).onError(blocked());

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Action unavailable",
        description: NEUTRAL,
      }),
    );
  });
});
