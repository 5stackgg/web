import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TeamForm from "~/components/teams/TeamForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const OWNER = "76561198000000002";
const MEMBER = "76561198000000003";

const mutate = vi.fn().mockResolvedValue({});

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  mutate.mockClear();
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
        roster: [OWNER, MEMBER].map((steam_id) => ({
          player: { steam_id, name: steam_id, avatar_url: null },
        })),
      },
    },
    global: { stubs: { SettingsSaveBar: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

async function saveAndCaptureSet(
  wrapper: Awaited<ReturnType<typeof mountTeamForm>>,
  values: Record<string, unknown>,
) {
  const vm = wrapper.vm as any;
  const apollo = vm.$apollo;
  apollo.mutate = mutate;
  try {
    vm.form.setValues(values);
    await flushPromises();
    await vm.updateCreateTeam();
  } finally {
    delete apollo.mutate;
  }
  expect(mutate).toHaveBeenCalledTimes(1);
  return print(mutate.mock.calls[0][0].mutation);
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
  ])("shows the owner field to role %s", async (role) => {
    const wrapper = await mountTeamForm(role, OWNER);

    expect(wrapper.text()).toContain("Team Owner");
  });

  it("starts from the current owner", async () => {
    const wrapper = await mountTeamForm(
      e_player_roles_enum.administrator,
      OWNER,
    );

    expect((wrapper.vm as any).form.values.owner_steam_id).toBe(OWNER);
  });

  it("leaves ownership out of a save that did not change it", async () => {
    const wrapper = await mountTeamForm(
      e_player_roles_enum.administrator,
      OWNER,
    );

    const mutation = await saveAndCaptureSet(wrapper, {
      team_name: "Renamed",
    });

    expect(mutation).toContain("Renamed");
    expect(mutation).not.toContain("owner_steam_id");
  });

  it("sends a new owner once one is picked", async () => {
    const wrapper = await mountTeamForm(
      e_player_roles_enum.administrator,
      OWNER,
    );

    const mutation = await saveAndCaptureSet(wrapper, {
      owner_steam_id: MEMBER,
    });

    expect(mutation).toContain(`owner_steam_id: "${MEMBER}"`);
  });

  it("drops a discarded owner pick from the next save", async () => {
    const wrapper = await mountTeamForm(
      e_player_roles_enum.administrator,
      OWNER,
    );
    const vm = wrapper.vm as any;
    vm.form.setValues({ owner_steam_id: MEMBER });
    await flushPromises();
    vm.discardChanges();
    await flushPromises();

    const mutation = await saveAndCaptureSet(wrapper, {
      team_name: "Renamed",
    });

    expect(mutation).not.toContain("owner_steam_id");
  });

  it("never sends ownership for a viewer who cannot change it", async () => {
    const wrapper = await mountTeamForm(e_player_roles_enum.user, OWNER);

    const mutation = await saveAndCaptureSet(wrapper, {
      owner_steam_id: MEMBER,
    });

    expect(mutation).not.toContain("owner_steam_id");
  });
});
