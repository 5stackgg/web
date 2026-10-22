// What the nodes console derives from a game_server_nodes row: status, the
// per-node warnings, the fleet summary line and the client-side filter. Plain
// functions so the page, the row and the bulk bar agree, and so the rules can
// be tested without mounting anything.

export type NodeLike = {
  id: string;
  label?: string | null;
  status?: string | null;
  offline_at?: string | null;
  enabled?: boolean | null;
  enabled_for_match_making?: boolean | null;
  accepting_new_matches?: boolean | null;
  region?: string | null;
  gpu?: boolean | null;
  gpu_streaming_enabled?: boolean | null;
  gpu_demos_enabled?: boolean | null;
  gpu_rendering_enabled?: boolean | null;
  lan_ip?: string | null;
  public_ip?: string | null;
  build_id?: number | string | null;
  pin_build_id?: number | string | null;
  plugin_supported?: boolean | null;
  start_port_range?: number | null;
  end_port_range?: number | null;
  update_status?: string | null;
  update_failed_at?: string | null;
  update_error?: string | null;
  csgo_build_id?: number | string | null;
  csgo_update_status?: string | null;
  csgo_update_failed_at?: string | null;
  csgo_update_error?: string | null;
  supports_cpu_pinning?: boolean | null;
  cpu_sockets?: number | null;
  cpu_cores_per_socket?: number | null;
  cpu_threads_per_core?: number | null;
  cpu_frequency_info?: {
    frequency?: number | null;
    model?: string | null;
  } | null;
  cpu_governor_info?: { governor?: string | null } | null;
  cpu_warnings?: Array<string> | null;
  total_server_count?: number | null;
  available_server_count?: number | null;
  disk_used_percent?: number | null;
  disk_available_gb?: number | null;
};

export type NodeStatus =
  "online" | "not_accepting" | "setup" | "offline" | "disabled";

export type Tone = "bad" | "warn";

export type CpuPinning = { enabled: boolean; cpusPerServer: number };

export type DiskThresholds = { warning: number; critical: number };

export const DEFAULT_DISK_THRESHOLDS: DiskThresholds = {
  warning: 75,
  critical: 90,
};

// The application settings these rules read: CPU pinning shapes max servers,
// the disk thresholds colour the disk.
export function nodeSettings(
  settings: Array<{ name: string; value?: string | null }> = [],
) {
  const value = (name: string) =>
    settings.find((setting) => setting.name === name)?.value ?? "";
  const number = (name: string, fallback: number) => {
    const parsed = parseInt(value(name));
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  return {
    pinning: {
      enabled: value("enable_cpu_pinning") === "true",
      cpusPerServer: number("number_of_cpus_per_server", 1) || 1,
    } as CpuPinning,
    disk: {
      warning: number("disk_warning_percent", DEFAULT_DISK_THRESHOLDS.warning),
      critical: number(
        "disk_critical_percent",
        DEFAULT_DISK_THRESHOLDS.critical,
      ),
    } as DiskThresholds,
  };
}

export function isOffline(node: NodeLike) {
  return !!node.offline_at || node.status === "Offline";
}

// Only a connected node takes an update or install.
export function isReachable(node: NodeLike) {
  return (
    !isOffline(node) &&
    (node.status === "Online" || node.status === "NotAcceptingNewMatches")
  );
}

export function hasPorts(node: NodeLike) {
  return !!node.start_port_range && !!node.end_port_range;
}

// Matches and practice servers start here. A node out of matchmaking keeps
// its region and ports for the dedicated servers it hosts. Unselected reads as
// taking them, the column's default.
export function takesMatches(node: Pick<NodeLike, "enabled_for_match_making">) {
  return node.enabled_for_match_making !== false;
}

// A GPU node with nothing for CS2 servers: out of matchmaking, no ports.
export function isGpuOnly(node: NodeLike) {
  return !!node.gpu && !takesMatches(node) && !hasPorts(node);
}

// A GPU-only node still boots a CS2 server for each lineup preview it renders:
// the render pod films that server over loopback, so it has to be on the node.
export function runsCs2(node: NodeLike) {
  return !isGpuOnly(node) || !!node.gpu_rendering_enabled;
}

export function nodeStatus(node: NodeLike): NodeStatus {
  if (node.status === "Setup") {
    return "setup";
  }
  if (isOffline(node)) {
    return "offline";
  }
  if (!node.enabled) {
    return "disabled";
  }
  if (node.status === "NotAcceptingNewMatches" && takesMatches(node)) {
    return "not_accepting";
  }
  return "online";
}

// One core stays with the system; with CPU pinning each server takes
// `cpusPerServer` of what is left.
export function maxServers(
  node: NodeLike,
  pinning: CpuPinning = { enabled: false, cpusPerServer: 1 },
) {
  const threads =
    (node.cpu_sockets || 0) *
    (node.cpu_cores_per_socket || 0) *
    (node.cpu_threads_per_core || 0);
  const available = Math.max(1, threads ? threads - 1 : 0);

  if (!node.supports_cpu_pinning || !pinning.enabled) {
    return available;
  }

  return Math.max(1, Math.floor(available / (pinning.cpusPerServer || 1)));
}

export function isOverprovisioned(node: NodeLike, max: number) {
  return !!node.enabled && max < (node.total_server_count ?? 0);
}

export function cpuFrequency(node: NodeLike): number | null {
  const frequency = node.cpu_frequency_info?.frequency;
  return frequency != null ? Math.round(frequency * 100) / 100 : null;
}

// Under 3 GHz hurts CS2; a governor other than performance is a softer warning.
export function cpuTone(node: NodeLike): Tone | null {
  const frequency = cpuFrequency(node);
  if (frequency && frequency < 3) {
    return "bad";
  }
  const governor = node.cpu_governor_info?.governor;
  if (governor && governor !== "performance") {
    return "warn";
  }
  return null;
}

export function diskTone(
  percent: number | null | undefined,
  thresholds: DiskThresholds = DEFAULT_DISK_THRESHOLDS,
): Tone | "ok" | null {
  if (percent == null) {
    return null;
  }
  if (thresholds.critical > 0 && percent >= thresholds.critical) {
    return "bad";
  }
  if (thresholds.warning > 0 && percent >= thresholds.warning) {
    return "warn";
  }
  return "ok";
}

export function updateTargetBuildId(
  node: NodeLike,
  currentBuildId: number | string | null | undefined,
) {
  return node.pin_build_id || currentBuildId || null;
}

// A pinned node is behind when it isn't on its pin; otherwise when it isn't
// on the current build. Unknown current build: nothing to compare with yet.
export function isBuildBehind(
  node: NodeLike,
  currentBuildId: number | string | null | undefined,
) {
  if (!node.build_id) {
    return false;
  }
  if (node.pin_build_id) {
    return String(node.pin_build_id) !== String(node.build_id);
  }
  return (
    currentBuildId != null && String(node.build_id) !== String(currentBuildId)
  );
}

// Whether "Update CS2" has something to do on this node right now.
export function canUpdateCs(
  node: NodeLike,
  currentBuildId: number | string | null | undefined,
) {
  return (
    isReachable(node) &&
    !node.update_status &&
    runsCs2(node) &&
    (!node.build_id || isBuildBehind(node, currentBuildId))
  );
}

export type IssueContext = {
  currentBuildId?: number | string | null;
  maxServers?: (node: NodeLike) => number;
  diskThresholds?: DiskThresholds;
};

export type NodeIssue =
  | "offline"
  | "update_failed"
  | "overprovisioned"
  | "plugin_unsupported"
  | "no_region"
  | "no_ports"
  | "no_cs2"
  | "update_available"
  | "cpu_frequency"
  | "cpu_governor"
  | "disk"
  | "cpu_warnings";

// Everything that wants an admin's attention. A node in setup or switched off
// asks for nothing.
export function nodeIssues(
  node: NodeLike,
  context: IssueContext = {},
): Array<NodeIssue> {
  if (node.status === "Setup" || !node.enabled) {
    return [];
  }
  if (isOffline(node)) {
    return ["offline"];
  }

  const issues: Array<NodeIssue> = [];
  const gpuOnly = isGpuOnly(node);
  const matches = takesMatches(node);
  const max = context.maxServers?.(node) ?? maxServers(node);

  if (node.update_failed_at && !node.update_status) {
    issues.push("update_failed");
  }
  if (matches && isOverprovisioned(node, max)) {
    issues.push("overprovisioned");
  }
  if (node.build_id && node.plugin_supported === false) {
    issues.push("plugin_unsupported");
  }
  if (matches && !node.region) {
    issues.push("no_region");
  } else if (matches && !hasPorts(node)) {
    issues.push("no_ports");
  }
  if (!gpuOnly && !node.build_id && !node.update_status) {
    issues.push("no_cs2");
  }
  if (
    !gpuOnly &&
    !node.update_status &&
    !node.update_failed_at &&
    isBuildBehind(node, context.currentBuildId)
  ) {
    issues.push("update_available");
  }
  const cpu = cpuTone(node);
  if (cpu === "bad") {
    issues.push("cpu_frequency");
  } else if (cpu === "warn") {
    issues.push("cpu_governor");
  }
  const disk = diskTone(node.disk_used_percent, context.diskThresholds);
  if (disk === "bad" || disk === "warn") {
    issues.push("disk");
  }
  if (node.cpu_warnings?.length) {
    issues.push("cpu_warnings");
  }

  return issues;
}

export type FleetSummary = {
  total: number;
  online: number;
  free: number;
  capacity: number;
  attention: number;
  updating: number;
};

export function fleetSummary(
  nodes: Array<NodeLike>,
  context: IssueContext = {},
): FleetSummary {
  const summary: FleetSummary = {
    total: nodes.length,
    online: 0,
    free: 0,
    capacity: 0,
    attention: 0,
    updating: 0,
  };

  for (const node of nodes) {
    const connected = !isOffline(node) && node.status !== "Setup";
    if (connected) {
      summary.online++;
    }
    // Free servers count only where matches can actually land.
    if (connected && node.enabled && hasPorts(node) && takesMatches(node)) {
      summary.free += node.available_server_count ?? 0;
      summary.capacity += node.total_server_count ?? 0;
    }
    if (nodeIssues(node, context).length) {
      summary.attention++;
    }
    if (node.update_status) {
      summary.updating++;
    }
  }

  return summary;
}

export type NodeFilters = {
  query: string;
  regions: Array<string>;
  onlyEnabled: boolean;
  hideOffline: boolean;
  sort: "asc" | "desc";
};

// Label, node id or IP, so a pasted UUID or address finds its node.
export function matchesNodeSearch(node: NodeLike, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return (
    (node.label ?? "").toLowerCase().includes(needle) ||
    node.id.toLowerCase().includes(needle) ||
    (node.lan_ip ?? "").includes(needle) ||
    (node.public_ip ?? "").includes(needle)
  );
}

// Labelled nodes first by label, then unlabelled ones by id -- the order the
// old server-side `label asc, id asc` gave.
function compareNodes(a: NodeLike, b: NodeLike) {
  if (a.label && b.label) {
    return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  }
  if (a.label) {
    return -1;
  }
  if (b.label) {
    return 1;
  }
  return a.id.localeCompare(b.id);
}

export function filterNodes<T extends NodeLike>(
  nodes: Array<T>,
  filters: NodeFilters,
): Array<T> {
  const list = nodes.filter(
    (node) =>
      matchesNodeSearch(node, filters.query) &&
      (!filters.regions.length ||
        filters.regions.includes(node.region ?? "")) &&
      (!filters.onlyEnabled || !!node.enabled) &&
      (!filters.hideOffline || !isOffline(node)),
  );
  list.sort(compareNodes);
  return filters.sort === "desc" ? list.reverse() : list;
}
