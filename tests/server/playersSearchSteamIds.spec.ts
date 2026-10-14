// @vitest-environment node
import { describe, expect, it } from "vitest";
import { playersSearchSteamIds } from "~/server/utils/playersSearchSteamIds";

const A = "76561198000000001";
const B = "76561198000000002";
const C = "76561198000000003";

describe("playersSearchSteamIds", () => {
  it("leaves the search unscoped when no roster was sent", () => {
    expect(playersSearchSteamIds({})).toBeNull();
  });

  it("scopes to who is online", () => {
    expect(playersSearchSteamIds({ online_steam_ids: [A, B] })).toEqual([
      A,
      B,
    ]);
  });

  it("scopes to who is live on Twitch", () => {
    expect(playersSearchSteamIds({ live_steam_ids: [C, A] })).toEqual([C, A]);
  });

  it("needs a player to be on both rosters when both filters are on", () => {
    expect(
      playersSearchSteamIds({
        online_steam_ids: [A, B],
        live_steam_ids: [B, C],
      }),
    ).toEqual([B]);
  });

  it("matches nobody when nobody is live, rather than everybody", () => {
    expect(
      playersSearchSteamIds({ online_steam_ids: [A], live_steam_ids: [] }),
    ).toEqual([]);
    expect(playersSearchSteamIds({ live_steam_ids: [] })).toEqual([]);
  });

  it("drops anything that is not a steam id, so it can't reach the filter", () => {
    expect(
      playersSearchSteamIds({
        live_steam_ids: [A, "1 || role:=administrator", 76561198000000002n],
      }),
    ).toEqual([A, B]);
  });
});
