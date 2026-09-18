import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const SOMEONE_ELSE = "76561198000000002";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountJoinForm(options: {
  isOrganizer?: boolean;
  tournamentOwners: string[];
}) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Player",
    role: e_player_roles_enum.user,
    teams: [
      { id: "mine", name: "Mine", owner_steam_id: ME },
      { id: "theirs", name: "Theirs", owner_steam_id: SOMEONE_ELSE },
    ],
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentJoinForm, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        can_join: true,
        is_organizer: options.isOrganizer ?? false,
        min_players_per_lineup: 5,
        teams: options.tournamentOwners.map((owner, index) => ({
          id: `entry-${index}`,
          team_id: `registered-${index}`,
          owner_steam_id: owner,
          roster: [],
        })),
      },
    },
    global: { stubs: { TeamSearch: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function ineligible(wrapper: Awaited<ReturnType<typeof mountJoinForm>>) {
  return wrapper.findComponent(TeamSearch).props("ineligible") as Record<
    string,
    string
  >;
}

describe("TournamentJoinForm", () => {
  it("offers a new team to a player who has no team in the tournament", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    expect(wrapper.text()).toContain("Create New Team");
    expect(ineligible(wrapper).mine).toBeUndefined();
  });

  it("stops a player who owns a team here from entering another they own", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [ME] });

    expect(wrapper.text()).not.toContain("Create New Team");
    expect(ineligible(wrapper).mine).toBe(
      "Its owner already has a team in this tournament.",
    );
    expect(ineligible(wrapper).theirs).toBeUndefined();
  });

  it("blocks a managed team whose owner already has a team here", async () => {
    const wrapper = await mountJoinForm({ tournamentOwners: [SOMEONE_ELSE] });

    expect(ineligible(wrapper).theirs).toBe(
      "Its owner already has a team in this tournament.",
    );
  });

  it("lets an organizer add as many teams as they need", async () => {
    const wrapper = await mountJoinForm({
      isOrganizer: true,
      tournamentOwners: [ME, SOMEONE_ELSE],
    });

    expect(wrapper.text()).toContain("Create New Team");
    expect(ineligible(wrapper)).toEqual({
      "registered-0": "Already entered in this tournament.",
      "registered-1": "Already entered in this tournament.",
    });
  });
});
