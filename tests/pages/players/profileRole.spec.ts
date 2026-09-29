import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const client = vi.hoisted(() => ({
  query: () => Promise.resolve({ data: {} }),
  subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const ME = "76561198000000001";
const TARGET = "76561198000000002";

let unmount: (() => void) | undefined;

async function mountProfile(
  viewerRole: e_player_roles_enum,
  player: { steam_id: string; name: string; role: e_player_roles_enum },
) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${player.steam_id}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).player = player;
  await flushPromises();
  return wrapper;
}

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("player profile role slot", () => {
  it("gives a streamer the read-only chip, not an empty role form", async () => {
    const wrapper = await mountProfile(e_player_roles_enum.streamer, {
      steam_id: TARGET,
      name: "Dana",
      role: e_player_roles_enum.user,
    });

    expect(wrapper.findComponent(PlayerRoleForm).exists()).toBe(false);
    expect(wrapper.text()).toContain("User");
  });

  it("gives a match organizer the read-only chip for an administrator", async () => {
    const wrapper = await mountProfile(e_player_roles_enum.match_organizer, {
      steam_id: TARGET,
      name: "Dana",
      role: e_player_roles_enum.administrator,
    });

    expect(wrapper.findComponent(PlayerRoleForm).exists()).toBe(false);
    expect(wrapper.text()).toContain("Administrator");
  });

  it("gives an administrator the role form", async () => {
    const wrapper = await mountProfile(e_player_roles_enum.administrator, {
      steam_id: TARGET,
      name: "Dana",
      role: e_player_roles_enum.user,
    });

    expect(wrapper.findComponent(PlayerRoleForm).exists()).toBe(true);
  });
});

describe("player profile ELO empty state", () => {
  it("does not tell a visitor to play a match on someone else's profile", async () => {
    const wrapper = await mountProfile(e_player_roles_enum.user, {
      steam_id: TARGET,
      name: "Dana",
      role: e_player_roles_enum.user,
    });

    expect(wrapper.text()).toContain("No ELO history yet");
    expect(wrapper.text()).not.toContain("Play a match to generate ELO");
    expect(wrapper.find('[to="/play"]').exists()).toBe(false);
  });

  it("keeps the Play prompt on your own profile", async () => {
    const wrapper = await mountProfile(e_player_roles_enum.user, {
      steam_id: ME,
      name: "Viewer",
      role: e_player_roles_enum.user,
    });

    expect(wrapper.text()).toContain("Play a match to generate ELO");
    expect(wrapper.find('[to="/play"]').exists()).toBe(true);
  });
});
