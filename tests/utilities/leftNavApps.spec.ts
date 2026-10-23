import { describe, expect, it } from "vitest";
import { placeApps, sectionForGroup } from "~/utilities/leftNavApps";

const sections = () => [
  { id: "play", label: "Play", items: ["find", "scrims", "utility"] },
  { id: "compete", label: "Compete", items: ["tournaments", "league"] },
];

const app = (slug: string, nav_group: string | null, nav_order = 0) => ({
  slug,
  nav_group,
  nav_order,
});

const place = (apps: ReturnType<typeof app>[]) =>
  placeApps(sections(), apps, (entry) => entry.slug, "Apps").map((section) => [
    section.id,
    section.label,
    section.items,
  ]);

describe("sectionForGroup", () => {
  it("matches a built-in section by id or label, ignoring case and spaces", () => {
    expect(sectionForGroup("play", sections())).toBe("play");
    expect(sectionForGroup(" Compete ", sections())).toBe("compete");
    expect(sectionForGroup("Social", sections())).toBeNull();
    expect(sectionForGroup("", sections())).toBeNull();
    expect(sectionForGroup(null, sections())).toBeNull();
  });
});

describe("placeApps", () => {
  it("puts an app after the page its nav order names", () => {
    expect(place([app("pickem", "compete", 1)])).toEqual([
      ["play", "Play", ["find", "scrims", "utility"]],
      ["compete", "Compete", ["tournaments", "pickem", "league"]],
    ]);
  });

  it("puts an app with no slot, or one past the end, at the end", () => {
    expect(
      place([app("inventory", "Play"), app("stats", "play", 9)])[0],
    ).toEqual([
      "play",
      "Play",
      ["find", "scrims", "utility", "inventory", "stats"],
    ]);
  });

  it("keeps the arrival order of apps that share a slot", () => {
    expect(
      place([app("b", "play", 1), app("a", "play", 1), app("c", "play", 2)])[0],
    ).toEqual(["play", "Play", ["find", "b", "a", "scrims", "c", "utility"]]);
  });

  it("gives any other group a section of its own, and no group Apps, last", () => {
    expect(
      place([
        app("loose", null),
        app("feed", "Social"),
        app("chat", "social"),
      ]).slice(2),
    ).toEqual([
      ["group:social", "Social", ["feed", "chat"]],
      ["apps", "Apps", ["loose"]],
    ]);
  });

  it("leaves the sections it was given untouched", () => {
    const given = sections();
    placeApps(
      given,
      [app("pickem", "compete", 1)],
      (entry) => entry.slug,
      "Apps",
    );
    expect(given[1].items).toEqual(["tournaments", "league"]);
  });
});
