// What the inspector derives from one node: the problems it lists, the one
// next step its header offers, the CS2 state and the disk numbers. Built on
// nodeState so the table, the summary line and the inspector agree.
import {
  cpuFrequency,
  diskTone,
  hasPorts,
  isBuildBehind,
  isGpuOnly,
  isOffline,
  isOverprovisioned,
  maxServers,
  nodeIssues,
  type DiskThresholds,
  type IssueContext,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";

export type AttentionTone = "bad" | "warn" | "info";
export type ReadinessNeed = "region" | "ports" | "cs2";
export type GpuWorkloadKey = "streaming" | "demos" | "rendering";

export type AttentionItem = {
  key:
    | "setup"
    | "offline"
    | "update_failed"
    | "overprovisioned"
    | "plugin_unsupported"
    | "not_ready"
    | "update_available"
    | "cpu_frequency"
    | "cpu_governor"
    | "disk"
    | "cpu_warning"
    | "workloads";
  tone: AttentionTone;
  params?: Record<string, any>;
};

const SEVERITY: Record<AttentionTone, number> = { bad: 0, warn: 1, info: 2 };

export const GPU_WORKLOADS: Array<GpuWorkloadKey> = [
  "streaming",
  "demos",
  "rendering",
];

export function workloadsOff(node: NodeLike): Array<GpuWorkloadKey> {
  if (!node.gpu) {
    return [];
  }
  return GPU_WORKLOADS.filter(
    (key) => !node[`gpu_${key}_enabled` as keyof NodeLike],
  );
}

// What a hosting node still lacks before it can take a match. Folded into one
// item so a fresh node reads as one problem, not three.
export function readinessNeeds(node: NodeLike): Array<ReadinessNeed> {
  if (isGpuOnly(node)) {
    return [];
  }
  const needs: Array<ReadinessNeed> = [];
  if (!node.region) {
    needs.push("region");
  }
  if (!hasPorts(node)) {
    needs.push("ports");
  }
  if (!node.build_id && !node.update_status) {
    needs.push("cs2");
  }
  return needs;
}

// Everything that wants an admin's attention, worst first. A node in setup
// only waits to connect; one switched off asks for nothing.
export function nodeAttention(
  node: NodeLike,
  context: IssueContext = {},
): Array<AttentionItem> {
  if (node.status === "Setup") {
    return [{ key: "setup", tone: "info" }];
  }
  if (!node.enabled) {
    return [];
  }
  if (isOffline(node)) {
    return [{ key: "offline", tone: "bad", params: { at: node.offline_at } }];
  }

  const items: Array<AttentionItem> = [];
  let readinessAdded = false;

  for (const issue of nodeIssues(node, context)) {
    switch (issue) {
      case "update_failed":
        items.push({
          key: "update_failed",
          tone: "bad",
          params: { at: node.update_failed_at },
        });
        break;
      case "overprovisioned":
        items.push({
          key: "overprovisioned",
          tone: "bad",
          params: {
            total: node.total_server_count ?? 0,
            max: context.maxServers?.(node) ?? maxServers(node),
          },
        });
        break;
      case "plugin_unsupported":
        items.push({ key: "plugin_unsupported", tone: "bad" });
        break;
      case "no_region":
      case "no_ports":
      case "no_cs2":
        if (!readinessAdded) {
          readinessAdded = true;
          items.push({
            key: "not_ready",
            tone: "warn",
            params: { needs: readinessNeeds(node) },
          });
        }
        break;
      case "update_available":
        items.push({ key: "update_available", tone: "warn" });
        break;
      case "cpu_frequency":
        items.push({
          key: "cpu_frequency",
          tone: "warn",
          params: { ghz: cpuFrequency(node) },
        });
        break;
      case "cpu_governor": {
        const governor = node.cpu_governor_info?.governor ?? "";
        items.push({
          key: "cpu_governor",
          tone: governor === "powersave" ? "bad" : "warn",
          params: { governor },
        });
        break;
      }
      case "disk":
        items.push({
          key: "disk",
          tone:
            diskTone(node.disk_used_percent, context.diskThresholds) === "bad"
              ? "bad"
              : "warn",
          params: {
            percent: node.disk_used_percent,
            free: node.disk_available_gb ?? null,
          },
        });
        break;
      case "cpu_warnings":
        for (const warning of node.cpu_warnings ?? []) {
          items.push({ key: "cpu_warning", tone: "warn", params: { warning } });
        }
        break;
    }
  }

  const off = workloadsOff(node);
  if (off.length) {
    items.push({ key: "workloads", tone: "info", params: { off } });
  }

  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        SEVERITY[a.item.tone] - SEVERITY[b.item.tone] || a.index - b.index,
    )
    .map(({ item }) => item);
}

export function needsAttention(node: NodeLike, context: IssueContext = {}) {
  return nodeAttention(node, context).some((item) => item.tone !== "info");
}

export type NextStep =
  | "enable"
  | "retry_update"
  | "assign_region"
  | "set_ports"
  | "install_cs2"
  | "change_plugin"
  | "update_cs2"
  | "edit_ports"
  | "open_files";

// The one thing to do next on this node, in the order a fresh node gets set
// up; null when there is nothing to do.
export function nextStep(
  node: NodeLike,
  context: IssueContext = {},
): NextStep | null {
  if (node.status === "Setup" || isOffline(node)) {
    return null;
  }
  if (!node.enabled) {
    return "enable";
  }
  const gpuOnly = isGpuOnly(node);
  if (!gpuOnly) {
    if (node.update_failed_at && !node.update_status) {
      return "retry_update";
    }
    if (!node.region) {
      return "assign_region";
    }
    if (!hasPorts(node)) {
      return "set_ports";
    }
    if (!node.build_id && !node.update_status) {
      return "install_cs2";
    }
    if (node.build_id && node.plugin_supported === false) {
      return "change_plugin";
    }
    if (!node.update_status && isBuildBehind(node, context.currentBuildId)) {
      return "update_cs2";
    }
    const max = context.maxServers?.(node) ?? maxServers(node);
    if (isOverprovisioned(node, max)) {
      return "edit_ports";
    }
  }
  if (diskTone(node.disk_used_percent, context.diskThresholds) === "bad") {
    return "open_files";
  }
  return null;
}

export type Cs2State =
  "none" | "updating" | "missing" | "failed" | "behind" | "pinned" | "current";

export function cs2State(
  node: NodeLike,
  currentBuildId?: number | string | null,
): Cs2State {
  if (node.status === "Setup" || isGpuOnly(node)) {
    return "none";
  }
  if (node.update_status) {
    return "updating";
  }
  if (!node.build_id) {
    return "missing";
  }
  const behind = isBuildBehind(node, currentBuildId);
  if (node.update_failed_at && behind) {
    return "failed";
  }
  if (behind) {
    return "behind";
  }
  return node.pin_build_id ? "pinned" : "current";
}

// "downloading 40%" -> 40. The api reports free text; only a trailing
// percentage is read, anything else shows as text alone.
export function updateProgress(status: string | null | undefined) {
  const match = String(status ?? "").match(/(\d{1,3}(?:\.\d+)?)\s*%\s*$/);
  return match ? Math.min(100, Number(match[1])) : null;
}

// "Downloading depot 2/3 41%" -> "Downloading depot 2/3": the step, with the
// percentage left to the meter.
export function updateStep(status: string | null | undefined) {
  const text = String(status ?? "")
    .replace(/\s*\d{1,3}(?:\.\d+)?\s*%\s*$/, "")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type CsgoState =
  "none" | "updating" | "failed" | "behind" | "current" | "installed";

// CS:GO shows only once it's installed, or while an install of it runs or has
// failed. "installed" is an install with no latest build to compare against.
export function csgoState(
  node: NodeLike,
  latestBuildId?: number | string | null,
): CsgoState {
  if (node.csgo_update_status) {
    return "updating";
  }
  if (node.csgo_update_failed_at) {
    return "failed";
  }
  if (!node.csgo_build_id) {
    return "none";
  }
  if (!latestBuildId) {
    return "installed";
  }
  return String(node.csgo_build_id) === String(latestBuildId)
    ? "current"
    : "behind";
}

export type DiskSize = {
  percent: number;
  freeGb: number | null;
  totalGb: number | null;
  usedGb: number | null;
};

// The node row carries the fill and the free space; the size follows from
// the two.
export function diskSize(node: NodeLike): DiskSize | null {
  const percent = node.disk_used_percent;
  if (percent == null) {
    return null;
  }
  const freeGb = node.disk_available_gb ?? null;
  const totalGb =
    freeGb != null && percent < 100 ? freeGb / (1 - percent / 100) : null;
  return {
    percent,
    freeGb,
    totalGb,
    usedGb: totalGb != null && freeGb != null ? totalGb - freeGb : null,
  };
}

export function diskLevel(
  percent: number | null | undefined,
  thresholds?: DiskThresholds,
): "bad" | "warn" | null {
  const tone = diskTone(percent, thresholds);
  return tone === "bad" || tone === "warn" ? tone : null;
}

export const PORT_MIN = 30000;
export const PORT_MAX = 32767;

export function portsError(
  start: number | null | undefined,
  end: number | null | undefined,
): "range" | "order" | null {
  if (
    !start ||
    !end ||
    start < PORT_MIN ||
    start > PORT_MAX ||
    end < PORT_MIN ||
    end > PORT_MAX
  ) {
    return "range";
  }
  if (end < start + 2) {
    return "order";
  }
  return null;
}

// Each server takes two ports.
export function serversFit(start: number, end: number) {
  return Math.max(0, Math.floor((end - start + 1) / 2));
}

export type NodeWarning = {
  kind: "lowlatency" | "constrained" | "governor" | "other";
  // The quoted name in the text: the server, or the governor.
  subject: string | null;
  // For "other": the first sentence, cut at 64 characters.
  title: string;
  body: string;
  url: string | null;
};

// The node reports its warnings as English sentences with a docs URL at the
// end. The URL comes out as a link, the known ones get a short title, and the
// rest of the text stays readable under Details.
export function warningInfo(text: string | null | undefined): NodeWarning {
  const raw = String(text ?? "").trim();
  const url =
    raw.match(/https?:\/\/[^\s)]+/)?.[0].replace(/[.,;]+$/, "") ?? null;
  const stripped = raw.replace(/[:\s]*https?:\/\/[^\s)]+[.,;]?/, "").trim();
  const body = !stripped || /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
  const subject = body.match(/"([^"]+)"/)?.[1] ?? null;
  const kind = /legacy "lowlatency" kernel/i.test(body)
    ? "lowlatency"
    : /CPU-constrained/i.test(body)
      ? "constrained"
      : /scaling governor is/i.test(body)
        ? "governor"
        : "other";
  let title = body.split(/(?<=[.!?])\s/)[0].replace(/\.$/, "");
  if (title.length > 64) {
    title = `${title.slice(0, 61).trim()}…`;
  }
  return { kind, subject, title, body, url };
}

export function cpuThreads(node: NodeLike) {
  return (
    (node.cpu_sockets || 0) *
    (node.cpu_cores_per_socket || 0) *
    (node.cpu_threads_per_core || 0)
  );
}

// Nodes whose ids sit between two rows of the shown list, both ends included,
// for a Shift-click range.
export function idRange(ids: Array<string>, from: string, to: string) {
  const a = ids.indexOf(from);
  const b = ids.indexOf(to);
  if (a === -1 || b === -1) {
    return b === -1 ? [] : [to];
  }
  return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
}

// The deep link (?node=) picks a node only if it exists.
export function linkedNodeId(
  query: unknown,
  nodes: Array<{ id: string }>,
): string | null {
  const id = Array.isArray(query) ? query[0] : query;
  if (typeof id !== "string" || !id) {
    return null;
  }
  return nodes.some((node) => node.id === id) ? id : null;
}
