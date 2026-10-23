import { describe, expect, it } from "vitest";
import { parse, print } from "graphql";
import RecentGamesPanel from "~/components/hub/RecentGamesPanel.vue";

const options = (RecentGamesPanel as any).apollo.$subscribe.matches;
const field = (parse(print(options.query)).definitions[0] as any).selectionSet
  .selections[0];

const panel = () => ({ loadMatchStats: () => {} }) as Record<string, any>;

describe("recent games", () => {
  it("reads the latest ten of the player's own matches", () => {
    expect(field.name.value).toBe("players_by_pk");
    const matches = field.selectionSet.selections.find(
      (s: any) => s.name.value === "matches",
    );
    expect(
      matches.arguments.map((a: any) => [a.name.value, print(a.value)]),
    ).toEqual([
      ["limit", "10"],
      ["where", expect.stringContaining("status")],
      ["order_by", "[{created_at: desc}]"],
    ]);
  });

  it("lists the player's matches, and none for an unknown player", () => {
    const known = panel();
    options.result.call(known, {
      data: { players_by_pk: { matches: [{ id: "m1" }, { id: "m2" }] } },
    });
    expect(known.matches).toEqual([{ id: "m1" }, { id: "m2" }]);
    expect(known.loading).toBe(false);

    const unknown = panel();
    options.result.call(unknown, { data: { players_by_pk: null } });
    expect(unknown.matches).toEqual([]);
  });
});
