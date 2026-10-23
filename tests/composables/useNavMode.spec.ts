import { describe, expect, it } from "vitest";
import { isAdminRouteName } from "~/composables/useNavMode";

describe("isAdminRouteName", () => {
  it("puts admin pages and their children in the Admin list", () => {
    expect(isAdminRouteName("admin")).toBe(true);
    expect(isAdminRouteName("awards")).toBe(true);
    expect(isAdminRouteName("game-server-nodes")).toBe(true);
    expect(isAdminRouteName("game-server-nodes-builds")).toBe(true);
    expect(isAdminRouteName("dedicated-servers-id")).toBe(true);
    expect(isAdminRouteName("practice-servers")).toBe(true);
    expect(isAdminRouteName("settings-application-players")).toBe(true);
    expect(isAdminRouteName("stream-deck-matchId")).toBe(true);
    expect(isAdminRouteName("plugins-slug")).toBe(true);
    expect(isAdminRouteName("system-metrics")).toBe(true);
    expect(isAdminRouteName("fleet-telemetry")).toBe(true);
  });

  it("keeps public pages and personal settings in the Play list", () => {
    expect(isAdminRouteName("play")).toBe(false);
    expect(isAdminRouteName("matches-id")).toBe(false);
    expect(isAdminRouteName("settings")).toBe(false);
    expect(isAdminRouteName("settings-profile")).toBe(false);
    expect(isAdminRouteName("public-servers")).toBe(false);
  });

  it("keeps the public award page in Play, though Awards is admin", () => {
    expect(isAdminRouteName("awards-id")).toBe(false);
  });

  it("claims children only for pages that have them", () => {
    expect(isAdminRouteName("regions-ish")).toBe(false);
    expect(isAdminRouteName("seasons-id")).toBe(false);
    expect(isAdminRouteName("regionsx")).toBe(false);
    expect(isAdminRouteName("dedicated-serversx")).toBe(false);
  });

  it("ignores names that aren't strings", () => {
    expect(isAdminRouteName(undefined)).toBe(false);
    expect(isAdminRouteName(null)).toBe(false);
    expect(isAdminRouteName(Symbol("x"))).toBe(false);
  });
});
