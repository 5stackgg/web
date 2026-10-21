import { describe, expect, it, vi } from "vitest";
import { useUtilityMaps } from "~/composables/useUtilityMaps";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async () => ({
      data: {
        maps: [
          { name: "de_ancient", label: "Ancient", active_pool: true },
          { name: "de_mirage", label: "Mirage", active_pool: false },
          { name: "de_mirage", label: "Mirage", active_pool: true },
          { name: "de_train", label: "Train", active_pool: false },
          { name: "de_vertigo", label: "Vertigo", active_pool: null },
        ],
      },
    }),
  }),
}));

vi.mock("~/utilities/mapAssets", async (original) => ({
  ...(await original<typeof import("~/utilities/mapAssets")>()),
  loadRadarMaps: async () =>
    new Set(["de_ancient", "de_mirage", "de_train", "de_vertigo"]),
}));

describe("useUtilityMaps", () => {
  it("marks the Active Duty maps from any of their mode rows and keeps the list alphabetical", async () => {
    const { tiles, loadMaps } = useUtilityMaps();

    await loadMaps();

    expect(
      tiles.value.map((tile) => [tile.name, tile.activeDuty]),
    ).toEqual([
      ["de_ancient", true],
      ["de_mirage", true],
      ["de_train", false],
      ["de_vertigo", false],
    ]);
  });
});
