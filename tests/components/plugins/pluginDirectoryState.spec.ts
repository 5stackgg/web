import { describe, expect, it } from "vitest";
import {
  gridStep,
  installFraction,
  isPluginInstalled,
  latestVersion,
  needsAttention,
  nodeRolloutTextClass,
  nodeRolloutTone,
  pluginCardState,
  pluginViewValidators,
  retryVersion,
  type DirectoryPlugin,
} from "~/components/plugins/pluginDirectoryState";

const game = (overrides: Partial<DirectoryPlugin> = {}): DirectoryPlugin => ({
  slug: "retakes",
  kind: "game",
  install_state: "NotInstalled",
  installed_node_count: 0,
  target_node_count: 3,
  versions: [
    { runtime: "swiftlys2", version: "1.5.0", published_at: "2026-06-08" },
    { runtime: "swiftlys2", version: "1.5.1", published_at: "2026-06-29" },
    {
      runtime: "counterstrikesharp",
      version: "2.0.0",
      published_at: "2026-07-01",
    },
  ],
  ...overrides,
});

describe("latestVersion", () => {
  it("picks the newest release for the runtime", () => {
    expect(latestVersion(game(), "swiftlys2")).toBe("1.5.1");
    expect(latestVersion(game(), "counterstrikesharp")).toBe("2.0.0");
  });

  it("is null when the runtime has no build", () => {
    expect(latestVersion(game({ versions: [] }), "swiftlys2")).toBeNull();
  });
});

describe("pluginCardState", () => {
  const ctx = { runtime: "swiftlys2" };

  it("offers an install while nodes are online", () => {
    expect(pluginCardState(game(), ctx)).toEqual({
      key: "install",
      latest: "1.5.1",
    });
    expect(pluginCardState(game({ target_node_count: 0 }), ctx).key).toBe(
      "no-nodes",
    );
  });

  it("says there is no build for this runtime", () => {
    const state = pluginCardState(
      game({ versions: [{ runtime: "counterstrikesharp", version: "1.0.0" }] }),
      ctx,
    );
    expect(state).toEqual({
      key: "incompatible",
      runtimes: ["counterstrikesharp"],
    });
  });

  it("reports a rollout in progress with its counts", () => {
    expect(
      pluginCardState(
        game({
          install_state: "Partial",
          installed_node_count: 1,
          target_node_count: 3,
        }),
        ctx,
      ),
    ).toEqual({ key: "installing", installed: 1, target: 3 });
    expect(pluginCardState(game({ install_state: "Pending" }), ctx).key).toBe(
      "installing",
    );
  });

  it("keeps a failed rollout apart, with the nodes it failed on", () => {
    expect(
      pluginCardState(game({ install_state: "Failed" }), {
        ...ctx,
        failedNodes: ["fra-01"],
      }),
    ).toEqual({ key: "failed", nodes: ["fra-01"] });
  });

  it("offers an update only for a pinned install behind the latest", () => {
    const installed = game({ install_state: "Installed" });
    expect(
      pluginCardState(installed, {
        ...ctx,
        desired: {
          plugin_slug: "retakes",
          channel: "Pinned",
          version: "1.5.0",
        },
      }),
    ).toEqual({ key: "update", current: "1.5.0", latest: "1.5.1" });
    expect(
      pluginCardState(installed, {
        ...ctx,
        desired: { plugin_slug: "retakes", channel: "Auto", version: null },
      }),
    ).toEqual({ key: "installed", version: "1.5.1" });
  });

  it("treats a plugin found on disk as manual", () => {
    expect(pluginCardState(game({ install_state: "Manual" }), ctx).key).toBe(
      "manual",
    );
  });

  it("answers panel plugins from the panel", () => {
    const panel = game({ kind: "panel", versions: [] });
    expect(pluginCardState(panel, { ...ctx, panelInstalled: true }).key).toBe(
      "panel-installed",
    );
    expect(pluginCardState(panel, ctx).key).toBe("panel-available");
  });
});

describe("isPluginInstalled", () => {
  it("counts a failed rollout as installed, not available", () => {
    expect(isPluginInstalled(game({ install_state: "Failed" }), false)).toBe(
      true,
    );
    expect(isPluginInstalled(game(), false)).toBe(false);
  });

  it("counts a bundle installed when either half is", () => {
    expect(isPluginInstalled(game({ kind: "bundle" }), true)).toBe(true);
  });
});

describe("needsAttention", () => {
  it("flags failed, manual and update states only", () => {
    expect(needsAttention({ key: "failed", nodes: [] })).toBe(true);
    expect(needsAttention({ key: "manual", latest: "1" })).toBe(true);
    expect(needsAttention({ key: "update", current: "1", latest: "2" })).toBe(
      true,
    );
    expect(needsAttention({ key: "installed", version: "1" })).toBe(false);
    expect(needsAttention({ key: "installing", installed: 0, target: 1 })).toBe(
      false,
    );
  });
});

describe("retryVersion", () => {
  it("keeps a pinned install pinned", () => {
    expect(
      retryVersion({ plugin_slug: "x", channel: "Pinned", version: "1.2.0" }),
    ).toBe("1.2.0");
    expect(
      retryVersion({ plugin_slug: "x", channel: "Auto", version: null }),
    ).toBeUndefined();
  });
});

describe("installFraction", () => {
  it("clamps and handles no target", () => {
    expect(installFraction(1, 4)).toBe(0.25);
    expect(installFraction(5, 4)).toBe(1);
    expect(installFraction(0, 0)).toBe(0);
  });
});

describe("gridStep", () => {
  // 7 cards, 3 wide:  0 1 2 / 3 4 5 / 6
  it("steps sideways one card and stops at the ends", () => {
    expect(gridStep(1, 7, 3, "ArrowRight")).toBe(2);
    expect(gridStep(2, 7, 3, "ArrowRight")).toBe(3);
    expect(gridStep(6, 7, 3, "ArrowRight")).toBe(6);
    expect(gridStep(0, 7, 3, "ArrowLeft")).toBe(0);
  });

  it("moves a row at a time", () => {
    expect(gridStep(1, 7, 3, "ArrowDown")).toBe(4);
    expect(gridStep(4, 7, 3, "ArrowUp")).toBe(1);
    expect(gridStep(1, 7, 3, "ArrowUp")).toBe(1);
  });

  it("drops onto a shorter last row, and stays on the last row", () => {
    expect(gridStep(5, 7, 3, "ArrowDown")).toBe(6);
    expect(gridStep(6, 7, 3, "ArrowDown")).toBe(6);
  });

  it("starts at the first card and handles an empty grid", () => {
    expect(gridStep(-1, 7, 3, "ArrowDown")).toBe(0);
    expect(gridStep(0, 0, 3, "ArrowDown")).toBe(-1);
  });
});

describe("pluginViewValidators", () => {
  it("never restores the attention tab or an unknown kind", () => {
    expect(pluginViewValidators.state("installed")).toBe(true);
    expect(pluginViewValidators.state("attention")).toBe(false);
    expect(pluginViewValidators.kind("panel")).toBe(true);
    expect(pluginViewValidators.kind("theme")).toBe(false);
    expect(pluginViewValidators.verifiedOnly("yes")).toBe(false);
  });
});

describe("nodeRolloutTone", () => {
  it("never reads Manual or Installing as broken", () => {
    expect(nodeRolloutTone("Installed")).toBe("ok");
    expect(nodeRolloutTone("Installing")).toBe("amber");
    expect(nodeRolloutTone("Manual")).toBe("warn");
    expect(nodeRolloutTone("Failed")).toBe("bad");
    expect(nodeRolloutTone("Pending")).toBe("off");
    expect(nodeRolloutTextClass("Installed")).toBe("text-muted-foreground");
    expect(nodeRolloutTextClass("Manual")).toBe("text-warning");
  });
});
