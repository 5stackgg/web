import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerPlayerManagement from "~/components/servers/ServerPlayerManagement.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const state = vi.hoisted(() => ({
  server: null as Record<string, unknown> | null,
  roster: null as Record<string, unknown> | null,
  pushRoster: null as
    | ((roster: Record<string, unknown> | null) => void)
    | null,
}));

vi.mock("~/graphql/getGraphqlClient", async () => {
  const { print } = await import("graphql");

  return {
    default: () => ({
      query: async () => ({ data: {} }),
      subscribe: ({ query }: any) => ({
        subscribe: ({ next }: any) => {
          const text = typeof query === "string" ? query : print(query);

          if (text.includes("server_rosters_by_pk")) {
            state.pushRoster = (roster) =>
              next({ data: { server_rosters_by_pk: roster } });
            next({ data: { server_rosters_by_pk: state.roster } });

            return { unsubscribe() {} };
          }

          next({
            data: text.includes("player_management_seen_at")
              ? { servers_by_pk: state.server }
              : {},
          });

          return { unsubscribe() {} };
        },
      }),
    }),
  };
});

const community = (seenAt: string | null) => ({
  id: "server-1",
  type: "Casual",
  game: "cs2",
  is_dedicated: true,
  player_management_version: seenAt ? "0.0.412" : null,
  player_management_runtime: seenAt ? "swiftlys2" : null,
  player_management_seen_at: seenAt,
});

let unmount: (() => void) | null = null;

async function mountCard(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ServerPlayerManagement, {
    props: { serverId: "server-1", ...props },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function warning(wrapper: Awaited<ReturnType<typeof mountCard>>) {
  return wrapper.find('[data-testid="plugin-warning"]');
}

function lastStatus(wrapper: Awaited<ReturnType<typeof mountCard>>) {
  const events = wrapper.emitted("status") ?? [];
  return events[events.length - 1]?.[0] as Record<string, unknown>;
}

// A browser can't focus reka's popper wrapper (a plain div), but happy-dom
// can, and the focusin it fires lands outside the popover and dismisses one
// with nothing focusable inside the moment it opens.
const focus = HTMLElement.prototype.focus;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (!this.hasAttribute("data-reka-popper-content-wrapper")) {
      focus.call(this, options);
    }
  });
  state.server = null;
  state.roster = null;
  state.pushRoster = null;
  vi.spyOn(
    useApplicationSettingsStore(),
    "latestPluginVersion",
  ).mockImplementation((runtime: string) =>
    runtime === "swiftlys2" ? "0.0.412" : "0.0.390",
  );
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: "administrator",
  } as any;
});

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServerPlayerManagement plugin status", () => {
  it("shows only Live while the plugin reports players, and hands the version to the page", async () => {
    state.server = community(new Date().toISOString());
    state.roster = roster([]);

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(wrapper.find('[data-testid="roster-live"]').exists()).toBe(true);
    expect(warning(wrapper).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("v0.0.412");
    expect(lastStatus(wrapper)).toMatchObject({
      community: true,
      pluginActive: true,
      pluginVersion: "v0.0.412",
      pluginRuntime: "SwiftlyS2",
    });
  });

  it("keeps a plugin that isn't reporting players behind a warning triangle, not a banner", async () => {
    state.server = community(new Date().toISOString());

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    expect(warning(wrapper).attributes("aria-label")).toBe(
      "The Player Management plugin isn't reporting players yet, so the roster is read over RCON every 30 seconds and no history is recorded.",
    );
    expect(wrapper.text()).not.toContain("isn't reporting players");
    expect(wrapper.find('[data-testid="poll-notice"]').exists()).toBe(false);
  });

  it("treats a heartbeat older than a few minutes as the plugin being gone", async () => {
    state.server = community(
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    );

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    const label = warning(wrapper).attributes("aria-label");
    expect(label).toContain("Player Management plugin not detected.");
    expect(label).toContain("switch the server off and back on");
    expect(label).not.toContain("install steps");
    expect(lastStatus(wrapper).pluginActive).toBe(false);
  });

  it("stays quiet about a missing plugin while the server is offline", async () => {
    state.server = community(null);

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(warning(wrapper).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("has not checked in");
  });

  it("sends an administrator from the warning to the install steps on a server outside a node", async () => {
    state.server = community(null);

    const push = vi.spyOn(useRouter(), "push").mockResolvedValue(undefined);
    const wrapper = await mountCard({ gameServerNodeId: null, online: true });

    expect(warning(wrapper).attributes("aria-label")).toContain(
      "Click to open the install steps in Settings.",
    );

    await warning(wrapper).trigger("click");

    expect(push).toHaveBeenCalledWith({
      query: expect.objectContaining({
        tab: "settings",
        settings: "player-management",
      }),
    });
  });

  it("never points someone who is not an administrator at the install steps", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000002",
      role: "moderator",
    } as any;
    state.server = community(null);

    const push = vi.spyOn(useRouter(), "push").mockResolvedValue(undefined);
    const wrapper = await mountCard({ gameServerNodeId: null, online: true });

    expect(warning(wrapper).attributes("aria-label")).toContain(
      "installed on this server",
    );
    expect(warning(wrapper).attributes("aria-label")).not.toContain(
      "install steps",
    );

    await warning(wrapper).trigger("click");

    expect(push).not.toHaveBeenCalled();
  });

  it("says nothing about the plugin on a Ranked server", async () => {
    state.server = { ...community(null), type: "Ranked" };

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    expect(warning(wrapper).exists()).toBe(false);
  });
});

type Session = {
  id: number;
  player_steam_id: string;
  name: string;
  ip: string | null;
  player: Record<string, unknown> | null;
};

const MINUTE = 60 * 1000;

function session(
  id: number,
  steamId: string,
  name: string,
  ip: string | null,
  player: Record<string, unknown> | null = null,
): Session {
  return { id, player_steam_id: steamId, name, ip, player };
}

function account(steamId: string, name: string, extra = {}) {
  return {
    steam_id: steamId,
    name,
    avatar_url: null,
    is_registered: true,
    is_banned: false,
    is_muted: false,
    is_gagged: false,
    vac_banned: false,
    vac_ban_count: 0,
    game_ban_count: 0,
    ...extra,
  };
}

function roster(sessions: Session[], reportedAgoMs = 5 * 1000) {
  return {
    server_id: "server-1",
    reported_at: new Date(Date.now() - reportedAgoMs).toISOString(),
    sessions: sessions.map((entry) => ({
      kills: 0,
      deaths: 0,
      started_at: new Date(Date.now() - 23 * MINUTE).toISOString(),
      ...entry,
    })),
  };
}

function operationName(query: any) {
  return query.definitions[0]?.name?.value;
}

function mockRcon(
  players: Array<{ steam_id: string; name: string }>,
  registered: Array<Record<string, unknown>> = [],
) {
  const calls: string[] = [];

  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "query",
  ).mockImplementation(async ({ query }: any) => {
    const name = operationName(query);
    calls.push(name);

    if (name === "ServerManagementPlayers") {
      return { data: { getDedicatedServerPlayers: players } };
    }

    return { data: { players: registered } };
  });

  return () =>
    calls.filter((call) => call === "ServerManagementPlayers").length;
}

function useFakeClock() {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
}

async function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushPromises();
}

function row(wrapper: Awaited<ReturnType<typeof mountCard>>, steamId: string) {
  return wrapper.find(`[data-steam-id="${steamId}"]`);
}

describe("ServerPlayerManagement live roster", () => {
  it("renders the plugin roster from the subscription and never polls RCON", async () => {
    useFakeClock();
    const rconPolls = mockRcon([]);
    state.roster = roster([
      session(
        1,
        "76561198000000011",
        "nyx | 5stack.gg",
        "203.0.113.24",
        account("76561198000000011", "nyx"),
      ),
      session(2, "76561198000000012", "kebab_king", "192.0.2.44"),
    ]);

    const wrapper = await mountCard({ online: true });

    expect(wrapper.find('[data-testid="roster-live"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(true);
    expect(row(wrapper, "76561198000000011").text()).toContain("nyx");
    expect(row(wrapper, "76561198000000011").text()).toContain(
      'in-game "nyx | 5stack.gg"',
    );
    expect(row(wrapper, "76561198000000012").text()).toContain("kebab_king");
    expect(row(wrapper, "76561198000000011").text()).toContain("23m");
    expect(wrapper.find('button[aria-label="Refresh"]').exists()).toBe(false);

    await advance(65 * 1000);

    expect(rconPolls()).toBe(0);
    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(true);
    expect(row(wrapper, "76561198000000011").text()).toContain("24m");
  });

  it("falls back to the RCON poll when the plugin roster is stale", async () => {
    const rconPolls = mockRcon([
      { steam_id: "76561198000000021", name: "rcon-only" },
    ]);
    state.roster = roster(
      [session(1, "76561198000000011", "ghost", "203.0.113.24")],
      10 * MINUTE,
    );

    const wrapper = await mountCard({ online: true });

    expect(rconPolls()).toBe(1);
    expect(wrapper.find('[data-testid="roster-live"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("rcon-only");
    expect(wrapper.text()).not.toContain("ghost");
    expect(wrapper.find('button[aria-label="Refresh"]').exists()).toBe(true);
  });

  it("goes live on a changed reported_at whatever the client clock says, then back to RCON once the pushes stop", async () => {
    useFakeClock();
    const rconPolls = mockRcon([
      { steam_id: "76561198000000011", name: "nyx" },
    ]);
    const nyx = session(1, "76561198000000011", "nyx", null);
    state.roster = roster([nyx], 10 * MINUTE);

    const wrapper = await mountCard({ online: true });

    expect(rconPolls()).toBe(1);
    expect(wrapper.find('[data-testid="polled-roster"]').exists()).toBe(true);

    state.pushRoster?.(roster([nyx], 9 * MINUTE));
    await flushPromises();

    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(true);

    await advance(2 * MINUTE);

    expect(rconPolls()).toBe(1);
    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(true);

    await advance(MINUTE + 1000);

    expect(rconPolls()).toBe(2);
    expect(wrapper.find('[data-testid="polled-roster"]').exists()).toBe(true);
    expect(row(wrapper, "76561198000000011").exists()).toBe(true);

    await advance(30 * 1000);

    expect(rconPolls()).toBe(3);
  });

  it("starts polling RCON the moment the plugin stops reporting", async () => {
    const rconPolls = mockRcon([]);
    state.roster = roster([session(1, "76561198000000011", "nyx", null)]);

    const wrapper = await mountCard({ online: true });

    expect(rconPolls()).toBe(0);

    state.pushRoster?.(null);
    await flushPromises();

    expect(rconPolls()).toBe(1);
    expect(wrapper.find('[data-testid="live-roster"]').exists()).toBe(false);
  });

  it("tells the page when someone joins or leaves, not on every report", async () => {
    mockRcon([]);
    const first = session(1, "76561198000000011", "nyx", null);
    state.roster = roster([first]);

    const wrapper = await mountCard({ online: true });

    state.pushRoster?.(roster([first]));
    await flushPromises();
    expect(wrapper.emitted("roster-change")).toBeUndefined();

    state.pushRoster?.(
      roster([first, session(2, "76561198000000012", "Vex", null)]),
    );
    await flushPromises();
    expect(wrapper.emitted("roster-change")).toHaveLength(1);
  });

  it("keeps the live row geometry on RCON, with n/a for what RCON can't tell", async () => {
    state.server = community(null);
    mockRcon(
      [
        { steam_id: "76561198000000031", name: "Mika" },
        { steam_id: "76561198000000032", name: "lil_flick" },
      ],
      [
        account("76561198000000031", "Mika"),
        account("76561198000000032", "lil_flick", { is_registered: false }),
      ],
    );

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    expect(warning(wrapper).attributes("aria-label")).toContain(
      "Player Management plugin not detected. The roster is read over RCON every 30 seconds",
    );

    const mika = row(wrapper, "76561198000000031");
    expect(mika.text()).toContain("Connected");
    expect(mika.text().match(/n\/a/g)).toHaveLength(2);
    expect(mika.find('a[href="/players/76561198000000031"]').exists()).toBe(
      true,
    );
    expect(row(wrapper, "76561198000000032").text()).toContain("Steam only");
  });
});

describe("ServerPlayerManagement player states", () => {
  it("says when the last player left an empty community server", async () => {
    state.server = community(new Date().toISOString());
    state.roster = roster([]);
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "query",
    ).mockImplementation(async ({ query }: any) =>
      operationName(query) === "ServerLastSeen"
        ? {
            data: {
              server_recent_players: [
                {
                  last_seen_at: new Date(
                    Date.now() - 14 * MINUTE - 30 * 1000,
                  ).toISOString(),
                },
              ],
            },
          }
        : { data: {} },
    );

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      maxPlayers: 24,
    });
    const empty = wrapper.find('[data-testid="roster-empty"]');

    expect(wrapper.find('[data-testid="roster-count"]').text()).toBe(
      "0 / 24",
    );
    expect(empty.text()).toContain("No players currently on this server");
    expect(empty.text()).toMatch(/Last player left 14 min/);
  });

  it("shows one sanction pill for the worst active sanction and counts the rest", async () => {
    mockRcon([]);
    state.roster = roster([
      session(
        1,
        "76561198000000011",
        "dazed.",
        "198.51.100.212",
        account("76561198000000011", "dazed.", {
          is_muted: true,
          is_gagged: true,
        }),
      ),
    ]);

    const wrapper = await mountCard({ online: true });
    const text = row(wrapper, "76561198000000011").text();

    expect(text).toContain("Muted");
    expect(text).toContain("+1");
    expect(text).not.toContain("Gagged");
  });

  it("marks a player without a 5stack account as Steam only, without a tag", async () => {
    mockRcon([]);
    state.roster = roster([
      session(1, "76561198000000012", "Tarik's Cousin", "198.51.100.7"),
      session(
        2,
        "76561198000000013",
        "imported",
        "198.51.100.8",
        account("76561198000000013", "Seen Once", { is_registered: false }),
      ),
    ]);

    const wrapper = await mountCard({ online: true });

    for (const steamId of ["76561198000000012", "76561198000000013"]) {
      const stranger = row(wrapper, steamId);

      expect(stranger.text()).toContain(`Steam only · ${steamId}`);
      expect(
        stranger.find('[data-testid="steam-only-avatar"]').exists(),
      ).toBe(true);
      expect(stranger.find('a[href^="/players/"]').exists()).toBe(false);
    }

    expect(row(wrapper, "76561198000000013").text()).toContain("imported");
  });

  it("turns an IP shared with someone else on the server amber with a count", async () => {
    mockRcon([]);
    state.roster = roster([
      session(
        1,
        "76561198000000011",
        "nyx",
        "203.0.113.24",
        account("76561198000000011", "nyx"),
      ),
      session(2, "76561198000000013", "smurfacc", "203.0.113.24"),
      session(
        3,
        "76561198000000014",
        "Mika",
        "203.0.113.150",
        account("76561198000000014", "Mika"),
      ),
    ]);

    const wrapper = await mountCard({ online: true });
    const shared = row(wrapper, "76561198000000011").find("[data-shared-ip]");

    expect(shared.exists()).toBe(true);
    expect(shared.text()).toContain("203.0.113.24");
    expect(shared.text()).toContain("×2");
    expect(shared.attributes("aria-label")).toContain(
      "Also on this server now: smurfacc",
    );
    expect(
      row(wrapper, "76561198000000013").find("[data-shared-ip]").exists(),
    ).toBe(true);
    expect(
      row(wrapper, "76561198000000014").find("[data-shared-ip]").exists(),
    ).toBe(false);
    expect(row(wrapper, "76561198000000014").text()).toContain(
      "203.0.113.150",
    );
  });
});
