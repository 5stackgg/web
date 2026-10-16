import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";

const member = (steamId: string, overrides: Record<string, any> = {}) => ({
  steam_id: steamId,
  status: "Accepted",
  lineup: 1,
  pick_order: null,
  is_captain: false,
  elo_snapshot: 1500,
  joined_at: "2026-10-16T18:00:00Z",
  player: { steam_id: steamId, name: steamId },
  ...overrides,
});

let mounted: { unmount: () => void } | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

async function mountRoom(room: Record<string, any>, match?: any) {
  const wrapper = await mountSuspended(DraftRoom, {
    props: {
      room: {
        id: "room-1",
        mode: "Host",
        status: "Open",
        capacity: 10,
        match_id: null,
        host_steam_id: "host",
        is_organizer: true,
        picks: [],
        ...room,
      },
      match,
    },
    shallow: true,
  });
  mounted = wrapper;
  return wrapper.vm as any;
}

describe("host assigns captains", () => {
  it("lists a side in the order players were placed on it", async () => {
    const vm = await mountRoom({
      players: [
        member("joined-first", { pick_order: 3 }),
        member("placed-first", { pick_order: 1 }),
        member("placed-second", { pick_order: 2 }),
      ],
    });

    expect(vm.team1.map((player: any) => player.steam_id)).toEqual([
      "placed-first",
      "placed-second",
      "joined-first",
    ]);
  });

  it("puts the captain the host named at the top of the side", async () => {
    const vm = await mountRoom({
      players: [
        member("placed-first", { pick_order: 1 }),
        member("named", { pick_order: 2, is_captain: true }),
      ],
    });

    expect(vm.team1[0].steam_id).toBe("named");
  });

  it("offers the armband on everyone but the current captain", async () => {
    const wrapper = await mountSuspended(DraftTeamPanel, {
      props: {
        title: "Team 1",
        perTeam: 5,
        accent: "amber",
        captainable: true,
        players: [
          member("placed-first", { pick_order: 1 }),
          member("named", { pick_order: 2, is_captain: true }),
          member("third", { pick_order: 3 }),
        ],
      },
    });
    mounted = wrapper;

    expect((wrapper.vm as any).captainSteamId).toBe("named");
    expect(wrapper.findAll('button[aria-label="Make captain"]').length).toBe(2);
  });
});

describe("draft check-in", () => {
  const checkInMatch = (createdSecondsAgo: number) => ({
    id: "match-1",
    status: "WaitingForCheckIn",
    created_at: new Date(Date.now() - createdSecondsAgo * 1000).toISOString(),
    cancels_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    lineup_1: {
      lineup_players: [
        { steam_id: "here", checked_in: true },
        { steam_id: "no-show", checked_in: false },
      ],
    },
    lineup_2: { lineup_players: [] },
    options: {},
  });

  const room = {
    mode: "Captains",
    status: "Completed",
    match_id: "match-1",
    players: [
      member("here", { pick_order: 0, is_captain: true }),
      member("no-show", { pick_order: 1 }),
      member("second-backup", {
        status: "Waitlist",
        lineup: null,
        joined_at: "2026-10-16T18:05:00Z",
      }),
      member("first-backup", {
        status: "Waitlist",
        lineup: null,
        joined_at: "2026-10-16T18:04:00Z",
      }),
    ],
  };

  it("runs a one-minute clock and holds the swaps until it ends", async () => {
    const vm = await mountRoom(room, checkInMatch(10));

    expect(vm.checkInWindowOver).toBe(false);
    expect(vm.canReplaceNoShows).toBe(false);
    expect(vm.checkInDeadline).toBe(vm.checkInEndsAt);
  });

  it("lets the host swap in the next backup once the minute is up", async () => {
    const match = checkInMatch(90);
    const vm = await mountRoom(room, match);

    expect(vm.checkInWindowOver).toBe(true);
    expect(vm.canReplaceNoShows).toBe(true);
    expect(vm.swapLabel).toBe("Swap in first-backup");
    // Past the minute the readout falls back to the match's own auto-cancel.
    expect(vm.checkInDeadline).toBe(match.cancels_at);
  });

  it("never offers the swaps to anyone but the host", async () => {
    const vm = await mountRoom(
      { ...room, is_organizer: false },
      checkInMatch(90),
    );

    expect(vm.canReplaceNoShows).toBe(false);
  });
});
