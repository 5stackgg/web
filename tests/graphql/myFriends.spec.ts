import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { MY_FRIENDS_SUBSCRIPTION } from "~/graphql/myFriends";

describe("MY_FRIENDS_SUBSCRIPTION", () => {
  const document = print(MY_FRIENDS_SUBSCRIPTION).replace(/\s+/g, " ");

  // Filtering player_lineup to Live walked every lineup a friend had ever been
  // in; live_lineup only holds Live ones.
  it("asks each friend for their live lineup", () => {
    expect(document).not.toContain("player_lineup");
    expect(document).toContain("live_lineup(limit: 1, where:");
  });

  // Zeus only emits an enum bare for a field generated/zeus knows about; a
  // quoted "Live" or "asc" fails Hasura's validation and the whole friends
  // list with it.
  it("sends the live lineup's enums bare", () => {
    expect(document).toContain(
      "live_lineup(limit: 1, where: {lineup: {match: {status: {_eq: Live}}}})",
    );
    expect(document).toContain("match_maps(order_by: [{order: asc}])");
  });

  it("asks each friend for one Ready practice server friends may join", () => {
    expect(document).toContain(
      "hosted_practice_sessions( where: {status: {_eq: Ready}, access: {_in: [Open, Friends]}} limit: 1 ) { id map_name access status invite_code seated_players max_players is_full }",
    );
  });
});
