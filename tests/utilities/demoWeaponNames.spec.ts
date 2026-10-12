// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  internalWeaponName,
  normalizeRoundInventory,
} from "~/utilities/demoWeaponNames";
import { weaponBasename } from "~/utilities/weaponIcon";

describe("internalWeaponName", () => {
  it("tells the M4A1-S from the M4A4", () => {
    expect(internalWeaponName("M4A1")).toBe("m4a1_silencer");
    expect(internalWeaponName("M4A4")).toBe("m4a1");
    expect(weaponBasename(internalWeaponName("M4A1"))).toBe("m4a1_silencer");
    expect(weaponBasename(internalWeaponName("M4A4"))).toBe("m4a1");
  });

  it("maps the rest of demoinfocs' guns and gear", () => {
    expect(internalWeaponName("USP-S")).toBe("usp_silencer");
    expect(internalWeaponName("P2000")).toBe("hkp2000");
    expect(internalWeaponName("CZ75 Auto")).toBe("cz75a");
    expect(internalWeaponName("Desert Eagle")).toBe("deagle");
    expect(internalWeaponName("Dual Berettas")).toBe("elite");
    expect(internalWeaponName("R8 Revolver")).toBe("revolver");
    expect(internalWeaponName("Galil AR")).toBe("galilar");
    expect(internalWeaponName("SG 553")).toBe("sg556");
    expect(internalWeaponName("SSG 08")).toBe("ssg08");
    expect(internalWeaponName("PP-Bizon")).toBe("bizon");
    expect(internalWeaponName("Zeus x27")).toBe("taser");
    expect(internalWeaponName("Incendiary Grenade")).toBe("inferno");
    expect(internalWeaponName("Kevlar + Helmet")).toBe("assaultsuit");
    expect(internalWeaponName("Defuse Kit")).toBe("defuser");
  });

  it("leaves internal names and unknowns alone", () => {
    expect(internalWeaponName("m4a1")).toBe("m4a1");
    expect(internalWeaponName("m4a1_silencer")).toBe("m4a1_silencer");
    expect(internalWeaponName("usp_silencer")).toBe("usp_silencer");
    expect(internalWeaponName("Some New Gun")).toBe("Some New Gun");
    expect(internalWeaponName("constructor")).toBe("constructor");
    expect(internalWeaponName(null)).toBeNull();
  });
});

describe("normalizeRoundInventory", () => {
  it("renames primary and secondary, keeping the rest", () => {
    const rows = [
      {
        round: 1,
        steam_id: "a",
        primary: "M4A1",
        secondary: "USP-S",
        armor: 100,
      },
      { round: 1, steam_id: "b", primary: null, secondary: "glock", armor: 0 },
    ];
    expect(normalizeRoundInventory(rows)).toEqual([
      {
        round: 1,
        steam_id: "a",
        primary: "m4a1_silencer",
        secondary: "usp_silencer",
        armor: 100,
      },
      { round: 1, steam_id: "b", primary: null, secondary: "glock", armor: 0 },
    ]);
  });
});
