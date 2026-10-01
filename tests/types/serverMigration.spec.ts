// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatBytes,
  isNodeUp,
  moveTargetIneligibility,
  type ServerMoveNode,
} from "~/types/serverMigration";

const node = (overrides: Partial<ServerMoveNode> = {}): ServerMoveNode => ({
  id: "node-b",
  label: "Node B",
  status: "Online",
  node_ip: "100.64.0.2",
  enabled: true,
  build_id: 100,
  csgo_build_id: null,
  update_status: null,
  region: "EU",
  disk_available_gb: 100,
  available_dedicated_slot_count: 2,
  pin_plugin_runtime: null,
  ...overrides,
});

const cs2 = { game: "cs2", game_server_node_id: "node-a" };

describe("moveTargetIneligibility", () => {
  it.each([
    ["the current node", node({ id: "node-a" }), cs2, "current"],
    ["a disabled node", node({ enabled: false }), cs2, "disabled"],
    ["an offline node", node({ status: "Offline" }), cs2, "offline"],
    ["a node still being set up", node({ status: "Setup" }), cs2, "setup"],
    [
      "an online node without an address",
      node({ node_ip: null }),
      cs2,
      "unreachable",
    ],
    ["a node updating CS2", node({ update_status: "Downloading" }), cs2, "updating"],
    ["a node without CS2", node({ build_id: null }), cs2, "no_build"],
    [
      "a node without CS:GO for a CS:GO server",
      node(),
      { game: "csgo", game_server_node_id: "node-a" },
      "no_build",
    ],
    ["a full node", node({ available_dedicated_slot_count: 0 }), cs2, "no_slot"],
  ])("rules out %s", (_label, candidate, server, key) => {
    expect(moveTargetIneligibility(candidate, server)?.key).toBe(key);
  });

  it("accepts a node that is not taking new matches", () => {
    expect(
      moveTargetIneligibility(node({ status: "NotAcceptingNewMatches" }), cs2),
    ).toBeNull();
  });
});

describe("isNodeUp", () => {
  it("needs both a live status and an address", () => {
    expect(isNodeUp(node())).toBe(true);
    expect(isNodeUp(node({ node_ip: null }))).toBe(false);
    expect(isNodeUp(node({ status: "Setup" }))).toBe(false);
    expect(isNodeUp(null)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("scales to the largest whole unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
    expect(formatBytes(null)).toBe("0 B");
  });
});
