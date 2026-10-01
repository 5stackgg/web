// Mirrors graphql/serverMigrationGraphql.ts and the api's
// DedicatedServerMigrationService -- extend them together.

export const ACTIVE_SERVER_MIGRATION_STATUSES = [
  "Queued",
  "Stopping",
  "Transferring",
  "Finalizing",
];

export const CANCELABLE_SERVER_MIGRATION_STATUSES = [
  "Queued",
  "Stopping",
  "Transferring",
];

export type ServerMoveNode = {
  id: string;
  label: string | null;
  status: string | null;
  node_ip: string | null;
  enabled: boolean | null;
  build_id: number | null;
  csgo_build_id: number | null;
  update_status: string | null;
  region: string | null;
  e_region?: { description: string | null } | null;
  disk_available_gb: number | null;
  available_dedicated_slot_count: number | null;
  pin_plugin_runtime: string | null;
};

export type ServerMigrationRow = {
  id: string;
  status: string;
  with_files: boolean;
  bytes_total: number | string | null;
  bytes_done: number | string;
  error: string | null;
  warnings: Array<string> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  from_game_server_node: { id: string; label: string | null } | null;
  to_game_server_node: { id: string; label: string | null } | null;
};

export type MigratingServer = {
  id: string;
  game: string;
  region: string | null;
  plugin_runtime: string | null;
  game_server_node_id: string | null;
  game_server_node: {
    id: string;
    label: string | null;
    status: string | null;
    node_ip: string | null;
    offline_at: string | null;
    pin_plugin_runtime: string | null;
  } | null;
  migrations: Array<ServerMigrationRow>;
};

export type ServerMoveIneligibility =
  | { key: "current" }
  | { key: "disabled" }
  | { key: "offline" }
  | { key: "setup" }
  | { key: "unreachable" }
  | { key: "updating" }
  | { key: "no_build"; game: string }
  | { key: "no_slot" };

export function isNodeUp(
  node: Pick<ServerMoveNode, "status" | "node_ip"> | null | undefined,
): boolean {
  return (
    !!node?.node_ip &&
    (node.status === "Online" || node.status === "NotAcceptingNewMatches")
  );
}

export function moveTargetIneligibility(
  node: ServerMoveNode,
  server: Pick<MigratingServer, "game" | "game_server_node_id">,
): ServerMoveIneligibility | null {
  if (node.id === server.game_server_node_id) {
    return { key: "current" };
  }
  if (!node.enabled) {
    return { key: "disabled" };
  }
  if (!isNodeUp(node)) {
    if (node.status === "Online" || node.status === "NotAcceptingNewMatches") {
      return { key: "unreachable" };
    }

    return { key: node.status === "Setup" ? "setup" : "offline" };
  }
  if (node.update_status) {
    return { key: "updating" };
  }
  if (server.game === "csgo" ? !node.csgo_build_id : !node.build_id) {
    return { key: "no_build", game: server.game === "csgo" ? "CS:GO" : "CS2" };
  }
  if (!node.available_dedicated_slot_count) {
    return { key: "no_slot" };
  }
  return null;
}

export function formatBytes(
  bytes: number | string | null | undefined,
): string {
  const value = Number(bytes ?? 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
