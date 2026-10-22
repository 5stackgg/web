import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import CreateDraftGame from "~/components/draft-games/CreateDraftGame.vue";

const member = (
  steamId: string,
  lineup: number | null,
  pickOrder: number | null,
  eloSnapshot = 1500,
) => ({
  steam_id: steamId,
  status: "Accepted",
  lineup,
  pick_order: pickOrder,
  is_captain: pickOrder === 0,
  elo_snapshot: eloSnapshot,
  joined_at: "2026-10-11T18:00:00Z",
  player: { steam_id: steamId, name: steamId },
});

const pick = (id: string, lineup: number, picked: string, auto = false) => ({
  id,
  lineup,
  auto_picked: auto,
  created_at: "2026-10-11T18:00:00Z",
  captain: { steam_id: `cap${lineup}`, name: `cap${lineup}` },
  picked: { steam_id: picked, name: picked },
});

const draftingRoom = () => ({
  id: "room-1",
  mode: "Captains",
  status: "Drafting",
  capacity: 10,
  match_id: null,
  host_steam_id: "cap1",
  current_pick_lineup: 1,
  pattern: [1, 2, 2, 1, 1, 2, 2, 1],
  players: [
    member("cap1", 1, 0),
    member("cap2", 2, 0),
    member("first", 1, 1),
    member("second", 2, 1),
    member("third", 2, 2),
    member("fourth", 1, 2),
    member("low", null, null, 1400),
    member("high", null, null, 1900),
    member("mid", null, null, 1600),
    member("last", null, null, 1450),
  ],
  picks: [
    pick("k1", 1, "first"),
    pick("k2", 2, "second", true),
    pick("k3", 2, "third"),
    pick("k4", 1, "fourth"),
  ],
});

let mounted: { unmount: () => void } | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

async function mountRoom(overrides: Record<string, any> = {}) {
  const wrapper = await mountSuspended(DraftRoom, {
    props: { room: { ...draftingRoom(), ...overrides } },
    shallow: true,
  });
  mounted = wrapper;
  return wrapper.vm as any;
}

describe("draft room pick order", () => {
  it("numbers each side's players by their place in the whole draft", async () => {
    const vm = await mountRoom();

    expect(vm.pickLabelsFor(vm.team1)).toEqual({
      cap1: "C",
      first: "1",
      fourth: "4",
    });
    expect(vm.pickLabelsFor(vm.team2)).toEqual({
      cap2: "C",
      second: "2",
      third: "3",
    });
  });

  it("lays out the track as done, on the clock, then still to come", async () => {
    const vm = await mountRoom();

    expect(vm.pickTrack.map((cell: any) => cell.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(vm.pickTrack.map((cell: any) => cell.name)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
      "cap1 is picking",
      "Pick 6",
      "Pick 7",
      "Pick 8",
    ]);
    expect(vm.pickTrack.map((cell: any) => !!cell.auto)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("carries the pick order in each side's stack, no row of its own", async () => {
    const vm = await mountRoom();
    const stack = (side: number) =>
      vm.headerSides[side].seats.map((seat: any) => ({
        player: seat.player?.steamId ?? null,
        captain: seat.captain,
        no: seat.no,
        current: seat.current,
        auto: seat.auto,
      }));

    expect(vm.headerSides[1].ordered).toBe(true);
    expect(stack(1)).toEqual([
      { player: "cap2", captain: true, no: null, current: false, auto: false },
      { player: "second", captain: false, no: 2, current: false, auto: true },
      { player: "third", captain: false, no: 3, current: false, auto: false },
      { player: null, captain: false, no: 6, current: false, auto: false },
      { player: null, captain: false, no: 7, current: false, auto: false },
    ]);
    expect(stack(0)[3]).toEqual({
      player: null,
      captain: false,
      no: 5,
      current: true,
      auto: false,
    });
  });

  it("numbers no seats outside a captains draft", async () => {
    const vm = await mountRoom({
      mode: "Pug",
      status: "Filled",
      pattern: [],
      players: [1, 2, 3].map((order) => member(`p${order}`, 1, order)),
      picks: [],
    });

    expect(vm.headerSides[0].ordered).toBe(false);
    expect(
      vm.headerSides[0].seats.map((seat: any) => [
        seat.player?.steamId ?? null,
        seat.no,
      ]),
    ).toEqual([
      ["p1", null],
      ["p2", null],
      ["p3", null],
      [null, null],
      [null, null],
    ]);
  });

  it("leaves each side's open slots for the picks it still makes", async () => {
    const vm = await mountRoom();

    expect(vm.upcomingPicksFor(1)).toEqual([5, 8]);
    expect(vm.upcomingPicksFor(2)).toEqual([6, 7]);
    expect(vm.clockPick).toBe(5);
  });

  it("names the player the clock would pick, the highest rated one left", async () => {
    const vm = await mountRoom();

    expect(vm.autoPickName).toBe("high");
  });

  it("gives a tie at the top of the pool to whoever joined first", async () => {
    const room = draftingRoom();
    const vm = await mountRoom({
      players: [
        ...room.players,
        {
          ...member("also-high", null, null, 1900),
          joined_at: "2026-10-11T17:00:00Z",
        },
      ],
    });

    expect(vm.autoPickName).toBe("also-high");
  });

  it("keeps a pug lobby's own 1..n numbering after the auto split", async () => {
    const vm = await mountRoom({
      mode: "Pug",
      status: "Filled",
      players: [1, 2, 3, 4, 5].map((order) => member(`p${order}`, 1, order)),
      picks: [],
    });

    expect(vm.pickLabelsFor(vm.team1)).toEqual({});
  });
});

describe("draft order preview", () => {
  async function mountForm() {
    const wrapper = await mountSuspended(CreateDraftGame, { shallow: true });
    mounted = wrapper;
    return wrapper.vm as any;
  }

  it("matches the sequence the server builds for a 5v5 lobby", async () => {
    const vm = await mountForm();

    vm.draftOrder = "Snake";
    expect(vm.draftPattern).toEqual([1, 2, 2, 1, 1, 2, 2, 1]);

    vm.draftOrder = "FrontLoaded";
    expect(vm.draftPattern).toEqual([1, 2, 2, 1, 2, 1, 2, 1]);

    vm.draftOrder = "Alternating";
    expect(vm.draftPattern).toEqual([1, 2, 1, 2, 1, 2, 1, 2]);
  });

  it("follows the lobby size", async () => {
    const vm = await mountForm();

    vm.draftOrder = "Snake";
    vm.form.setFieldValue("type", "Wingman");

    expect(vm.draftPattern).toEqual([1, 2]);
  });
});
