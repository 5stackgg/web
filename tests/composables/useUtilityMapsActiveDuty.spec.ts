import { describe, expect, it, vi } from "vitest";
import { useUtilityMaps } from "~/composables/useUtilityMaps";

// One row per map and mode, flagged the way the api's maps seed flags them.
vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async () => ({
      data: {
        maps: [
          { name: "de_ancient", type: "Competitive", active_pool: true },
          { name: "de_mirage", type: "Competitive", active_pool: true },
          { name: "de_mirage_night", type: "Competitive", active_pool: false },
          { name: "de_nuke", type: "Competitive", active_pool: true },
          { name: "de_nuke", type: "Wingman", active_pool: true },
          { name: "de_overpass", type: "Competitive", active_pool: false },
          { name: "de_overpass", type: "Duel", active_pool: true },
          { name: "de_overpass", type: "Wingman", active_pool: true },
          { name: "de_train", type: "Competitive", active_pool: false },
          { name: "de_vertigo", type: "Competitive", active_pool: false },
          { name: "de_vertigo", type: "Wingman", active_pool: true },
        ],
      },
    }),
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<typeof import("~/utilities/mapAssets")>()),
  loadRadarMaps: async () =>
    new Set([
      "de_ancient",
      "de_mirage",
      "de_nuke",
      "de_overpass",
      "de_train",
      "de_vertigo",
    ]),
}));

describe("useUtilityMaps", () => {
  it("takes Active Duty from the Competitive pool and keeps the list alphabetical", async () => {
    const { tiles, loadMaps } = useUtilityMaps();

    await loadMaps();

    expect(
      tiles.value.map((tile) => [tile.name, tile.activeDuty]),
    ).toEqual([
      ["de_ancient", true],
      ["de_mirage", true],
      ["de_nuke", true],
      ["de_overpass", false],
      ["de_train", false],
      ["de_vertigo", false],
    ]);
  });
});
