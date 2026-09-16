import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import AwardCase from "~/components/award/AwardCase.vue";

const tournament = {
  name: "Spring Cup",
  start: "2026-03-01T12:00:00Z",
  stages: [],
};

const manualTournamentGrant = {
  id: "manual-tournament-1",
  source: "manual",
  placement: null,
  placement_tier: null,
  tournament_id: "tournament-1",
  created_at: "2026-04-05T12:00:00Z",
  award: {
    id: "award-spirit",
    name: "Spirit of the Cup",
    tier: "special",
    silhouette: null,
    image_url: null,
  },
  tournament,
  tournament_award: null,
};

const placementGrant = {
  id: "tournament-gold-1",
  source: "tournament",
  placement: 1,
  placement_tier: null,
  tournament_id: "tournament-1",
  created_at: "2026-03-10T12:00:00Z",
  award: {
    id: "award-gold",
    name: "Tournament Champion",
    tier: "gold",
    silhouette: null,
    image_url: null,
  },
  tournament,
  tournament_award: null,
};

async function nameplate(awardId: string) {
  const wrapper = await mountSuspended(AwardCase, {
    props: { awards: [manualTournamentGrant, placementGrant] },
  });
  const link = wrapper.find(`a[href="/awards/${awardId}"]`);
  expect(link.exists()).toBe(true);
  return link.text();
}

describe("AwardCase grant nameplate", () => {
  it("titles and dates a manual grant made inside a tournament by the award", async () => {
    const text = await nameplate("award-spirit");

    expect(text).toContain("Spirit of the Cup");
    expect(text).not.toContain("Spring Cup");
    expect(text).toContain("APR 5, 2026");
  });

  it("keeps titling and dating a placement by its tournament", async () => {
    const text = await nameplate("award-gold");

    expect(text).toContain("Spring Cup");
    expect(text).toContain("MAR 1, 2026");
  });
});
