import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentStage from "~/components/tournament/TournamentStage.vue";
import { useBracketView } from "~/composables/useBracketView";

const bracket = (group: number, team1: string, team2: string) => ({
  id: `b-${group}-${team1}`,
  group,
  round: 1,
  team_1: { id: team1 },
  team_2: { id: team2 },
});

const stage = (groups: number, brackets: Array<Record<string, any>>) => ({
  id: "stage-1",
  order: 1,
  type: "DoubleElimination",
  groups,
  brackets,
});

let mounted: { unmount: () => void } | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  useBracketView().followTeamId.value = null;
});

async function mountStage(groups: number, brackets: Array<Record<string, any>>) {
  const wrapper = await mountSuspended(TournamentStage, {
    props: {
      stage: stage(groups, brackets),
      tournament: { id: "t-1", status: "Live" },
      isFinalStage: true,
    },
    shallow: true,
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

const groupsOf = [
  bracket(1, "northside", "lantern"),
  bracket(2, "academy", "gravel"),
  bracket(3, "pinecone", "ember"),
];

describe("TournamentStage followed team group", () => {
  it("opens on the group the followed team plays in", async () => {
    useBracketView().followTeamId.value = "academy";

    const wrapper = await mountStage(3, groupsOf);

    expect((wrapper.vm as any).activeGroupTab).toBe("group-2");
  });

  it("switches group when another team is followed", async () => {
    const wrapper = await mountStage(3, groupsOf);

    useBracketView().followTeamId.value = "pinecone";
    await flushPromises();

    expect((wrapper.vm as any).activeGroupTab).toBe("group-3");
  });

  it("finds a team that is only left in a lower bracket", async () => {
    const wrapper = await mountStage(3, [
      ...groupsOf,
      bracket(5, "quartz", "halcyon"),
    ]);

    useBracketView().followTeamId.value = "quartz";
    await flushPromises();

    expect((wrapper.vm as any).activeGroupTab).toBe("group-2");
  });

  it("stays put for a team that is not in the stage", async () => {
    const wrapper = await mountStage(3, groupsOf);

    useBracketView().followTeamId.value = "withdrawn";
    await flushPromises();

    expect((wrapper.vm as any).activeGroupTab).toBe("group-1");
  });
});
