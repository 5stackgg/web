import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import EventTeamsPanel from "~/components/events/EventTeamsPanel.vue";

describe("EventTeamsPanel", () => {
  it("links a team with a team page to /teams/<id>", async () => {
    const wrapper = await mountSuspended(EventTeamsPanel, {
      props: {
        teams: [{ id: "abc", name: "Team A", short_name: "TA" }],
        players: [],
      },
    });

    const link = wrapper.find('a[href="/teams/abc"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("Team A");
    expect(wrapper.find("nuxtlink").exists()).toBe(false);
  });

  it("does not link a team without a team page", async () => {
    const wrapper = await mountSuspended(EventTeamsPanel, {
      props: {
        teams: [{ id: null, name: "Ad-hoc Five" }],
        players: [],
      },
    });

    expect(wrapper.text()).toContain("Ad-hoc Five");
    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.find("nuxtlink").exists()).toBe(false);
  });
});
