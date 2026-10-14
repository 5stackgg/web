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

  it("ignores a roster that is not a list", () => {
    expect(playersSearchSteamIds({ live_steam_ids: "1,2,3" })).toBeNull();
    expect(
      playersSearchSteamIds({ online_steam_ids: { 0: A }, live_steam_ids: [A] }),
    ).toEqual([A]);
  });

  it("reads at most 5000 ids from a roster, however many are sent", () => {
    const sent = Array.from({ length: 20_000 }, (_, index) =>
      String(76561198000000000n + BigInt(index)),
    );

    const ids = playersSearchSteamIds({
      online_steam_ids: sent,
      live_steam_ids: sent,
    })!;

    expect(ids).toHaveLength(5000);
    expect(ids.at(-1)).toBe(sent[4999]);
  });

  it("drops ids too long to be a steam id", () => {
    expect(
      playersSearchSteamIds({ live_steam_ids: [A, "1".repeat(21)] }),
    ).toEqual([A]);
  });

  it("drops anything that is not a steam id, so it can't reach the filter", () => {
    expect(
      playersSearchSteamIds({
        live_steam_ids: [A, "1 || role:=administrator", 76561198000000002n],
      }),
    ).toEqual([A, B]);
  });
});
