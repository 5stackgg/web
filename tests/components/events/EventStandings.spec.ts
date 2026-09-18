import { describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventStandings from "~/components/events/EventStandings.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query } }),
}));

const award = {
  award: {
    id: "award-1",
    name: "Gold",
    tier: "gold",
    silhouette: null,
    image_url: null,
  },
  tournament: { name: "Spring Cup", start: "2026-01-01T00:00:00Z", stages: [] },
  tournament_award: null,
  player: null,
  source: "auto",
};

function standings() {
  return {
    data: {
      events_by_pk: {
        tournaments: [
          {
            tournament: {
              id: "tournament-1",
              name: "Spring Cup",
              awards: [
                {
                  ...award,
                  id: "placement-1",
                  placement: 1,
                  player_steam_id: null,
                  tournament_team_id: "tt-1",
                  tournament_team: {
                    name: "Alpha",
                    team: { id: "team-1", name: "Alpha" },
                  },
                  team: { id: "team-1", name: "Alpha" },
                },
                {
                  ...award,
                  id: "placement-2",
                  placement: 2,
                  player_steam_id: "76561198000000001",
                  tournament_team_id: "tt-2",
                  tournament_team: { name: "Pick-up Five", team: null },
                  team: null,
                  player: { name: "Roster Player", avatar_url: null },
                },
              ],
            },
          },
        ],
      },
    },
  };
}

async function mountStandings() {
  query.mockResolvedValue(standings());
  const wrapper = await mountSuspended(EventStandings, {
    props: { eventId: "event-1" },
  });
  await flushPromises();
  return wrapper;
}

describe("EventStandings team links", () => {
  it("links the placement winner and the medal table row to /teams/<id>", async () => {
    const wrapper = await mountStandings();

    const links = wrapper.findAll('a[href="/teams/team-1"]');
    expect(links.map((link) => link.text())).toEqual(["Alpha", "Alpha"]);
    expect(wrapper.find("nuxtlink").exists()).toBe(false);
  });

  it("does not link an ad-hoc tournament team", async () => {
    const wrapper = await mountStandings();

    const adHoc = wrapper
      .findAll("span")
      .filter((span) => span.text() === "Pick-up Five");
    expect(adHoc.length).toBeGreaterThan(0);
    for (const span of adHoc) {
      expect(span.element.closest("a")).toBeNull();
    }
  });
});
