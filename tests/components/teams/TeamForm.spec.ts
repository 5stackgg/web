import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamForm from "~/components/teams/TeamForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const OWNER = "76561198000000002";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountTeamForm(viewerRole: e_player_roles_enum, owner: string) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TeamForm, {
    props: {
      team: {
        id: "team-1",
        name: "Alpha",
        short_name: "ALP",
        owner_steam_id: owner,
        is_organization: false,
        roster: [],
      },
    },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("TeamForm owner field", () => {
  it("shows the owner field to the team owner", async () => {
    const wrapper = await mountTeamForm(e_player_roles_enum.user, ME);

    expect(wrapper.text()).toContain("Team Owner");
  });

  it("hides the owner field from a roster admin who is not the owner", async () => {
    const wrapper = await mountTeamForm(e_player_roles_enum.user, OWNER);

    expect(wrapper.text()).not.toContain("Team Owner");
  });

  it("hides the owner field from a match organizer", async () => {
    const wrapper = await mountTeamForm(
      e_player_roles_enum.match_organizer,
      OWNER,
    );

    expect(wrapper.text()).not.toContain("Team Owner");
  });

  it.each([
    e_player_roles_enum.tournament_organizer,
    e_player_roles_enum.administrator,
  ])("shows the owner field to a %s", async (role) => {
    const wrapper = await mountTeamForm(role, OWNER);

    expect(wrapper.text()).toContain("Team Owner");
  });
});
