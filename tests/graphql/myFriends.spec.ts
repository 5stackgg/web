import { describe, expect, it } from "vitest";
import { print } from "graphql";
import {
  MY_FRIENDS_ROW_STATE_SUBSCRIPTION,
  MY_FRIENDS_SUBSCRIPTION,
} from "~/graphql/myFriends";

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

describe("MY_FRIENDS_ROW_STATE_SUBSCRIPTION", () => {
  // Every selection set in a fixed order, so field order is not compared.
  const sorted = (node: any): any =>
    node.selectionSet
      ? {
          ...node,
          selectionSet: {
            ...node.selectionSet,
            selections: node.selectionSet.selections
              .map(sorted)
              .sort((a: any, b: any) => (print(a) < print(b) ? -1 : 1)),
          },
        }
      : node;
  const friendsField = (document: any) =>
    document.definitions[0].selectionSet.selections[0];
  const moved = (field: any) => ({
    ...field,
    selectionSet: {
      ...field.selectionSet,
      selections: field.selectionSet.selections
        .filter((s: any) => s.name.value !== "is_in_another_match")
        .map((s: any) =>
          s.name.value === "player"
            ? {
                ...s,
                selectionSet: {
                  ...s.selectionSet,
                  selections: [
                    ...s.selectionSet.selections,
                    {
                      kind: "Field",
                      name: { kind: "Name", value: "is_in_another_match" },
                    },
                  ],
                },
              }
            : s,
        ),
    },
  });

  it("asks each friends row whether they are in another match, and nothing else differently", () => {
    const row = friendsField(MY_FRIENDS_ROW_STATE_SUBSCRIPTION);
    const names = (field: any) =>
      field.selectionSet.selections.map((s: any) => s.name.value);
    const player = row.selectionSet.selections.find(
      (s: any) => s.name.value === "player",
    );

    expect(names(row)).toContain("is_in_another_match");
    expect(names(player)).not.toContain("is_in_another_match");
    expect(print(sorted(moved(row)))).toEqual(
      print(sorted(friendsField(MY_FRIENDS_SUBSCRIPTION))),
    );
  });
});
