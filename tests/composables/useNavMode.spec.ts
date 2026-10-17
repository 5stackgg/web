import { describe, expect, it } from "vitest";
import { isAdminRouteName } from "~/composables/useNavMode";

describe("isAdminRouteName", () => {
  it("puts admin pages and their children in the Admin list", () => {
    expect(isAdminRouteName("game-server-nodes")).toBe(true);
    expect(isAdminRouteName("game-server-nodes-builds")).toBe(true);
    expect(isAdminRouteName("dedicated-servers-id")).toBe(true);
    expect(isAdminRouteName("settings-application-players")).toBe(true);
    expect(isAdminRouteName("stream-deck-matchId")).toBe(true);
    expect(isAdminRouteName("system-metrics")).toBe(true);
  });

  it("keeps public pages and personal settings in the Play list", () => {
    expect(isAdminRouteName("play")).toBe(false);
    expect(isAdminRouteName("matches-id")).toBe(false);
    expect(isAdminRouteName("settings")).toBe(false);
    expect(isAdminRouteName("settings-profile")).toBe(false);
    expect(isAdminRouteName("public-servers")).toBe(false);
  });

  it("does not match a page that only shares a prefix", () => {
    expect(isAdminRouteName("regions-ish")).toBe(true);
    expect(isAdminRouteName("regionsx")).toBe(false);
    expect(isAdminRouteName(undefined)).toBe(false);
    expect(isAdminRouteName(Symbol("x"))).toBe(false);
  });
});
