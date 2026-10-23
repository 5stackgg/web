import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";
import TournamentViewingSelect from "~/components/tournament/TournamentViewingSelect.vue";
import { useBracketView } from "~/composables/useBracketView";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";

const entry = (id: string, players: string[]) => ({
  id,
  name: id,
  roster: players.map((steam_id) => ({ player: { steam_id } })),
});

const seeded = (team1: string, team2: string) => ({
  id: `b-${team1}`,
  team_1: { id: team1 },
  team_2: { id: team2 },
});

let mounted: { unmount: () => void } | null = null;

beforeEach(() => {
  config.global.renderStubDefaultSlot = true;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  config.global.renderStubDefaultSlot = false;
  useAuthStore().me = undefined;
  useBracketView().followDefaultTeamId.value = null;
  useBracketView().followPicked.value = false;
  vi.restoreAllMocks();
});

const stage = (order: number, brackets: Array<Record<string, any>>) => ({
  id: `stage-${order}`,
  order,
  type: "DoubleElimination",
  min_teams: 2,
  max_teams: 8,
  brackets,
  results: [],
});

async function mountDetail(
  myTeams: Array<Record<string, any>>,
  brackets: Array<Record<string, any>> = [],
  overrides: Record<string, unknown> = {},
) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Owner",
    role: e_player_roles_enum.user,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentDetail, {
    route: "/tournaments/t-1",
    shallow: true,
  });
  mounted = wrapper;
  const vm = wrapper.vm as any;
  vm.tournamentLive = {
    id: "t-1",
    name: "Autumn Cup",
    status: "Live",
    e_tournament_status: { description: "Live" },
    is_organizer: false,
    start: new Date().toISOString(),
    max_players_per_lineup: 5,
    admin: { steam_id: "76561198000000009", name: "Organizer" },
    options: { type: "Competitive", mr: 12, best_of: 1 },
    organizers: [],
    teams: [],
    stages: [stage(1, brackets)],
    ...overrides,
  };
  vm.myTeams = myTeams;
  await flushPromises();
  return wrapper;
}

const managed = entry("managed", ["76561198000000002"]);
const playing = entry("playing", [ME]);

describe("TournamentDetail Viewing switcher", () => {
  it("sits in the header for an owner with several teams, on the team they play on", async () => {
    const wrapper = await mountDetail([managed, playing]);
    const switcher = wrapper.findComponent(TournamentViewingSelect);

    expect(switcher.exists()).toBe(true);
    expect(switcher.props("modelValue")).toBe("playing");
  });

  it("is not shown for a single team", async () => {
    const wrapper = await mountDetail([playing]);

    expect(wrapper.findComponent(TournamentViewingSelect).exists()).toBe(
      false,
    );
  });

  it("switches the page to the picked team", async () => {
    const wrapper = await mountDetail([managed, playing]);

    wrapper
      .findComponent(TournamentViewingSelect)
      .vm.$emit("update:modelValue", "managed");
    await flushPromises();

    expect((wrapper.vm as any).myTeamId).toBe("managed");
  });

  it("has the bracket follow the viewed team once it holds a slot", async () => {
    await mountDetail([managed, playing], [seeded("playing", "rival")]);

    expect(useBracketView().followDefaultTeamId.value).toBe("playing");
  });

  it("has the bracket follow nothing while the viewed team has no slot", async () => {
    const wrapper = await mountDetail(
      [managed, playing],
      [seeded("playing", "rival")],
    );

    (wrapper.vm as any).selectedMyTeamId = "managed";
    await flushPromises();

    expect(useBracketView().followDefaultTeamId.value).toBeNull();
  });

  it("has the bracket follow nothing when the team is out of the current stage", async () => {
    await mountDetail([managed, playing], [], {
      current_stage: 2,
      stages: [
        stage(1, [seeded("playing", "rival")]),
        stage(2, [seeded("rival", "other")]),
      ],
    });

    expect(useBracketView().followDefaultTeamId.value).toBeNull();
  });

  it("has the bracket follow a team placed in the current stage", async () => {
    await mountDetail([managed, playing], [], {
      current_stage: 2,
      stages: [
        stage(1, [seeded("rival", "other")]),
        stage(2, [seeded("playing", "rival")]),
      ],
    });

    expect(useBracketView().followDefaultTeamId.value).toBe("playing");
  });

  it("has the bracket follow nothing before seeding", async () => {
    await mountDetail([managed, playing], [{ id: "b-1" }]);

    expect(useBracketView().followDefaultTeamId.value).toBeNull();
  });

  it("leaves the bracket unfollowed for a single team", async () => {
    await mountDetail([playing], [seeded("playing", "rival")]);

    expect(useBracketView().followDefaultTeamId.value).toBeNull();
  });

  it("drops the viewer's own follow pick when they switch teams", async () => {
    const wrapper = await mountDetail(
      [managed, playing],
      [seeded("playing", "managed")],
    );
    useBracketView().followPicked.value = true;

    (wrapper.vm as any).selectedMyTeamId = "managed";
    await flushPromises();

    expect(useBracketView().followDefaultTeamId.value).toBe("managed");
    expect(useBracketView().followPicked.value).toBe(false);
  });

  it("clears the bracket default when the page closes", async () => {
    const wrapper = await mountDetail(
      [managed, playing],
      [seeded("playing", "rival")],
    );

    wrapper.unmount();
    mounted = null;

    expect(useBracketView().followDefaultTeamId.value).toBeNull();
  });
});
