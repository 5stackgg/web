import type { Tone as AdminTone } from "~/components/admin/tone";
import { takesMatches } from "~/components/game-server-nodes/nodeState";

export type Tone = Extract<AdminTone, "ok" | "warn" | "bad" | "off">;

// region_status() in the api: "Disabled" means no enabled node or dedicated
// server takes matches there, which reads as "No servers", not as an outage.
export function regionTone(status?: string | null): Tone {
  switch (status) {
    case "Online":
      return "ok";
    case "Partial":
      return "warn";
    case "Offline":
      return "bad";
    default:
      return "off";
  }
}

type RegionNodeFlags = {
  enabled?: boolean | null;
  enabled_for_match_making?: boolean | null;
};

// A node out of matchmaking still hosts dedicated servers, so a region with
// only those reads "No matchmaking", not "No servers".
export function regionStatusKey(
  status?: string | null,
  nodes: Array<RegionNodeFlags> = [],
): string {
  switch (status) {
    case "Online":
      return "pages.regions.status.online";
    case "Partial":
      return "pages.regions.status.partial";
    case "Offline":
      return "pages.regions.status.offline";
    default:
      return nodes.some((node) => node.enabled && !takesMatches(node))
        ? "pages.regions.status.no_matchmaking"
        : "pages.regions.status.disabled";
  }
}

export function regionLabel(region: {
  value: string;
  description?: string | null;
}): string {
  return region.description?.trim() || region.value;
}

// The api turns the relay off when LAN only goes on, so LAN wins if a stale
// row still has both.
export type RegionMode = "lan" | "relay" | null;

export function regionMode(region: {
  is_lan?: boolean | null;
  steam_relay?: boolean | null;
}): RegionMode {
  if (region.is_lan) {
    return "lan";
  }
  return region.steam_relay ? "relay" : null;
}

export function matchesRegionSearch(
  region: { value: string; description?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return [region.value, region.description ?? ""].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

export type NodeState =
  "online" | "offline" | "setup" | "not_accepting" | "disabled";

export function nodeState(node: {
  status?: string | null;
  offline_at?: string | null;
  enabled?: boolean | null;
  enabled_for_match_making?: boolean | null;
}): NodeState {
  if (node.enabled === false) {
    return "disabled";
  }
  if (node.offline_at || node.status === "Offline") {
    return "offline";
  }
  switch (node.status) {
    case "Online":
      return "online";
    case "Setup":
      return "setup";
    // Accepting matches is moot on a node out of matchmaking.
    case "NotAcceptingNewMatches":
      return takesMatches(node) ? "not_accepting" : "online";
    default:
      return "offline";
  }
}

export const nodeStateTone: Record<NodeState, Tone> = {
  online: "ok",
  offline: "bad",
  setup: "warn",
  not_accepting: "warn",
  disabled: "off",
};

export const nodeStateKey: Record<NodeState, string> = {
  online: "common.online",
  offline: "common.offline",
  setup: "pages.game_server_nodes.status.setup",
  not_accepting: "pages.game_server_nodes.status.not_accepting",
  disabled: "common.disabled",
};

/** What the regions page remembers: the search and the region it showed. */
export const regionViewDefaults = () => ({
  search: "",
  selected: null as string | null,
});

export const regionViewValidators = {
  search: (value: unknown) => typeof value === "string",
  selected: (value: unknown) => value === null || typeof value === "string",
};
