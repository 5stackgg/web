import { describe, expect, it } from "vitest";
import { nextSort } from "~/components/admin/sort";
import {
  hostKey,
  hostLabel,
  LEGACY_SERVER_VIEW_KEY,
  matchesServerSearch,
  rememberServerView,
  restoreServerView,
  SERVER_SORT_NATURAL_DIRS,
  serverViewDefaults,
  pluginOutdated,
  serverFacetValues,
  serverState,
  serverStatus,
  serverType,
  sortServers,
  versionRank,
  type FleetContext,
} from "~/components/servers/serverFleet";

const ctx: FleetContext = {
  currentPluginVersion: "1.8.3",
  pluginRuntime: "swiftlys2",
  players: new Map([["busy", 4]]),
  now: Date.UTC(2026, 9, 16, 15, 0),
};

const server = (extra: Record<string, unknown> = {}) => ({
  id: "s",
  label: "Ranked #1",
  host: "10.0.0.5",
  port: 27015,
  type: "Ranked",
  enabled: true,
  connected: true,
  rcon_status: true,
  hibernating: false,
  plugin_version: "1.8.3",
  plugin_runtime: null,
  current_match: null,
  ...extra,
});

describe("serverState", () => {
  it("derives each state", () => {
    expect(serverState(server({ enabled: false }), ctx)).toBe("disabled");
    expect(serverState(server({ connected: false }), ctx)).toBe("offline");
    expect(serverState(server({ rcon_status: false }), ctx)).toBe("attention");
    expect(serverState(server({ plugin_version: "1.8.2" }), ctx)).toBe(
      "attention",
    );
    expect(serverState(server({ current_match: { id: "m" } }), ctx)).toBe(
      "inuse",
    );
    expect(serverState(server({ id: "busy" }), ctx)).toBe("inuse");
    expect(serverState(server({ hibernating: true }), ctx)).toBe("hibernating");
    expect(serverState(server(), ctx)).toBe("ready");
  });

  it("holds only Ranked servers on the app runtime to the current plugin", () => {
    expect(pluginOutdated(server({ plugin_version: "1.8.2" }), ctx)).toBe(true);
    expect(
      pluginOutdated(server({ type: "Casual", plugin_version: "1.0.0" }), ctx),
    ).toBe(false);
    expect(
      pluginOutdated(
        server({
          plugin_version: "1.0.0",
          plugin_runtime: "counterstrikesharp",
        }),
        ctx,
      ),
    ).toBe(false);
  });
});

describe("serverStatus", () => {
  it("says how long an offline server has been gone", () => {
    const status = serverStatus(
      server({
        connected: false,
        offline_at: new Date(ctx.now! - 60 * 60 * 1000).toISOString(),
      }),
      ctx,
    );
    expect(status.tone).toBe("bad");
    expect(status.word[0]).toBe("pages.dedicated_servers.status_offline_since");
    expect(status.word[1]?.time).toBeTruthy();
  });

  it("is live only while in use", () => {
    expect(serverStatus(server({ id: "busy" }), ctx)).toMatchObject({
      tone: "ok",
      live: true,
      word: ["pages.dedicated_servers.status_playing", { count: 4 }],
    });
    expect(serverStatus(server(), ctx).live).toBe(false);
    expect(serverStatus(server({ enabled: false }), ctx).tone).toBe("off");
  });
});

describe("facets, search and sort", () => {
  const node = server({
    id: "n",
    label: "Node box",
    game_server_node_id: "node-1",
    game_server_node: { label: "fra-1", node_ip: "192.168.1.9" },
  });
  const custom = server({
    id: "c",
    label: "Retakes",
    type: "Custom",
    game_mode: { name: "Retake" },
  });

  it("names types, hosts and versions", () => {
    expect(serverType(custom)).toBe("Retake");
    expect(serverType(server({ type: "ArmsRace" }))).toBe("Arms Race");
    expect(hostKey(node)).toBe("node:node-1");
    expect(hostLabel(node)).toBe("fra-1");
    expect(hostKey(server())).toBe("ext:10.0.0.5");
    expect(
      serverFacetValues(server({ plugin_version: null }), "plugin", ctx),
    ).toBe("none");
    expect(versionRank("1.10.0")).toBeGreaterThan(versionRank("1.9.9"));
  });

  it("searches label, address, host and node ip", () => {
    expect(matchesServerSearch(node, "fra-1")).toBe(true);
    expect(matchesServerSearch(node, "192.168")).toBe(true);
    expect(matchesServerSearch(server(), "10.0.0.5:27015")).toBe(true);
    expect(matchesServerSearch(server(), "nope")).toBe(false);
  });

  it("sorts by status first, then by label", () => {
    const list = [
      server({ id: "a", label: "B ready" }),
      server({ id: "b", label: "A offline", connected: false }),
      server({ id: "c", label: "C disabled", enabled: false }),
      server({ id: "d", label: "A ready" }),
    ];
    expect(
      sortServers(list, { key: "status", dir: "asc" }, ctx).map((s) => s.label),
    ).toEqual(["A offline", "A ready", "B ready", "C disabled"]);
    expect(
      sortServers(list, { key: "server", dir: "desc" }, ctx).map(
        (s) => s.label,
      ),
    ).toEqual(["C disabled", "B ready", "A ready", "A offline"]);
  });

  it("starts players and plugin largest first", () => {
    const from = { key: "status" as const, dir: "asc" as const };
    expect(nextSort(from, "players", SERVER_SORT_NATURAL_DIRS)).toEqual({
      key: "players",
      dir: "desc",
    });
    expect(nextSort(from, "server", SERVER_SORT_NATURAL_DIRS)).toEqual({
      key: "server",
      dir: "asc",
    });
  });
});

describe("remembered list view", () => {
  const STORED = "admin-view:dedicated-servers";
  const facets = (extra: Record<string, string[]> = {}) => ({
    ...serverViewDefaults().facets,
    ...extra,
  });

  it("restores the last search, filters and sort", () => {
    localStorage.clear();
    const view = {
      search: "pistols",
      facets: facets({ state: ["ready", "disabled"], type: ["Deathmatch"] }),
      sort: { key: "players" as const, dir: "desc" as const },
    };
    rememberServerView(view);
    expect(restoreServerView()).toEqual(view);
  });

  it("falls back field by field on anything it can't read", () => {
    localStorage.clear();
    expect(restoreServerView()).toEqual(serverViewDefaults());
    localStorage.setItem(STORED, "{not json");
    expect(restoreServerView()).toEqual(serverViewDefaults());
    localStorage.setItem(
      STORED,
      JSON.stringify({
        search: 4,
        facets: {
          state: ["ready", "bogus"],
          gone: ["x"],
          type: ["Ranked", 4],
          host: "x",
        },
        sort: { key: "nope", dir: "asc" },
      }),
    );
    expect(restoreServerView()).toEqual({
      search: "",
      facets: facets({ state: ["ready"], type: ["Ranked"] }),
      sort: { key: "status", dir: "asc" },
    });
  });

  it("moves the old dedicated-servers-view over once and drops it", () => {
    localStorage.clear();
    localStorage.setItem(
      LEGACY_SERVER_VIEW_KEY,
      JSON.stringify({
        search: "fra",
        facets: { state: ["offline"], type: [], host: [] },
        sort: { key: "players", dir: -1 },
      }),
    );
    const restored = {
      search: "fra",
      facets: facets({ state: ["offline"] }),
      sort: { key: "players", dir: "desc" },
    };
    expect(restoreServerView()).toEqual(restored);
    expect(localStorage.getItem(LEGACY_SERVER_VIEW_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORED)!).sort).toEqual(
      restored.sort,
    );
    expect(restoreServerView()).toEqual(restored);
  });

  it("never lets the old key overwrite a newer view", () => {
    localStorage.clear();
    rememberServerView({ ...serverViewDefaults(), search: "new" });
    localStorage.setItem(
      LEGACY_SERVER_VIEW_KEY,
      JSON.stringify({ search: "old" }),
    );
    expect(restoreServerView().search).toBe("new");
    expect(localStorage.getItem(LEGACY_SERVER_VIEW_KEY)).toBeNull();
  });
});
