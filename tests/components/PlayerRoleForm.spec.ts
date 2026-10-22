import { afterEach, describe, expect, it, vi } from "vitest";
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
  vi.restoreAllMocks();
});

async function mountRoleForm(
  viewerRole: e_player_roles_enum,
  targetRole: e_player_roles_enum,
  list = false,
) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(PlayerRoleForm, {
    props: { player: { steam_id: TARGET, role: targetRole }, list },
    attachTo: document.body,
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
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

describe("PlayerRoleForm as a list", () => {
  const rows = (wrapper: Awaited<ReturnType<typeof mountRoleForm>>) =>
    wrapper.findAll('[role="radio"]');

  it("saves the privilege tapped", async () => {
    const mutate = vi
      .spyOn((useNuxtApp() as any).$apollo.defaultClient, "mutate")
      .mockResolvedValue({ data: {} });
    const wrapper = await mountRoleForm(
      e_player_roles_enum.tournament_organizer,
      e_player_roles_enum.user,
      true,
    );

    expect(rows(wrapper).map((row) => row.text())).toEqual([
      "User",
      "Verified User",
      "Streamer",
      "Moderator",
      "Match Organizer",
      "Tournament Organizer",
    ]);
    expect(rows(wrapper)[0].attributes("aria-checked")).toBe("true");

    await rows(wrapper)[3].trigger("click");
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("updated")).toEqual([
      [e_player_roles_enum.moderator],
    ]);
  });

  it("saves nothing for a tap on the privilege the player has", async () => {
    const mutate = vi
      .spyOn((useNuxtApp() as any).$apollo.defaultClient, "mutate")
      .mockResolvedValue({ data: {} });
    const wrapper = await mountRoleForm(
      e_player_roles_enum.administrator,
      e_player_roles_enum.user,
      true,
    );

    await rows(wrapper)[0].trigger("click");
    await flushPromises();

    expect(mutate).not.toHaveBeenCalled();
  });

  it("shows a privilege that outranks the viewer read-only", async () => {
    const wrapper = await mountRoleForm(
      e_player_roles_enum.match_organizer,
      e_player_roles_enum.administrator,
      true,
    );

    expect(rows(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain("Administrator");
    expect(wrapper.text()).toContain("Outranks you");
  });
});
