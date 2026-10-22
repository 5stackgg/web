import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const member = (steamId: string, overrides: Record<string, any> = {}) => ({
  steam_id: steamId,
  status: "Accepted",
  lineup: null,
  pick_order: null,
  is_captain: false,
  elo_snapshot: 1500,
  joined_at: "2026-10-21T18:00:00Z",
  player: { steam_id: steamId, name: steamId },
  ...overrides,
});

const lobby = (count: number, extra: any[] = []) => ({
  id: "room-1",
  mode: "Captains",
  status: "Open",
  capacity: 10,
  match_id: null,
  host_steam_id: "p0",
  is_organizer: false,
  picks: [],
  players: [
    ...Array.from({ length: count }, (_, i) =>
      member(`p${i}`, { joined_at: `2026-10-21T18:0${i}:00Z` }),
    ),
    ...extra,
  ],
});

let mounted: { unmount: () => void } | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
});

async function mountRoom(room: Record<string, any>, me?: string, match?: any) {
  if (me) {
    useAuthStore().me = { steam_id: me } as any;
  }
  useApplicationSettingsStore().availableRegions = [{ value: "us" }] as any;
  const wrapper = await mountSuspended(DraftRoom, {
    props: { room, match },
    shallow: true,
  });
  mounted = wrapper;
  return wrapper.vm as any;
}

describe("draft room header in the lobby", () => {
  it("keeps Start Draft in place, locked, until every seat is filled", async () => {
    const vm = await mountRoom({ ...lobby(9), is_organizer: true }, "p0");

    expect(vm.header.phase).toBe("lobby");
    expect(vm.header.title).toBe("Waiting for 1 more player");
    expect(vm.header.detail).toBe(
      "Start Draft unlocks when all 10 seats are filled.",
    );
    expect(vm.showStart).toBe(true);
    expect(vm.startReady).toBe(false);
  });

  it("lights Start Draft up once the lobby is full", async () => {
    const vm = await mountRoom({ ...lobby(10), is_organizer: true }, "p0");

    expect(vm.header.title).toBe("All 10 seats filled");
    expect(vm.header.hot).toBe(true);
    expect(vm.startReady).toBe(true);
  });

  it("tells a backup where they stand in line", async () => {
    const vm = await mountRoom(
      lobby(10, [
        member("first", {
          status: "Waitlist",
          joined_at: "2026-10-21T18:20:00Z",
        }),
        member("second", {
          status: "Waitlist",
          joined_at: "2026-10-21T18:21:00Z",
        }),
      ]),
      "second",
    );

    expect(vm.header.title).toBe("You're backup #2");
    expect(vm.header.detail).toBe(
      "You get a seat if a player leaves or misses check-in.",
    );
  });

  it("names the short side while a Teams lobby fills its rosters", async () => {
    const vm = await mountRoom(
      {
        ...lobby(0, [
          ...["a1", "a2", "a3", "a4", "a5"].map((id) =>
            member(id, { lineup: 1 }),
          ),
          ...["b1", "b2", "b3"].map((id) => member(id, { lineup: 2 })),
        ]),
        mode: "Teams",
        is_organizer: true,
        team_1_id: "team-a",
        team_2_id: "team-b",
        team_1: { name: "Alpha Wolves" },
        team_2: { name: "Night Owls" },
      },
      "a1",
    );

    expect(vm.header.title).toBe("Fill both rosters");
    expect(vm.header.detail).toBe("Night Owls needs 2 more players.");
    expect(vm.startReady).toBe(false);
  });

  it("counts the open seats for someone who can join", async () => {
    const vm = await mountRoom(lobby(7), "visitor");

    expect(vm.header.title).toBe("3 seats open");
    expect(vm.joinLabel).toBe("Join Lobby");
  });
});

describe("draft room header during the draft", () => {
  const drafting = () => ({
    id: "room-1",
    mode: "Captains",
    status: "Drafting",
    capacity: 10,
    match_id: null,
    host_steam_id: "cap1",
    current_pick_lineup: 1,
    pattern: [1, 2, 2, 1, 1, 2, 2, 1],
    picks: [{ id: "k1" }, { id: "k2" }, { id: "k3" }, { id: "k4" }],
    players: [
      member("cap1", { lineup: 1, pick_order: 0, is_captain: true }),
      member("cap2", { lineup: 2, pick_order: 0, is_captain: true }),
      member("first", { lineup: 1, pick_order: 1 }),
      member("second", { lineup: 2, pick_order: 1 }),
      member("third", { lineup: 2, pick_order: 2 }),
      member("fourth", { lineup: 1, pick_order: 2 }),
      member("low", { elo_snapshot: 1400 }),
      member("high", { elo_snapshot: 1900 }),
    ],
  });

  it("names the captain on the clock and tells the other captain they're next", async () => {
    const vm = await mountRoom(drafting(), "cap2");

    expect(vm.header.phase).toBe("draft");
    expect(vm.header.title).toBe("cap1 is picking for Team 1");
    expect(vm.header.detail).toBe("Pick 5 of 8. You pick next.");
    expect(vm.header.onClock).toBe(1);
  });

  it("puts your own pick and its fallback in the header", async () => {
    const vm = await mountRoom(drafting(), "cap1");

    expect(vm.header.title).toBe("Your pick");
    expect(vm.header.detail).toBe(
      "Pick 5 of 8. If time runs out, high is picked for you.",
    );
    expect(
      vm.headerSides[0].seats.map((seat: any) => [
        seat.player?.steamId ?? null,
        seat.no,
        seat.current,
      ]),
    ).toEqual([
      ["cap1", null, false],
      ["first", 1, false],
      ["fourth", 4, false],
      [null, 5, true],
      [null, 8, false],
    ]);
  });
});

describe("draft room header at check-in", () => {
  const room = {
    id: "room-1",
    mode: "Captains",
    status: "Completed",
    capacity: 4,
    match_id: "match-1",
    host_steam_id: "here",
    is_organizer: true,
    picks: [],
    players: [
      member("here", { lineup: 1, pick_order: 0, is_captain: true }),
      member("no-show", { lineup: 1, pick_order: 1 }),
      member("backup", {
        status: "Waitlist",
        joined_at: "2026-10-21T18:30:00Z",
      }),
    ],
  };
  const match = (createdSecondsAgo: number, extra: any = {}) => ({
    id: "match-1",
    status: "WaitingForCheckIn",
    can_check_in: true,
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
    ...extra,
  });

  it("asks a player who hasn't checked in to do it", async () => {
    const vm = await mountRoom(room, "no-show", match(10));

    expect(vm.header.phase).toBe("checkin");
    expect(vm.header.title).toBe("Check in to play");
    expect(vm.header.detail).toBe("1 of 2 checked in. Everyone has a minute.");
    expect(vm.header.box.kind).toBe("checkin");
    expect(vm.canCheckIn).toBe(true);
  });

  it("leaves out the prompt when only captains check in", async () => {
    const vm = await mountRoom(
      room,
      "no-show",
      match(10, { can_check_in: false }),
    );

    expect(vm.header.title).toBe("Checking in");
    expect(vm.canCheckIn).toBe(false);
  });

  it("tells the host who missed it once the minute is up", async () => {
    const vm = await mountRoom(room, "here", match(90));

    expect(vm.header.title).toBe("1 player missed check-in");
  });

  it("gives a side's backup in the match its own check-in", async () => {
    const vm = await mountRoom(
      {
        ...room,
        mode: "Teams",
        players: [
          ...room.players,
          member("sub", { status: "Waitlist", lineup: 1 }),
        ],
      },
      "sub",
      match(10, {
        lineup_1: {
          lineup_players: [
            { steam_id: "here", checked_in: true },
            { steam_id: "no-show", checked_in: false },
            { steam_id: "sub", checked_in: false },
          ],
        },
      }),
    );

    expect(vm.canCheckIn).toBe(true);
    expect(vm.header.detail).toBe("1 of 2 checked in. Everyone has a minute.");
  });

  it("doesn't send a Teams host looking for swap controls", async () => {
    const vm = await mountRoom({ ...room, mode: "Teams" }, "here", match(90));

    expect(vm.header.title).toBe("You're checked in");
  });
});

describe("draft room header actions", () => {
  it("lets a site organizer join a lobby they could also start", async () => {
    const vm = await mountRoom({ ...lobby(7), is_organizer: true }, "visitor");

    expect(vm.headerActions).toEqual(["join", "start"]);
  });

  it("gives a player who isn't the host Leave in the lobby", async () => {
    const vm = await mountRoom(lobby(6), "p3");

    expect(vm.headerActions).toEqual(["leave"]);
  });

  it("keeps an invite answerable while the draft runs", async () => {
    const vm = await mountRoom(
      {
        ...lobby(10, [member("guest", { status: "Invited" })]),
        status: "Drafting",
      },
      "guest",
    );

    expect(vm.headerActions).toEqual(["decline", "accept"]);
  });

  it("only lets an invite be declined once the match is made", async () => {
    const vm = await mountRoom(
      {
        ...lobby(10, [member("guest", { status: "Invited" })]),
        status: "Completed",
        match_id: "match-1",
      },
      "guest",
    );

    expect(vm.headerActions).toEqual(["decline"]);
  });

  it("counts a backup's place on their own side", async () => {
    const vm = await mountRoom(
      {
        ...lobby(10, [
          member("one-a", {
            status: "Waitlist",
            lineup: 1,
            joined_at: "2026-10-21T18:20:00Z",
          }),
          member("one-b", {
            status: "Waitlist",
            lineup: 1,
            joined_at: "2026-10-21T18:21:00Z",
          }),
          member("two-a", {
            status: "Waitlist",
            lineup: 2,
            joined_at: "2026-10-21T18:22:00Z",
          }),
        ]),
        mode: "Teams",
      },
      "two-a",
    );

    expect(vm.header.title).toBe("You're backup #1");
  });

  it("doesn't claim a Host lobby is choosing captains", async () => {
    const vm = await mountRoom(
      { ...lobby(10), mode: "Host", status: "Filled" },
      "p1",
    );

    expect(vm.header.title).toBe("Setting up the match");
  });
});
