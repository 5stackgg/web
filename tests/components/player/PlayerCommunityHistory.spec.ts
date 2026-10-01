import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerCommunityHistory from "~/components/player/PlayerCommunityHistory.vue";

const HOUR = 60 * 60 * 1000;

function totals(extra: Record<string, unknown> = {}) {
  return {
    sessions: 19,
    seconds: 42120,
    kills: 412,
    deaths: 340,
    servers: 2,
    rank: 3,
    ...extra,
  };
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

function stats(moderator: boolean) {
  return {
    week: totals(),
    all_time: totals({ sessions: 214, seconds: 670200, kills: 7903 }),
    last_seen_at: hoursAgo(2),
    online_server_id: null,
    online_server_label: null,
    is_moderator_view: moderator,
    servers: [
      {
        server_id: "server-retake",
        label: "Retake #1",
        region: "US-East",
        type: "Retake",
        online: false,
        last_seen_at: hoursAgo(2),
        week: totals({ sessions: 11, seconds: 28200, kills: 281 }),
        all_time: totals({ sessions: 98, seconds: 374700, kills: 4410 }),
        names: moderator ? ["nyx | 5stack.gg", "nyx"] : null,
        sessions: moderator
          ? [
              {
                started_at: hoursAgo(3),
                ended_at: hoursAgo(2),
                ip: "203.0.113.24",
              },
              {
                started_at: hoursAgo(30),
                ended_at: hoursAgo(29),
                ip: "198.51.100.58",
              },
            ]
          : null,
      },
    ],
    ips: moderator
      ? [
          { ip: "203.0.113.24", sessions: 17 },
          { ip: "198.51.100.58", sessions: 2 },
        ]
      : null,
    ip_matches: moderator
      ? [
          {
            steam_id: "76561199433310288",
            name: "smurfacc",
            avatar_url: null,
            has_account: false,
            is_banned: false,
            sessions: 4,
            last_seen_at: hoursAgo(1),
            online: true,
            ip: "203.0.113.24",
          },
          {
            steam_id: "76561199077712345",
            name: "cheatyboi",
            avatar_url: null,
            has_account: true,
            is_banned: true,
            sessions: 3,
            last_seen_at: hoursAgo(50),
            online: false,
            ip: "203.0.113.24",
          },
        ]
      : null,
  };
}

let unmount: (() => void) | null = null;

// AnimatedStat flips each character on its own and keeps spaces as NBSPs.
function tile(wrapper: { find: (selector: string) => any }, key: string) {
  return wrapper
    .find(`[data-tile="${key}"]`)
    .text()
    .replace(/\u00a0/g, " ");
}

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
});

async function mountHistory(payload: Record<string, unknown> | null) {
  const query = vi
    .spyOn((useNuxtApp() as any).$apollo.defaultClient, "query")
    .mockResolvedValue({ data: { getPlayerCommunityStats: payload } });

  const wrapper = await mountSuspended(PlayerCommunityHistory, {
    props: { steamId: "76561198041234567" },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();

  return { wrapper, query };
}

describe("PlayerCommunityHistory", () => {
  it("renders a non-moderator payload as totals and a relative last seen, with no session, name or IP controls", async () => {
    const { wrapper, query } = await mountHistory(stats(false));

    expect(query.mock.calls[0][0].variables).toEqual({
      steamId: "76561198041234567",
    });
    expect(tile(wrapper, "time")).toContain("11h 42m");
    expect(tile(wrapper, "kills")).toContain("412");
    expect(tile(wrapper, "kills")).toContain("1.21 K/D");
    expect(tile(wrapper, "last-seen")).toMatch(/2\W*h.*ago/);
    expect(wrapper.find('[data-server-id="server-retake"]').text()).toContain(
      "Retake #1",
    );
    expect(wrapper.find('[data-server-id="server-retake"]').text()).toContain(
      "#3",
    );

    expect(wrapper.find("button[aria-expanded]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Names Used");
    expect(wrapper.find('[data-testid="community-ip-section"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain("203.0.113.24");
  });

  it("gives a moderator exact times, names used, sessions and the shared-IP panel", async () => {
    const { wrapper } = await mountHistory(stats(true));

    expect(tile(wrapper, "last-seen")).not.toContain("ago");
    expect(wrapper.text()).toContain("Names Used");
    expect(wrapper.text()).toContain("nyx | 5stack.gg");

    const expand = wrapper.find(
      'button[aria-label="Show sessions on Retake #1"]',
    );
    expect(expand.attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('[data-sessions-for="server-retake"]').exists()).toBe(
      false,
    );

    await expand.trigger("click");
    await flushPromises();

    const sessions = wrapper.find('[data-sessions-for="server-retake"]');
    expect(expand.attributes("aria-expanded")).toBe("true");
    expect(sessions.text()).toContain("Moderators only");
    expect(sessions.text()).toContain("203.0.113.24");
    expect(sessions.findAll("[data-alt-ip]").map((ip) => ip.text())).toEqual([
      "198.51.100.58",
    ]);

    const panel = wrapper.find('[data-testid="community-ip-section"]');
    expect(panel.exists()).toBe(true);
    expect(panel.find('[data-match="76561199433310288"]').text()).toContain(
      "Steam only",
    );
    expect(panel.find('[data-match="76561199433310288"]').text()).toContain(
      "Online",
    );
    expect(panel.find('[data-match="76561199077712345"]').text()).toContain(
      "Banned",
    );
    expect(panel.find('[data-testid="community-ips"]').text()).toContain(
      "203.0.113.24 · 17 sessions",
    );
  });

  it("switches the tiles and table to all-time totals", async () => {
    const { wrapper } = await mountHistory(stats(false));

    const allTime = wrapper
      .findAll("button")
      .find((button) => button.text() === "All Time");
    await allTime!.trigger("click");
    await flushPromises();

    expect(tile(wrapper, "time")).toContain("186h 10m");
    expect(tile(wrapper, "kills")).toContain("7,903");
  });

  it("says so when the player has never been on a community server", async () => {
    const { wrapper } = await mountHistory({
      ...stats(false),
      week: totals({ sessions: 0, seconds: 0, kills: 0, servers: 0 }),
      all_time: totals({ sessions: 0, seconds: 0, kills: 0, servers: 0 }),
      last_seen_at: null,
      servers: [],
    });

    expect(wrapper.find('[data-testid="community-empty"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-tile="time"]').exists()).toBe(false);
  });
});
