import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({
    me: { steam_id: "1", role: "user" },
    isRoleAbove: () => false,
  }),
}));

const match = (overrides: Record<string, unknown> = {}) => ({
  id: "match-1",
  status: "Live",
  server_id: "server-1",
  server_type: "OnDemand",
  is_server_online: false,
  is_in_lineup: true,
  connection_string: "connect 1.2.3.4",
  connection_link: null,
  tv_connection_string: "tv",
  options: { tv_delay: 0 },
  ...overrides,
});

describe("QuickMatchConnect", () => {
  it("boots in the card the join row takes over", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: match() },
    });

    expect(wrapper.find(".qmc-boot").text()).toContain(
      "Starting your match server",
    );
  });

  it("calls a player to the gold Join Server once the server is up", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: {
        match: match({
          is_server_online: true,
          connection_link: "steam://connect/1.2.3.4",
        }),
      },
    });

    const join = wrapper.find(".qmc-join");
    expect(join.classes()).toContain("tac-amber-cta");
    expect(join.classes()).toContain("is-calling");
    expect(wrapper.find(".qmc-boot").exists()).toBe(false);
  });

  it("waits while the page shows the server starting elsewhere", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: {
        match: match({
          is_server_online: true,
          connection_link: "steam://connect/1.2.3.4",
        }),
        hideBooting: true,
      },
    });

    expect(wrapper.find(".qmc-join").exists()).toBe(false);
  });
});
