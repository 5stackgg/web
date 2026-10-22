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
const scrimTeams = [
  {
    id: "z",
    name: "Team Zalrus",
    avatarUrl: null,
    from: new Date(2026, 9, 2, 20),
    to: new Date(2026, 9, 2, 22),
  },
  {
    id: "n",
    name: "nuggets",
    avatarUrl: null,
    from: new Date(2026, 9, 2, 21, 30),
    to: new Date(2026, 9, 2, 23, 30),
  },
];
const scrims = { teamsToday: 2, teams: scrimTeams, managesTeam: true };
const quietScrims = { teamsToday: 0, teams: [], managesTeam: true };

function servers(players: number[]) {
  return players.map((count, index) => ({
    id: `s${index}`,
    label: `Server ${index}`,
    map: "Train",
    mapName: "de_train",
    region: "US East",
    ping: 18,
    players: count,
    maxPlayers: 16,
    connectionLink: `steam://connect/1.2.3.${index}`,
    connectionString: `connect 1.2.3.${index}`,
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

const featured = (wrapper: any) => wrapper.find(".ways-grid > article");
const peeks = (wrapper: any) =>
  wrapper.findAll(".ways-grid > div > section").map((part: any) => part.text());

describe("PlayMoreWaysView", () => {
  it("features the busiest public server and peeks at the other ways beside it", async () => {
    const wrapper = await mount();

    const card = featured(wrapper);
    expect(card.find("h3").text()).toBe("Server 1");
    expect(card.text()).toContain("14 playing now");
    expect(card.find('a[href="steam://connect/1.2.3.1"]').text()).toContain(
      "Connect",
    );

    const [scrimsPart, practicePart] = peeks(wrapper);
    expect(scrimsPart).toContain("Scrims");
    expect(scrimsPart).toContain("Team Zalrus");
    expect(scrimsPart).toContain("Find a scrim");
    expect(practicePart).toContain("Practice server");
    expect(wrapper.find('a[href="/public-servers"]').text()).toContain(
      "All servers (3)",
    );
  });

  it("features today's scrims when nobody is on a public server", async () => {
    const wrapper = await mount({ servers: servers([0]) });

    const card = featured(wrapper);
    expect(card.find("h3").text()).toBe("Scrims");
    expect(card.text()).toContain("2 teams looking for a scrim today");
    expect(card.text()).toContain("Team Zalrus");
    expect(card.text()).toContain("nuggets");
    expect(card.find('a[href="/scrims"]').text()).toBe("Find a scrim");

    const [serverPart, practicePart] = peeks(wrapper);
    expect(serverPart).toContain("Server 0");
    expect(serverPart).toContain("0/16");
    expect(practicePart).toContain("Practice server");
  });

  it("features practice when it's quiet, and never says nobody is playing", async () => {
    const wrapper = await mount({
      servers: servers([0]),
      scrims: quietScrims,
    });

    expect(featured(wrapper).text()).toContain("Practice server");
    const [scrimsPart] = peeks(wrapper);
    expect(scrimsPart).toContain("No teams looking for a scrim today");
    expect(scrimsPart).toContain(
      "Post when your team is free and others can request a scrim.",
    );
    expect(scrimsPart).toContain("Post availability");
    expect(wrapper.text()).not.toContain("playing now");
    expect(wrapper.text()).not.toContain("playing on public servers");
  });

  it("drops the panel when only one way is on offer", async () => {
    const wrapper = await mount({ scrims: null, servers: [] });

    expect(featured(wrapper).text()).toContain("Practice server");
    expect(peeks(wrapper)).toEqual([]);
  });

  it("links to every public server only when there's more than one", async () => {
    const wrapper = await mount({ servers: servers([4]) });

    expect(wrapper.find('a[href="/public-servers"]').exists()).toBe(false);
  });

  it("keeps an open tournament and the league signup under the ways", async () => {
    const wrapper = await mount();

    expect(wrapper.text()).toContain("2v2 Wingman Tournament");
    expect(wrapper.text()).toContain("6 of 16 teams");
    expect(wrapper.find('a[href="/tournaments"]').text()).toContain(
      "All tournaments",
    );
    expect(wrapper.text()).toContain("Fall League");
    expect(wrapper.text()).toContain("Register a team");
  });

  it("gives the tournament the whole row unless the league sits beside it", async () => {
    const card = (wrapper: any) =>
      wrapper
        .findAll(".ways-grid > article")
        .find((part: any) => part.text().includes("2v2 Wingman Tournament"));

    expect(card(await mount()).classes()).not.toContain("ways-solo");
    expect(card(await mount({ league: null })).classes()).toContain(
      "ways-solo",
    );
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
      scrims: { ...scrims, managesTeam: null },
    });

    expect(wrapper.text()).toContain("Sign in to register");
    expect(wrapper.text()).toContain("Sign in to practice");
    expect(wrapper.text()).not.toContain("Register a team");
    expect(wrapper.text()).not.toContain("Needs a team you manage");
  });

  it("tells a player without a team that scrims need one", async () => {
    const wrapper = await mount({
      scrims: { ...quietScrims, managesTeam: false },
    });

    expect(wrapper.text()).toContain("Needs a team you manage");
    expect(wrapper.text()).toContain("Post availability");
  });
});
