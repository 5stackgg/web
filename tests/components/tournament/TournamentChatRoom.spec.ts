import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const tournament = {
  id: "t-1",
  name: "Spring Cup",
  status: "Live",
  e_tournament_status: { value: "Live", description: "Live" },
  options: { type: "Competitive", mr: 12, best_of: 1 },
  admin: { steam_id: "1", name: "Organizer", avatar_url: null },
  teams: [],
  stages: [],
  rosters: [],
  organizers: [],
};

let mounted: { unmount: () => void } | null = null;

async function mountDetail(inChat: boolean) {
  useMatchLobbyStore().chatTournaments = inChat
    ? [{ id: tournament.id, name: tournament.name }]
    : [];

  const wrapper = await mountSuspended(TournamentDetail, {
    route: `/tournaments/${tournament.id}`,
    shallow: true,
  });
  mounted = wrapper;
  (wrapper.vm as any).tournamentLive = { ...tournament };
  await flushPromises();
  return wrapper;
}

function classesOf(element: { attributes: (name: string) => string }) {
  return (element.attributes("class") ?? "").split(/\s+/);
}

beforeEach(() => {
  config.global.renderStubDefaultSlot = true;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  useMatchLobbyStore().chatTournaments = [];
  config.global.renderStubDefaultSlot = false;
});

describe("tournament chat room button", () => {
  it("is left out for a tournament without a chat room", async () => {
    const wrapper = await mountDetail(false);

    expect(wrapper.find("tabs-list-stub").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Chat Room");
  });

  it("sits beside the left-aligned tabs on one row at every width", async () => {
    const wrapper = await mountDetail(true);
    const tabList = wrapper.find("tabs-list-stub");
    const row = tabList.element.parentElement!;
    const button = tabList.element.nextElementSibling!;

    expect(button.tagName.toLowerCase()).toBe("button-stub");
    expect(button.textContent).toContain("Chat Room");

    const rowClasses = row.className.split(/\s+/);
    expect(rowClasses).toEqual(expect.arrayContaining(["flex", "items-start"]));
    expect(rowClasses).not.toContain("flex-wrap");

    const tabListClasses = classesOf(tabList);
    expect(tabListClasses).toEqual(
      expect.arrayContaining(["min-w-0", "flex-wrap", "justify-start"]),
    );
    expect(tabListClasses).not.toContain("flex-1");

    expect(button.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["shrink-0", "max-sm:px-2"]),
    );

    const label = [...button.querySelectorAll("span")].find((span) =>
      span.textContent?.includes("Chat Room"),
    )!;
    expect(label.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["sr-only", "sm:not-sr-only"]),
    );
  });
});
