import { describe, expect, it } from "vitest";
import {
  isOnMatchActionPage,
  matchActions,
} from "~/utilities/matchActionToasts";

const ME = "76561198000000001";
const TEAMMATE = "76561198000000002";
const OPPONENT = "76561198000000003";

function lineup(
  name: string,
  players: Array<{ steamId: string; checkedIn?: boolean }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `${name}-lineup`,
    name,
    is_on_lineup: players.some((player) => player.steamId === ME),
    is_ready: false,
    can_pick_map_veto: false,
    can_pick_region_veto: false,
    lineup_players: players.map((player) => ({
      checked_in: player.checkedIn ?? false,
      player: { steam_id: player.steamId },
    })),
    ...overrides,
  };
}

function match(overrides: Record<string, any> = {}) {
  const { mine = {}, theirs = {}, ...rest } = overrides;
  return {
    id: "match-1",
    status: "WaitingForCheckIn",
    is_in_lineup: true,
    can_check_in: true,
    map_veto_type: null,
    region: null,
    options: { region_veto: false },
    draft_games: [],
    lineup_1: lineup(
      "Iron Wolves",
      [{ steamId: ME }, { steamId: TEAMMATE }],
      mine,
    ),
    lineup_2: lineup("Night Owls", [{ steamId: OPPONENT }], theirs),
    ...rest,
  };
}

function regionVeto(overrides: Record<string, any> = {}) {
  return match({
    status: "Veto",
    options: { region_veto: true },
    ...overrides,
  });
}

const kinds = (matches: any[], steamId: string | null = ME) =>
  matchActions(matches, steamId).map((action) => action.kind);

describe("matchActions check-in", () => {
  it("asks a player who has not checked in to check in", () => {
    const [action] = matchActions([match()], ME);

    expect(action).toMatchObject({
      id: "match-check_in:match-1",
      kind: "check_in",
      path: "/matches/match-1",
    });
    expect(action.match.id).toBe("match-1");
  });

  it("clears once the player has checked in", () => {
    const checkedIn = match({
      lineup_1: lineup("Iron Wolves", [
        { steamId: ME, checkedIn: true },
        { steamId: TEAMMATE },
      ]),
    });

    expect(kinds([checkedIn])).toEqual([]);
  });

  it("clears once their lineup is ready", () => {
    expect(kinds([match({ mine: { is_ready: true } })])).toEqual([]);
  });

  it("follows the server when it says the player cannot check in", () => {
    expect(kinds([match({ can_check_in: false })])).toEqual([]);
  });

  it("only applies while the match is waiting for check-in", () => {
    expect(kinds([match({ status: "Scheduled" })])).toEqual([]);
    expect(kinds([match({ status: "Live" })])).toEqual([]);
  });
});

describe("matchActions veto", () => {
  it("tells the picking captain it is their region ban", () => {
    const [action] = matchActions(
      [regionVeto({ mine: { can_pick_region_veto: true } })],
      ME,
    );

    expect(action).toMatchObject({
      id: "match-region_veto:match-1",
      kind: "region_veto",
    });
  });

  it("tells the picking captain it is their map veto turn, side picks included", () => {
    const ban = match({
      status: "Veto",
      map_veto_type: "Ban",
      mine: { can_pick_map_veto: true },
    });
    const side = match({
      status: "Veto",
      map_veto_type: "Side",
      mine: { can_pick_map_veto: true },
    });

    expect(matchActions([ban], ME)[0]).toMatchObject({
      id: "match-map_veto:match-1:Ban",
      kind: "map_veto",
    });
    expect(matchActions([side], ME)[0]).toMatchObject({
      id: "match-map_veto:match-1:Side",
      kind: "map_veto",
    });
  });

  it("gives a lineup's back-to-back side and pick turns their own ids", () => {
    const side = match({
      status: "Veto",
      map_veto_type: "Side",
      mine: { can_pick_map_veto: true },
    });
    const pick = { ...side, map_veto_type: "Pick" };

    expect(matchActions([side], ME)[0].id).not.toBe(
      matchActions([pick], ME)[0].id,
    );
  });

  it("does not offer a map veto turn while the region veto is running", () => {
    const theirRegionBan = regionVeto({
      map_veto_type: "Ban",
      mine: { can_pick_map_veto: true },
      theirs: { can_pick_region_veto: true },
    });

    expect(kinds([theirRegionBan])).toEqual([]);
  });

  it("only offers a region ban while a region veto is running", () => {
    const mapVetoWithoutRegionVeto = match({
      status: "Veto",
      map_veto_type: "Ban",
      mine: { can_pick_region_veto: true, can_pick_map_veto: true },
    });
    const regionAlreadyPicked = regionVeto({
      region: "USE",
      map_veto_type: "Ban",
      mine: { can_pick_region_veto: true, can_pick_map_veto: true },
    });

    expect(kinds([mapVetoWithoutRegionVeto])).toEqual(["map_veto"]);
    expect(kinds([regionAlreadyPicked])).toEqual(["map_veto"]);
  });

  it("stays quiet while the other lineup is picking", () => {
    const theirTurn = match({
      status: "Veto",
      map_veto_type: "Ban",
      theirs: { can_pick_map_veto: true },
    });

    expect(kinds([theirTurn])).toEqual([]);
  });
});

describe("matchActions audience", () => {
  it("never asks a spectator or an organizer who is not playing", () => {
    const watching = match({
      is_in_lineup: false,
      can_check_in: false,
      lineup_1: lineup("Iron Wolves", [{ steamId: TEAMMATE }], {
        can_pick_map_veto: true,
      }),
    });

    expect(kinds([watching])).toEqual([]);
    expect(
      kinds([{ ...watching, status: "Veto", map_veto_type: "Ban" }]),
    ).toEqual([]);
  });

  it("never asks a guest", () => {
    expect(kinds([match()], null)).toEqual([]);
  });

  it("opens the draft room for a draft-created match", () => {
    const drafted = match({ draft_games: [{ id: "draft-7" }] });

    expect(matchActions([drafted], ME)[0].path).toBe("/draft-room/draft-7");
  });

  it("lists one action per match", () => {
    const veto = regionVeto({
      id: "match-2",
      mine: { can_pick_region_veto: true },
    });

    expect(matchActions([match(), veto], ME).map((a) => a.id)).toEqual([
      "match-check_in:match-1",
      "match-region_veto:match-2",
    ]);
  });
});

describe("isOnMatchActionPage", () => {
  const [action] = matchActions([match()], ME);
  const [drafted] = matchActions(
    [match({ draft_games: [{ id: "draft-7" }] })],
    ME,
  );

  it("is true on that match's page and its sub-pages", () => {
    expect(isOnMatchActionPage(action, "/matches/match-1")).toBe(true);
    expect(isOnMatchActionPage(action, "/matches/match-1/camera")).toBe(true);
  });

  it("is true in the draft room a draft-created match lives in", () => {
    expect(isOnMatchActionPage(drafted, "/draft-room/draft-7")).toBe(true);
    expect(isOnMatchActionPage(drafted, "/matches/match-1")).toBe(true);
  });

  it("is false anywhere else", () => {
    expect(isOnMatchActionPage(action, "/")).toBe(false);
    expect(isOnMatchActionPage(action, "/matches/match-10")).toBe(false);
    expect(isOnMatchActionPage(action, "/matches")).toBe(false);
  });
});
