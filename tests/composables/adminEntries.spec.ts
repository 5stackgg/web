import { describe, expect, it } from "vitest";
import {
  ADMIN_ENTRIES,
  ADMIN_GROUPS,
  groupAdminEntries,
  visibleAdminEntries,
  type AdminAccess,
} from "~/composables/adminEntries";
import { roleOrder } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

function accessAs(
  role: e_player_roles_enum,
  settings: Partial<Omit<AdminAccess, "above">> = {},
): AdminAccess {
  return {
    above: (gate) => roleOrder.indexOf(role) >= roleOrder.indexOf(gate),
    canManageAwards: false,
    canGrantAwards: false,
    seasonsEnabled: true,
    gamePluginsEnabled: true,
    fleetTelemetry: false,
    ...settings,
  };
}

const ids = (entries: { id: string }[]) => entries.map(({ id }) => id);

describe("admin entries", () => {
  it("has one entry per id and per route, each in a known group", () => {
    expect(new Set(ids(ADMIN_ENTRIES)).size).toBe(ADMIN_ENTRIES.length);
    expect(new Set(ADMIN_ENTRIES.map((entry) => entry.route)).size).toBe(
      ADMIN_ENTRIES.length,
    );
    const groups = ADMIN_GROUPS.map((group) => group.id);
    for (const entry of ADMIN_ENTRIES) {
      expect(entry.group === null || groups.includes(entry.group)).toBe(true);
    }
  });

  it("gives an administrator every page, the Overview first", () => {
    const entries = visibleAdminEntries(
      accessAs(e_player_roles_enum.administrator, { canManageAwards: true }),
      { nav: true },
    );
    expect(entries[0].id).toBe("overview");
    expect(ids(entries)).toEqual(
      expect.arrayContaining([
        "awards",
        "seasons",
        "game-server-nodes",
        "control-room",
        "render-queue",
        "app-settings",
      ]),
    );
    expect(entries.at(-1)?.id).toBe("app-settings");
  });

  it("opens Control Room alone to a streamer, behind the same gate as its middleware", () => {
    expect(
      ids(visibleAdminEntries(accessAs(e_player_roles_enum.streamer))),
    ).toEqual(["control-room"]);
    expect(
      ids(visibleAdminEntries(accessAs(e_player_roles_enum.verified_user))),
    ).toEqual([]);
  });

  it("gives an organizer who can grant awards Awards and Control Room", () => {
    expect(
      ids(
        visibleAdminEntries(
          accessAs(e_player_roles_enum.match_organizer, {
            canGrantAwards: true,
          }),
        ),
      ),
    ).toEqual(["awards", "control-room"]);
  });

  it("follows the feature settings", () => {
    const entries = ids(
      visibleAdminEntries(
        accessAs(e_player_roles_enum.administrator, {
          seasonsEnabled: false,
          gamePluginsEnabled: false,
        }),
      ),
    );
    expect(entries).not.toContain("seasons");
    expect(entries).not.toContain("plugins");
    expect(entries).not.toContain("awards");
  });

  it("keeps Fleet telemetry to 5stack.gg and out of the Admin list", () => {
    const admin = accessAs(e_player_roles_enum.administrator, {
      fleetTelemetry: true,
    });
    expect(ids(visibleAdminEntries(admin))).toContain("fleet-telemetry");
    expect(ids(visibleAdminEntries(admin, { nav: true }))).not.toContain(
      "fleet-telemetry",
    );
    expect(
      ids(visibleAdminEntries(accessAs(e_player_roles_enum.administrator))),
    ).not.toContain("fleet-telemetry");
  });

  it("drops a page this build has no route for", () => {
    const entries = visibleAdminEntries(
      accessAs(e_player_roles_enum.administrator),
      { hasRoute: (name) => name !== "admin" },
    );
    expect(ids(entries)).not.toContain("overview");
    expect(ids(entries)).toContain("regions");
  });

  it("groups in nav order with the ungrouped Overview leading", () => {
    const groups = groupAdminEntries(
      visibleAdminEntries(
        accessAs(e_player_roles_enum.administrator, { canManageAwards: true }),
        { nav: true },
      ),
    );
    expect(groups.map((group) => group.id)).toEqual([
      null,
      "competition",
      "servers",
      "media",
      "monitoring",
      "site",
    ]);
    expect(ids(groups[2].entries)).toEqual([
      "game-server-nodes",
      "dedicated-servers",
      "gpu-nodes",
      "regions",
    ]);
  });
});
