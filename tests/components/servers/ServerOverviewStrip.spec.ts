import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerOverviewStrip from "~/components/servers/ServerOverviewStrip.vue";

const status = (pluginActive: boolean) => ({
  count: 11,
  live: pluginActive,
  community: true,
  pluginActive,
  pluginVersion: pluginActive ? "v0.0.84" : null,
  pluginRuntime: pluginActive ? "SwiftlyS2" : null,
  pluginSeenAt: pluginActive ? new Date().toISOString() : null,
});

describe("ServerOverviewStrip", () => {
  it("sums up who is on, the week's reach and the plugin in one row", async () => {
    const wrapper = await mountSuspended(ServerOverviewStrip, {
      props: {
        status: status(true),
        totals: { day: 38, week: 142, sessions: 611, seconds: 611 * 47 * 60 },
        maxPlayers: 24,
      },
    });

    const online = wrapper.find('[data-testid="overview-online"]').text();
    expect(online.replace(/\s+/g, " ")).toBe("11 / 24");
    expect(wrapper.text()).toContain("38");
    expect(wrapper.text()).toContain("142");
    expect(wrapper.text()).toContain("47m");

    const plugin = wrapper.find('[data-testid="overview-plugin"]').text();
    expect(plugin).toContain("v0.0.84 · SwiftlyS2");
    expect(plugin).toContain("Last check-in");
  });

  it("holds its shape before the totals load and while the plugin is missing", async () => {
    const wrapper = await mountSuspended(ServerOverviewStrip, {
      props: { status: status(false), totals: null, maxPlayers: 24 },
    });

    expect(wrapper.text()).toContain("—");
    expect(wrapper.find('[data-testid="overview-plugin"]').text()).toContain(
      "Player Management plugin not detected",
    );
  });
});
