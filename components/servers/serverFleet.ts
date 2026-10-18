import { dateLocale } from "~/utilities/dateLocale";
import type { FacetSelection } from "~/components/admin/facets";
import type { SortDir, SortState } from "~/components/admin/sort";
import {
  readRememberedView,
  rememberedViewStorageKey,
  saveRememberedView,
  type ViewValidators,
} from "~/composables/useRememberedView";

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

// Only Ranked servers on the app's runtime are held
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
export type ServerSort = SortState<ServerSortKey>;

/** Players and plugin versions start largest first. */
export const SERVER_SORT_NATURAL_DIRS: Partial<Record<ServerSortKey, SortDir>> =
  { players: "desc", plugin: "desc" };

/** The list's remembered view: `admin-view:dedicated-servers`. */
export const SERVER_VIEW_KEY = "dedicated-servers";
export const LEGACY_SERVER_VIEW_KEY = "dedicated-servers-view";

export type ServerView = {
  search: string;
  facets: FacetSelection;
  sort: ServerSort;
};

export const serverViewDefaults = (): ServerView => ({
  search: "",
  facets: {
    state: [...DEFAULT_SERVER_STATES],
    type: [],
    region: [],
    host: [],
    plugin: [],
  },
  sort: { key: "status", dir: "asc" },
});

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const serverViewValidators: ViewValidators<ServerView> = {
  search: (value) => typeof value === "string",
  facets: isRecord,
  sort: (value) =>
    isRecord(value) &&
    (SERVER_SORT_KEYS as readonly unknown[]).includes(value.key) &&
    (value.dir === "asc" || value.dir === "desc"),
};

// Only the groups the defaults name, each a list of strings; a status the
// list doesn't know is dropped.
function cleanFacets(
  facets: FacetSelection,
  defaults: FacetSelection,
): FacetSelection {
  const clean: FacetSelection = {};
  for (const [group, fallback] of Object.entries(defaults)) {
    const values = (facets as Record<string, unknown>)[group];
    clean[group] = Array.isArray(values)
      ? values.filter(
          (value): value is string =>
            typeof value === "string" &&
            (group !== "state" ||
              (SERVER_STATES as readonly string[]).includes(value)),
        )
      : [...fallback];
  }
  return clean;
}

/**
 * Moves a view saved under the old `dedicated-servers-view` key (sort
 * direction 1 / -1) to the remembered-view store, once, and drops the old key.
 */
export function migrateServerView() {
  let legacy: string | null;
  try {
    legacy = localStorage.getItem(LEGACY_SERVER_VIEW_KEY);
  } catch {
    return;
  }
  if (legacy === null) return;
  try {
    if (
      localStorage.getItem(rememberedViewStorageKey(SERVER_VIEW_KEY)) === null
    ) {
      const raw = JSON.parse(legacy);
      if (isRecord(raw)) {
        const sort = isRecord(raw.sort)
          ? {
              key: raw.sort.key,
              dir:
                raw.sort.dir === -1
                  ? "desc"
                  : raw.sort.dir === 1
                    ? "asc"
                    : raw.sort.dir,
            }
          : raw.sort;
        saveRememberedView(
          SERVER_VIEW_KEY,
          { ...raw, sort } as ServerView,
          serverViewDefaults(),
        );
      }
    }
  } catch {}
  try {
    localStorage.removeItem(LEGACY_SERVER_VIEW_KEY);
  } catch {}
}

/**
 * The list's last search, filters and sort, so a refresh or a return lands
 * where the admin left it. Each field is validated; anything unreadable falls
 * back to its default.
 */
export function restoreServerView(): ServerView {
  migrateServerView();
  const defaults = serverViewDefaults();
  const view = readRememberedView(
    SERVER_VIEW_KEY,
    defaults,
    serverViewValidators,
  );
  return { ...view, facets: cleanFacets(view.facets, defaults.facets) };
}

export function rememberServerView(view: ServerView) {
  saveRememberedView(SERVER_VIEW_KEY, view, serverViewDefaults());
}

export function sortServers(
  list: any[],
  sort: ServerSort,
  ctx: FleetContext,
): any[] {
  const sign = sort.dir === "asc" ? 1 : -1;
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
      order * sign || String(a.label ?? "").localeCompare(String(b.label ?? ""))
    );
  });
}
