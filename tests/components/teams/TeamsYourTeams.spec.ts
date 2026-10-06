import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamsYourTeams from "~/components/teams/TeamsYourTeams.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { lastYourTeams } from "~/utilities/teamsListCache";

// The subscription only calls back when a test pushes data through it.
const subscription = vi.hoisted(() => ({
  next: undefined as undefined | ((value: unknown) => void),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({
        subscribe: ({ next }: { next: (value: unknown) => void }) => {
          subscription.next = next;
          return { unsubscribe() {} };
        },
      }),
    },
  }),
}));

vi.mock("~/components/teams/TeamsYourTeamCard.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { team: { type: Object, required: true } },
      setup: (props) => () =>
        h("div", { "data-team": (props.team as { id: string }).id }),
    }),
  };
});

const ME = "76561198000000001";
const TEAM = { id: "t1", name: "Blue Rabbits", roster: [] };

describe("TeamsYourTeams", () => {
  beforeEach(() => {
    subscription.next = undefined;
    lastYourTeams.clear();
    useAuthStore().me = { steam_id: ME } as any;
  });

  it("holds the section's space while a signed-in player's teams load", async () => {
    const wrapper = await mountSuspended(TeamsYourTeams);

    const section = wrapper.find("section");
    expect(section.exists()).toBe(true);
    expect(section.attributes("aria-busy")).toBe("true");
    expect(wrapper.findAll("[data-team]")).toHaveLength(0);

    subscription.next?.({ data: { teams: [TEAM] } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find("section").attributes("aria-busy")).toBe("false");
    expect(wrapper.findAll("[data-team]")).toHaveLength(1);
  });

  it("shows the last teams at once on a return visit", async () => {
    lastYourTeams.set(ME, [TEAM]);

    const wrapper = await mountSuspended(TeamsYourTeams);

    expect(wrapper.find("section").attributes("aria-busy")).toBe("false");
    expect(wrapper.findAll("[data-team]")).toHaveLength(1);
  });

  it("drops the section once it is known there are no teams", async () => {
    const wrapper = await mountSuspended(TeamsYourTeams);

    subscription.next?.({ data: { teams: [] } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find("section").exists()).toBe(false);
  });
});
