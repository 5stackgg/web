import { beforeEach, describe, expect, it, vi } from "vitest";
import { print } from "graphql";
import { loadPlayerElos, withPlayerElo } from "~/composables/usePlayerElos";

const graphql = vi.hoisted(() => ({ query: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query: graphql.query }),
}));

beforeEach(() => {
  graphql.query = vi.fn(async ({ variables }) => ({
    data: {
      players: variables.steamIds.map((steam_id: string) => ({
        steam_id,
        elo: { competitive: Number(steam_id.slice(-4)) },
      })),
    },
  }));
});

describe("loadPlayerElos", () => {
  it("reads each player's elo once, from the network", async () => {
    await loadPlayerElos([
      "76561198000001001",
      "76561198000001002",
      "76561198000001001",
      null,
    ]);

    expect(graphql.query).toHaveBeenCalledTimes(1);
    const [{ query, variables, fetchPolicy }] = graphql.query.mock.calls[0];
    expect(print(query)).toContain("elo");
    expect(variables).toEqual({
      steamIds: ["76561198000001001", "76561198000001002"],
    });
    expect(fetchPolicy).toBe("network-only");
  });

  it("asks for nothing when there are no players", async () => {
    await loadPlayerElos([null, undefined]);

    expect(graphql.query).not.toHaveBeenCalled();
  });

  it("keeps the page up when the read fails", async () => {
    graphql.query = vi.fn().mockRejectedValue(new Error("offline"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      loadPlayerElos(["76561198000001003"]),
    ).resolves.toBeUndefined();
    expect(withPlayerElo({ steam_id: "76561198000001003" })).toEqual({
      steam_id: "76561198000001003",
    });
    error.mockRestore();
  });
});

describe("withPlayerElo", () => {
  it("leaves a player alone until their elo is read, then adds it", async () => {
    const player = { steam_id: "76561198000002001", name: "dusk" };
    expect(withPlayerElo(player)).toBe(player);

    await loadPlayerElos([player.steam_id]);

    expect(withPlayerElo(player)).toEqual({
      steam_id: "76561198000002001",
      name: "dusk",
      elo: { competitive: 2001 },
    });
  });

  it("passes a missing player through", () => {
    expect(withPlayerElo(null)).toBeNull();
    expect(withPlayerElo(undefined)).toBeUndefined();
  });
});
