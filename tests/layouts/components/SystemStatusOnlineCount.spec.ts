import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SystemStatus from "~/layouts/components/SystemStatus.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
});

async function mountAs(role: e_player_roles_enum) {
  useAuthStore().me = {
    steam_id: "76561198000000401",
    name: "Viewer",
    role,
  } as any;
  useApplicationSettingsStore().availableRegions = [
    { value: "US", description: "US", status: "Online" },
  ] as any;
  useMatchmakingStore().setOnlineCount(42);

  const wrapper = await mountSuspended(SystemStatus, {
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("the online count on the status globe", () => {
  it("shows an administrator how many players are online", async () => {
    const wrapper = await mountAs(e_player_roles_enum.administrator);

    expect(wrapper.get('[data-testid="players-online-count"]').text()).toBe(
      "42",
    );

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(
      document.body.querySelector('[data-testid="players-online-line"]')
        ?.textContent,
    ).toContain("42 online");
  });

  it("shows a player no online count", async () => {
    const wrapper = await mountAs(e_player_roles_enum.user);

    expect(wrapper.find('[data-testid="players-online-count"]').exists()).toBe(
      false,
    );
  });
});
