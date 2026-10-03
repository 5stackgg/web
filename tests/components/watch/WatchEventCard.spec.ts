import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WatchEventCard from "~/components/watch/WatchEventCard.vue";
import { tournamentProgressSteps } from "~/utilities/tournamentProgressSteps";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const WIN = { status: "Finished", winning_lineup_id: "lineup" };
const LIVE = { status: "Live", winning_lineup_id: null };
const bracket = (round: number, match: any) => ({
  round,
  group: 1,
  path: "WB",
  match,
});

const fallCupSteps = tournamentProgressSteps([
  {
    type: "SingleElimination",
    order: 1,
    groups: 1,
    brackets: [
      bracket(1, WIN),
      bracket(1, WIN),
      bracket(1, WIN),
      bracket(1, WIN),
      bracket(2, LIVE),
      bracket(2, LIVE),
      bracket(3, null),
    ],
  },
]);

function tournament(overrides: Record<string, unknown>) {
  return {
    options: { type: "Competitive" },
    prizes: [],
    teams_aggregate: { aggregate: { count: 8 } },
    stages: [{ type: "SingleElimination", order: 1, results: [] }],
    awards: [],
    ...overrides,
  };
}

function event() {
  const midnight = new Date();
  midnight.setHours(12, 0, 0, 0);
  const starts = midnight.toISOString();
  const ends = new Date(midnight.getTime() + 2 * 86_400_000).toISOString();
  return {
    id: "event-1",
    name: "Northside LAN 2026",
    starts_at: starts,
    ends_at: ends,
    banner: null,
    hide_creator_organizer: false,
    organizer_steam_id: "1",
    organizer: { name: "Northside LAN Club" },
    organizers: [],
    tournaments_aggregate: { aggregate: { count: 3 } },
    teams_aggregate: { aggregate: { count: 22 } },
    players_aggregate: { aggregate: { count: 104 } },
    tournaments: [
      {
        tournament: tournament({
          id: "fall-cup",
          name: "Fall Cup 2026",
          status: "Live",
          prizes: [{ prize: "$500" }, { prize: "$250" }, { prize: "$100" }],
          teams_aggregate: { aggregate: { count: 16 } },
          stages: [{ type: "DoubleElimination", order: 1, results: [] }],
        }),
      },
      {
        tournament: tournament({
          id: "aim-duels",
          name: "Aim Duels",
          status: "Finished",
          options: { type: "Duel" },
          teams_aggregate: { aggregate: { count: 32 } },
          stages: [
            {
              type: "SingleElimination",
              order: 1,
              results: [{ rank: 1, team: { name: "flickr" } }],
            },
          ],
        }),
      },
      {
        tournament: tournament({
          id: "wingman",
          name: "Saturday Wingman",
          status: "RegistrationClosed",
          start: hours(30),
          options: { type: "Wingman" },
        }),
      },
      { tournament: null },
    ],
  };
}

function play(id: string, kills: number) {
  return {
    id,
    user_steam_id: "1",
    target_steam_id: "1",
    title: null,
    duration_ms: 6000,
    download_url: null,
    thumbnail_url: null,
    thumbnail_download_url: null,
    kills_count: kills,
    round: 3,
    views_count: 0,
    visibility: "public",
    created_at: hours(-2),
    user: null,
    target: { steam_id: "1", name: "flickr", avatar_url: null },
    match_map: null,
  };
}

async function mountCard(props: Record<string, unknown> = {}) {
  return mountSuspended(WatchEventCard, {
    props: {
      event: event(),
      steps: { "fall-cup": fallCupSteps },
      leaderboard: [],
      media: [],
      mediaCount: 0,
      plays: [play("ace", 5), play("quad", 4), play("triple", 3)],
      playsCount: 218,
      ...props,
    },
  });
}

describe("WatchEventCard", () => {
  it("says which day of the event it is", async () => {
    const wrapper = await mountCard();
    expect(wrapper.text()).toContain("Day 1 of 3");
    expect(wrapper.text()).toContain("Organized by Northside LAN Club");
  });

  it("gives the live tournament a stepper on its current round", async () => {
    const wrapper = await mountCard();

    const current = wrapper.find('[aria-current="step"]');
    expect(current.text()).toContain("Semifinals");
    expect(current.text()).toContain("2 live");
    expect(wrapper.text()).toContain(
      "Double elimination · 16 teams · $850 in prizes",
    );
  });

  it("shows the event's top plays, linking to its highlights tab", async () => {
    const wrapper = await mountCard();

    expect(wrapper.text()).toContain("Top plays");
    expect(
      wrapper.findAll('a[href^="/clips/"]').map((a) => a.attributes("href")),
    ).toEqual(["/clips/ace", "/clips/quad", "/clips/triple"]);
    expect(wrapper.text()).toContain("Top play");
    const all = wrapper.find('a[href="/events/event-1?tab=highlights"]');
    expect(all.text()).toContain("All 218 plays");
  });

  it("shows the champion of a finished tournament and when the next one starts", async () => {
    const wrapper = await mountCard();

    const rows = wrapper.findAll('a[href^="/tournaments/"]');
    const duels = rows.find((row) => row.text().includes("Aim Duels"))!;
    expect(duels.text()).toContain("flickr");
    expect(duels.text()).toContain("Single elimination · 32 players");

    const wingman = rows.find((row) =>
      row.text().includes("Saturday Wingman"),
    )!;
    expect(wingman.text()).toContain("Starts");
    expect(wingman.text()).toContain("2v2");
  });

  it("hides the plays when the event has no public clips", async () => {
    const wrapper = await mountCard({ plays: [], playsCount: 0 });
    expect(wrapper.text()).not.toContain("Top plays");
    expect(wrapper.find('a[href$="?tab=highlights"]').exists()).toBe(false);
  });

  it("falls back to a plain row while the bracket hasn't loaded", async () => {
    const wrapper = await mountCard({ steps: {} });

    expect(wrapper.find('[aria-current="step"]').exists()).toBe(false);
    const fallCup = wrapper
      .findAll('a[href^="/tournaments/"]')
      .find((row) => row.text().includes("Fall Cup 2026"))!;
    expect(fallCup.text()).toContain("Live");
  });
});
