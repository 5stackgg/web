import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";
import TournamentCreateWizard from "~/components/tournament/TournamentCreateWizard.vue";

const tournament = {
  id: "t-1",
  name: "Autumn Cup",
  status: "RegistrationOpen",
  e_tournament_status: { value: "RegistrationOpen", description: "Open" },
  options: { type: "Competitive", mr: 12, best_of: 1 },
  admin: { steam_id: "1", name: "Organizer", avatar_url: null },
  teams: [],
  stages: [],
  rosters: [],
  organizers: [],
};

let mounted: { unmount: () => void } | null = null;

beforeEach(() => {
  config.global.renderStubDefaultSlot = true;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  config.global.renderStubDefaultSlot = false;
});

async function mountDetail(overrides: Record<string, unknown>) {
  const wrapper = await mountSuspended(TournamentDetail, {
    route: `/tournaments/${tournament.id}`,
    shallow: true,
  });
  mounted = wrapper;
  (wrapper.vm as any).tournamentLive = { ...tournament, ...overrides };
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountDetail>>;

const homepageLink = (wrapper: Wrapper) =>
  wrapper.findAll("a").find((a) => a.text().includes("Homepage"));

function matchSettingsGrid(wrapper: Wrapper) {
  const section = wrapper
    .findAll("manage-section-stub")
    .find((stub) => stub.attributes("label") === "Match Settings");
  expect(section, "Match Settings section").toBeDefined();
  return section!.element.parentElement!;
}

describe("tournament overview homepage link", () => {
  it("is left out when the homepage is this site", async () => {
    const wrapper = await mountDetail({
      homepage: `${window.location.origin}/`,
    });

    expect(homepageLink(wrapper)).toBeUndefined();
  });

  it("is left out when the homepage is this site without a scheme", async () => {
    const wrapper = await mountDetail({ homepage: window.location.host });

    expect(homepageLink(wrapper)).toBeUndefined();
  });

  it("links an event page on this site", async () => {
    const wrapper = await mountDetail({
      homepage: `${window.location.origin}/events/autumn-cup`,
    });

    expect(homepageLink(wrapper)?.attributes("href")).toBe(
      `${window.location.origin}/events/autumn-cup`,
    );
  });

  it("links an outside site, adding https when the scheme is missing", async () => {
    const wrapper = await mountDetail({ homepage: "nordic-lan.example/open" });

    expect(homepageLink(wrapper)?.attributes("href")).toBe(
      "https://nordic-lan.example/open",
    );
  });

  it("keeps an outside http address as it is", async () => {
    const wrapper = await mountDetail({
      homepage: "http://nordic-lan.example/open",
    });

    expect(homepageLink(wrapper)?.attributes("href")).toBe(
      "http://nordic-lan.example/open",
    );
  });

  it("is left out when the address carries credentials", async () => {
    const wrapper = await mountDetail({
      homepage: "https://admin:hunter2@nordic-lan.example/",
    });

    expect(homepageLink(wrapper)).toBeUndefined();
  });

  it("is left out when the address is not a web address", async () => {
    const wrapper = await mountDetail({ homepage: "javascript:alert(1)" });

    expect(homepageLink(wrapper)).toBeUndefined();
  });
});

describe("tournament overview match settings", () => {
  it("takes the full width when there is no About text", async () => {
    const wrapper = await mountDetail({ description: null });

    expect(matchSettingsGrid(wrapper).className).not.toContain(
      "xl:grid-cols-2",
    );
  });

  it("sits beside the About text when there is one", async () => {
    const wrapper = await mountDetail({ description: "Two days of CS." });

    expect(matchSettingsGrid(wrapper).className).toContain("xl:grid-cols-2");
  });
});

describe("tournament create wizard homepage", () => {
  it("starts empty instead of pointing at this site", async () => {
    const wrapper = await mountSuspended(TournamentCreateWizard, {
      shallow: true,
    });
    mounted = wrapper;
    await flushPromises();

    expect((wrapper.vm as any).form.values.homepage ?? null).toBeNull();
  });
});
