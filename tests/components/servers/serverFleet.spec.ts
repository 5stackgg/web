import { describe, expect, it } from "vitest";
import {
  hostKey,
  hostLabel,
  matchesServerSearch,
  readServerView,
  saveServerView,
  SERVER_VIEW_STORAGE_KEY,
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
      sortServers(list, { key: "status", dir: 1 }, ctx).map((s) => s.label),
    ).toEqual(["A offline", "A ready", "B ready", "C disabled"]);
    expect(
      sortServers(list, { key: "server", dir: -1 }, ctx).map((s) => s.label),
    ).toEqual(["C disabled", "B ready", "A ready", "A offline"]);
  });
});

describe("remembered list view", () => {
  const defaults = {
    search: "",
    facets: { state: ["ready"], type: [], host: [] },
    sort: { key: "status" as const, dir: 1 as const },
  };

  it("restores the last search, filters and sort", () => {
    localStorage.clear();
    saveServerView({
      search: "pistols",
      facets: { state: ["ready", "disabled"], type: ["Deathmatch"], host: [] },
      sort: { key: "players", dir: -1 },
    });
    expect(readServerView(defaults)).toEqual({
      search: "pistols",
      facets: { state: ["ready", "disabled"], type: ["Deathmatch"], host: [] },
      sort: { key: "players", dir: -1 },
    });
  });

  it("falls back on anything it can't read, and drops unknown groups", () => {
    localStorage.clear();
    expect(readServerView(defaults)).toEqual(defaults);
    localStorage.setItem(SERVER_VIEW_STORAGE_KEY, "{not json");
    expect(readServerView(defaults)).toEqual(defaults);
    localStorage.setItem(
      SERVER_VIEW_STORAGE_KEY,
      JSON.stringify({
        facets: { state: "ready", gone: ["x"], type: ["Ranked", 4] },
        sort: { key: "nope", dir: 1 },
      }),
    );
    expect(readServerView(defaults)).toEqual({
      search: "",
      facets: { state: ["ready"], type: ["Ranked"], host: [] },
      sort: { key: "status", dir: 1 },
    });
  });
});
