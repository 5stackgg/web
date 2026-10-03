import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayMoreWaysView from "~/components/play/PlayMoreWaysView.vue";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: { maps: [] } }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const tournament = {
  id: "t1",
  name: "2v2 Wingman Tournament",
  status: "RegistrationOpen",
  start: "2026-10-31T19:00:00Z",
  location: "Buttah Boyz HQ",
  e_tournament_status: { description: "Registration Open" },
  options: { type: "Wingman", best_of: 1 },
  teams_aggregate: { aggregate: { count: 6 } },
  stages: [{ order: 1, max_teams: 16 }],
};
const league = {
  id: "l1",
  name: "Fall League",
  signupClosesAt: "2026-10-09T00:00:00Z",
  teams: 14,
};
const scrims = { teamsToday: 4, managesTeam: true };

function servers(players: number[]) {
  return players.map((count, index) => ({
    id: `s${index}`,
    label: `Server ${index}`,
    map: "Mirage",
    region: "US East",
    ping: 18,
    players: count,
    maxPlayers: 20,
    connectionLink: "steam://connect/1.2.3.4",
    connectionString: "connect 1.2.3.4",
  }));
}

async function mount(props: Record<string, unknown> = {}) {
  return mountSuspended(PlayMoreWaysView, {
    props: {
      guest: false,
      tournament,
      league,
      scrims,
      servers: servers([8, 14, 6]),
      practiceEnabled: true,
      ...props,
    },
  });
}

const grid = (wrapper: any) => wrapper.find("section > div.grid");
const rail = (wrapper: any) => grid(wrapper).find(":scope > div.grid");

describe("PlayMoreWaysView", () => {
  it("leads with the tournament and rails every other way beside it", async () => {
    const wrapper = await mount();

    expect(wrapper.text()).toContain("2v2 Wingman Tournament");
    expect(wrapper.text()).toContain("6 of 16 teams");
    expect(wrapper.find('a[href="/tournaments"]').text()).toContain(
      "All tournaments",
    );
    expect(grid(wrapper).classes()).toContain("lg:grid-cols-2");
    const tiles = rail(wrapper);
    expect(tiles.text()).toContain("League");
    expect(tiles.text()).toContain("Scrims");
    expect(tiles.text()).toContain("Server 1");
    expect(tiles.text()).toContain("Practice server");
    expect(tiles.classes()).toContain("sm:grid-cols-2");
  });

  it("stacks two tiles in one rail column beside the tournament", async () => {
    const wrapper = await mount({ league: null, servers: [] });

    expect(rail(wrapper).classes()).toContain("lg:grid-cols-1");
    expect(rail(wrapper).text()).toContain("Scrims");
    expect(rail(wrapper).text()).toContain("Practice server");
  });

  it("lays the tournament across two thirds beside a lone tile", async () => {
    const wrapper = await mount({
      league: null,
      scrims: null,
      servers: [],
    });

    expect(grid(wrapper).classes()).toContain("lg:grid-cols-3");
    expect(rail(wrapper).exists()).toBe(false);
    expect(wrapper.text()).toContain("Practice server");
  });

  it("spreads tiles evenly without a tournament", async () => {
    const two = await mount({ tournament: null, league: null, servers: [] });
    expect(grid(two).classes()).toContain("sm:grid-cols-2");
    expect(grid(two).classes()).not.toContain("lg:grid-cols-3");

    const one = await mount({
      tournament: null,
      league: null,
      scrims: null,
      servers: [],
    });
    expect(grid(one).classes()).toContain("lg:grid-cols-3");
  });

  it("caps six servers at the three busiest and links to the rest", async () => {
    const wrapper = await mount({ servers: servers([3, 9, 3, 0, 12, 9]) });

    const titles = wrapper.findAll("h3").map((h) => h.text());
    expect(titles).toContain("Server 4");
    expect(titles).toContain("Server 1");
    expect(titles).toContain("Server 5");
    expect(titles).not.toContain("Server 0");
    expect(wrapper.text()).toContain("36 playing on public servers");
    expect(wrapper.find('a[href="/public-servers"]').text()).toContain(
      "All servers (6)",
    );
  });

  it("keeps the player count but skips the link with three servers or fewer", async () => {
    const wrapper = await mount({ servers: servers([4]) });

    expect(wrapper.text()).toContain("4 playing on public servers");
    expect(wrapper.find('a[href="/public-servers"]').exists()).toBe(false);
  });

  it("drops the player count when there are no public servers", async () => {
    const wrapper = await mount({ servers: [] });

    expect(wrapper.text()).not.toContain("playing on public servers");
    expect(wrapper.text()).toContain("Practice server");
  });

  it("renders nothing when there is nothing to offer", async () => {
    const wrapper = await mount({
      tournament: null,
      league: null,
      scrims: null,
      servers: [],
      practiceEnabled: false,
    });

    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("asks a guest to sign in instead of registering or practicing", async () => {
    const wrapper = await mount({
      guest: true,
      scrims: { teamsToday: 4, managesTeam: null },
    });

    expect(wrapper.text()).toContain("Sign in to register");
    expect(wrapper.text()).toContain("Sign in to practice");
    expect(wrapper.text()).not.toContain("Register a team");
    expect(wrapper.text()).not.toContain("Needs a team you manage");
  });

  it("tells a player without a team that scrims need one", async () => {
    const wrapper = await mount({
      scrims: { teamsToday: 0, managesTeam: false },
    });

    expect(wrapper.text()).toContain("No teams looking for a scrim today");
    expect(wrapper.text()).toContain("Needs a team you manage");
    expect(wrapper.text()).toContain("Post availability");
  });
});
