// Words for what nodeInspector derives: an attention item's title and line,
// and CS2 versions by name. Shared by the row tooltip and the inspector.
import {
  warningInfo,
  type AttentionItem,
  type AttentionTone,
  type NodeWarning,
} from "~/components/game-server-nodes/nodeInspector";
import type { NodeLike } from "~/components/game-server-nodes/nodeState";
import { formatGb } from "~/components/game-server-nodes/nodeMetrics";
import {
  clockLabel,
  listLabel,
  relativeTime,
} from "~/components/game-server-nodes/nodeFormat";

type Translate = (key: string, ...args: any[]) => string;
type GameVersion = { build_id: number | string; version?: string | null };

export const INSPECTOR = "pages.game_server_nodes.inspector";

const versionOf = (versions: Array<GameVersion>, buildId: unknown) =>
  versions.find((version) => String(version.build_id) === String(buildId));

// "1.41.9.0 (25890441)", or the bare build id for a build the list lacks.
export function versionLabel(versions: Array<GameVersion>, buildId: unknown) {
  const version = versionOf(versions, buildId);
  return version?.version && version.version !== String(buildId)
    ? `${version.version} (${buildId})`
    : String(buildId ?? "");
}

export function versionShort(versions: Array<GameVersion>, buildId: unknown) {
  return versionOf(versions, buildId)?.version || String(buildId ?? "");
}

// Where an update takes the node: its pin, or the current build.
export function updateTarget(
  versions: Array<GameVersion & { current?: boolean | null }>,
  node: NodeLike,
) {
  const target =
    node.pin_build_id || versions.find((version) => version.current)?.build_id;
  return target ? versionLabel(versions, target) : "";
}

// A node warning's short title: the known ones by name, the rest by their
// first sentence.
export function warningTitle(warning: NodeWarning, t: Translate) {
  switch (warning.kind) {
    case "lowlatency":
      return t(`${INSPECTOR}.warning.lowlatency`);
    case "constrained":
      return t(`${INSPECTOR}.warning.constrained`, {
        name: warning.subject ?? "",
      });
    case "governor":
      return t(`${INSPECTOR}.warning.governor`, {
        governor: warning.subject ?? "",
      });
    default:
      return warning.title;
  }
}

export function attentionCopy(
  item: AttentionItem,
  t: Translate,
  node: NodeLike,
  versions: Array<GameVersion & { current?: boolean | null }>,
): { title: string; text: string; url?: string | null } {
  const params = item.params ?? {};
  switch (item.key) {
    case "setup":
      return {
        title: t(`${INSPECTOR}.status.setup`),
        text: t(`${INSPECTOR}.attention.setup`),
      };
    case "offline":
      return {
        title: t(`${INSPECTOR}.status.offline_since`, {
          time: clockLabel(params.at),
        }),
        text: t(`${INSPECTOR}.attention.offline`),
      };
    case "update_failed":
      return {
        title: t(`${INSPECTOR}.attention.update_failed_title`, {
          ago: relativeTime(params.at),
        }),
        text: t(`${INSPECTOR}.attention.update_failed`),
      };
    case "overprovisioned":
      return {
        title: t("game_server.overprovisioned_warning"),
        text: t(`${INSPECTOR}.attention.overprovisioned`, {
          total: params.total,
          max: params.max,
        }),
      };
    case "plugin_unsupported":
      return {
        title: t("game_server.plugin_not_supported"),
        text: t(`${INSPECTOR}.attention.plugin`, { build: node.build_id }),
      };
    case "not_ready":
      return {
        title: t(`${INSPECTOR}.attention.not_ready_title`),
        text: t(`${INSPECTOR}.attention.not_ready`, {
          list: listLabel(
            (params.needs ?? []).map((need: string) =>
              t(`${INSPECTOR}.need.${need}`),
            ),
          ),
        }),
      };
    case "update_available":
      return {
        title: t(`${INSPECTOR}.attention.behind_title`, {
          version: versionShort(versions, node.build_id),
        }),
        text: t(`${INSPECTOR}.attention.behind`, {
          target: updateTarget(versions, node),
        }),
      };
    case "cpu_frequency":
      return {
        title: t(`${INSPECTOR}.attention.cpu_title`, {
          ghz: Number(params.ghz ?? 0).toFixed(2),
        }),
        text: t(`${INSPECTOR}.attention.cpu`),
      };
    case "cpu_governor":
      return {
        title: t(`${INSPECTOR}.attention.governor_title`, {
          governor: params.governor,
        }),
        text: t("game_server.governor_performance_recommended"),
      };
    case "disk":
      return {
        title: t(`${INSPECTOR}.attention.disk_title`, {
          percent: params.percent,
        }),
        text:
          params.free != null
            ? t(`${INSPECTOR}.attention.disk`, { free: formatGb(params.free) })
            : "",
      };
    case "cpu_warning": {
      const warning = warningInfo(params.warning);
      return {
        title: warningTitle(warning, t),
        text: t(`${INSPECTOR}.attention.cpu_warning`),
        url: warning.url,
      };
    }
    case "workloads":
      return {
        title: t(`${INSPECTOR}.attention.workloads_title`),
        text: t(`${INSPECTOR}.attention.workloads`, {
          list: listLabel(
            (params.off ?? []).map((key: string) =>
              t(`pages.gpu_nodes.workload.${key}`),
            ),
          ),
        }),
      };
  }
}

export const TONE_TEXT: Record<AttentionTone | "off", string> = {
  bad: "text-destructive",
  warn: "text-[hsl(var(--tac-amber))]",
  info: "text-info",
  off: "text-muted-foreground",
};
