import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentFeatureCard from "~/components/tournament/TournamentFeatureCard.vue";
import TournamentStatRibbon from "~/components/tournament/TournamentStatRibbon.vue";
import TournamentAgendaRow from "~/components/tournament/TournamentAgendaRow.vue";
import WatchTournamentCard from "~/components/watch/WatchTournamentCard.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

function fridayMix(
  registration_type: string,
  teams: number,
  agents: number,
  rostered = 0,
) {
  return {
    id: `friday-mix-${registration_type}`,
    name: "Friday Mix",
    status: "RegistrationOpen",
    start: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    registration_type,
    min_players_per_lineup: 5,
    options: { type: "Competitive", best_of: 1 },
    teams_aggregate: { aggregate: { count: teams } },
    rosters_aggregate: { aggregate: { count: rostered } },
    free_agents_aggregate: { aggregate: { count: agents } },
    stages: [{ order: 1, max_teams: 16, type: "SingleElimination" }],
    categories: [],
    prizes: [],
    organizer_teams: [],
    free_agents: [],
  };
}

async function mount(component: any, props: Record<string, unknown>) {
  const wrapper = await mountSuspended(component, { props });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("registration counts", () => {
  it("shows a free agent tournament's players on its card", async () => {
    const wrapper = await mount(TournamentFeatureCard, {
      tournament: fridayMix("free_agents", 0, 34),
    });

    expect(wrapper.text()).toMatch(/34\s*\/\s*80\s*Players/);
    expect(wrapper.text()).not.toMatch(/0\s*Teams/);
  });

  it("keeps counting teams on a teams-only card", async () => {
    const wrapper = await mount(TournamentFeatureCard, {
      tournament: fridayMix("teams", 6, 0),
    });

    expect(wrapper.text()).toMatch(/6\s*Teams/);
  });

  it("puts players against the cap in the overview ribbon", async () => {
    const wrapper = await mount(TournamentStatRibbon, {
      registration: { unit: "players", count: 46, max: 80 },
    });

    expect(wrapper.text()).toContain("Players");
    expect(wrapper.text()).toMatch(/46\s*\/\s*80/);
  });

  it("keeps the ribbon's team count for a teams-only tournament", async () => {
    const wrapper = await mount(TournamentStatRibbon, {
      registration: { unit: "teams", count: 6, max: 16 },
    });

    expect(wrapper.text()).toContain("Teams");
    expect(wrapper.text()).toMatch(/(^|\D)6(\D|$)/);
    expect(wrapper.text()).not.toContain("/");
  });

  it("counts the players on the agenda row, not a full lineup per team", async () => {
    const wrapper = await mount(TournamentAgendaRow, {
      tournament: fridayMix("both", 6, 16, 22),
    });

    expect(wrapper.text()).toContain("38 of 80 players");
  });

  it("counts players on the watch card", async () => {
    const wrapper = await mount(WatchTournamentCard, {
      tournament: fridayMix("free_agents", 0, 34),
    });

    expect(wrapper.text()).toContain("34 of 80 players");
  });
});
