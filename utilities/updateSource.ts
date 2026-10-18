export const UPDATE_COMPONENTS = [
  "api",
  "web",
  "game-server-node-connector",
  "demo-parser",
  "game-streamer",
  "game-server-sw",
  "game-server-css",
] as const;
export type UpdateSource = {
  version: 1;
  mode: "installed" | "official" | "custom";
  channel?: "latest" | "beta";
  panel?: { repository: string; ref: string } | null;
  images?: Record<string, string>;
};
export type BuildStatus = {
  service: string;
  plugin?: string;
  pod?: string;
  currentImage?: string;
  targetImage?: string;
  currentVersion?: string;
  newVersion?: string | null;
  source?: string;
  status:
    | "current"
    | "pinned"
    | "update"
    | "source-change"
    | "unavailable"
    | "on-demand";
  canUpdate: boolean;
  repository?: string;
  ref?: string;
};
export type UpdateSourceStatus = {
  source: UpdateSource;
  writable: boolean;
  resourceVersion: string | null;
  installedImages: Record<string, string>;
  panel: BuildStatus;
  services: BuildStatus[];
  checkedAt: string;
  applyMethod: string;
};
export function updateSourceChoice(source: UpdateSource) {
  return source.mode === "official"
    ? source.channel === "beta"
      ? "beta"
      : "stable"
    : source.mode;
}
export function buildSourceDraft(
  choice: string,
  images: Record<string, string>,
  panel: { repository: string; ref: string } | null,
): UpdateSource {
  if (choice === "stable" || choice === "beta")
    return {
      version: 1,
      mode: "official",
      channel: choice === "beta" ? "beta" : "latest",
    };
  if (choice === "installed") return { version: 1, mode: "installed" };
  return {
    version: 1,
    mode: "custom",
    images: Object.fromEntries(
      UPDATE_COMPONENTS.map((name) => [name, (images[name] ?? "").trim()]),
    ),
    panel,
  };
}
export function panelUpdateCommand(source: UpdateSource) {
  const panel =
    source.mode === "official"
      ? {
          repository: "5stackgg/5stack-panel",
          ref: source.channel === "beta" ? "beta" : "main",
        }
      : source.panel;
  if (!panel) return "./update.sh";
  // Same constrained grammar as the API; never interpolate shell metacharacters.
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(panel.repository) ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/.test(panel.ref) ||
    panel.repository.includes("..") ||
    panel.ref.includes("..") ||
    panel.ref.includes("//") ||
    panel.ref.endsWith("/") ||
    panel.ref.endsWith(".lock")
  )
    return "";
  return (
    "git fetch 'https://github.com/" +
    panel.repository +
    ".git' '" +
    panel.ref +
    "'\n" +
    "git checkout --detach FETCH_HEAD\n" +
    "git config 5stack.update-source-repository '" +
    panel.repository +
    "'\n" +
    "git config 5stack.update-source-ref '" +
    panel.ref +
    "'\n./update.sh"
  );
}
