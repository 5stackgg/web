import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamsTable from "~/components/TeamsTable.vue";
import AwardBadge from "~/components/award/AwardBadge.vue";

const teams = [
  {
    id: "team-1",
    name: "Alpha",
    short_name: "ALP",
    avatar_url: null,
    roster: [
      {
        roster_image_url: null,
        player: {
          steam_id: "76561198000000001",
          name: "Roster Player",
          avatar_url: "https://avatars.example/roster-player.jpg",
          country: null,
          elo: { competitive: 1500 },
        },
      },
    ],
  },
];

const manualGrant = {
  id: "manual-team-1",
  source: "manual",
  team_id: "team-1",
  placement: null,
  placement_tier: null,
  tournament_id: null,
  created_at: "2026-09-01T12:00:00Z",
  award: {
    id: "award-heroes",
    name: "Community Heroes",
    tier: "special",
    silhouette: null,
    image_url: null,
  },
  tournament: null,
  tournament_award: null,
};

const tournamentGrant = {
  id: "tournament-team-1",
  source: "tournament",
  team_id: "team-1",
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
  tournament: {
    id: "tournament-1",
    name: "Spring Cup",
    start: "2026-03-01T12:00:00Z",
    stages: [],
  },
  tournament_award: null,
};

const manualTournamentGrant = {
  id: "manual-tournament-team-1",
  source: "manual",
  team_id: "team-1",
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
  tournament: {
    id: "tournament-1",
    name: "Spring Cup",
    start: "2026-03-01T12:00:00Z",
    stages: [],
  },
  tournament_award: null,
};

async function mountTable() {
  return await mountSuspended(TeamsTable, {
    props: {
      teams,
      awardsByTeamId: {
        "team-1": [manualGrant, tournamentGrant, manualTournamentGrant],
      },
    },
    attachTo: document.body,
  });
}

function awardButton(wrapper: any, awardId: string) {
  const badge = wrapper
    .findAllComponents(AwardBadge)
    .find((candidate: any) => candidate.props("award")?.id === awardId);
  expect(badge, `award badge for ${awardId}`).toBeDefined();
  return badge.find("*").element.closest("button") as HTMLButtonElement;
}

describe("TeamsTable awards", () => {
  let unmount: (() => void) | null = null;

  afterEach(() => {
    unmount?.();
    unmount = null;
    vi.restoreAllMocks();
  });

  it("labels a manually granted award by its own name, never #null", async () => {
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    const labels = wrapper
      .findAll("button[aria-label]")
      .map((button) => button.attributes("aria-label"));

    expect(labels.join(" | ")).not.toContain("#null");
    expect(labels).toContain("Granted — Community Heroes");
    expect(labels).toContain("1st Place — Spring Cup");
  });

  it("opens the award for a manual grant and the tournament for a placement", async () => {
    const push = vi.spyOn(useRouter(), "push").mockResolvedValue(undefined);
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    awardButton(wrapper, "award-heroes").click();
    expect(push).toHaveBeenLastCalledWith("/awards/award-heroes");

    awardButton(wrapper, "award-gold").click();
    expect(push).toHaveBeenLastCalledWith("/tournaments/tournament-1");
  });

  it("describes a manual grant with its name, grant date and award link in the tooltip", async () => {
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    awardButton(wrapper, "award-heroes").focus();
    await flushPromises();

    const tooltip = document.body.querySelector(
      "[data-reka-popper-content-wrapper]",
    );
    expect(tooltip).not.toBeNull();
    const text = tooltip!.textContent ?? "";
    expect(text).toContain("Community Heroes");
    expect(text).not.toContain("Tournament");
    expect(text).toContain("Granted");
    expect(text).toContain("2026");
    expect(text).toContain("Click to view award");
  });

  it("names a manual grant made inside a tournament after the award", async () => {
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    const labels = wrapper
      .findAll("button[aria-label]")
      .map((button) => button.attributes("aria-label"));

    expect(labels).toContain("Granted — Spirit of the Cup");
    expect(labels).not.toContain("Granted — Spring Cup");
  });

  it("opens the award, not the tournament, for a manual grant made inside a tournament", async () => {
    const push = vi.spyOn(useRouter(), "push").mockResolvedValue(undefined);
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    awardButton(wrapper, "award-spirit").click();
    expect(push).toHaveBeenLastCalledWith("/awards/award-spirit");
  });

  it("dates a manual grant made inside a tournament by when it was granted", async () => {
    const wrapper = await mountTable();
    unmount = () => wrapper.unmount();

    awardButton(wrapper, "award-spirit").focus();
    await flushPromises();

    const tooltip = document.body.querySelector(
      "[data-reka-popper-content-wrapper]",
    );
    expect(tooltip).not.toBeNull();
    const text = tooltip!.textContent ?? "";
    expect(text).toContain("Spirit of the Cup");
    expect(text).toContain("APR 5, 2026");
    expect(text).not.toContain("MAR 1, 2026");
    expect(text).toContain("Click to view award");
  });
});
