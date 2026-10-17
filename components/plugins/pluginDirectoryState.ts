import { TONE_TEXT, type Tone } from "~/components/admin/tone";

export type DirectoryPluginVersion = {
  runtime: string;
  version: string;
  published_at?: string | null;
};

export type DirectoryPlugin = {
  slug: string;
  kind: string;
  install_state?: string | null;
  installed_node_count?: number | null;
  target_node_count?: number | null;
  versions?: DirectoryPluginVersion[] | null;
};

export type DesiredInstall = {
  plugin_slug: string;
  version?: string | null;
  channel?: string | null;
};

// What a card's footer says and offers. One key per thing an operator can do
// about it, so the footer never has to work the state out a second time.
export type PluginCardState =
  | { key: "panel-installed" }
  | { key: "panel-available" }
  | { key: "incompatible"; runtimes: string[] }
  | { key: "no-nodes"; latest: string }
  | { key: "install"; latest: string }
  | { key: "manual"; latest: string }
  | { key: "failed"; nodes: string[] }
  | { key: "installing"; installed: number; target: number }
  | { key: "update"; current: string; latest: string }
  | { key: "installed"; version: string };

export function runtimeLabel(runtime: string): string {
  return runtime === "swiftlys2" ? "SwiftlyS2" : "CounterStrikeSharp";
}

export function pluginRuntimes(plugin: DirectoryPlugin): string[] {
  return [...new Set((plugin.versions ?? []).map((v) => v.runtime))];
}

// Newest release for the runtime this deployment runs, by publish date when
// the catalog has one and in catalog order otherwise.
export function latestVersion(
  plugin: DirectoryPlugin,
  runtime: string,
): string | null {
  const forRuntime = (plugin.versions ?? [])
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.runtime === runtime);

  if (forRuntime.length === 0) {
    return null;
  }

  forRuntime.sort((a, b) => {
    const at = Date.parse(a.version.published_at ?? "");
    const bt = Date.parse(b.version.published_at ?? "");
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) {
      return bt - at;
    }
    return a.index - b.index;
  });

  return forRuntime[0].version.version;
}

export function pluginCardState(
  plugin: DirectoryPlugin,
  context: {
    runtime: string;
    desired?: DesiredInstall | null;
    panelInstalled?: boolean;
    failedNodes?: string[];
  },
): PluginCardState {
  if (plugin.kind === "panel") {
    return context.panelInstalled
      ? { key: "panel-installed" }
      : { key: "panel-available" };
  }

  const latest = latestVersion(plugin, context.runtime);

  if (!latest) {
    return { key: "incompatible", runtimes: pluginRuntimes(plugin) };
  }

  const installed = plugin.installed_node_count ?? 0;
  const target = plugin.target_node_count ?? 0;

  switch (plugin.install_state) {
    case "Manual":
      return { key: "manual", latest };
    case "Failed":
      return { key: "failed", nodes: context.failedNodes ?? [] };
    case "Pending":
    case "Partial":
      return { key: "installing", installed, target };
    case "Installed": {
      const desired = context.desired;
      if (
        desired?.channel === "Pinned" &&
        desired.version &&
        desired.version !== latest
      ) {
        return { key: "update", current: desired.version, latest };
      }
      return { key: "installed", version: desired?.version || latest };
    }
    default:
      return target > 0
        ? { key: "install", latest }
        : { key: "no-nodes", latest };
  }
}

// Two questions behind one word. A panel plugin is installed when the panel
// has a page for it; a game plugin when nodes were asked for it or have it on
// disk -- a failed rollout included, which is installed and in trouble rather
// than available.
export function isPluginInstalled(
  plugin: DirectoryPlugin,
  panelInstalled: boolean,
): boolean {
  if (plugin.kind === "panel") {
    return panelInstalled;
  }

  const installed = [
    "Installed",
    "Partial",
    "Pending",
    "Manual",
    "Failed",
  ].includes(plugin.install_state ?? "");

  return plugin.kind === "bundle" ? installed || panelInstalled : installed;
}

export function needsAttention(state: PluginCardState): boolean {
  return (
    state.key === "failed" || state.key === "manual" || state.key === "update"
  );
}

// Installing without a version moves a plugin to auto-update, so a retry of a
// pinned rollout has to name the version it is pinned at to stay there.
export function retryVersion(
  desired: DesiredInstall | null | undefined,
): string | undefined {
  return desired?.channel === "Pinned" && desired.version
    ? desired.version
    : undefined;
}

export function installFraction(installed: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, installed / target));
}

export const PLUGIN_KINDS = ["game", "panel", "bundle"];

/**
 * What the directory remembers between visits. The attention tab is left out:
 * it only exists while something is failing.
 */
export const pluginViewDefaults = () => ({
  search: "",
  state: "all",
  kind: "all",
  verifiedOnly: false,
});

export const pluginViewValidators = {
  search: (value: unknown) => typeof value === "string",
  state: (value: unknown) =>
    value === "all" || value === "installed" || value === "available",
  kind: (value: unknown) =>
    value === "all" ||
    (typeof value === "string" && PLUGIN_KINDS.includes(value)),
  verifiedOnly: (value: unknown) => typeof value === "boolean",
};

export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/**
 * Where an arrow key lands in a grid of `count` cards laid out `columns`
 * wide: ←/→ step one card, ↑/↓ one row. Down from a row with nothing under
 * it lands on the last card when a shorter last row exists; otherwise the
 * key has nowhere to go and the index stays.
 */
export function gridStep(
  index: number,
  count: number,
  columns: number,
  key: GridKey,
): number {
  if (count === 0) return -1;
  if (index < 0) return 0;
  const last = count - 1;
  const cols = Math.max(1, columns);
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowRight":
      return Math.min(last, index + 1);
    case "ArrowUp":
      return index - cols >= 0 ? index - cols : index;
    case "ArrowDown":
      if (index + cols <= last) return index + cols;
      return Math.floor(index / cols) < Math.floor(last / cols) ? last : index;
  }
}

/** A node's rollout state as a tone: installing pings amber, Manual warns. */
export function nodeRolloutTone(key: string): Tone {
  switch (key) {
    case "Installed":
      return "ok";
    case "Installing":
    case "Removing":
      return "amber";
    case "Failed":
      return "bad";
    case "Manual":
      return "warn";
    default:
      return "off";
  }
}

export function nodeRolloutTextClass(key: string): string {
  if (key === "Installed") return "text-muted-foreground";
  const tone = nodeRolloutTone(key);
  return tone === "off" ? "text-muted-foreground/50" : TONE_TEXT[tone];
}
