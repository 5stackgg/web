import { dateLocale } from "~/utilities/dateLocale";
import type { FacetSelection } from "~/components/admin/facets";

export const SERVER_PAGE_SIZE = 25;

export const SERVER_STATES = [
  "attention",
  "offline",
  "inuse",
  "ready",
  "hibernating",
  "disabled",
] as const;
export type ServerState = (typeof SERVER_STATES)[number];

/** Disabled servers are hidden until asked for. */
export const DEFAULT_SERVER_STATES: string[] = SERVER_STATES.filter(
  (state) => state !== "disabled",
);

export type FleetContext = {
  currentPluginVersion?: string | null;
  pluginRuntime?: string | null;
  /** Live player counts by server id, from getDedicatedServerInfo. */
  players?: Map<string, number>;
  now?: number;
};

export type ServerTone = "ok" | "warn" | "bad" | "off" | "info";

export type ServerStatus = {
  tone: ServerTone;
  /** i18n key and values for the status word. */
  word: [string, Record<string, unknown>?];
  tip: [string, Record<string, unknown>?];
  live: boolean;
  /** A second line under the word, e.g. when a disabled server went offline. */
  sub?: [string, Record<string, unknown>?];
};

// Mirrors ServerStatus.vue: only Ranked servers on the app's runtime are held
// to the current plugin version.
export function pluginOutdated(server: any, ctx: FleetContext): boolean {
  if (server?.type !== "Ranked" || !ctx.currentPluginVersion) return false;
  if (server.plugin_runtime && server.plugin_runtime !== ctx.pluginRuntime) {
    return false;
  }
  return server.plugin_version != ctx.currentPluginVersion;
}

export function playersOf(server: any, ctx: FleetContext): number {
  return ctx.players?.get(server?.id) ?? 0;
}

const inUse = (server: any, ctx: FleetContext) =>
  !!server?.current_match || playersOf(server, ctx) > 0;

export function serverState(server: any, ctx: FleetContext): ServerState {
  if (!server?.enabled) return "disabled";
  if (
    server.connected &&
    (!server.rcon_status || pluginOutdated(server, ctx))
  ) {
    return "attention";
  }
  if (!server.connected) return "offline";
  if (inUse(server, ctx)) return "inuse";
  return server.hibernating ? "hibernating" : "ready";
}

/** "14:02" within the last 18 hours, a date before that. */
export function offlineSince(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (now - date.getTime() < 18 * 60 * 60 * 1000) {
    return date.toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}

export function serverStatus(server: any, ctx: FleetContext): ServerStatus {
  const now = ctx.now ?? Date.now();
  const since = server?.offline_at ? offlineSince(server.offline_at, now) : "";
  if (!server?.enabled) {
    return {
      tone: "off",
      word: ["common.disabled"],
      tip: ["pages.dedicated_servers.tip_disabled"],
      live: false,
      sub:
        !server?.connected && since
          ? ["pages.dedicated_servers.status_offline_since", { time: since }]
          : undefined,
    };
  }
  if (!server.connected) {
    return {
      tone: "bad",
      word: since
        ? ["pages.dedicated_servers.status_offline_since", { time: since }]
        : ["common.offline"],
      tip: ["pages.dedicated_servers.detail.status.disconnected"],
      live: false,
    };
  }
  if (!server.rcon_status) {
    return {
      tone: "warn",
      word: ["pages.dedicated_servers.detail.status_label.no_rcon"],
      tip: ["pages.dedicated_servers.detail.status.no_rcon"],
      live: false,
    };
  }
  if (pluginOutdated(server, ctx)) {
    return {
      tone: "warn",
      word: ["pages.dedicated_servers.status_plugin_outdated"],
      tip: [
        "pages.dedicated_servers.plugin_outdated_tip",
        { version: ctx.currentPluginVersion },
      ],
      live: false,
    };
  }
  if (server.current_match) {
    return {
      tone: "ok",
      word: ["pages.dedicated_servers.status_in_match"],
      tip: ["pages.dedicated_servers.detail.status.connected"],
      live: true,
    };
  }
  const players = playersOf(server, ctx);
  if (players > 0) {
    return {
      tone: "ok",
      word: ["pages.dedicated_servers.status_playing", { count: players }],
      tip: ["pages.dedicated_servers.detail.status.connected"],
      live: true,
    };
  }
  if (server.hibernating) {
    return {
      tone: "info",
      word: ["pages.dedicated_servers.detail.status_label.hibernating"],
      tip: ["pages.dedicated_servers.detail.status.hibernating"],
      live: false,
    };
  }
  return {
    tone: "ok",
    word: ["pages.dedicated_servers.detail.status_label.connected"],
    tip: ["pages.dedicated_servers.detail.status.connected"],
    live: false,
  };
}

export function serverType(server: any): string {
  if (server?.type === "Custom" && server.game_mode?.name) {
    return server.game_mode.name;
  }
  if (server?.type === "ArmsRace") return "Arms Race";
  return server?.type ?? "";
}

export function hostKey(server: any): string {
  return server?.game_server_node_id
    ? `node:${server.game_server_node_id}`
    : `ext:${server?.host ?? ""}`;
}

export function hostLabel(server: any): string {
  if (server?.game_server_node_id) {
    return server.game_server_node?.label || server.game_server_node_id;
  }
  return server?.host ?? "";
}

export function pluginKey(server: any): string {
  return server?.plugin_version || "none";
}

export function versionRank(version: string | null | undefined): number {
  if (!version || version === "none") return -2;
  if (!/^\d/.test(version)) return -1;
  return version
    .split(".")
    .slice(0, 4)
    .reduce((rank, part) => rank * 1000 + (Number.parseInt(part, 10) || 0), 0);
}

export function serverAddress(server: any): string {
  return `${server?.host ?? ""}:${server?.port ?? ""}`;
}

export function serverFacetValues(
  server: any,
  key: string,
  ctx: FleetContext,
): string {
  if (key === "state") return serverState(server, ctx);
  if (key === "type") return serverType(server);
  if (key === "region") return server?.region ?? "";
  if (key === "host") return hostKey(server);
  if (key === "plugin") return pluginKey(server);
  return "";
}

export function matchesServerSearch(server: any, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [
    server?.label,
    serverAddress(server),
    serverType(server),
    server?.region,
    server?.server_region?.description,
    hostLabel(server),
    server?.game_server_node?.node_ip,
  ].some((value) => value && String(value).toLowerCase().includes(q));
}

const SERVER_SORT_KEYS = [
  "server",
  "status",
  "type",
  "hosting",
  "players",
  "plugin",
  "ports",
  "enabled",
] as const;
export type ServerSortKey = (typeof SERVER_SORT_KEYS)[number];
export type ServerSort = { key: ServerSortKey; dir: 1 | -1 };

export const SERVER_VIEW_STORAGE_KEY = "dedicated-servers-view";

export type ServerView = {
  search: string;
  facets: FacetSelection;
  sort: ServerSort;
};

/**
 * The list's last search, filters and sort, so a refresh or a return lands
 * where the admin left it. Anything unreadable falls back to `defaults`, and
 * only the facet groups `defaults` knows are restored.
 */
export function readServerView(defaults: ServerView): ServerView {
  try {
    const raw = JSON.parse(
      localStorage.getItem(SERVER_VIEW_STORAGE_KEY) || "null",
    );
    if (!raw || typeof raw !== "object") return defaults;
    const facets: FacetSelection = { ...defaults.facets };
    for (const key of Object.keys(facets)) {
      const values = raw.facets?.[key];
      if (Array.isArray(values)) {
        facets[key] = values.filter((v: unknown) => typeof v === "string");
      }
    }
    const sort =
      SERVER_SORT_KEYS.includes(raw.sort?.key) &&
      (raw.sort.dir === 1 || raw.sort.dir === -1)
        ? { key: raw.sort.key, dir: raw.sort.dir }
        : defaults.sort;
    return {
      search: typeof raw.search === "string" ? raw.search : defaults.search,
      facets,
      sort,
    };
  } catch {
    return defaults;
  }
}

export function saveServerView(view: ServerView) {
  try {
    localStorage.setItem(SERVER_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {}
}

export function sortServers(
  list: any[],
  sort: ServerSort,
  ctx: FleetContext,
): any[] {
  const value = (server: any): string | number => {
    switch (sort.key) {
      case "status":
        return SERVER_STATES.indexOf(serverState(server, ctx));
      case "type":
        return serverType(server).toLowerCase();
      case "hosting":
        return `${server.game_server_node_id ? 0 : 1}${hostLabel(server).toLowerCase()}`;
      case "players":
        return server.enabled && server.connected ? playersOf(server, ctx) : -1;
      case "plugin":
        return versionRank(server.plugin_version);
      case "ports":
        return Number(server.port) || 0;
      case "enabled":
        return server.enabled ? 0 : 1;
      default:
        return String(server.label ?? "").toLowerCase();
    }
  };
  return [...list].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    const order = x < y ? -1 : x > y ? 1 : 0;
    return (
      order * sort.dir ||
      String(a.label ?? "").localeCompare(String(b.label ?? ""))
    );
  });
}
