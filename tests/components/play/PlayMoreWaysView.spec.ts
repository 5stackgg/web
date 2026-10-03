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
  start: "2026-10-31T19:00:00Z",
  location: "Buttah Boyz HQ",
  teams: 6,
  maxTeams: 16,
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

const cardGrid = (wrapper: any) => wrapper.find("section > div.grid").classes();
const dropInGrid = (wrapper: any) =>
  wrapper.findAll("div.grid").at(-1)!.classes();

describe("PlayMoreWaysView", () => {
  it("shows the three cards without a group label", async () => {
    const wrapper = await mount();

    expect(wrapper.text()).toContain("Tournaments");
    expect(wrapper.text()).toContain("League");
    expect(wrapper.text()).toContain("Scrims");
    expect(wrapper.text()).not.toContain("Compete");
    expect(cardGrid(wrapper)).toContain("md:grid-cols-3");
  });

  it("re-flows two cards evenly and keeps a lone card at a third", async () => {
    const two = await mount({ league: null });
    expect(two.text()).not.toContain("League");
    expect(cardGrid(two)).toContain("md:grid-cols-2");

    const one = await mount({ league: null, scrims: null });
    expect(cardGrid(one)).toContain("md:grid-cols-3");
  });

  it("caps six servers at the three busiest and links to the rest", async () => {
    const wrapper = await mount({ servers: servers([3, 9, 3, 0, 12, 9]) });

    const titles = wrapper.findAll("h3").map((h) => h.text());
    expect(titles).toContain("Server 4");
    expect(titles).toContain("Server 1");
    expect(titles).toContain("Server 5");
    expect(titles).not.toContain("Server 0");
    expect(wrapper.find('a[href="/public-servers"]').text()).toContain(
      "All servers (6)",
    );
    expect(dropInGrid(wrapper)).toContain("xl:grid-cols-4");
  });

  it("puts one server beside the practice tile", async () => {
    const wrapper = await mount({ servers: servers([4]) });

    expect(dropInGrid(wrapper)).toContain("sm:grid-cols-2");
    expect(dropInGrid(wrapper)).not.toContain("xl:grid-cols-3");
    expect(wrapper.find('a[href="/public-servers"]').exists()).toBe(false);
  });

  it("shows only the practice tile when there are no public servers", async () => {
    const wrapper = await mount({ servers: [] });

    expect(wrapper.text()).toContain("No public servers on this server yet");
    expect(wrapper.text()).toContain("Practice server");
    expect(dropInGrid(wrapper)).toContain("xl:grid-cols-3");
  });

  it("hides Drop in when there are no servers and practice is off", async () => {
    const wrapper = await mount({ servers: [], practiceEnabled: false });

    expect(wrapper.text()).not.toContain("Drop in");
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
    expect(wrapper.find('a[href="/tournaments/t1"]').exists()).toBe(false);
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
