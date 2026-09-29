import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const TARGET = "76561198000000002";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountRoleForm(
  viewerRole: e_player_roles_enum,
  targetRole: e_player_roles_enum,
) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(PlayerRoleForm, {
    props: { player: { steam_id: TARGET, role: targetRole } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

async function openRoles(wrapper: Awaited<ReturnType<typeof mountRoleForm>>) {
  await wrapper.find("button").trigger("click");
  await flushPromises();
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="option"]'),
  ).map((option) => option.textContent?.trim());
}

describe("PlayerRoleForm", () => {
  it("offers Moderator to a tournament organizer", async () => {
    const wrapper = await mountRoleForm(
      e_player_roles_enum.tournament_organizer,
      e_player_roles_enum.user,
    );

    expect(await openRoles(wrapper)).toEqual([
      "User",
      "Verified User",
      "Streamer",
      "Moderator",
      "Match Organizer",
      "Tournament Organizer",
    ]);
  });

  it("labels a moderator instead of printing the raw key", async () => {
    const wrapper = await mountRoleForm(
      e_player_roles_enum.tournament_organizer,
      e_player_roles_enum.moderator,
    );

    expect(wrapper.find("button").text()).toBe("Moderator");
    expect(wrapper.text()).not.toContain("player_roles");
  });

  it("shows a streamer the role without a form", async () => {
    const wrapper = await mountRoleForm(
      e_player_roles_enum.streamer,
      e_player_roles_enum.user,
    );

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).toBe("User");
  });

  it("shows a match organizer an administrator's role without a form", async () => {
    const wrapper = await mountRoleForm(
      e_player_roles_enum.match_organizer,
      e_player_roles_enum.administrator,
    );

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).toBe("Administrator");
  });
});
