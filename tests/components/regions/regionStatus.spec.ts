// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  matchesRegionSearch,
  nodeState,
  regionLabel,
  regionMode,
  regionStatusKey,
  regionTone,
  regionViewValidators,
} from "~/components/regions/regionStatus";

describe("regionTone / regionStatusKey", () => {
  it("maps region_status() values to a tone and a sentence", () => {
    expect(regionTone("Online")).toBe("ok");
    expect(regionTone("Partial")).toBe("warn");
    expect(regionTone("Offline")).toBe("bad");
    expect(regionStatusKey("Partial")).toBe("pages.regions.status.partial");
  });

  it("reads Disabled (no servers) as neutral, not as an outage", () => {
    expect(regionTone("Disabled")).toBe("off");
    expect(regionTone(null)).toBe("off");
    expect(regionStatusKey("Disabled")).toBe("pages.regions.status.disabled");
  });
});

describe("regionLabel", () => {
  it("prefers the description and falls back to the ID", () => {
    expect(regionLabel({ value: "US-EAST", description: "US East" })).toBe(
      "US East",
    );
    expect(regionLabel({ value: "LAN", description: "  " })).toBe("LAN");
    expect(regionLabel({ value: "LAN", description: null })).toBe("LAN");
  });
});

describe("regionMode", () => {
  it("reads LAN only over a stale relay flag", () => {
    expect(regionMode({ is_lan: true, steam_relay: true })).toBe("lan");
    expect(regionMode({ is_lan: false, steam_relay: true })).toBe("relay");
    expect(regionMode({ is_lan: false, steam_relay: false })).toBeNull();
  });
});

describe("matchesRegionSearch", () => {
  const region = { value: "US-EAST", description: "Virginia" };

  it("matches the ID or the label, ignoring case and padding", () => {
    expect(matchesRegionSearch(region, "us-e")).toBe(true);
    expect(matchesRegionSearch(region, "  virg ")).toBe(true);
    expect(matchesRegionSearch(region, "frank")).toBe(false);
  });

  it("lets every region through an empty search", () => {
    expect(matchesRegionSearch({ value: "LAN", description: null }, " ")).toBe(
      true,
    );
  });
});

describe("nodeState", () => {
  it("treats a disabled node as disabled whatever it reports", () => {
    expect(nodeState({ status: "Online", enabled: false })).toBe("disabled");
  });

  it("trusts offline_at over a stale Online status", () => {
    expect(
      nodeState({
        status: "Online",
        enabled: true,
        offline_at: "2026-10-16T14:02:00Z",
      }),
    ).toBe("offline");
  });

  it("passes the node statuses through", () => {
    expect(nodeState({ status: "Online", enabled: true })).toBe("online");
    expect(nodeState({ status: "Setup", enabled: true })).toBe("setup");
    expect(nodeState({ status: "NotAcceptingNewMatches", enabled: true })).toBe(
      "not_accepting",
    );
    expect(nodeState({ status: null, enabled: true })).toBe("offline");
  });
});

describe("regionViewValidators", () => {
  it("restores a search and a region value, or nothing", () => {
    expect(regionViewValidators.search("eu")).toBe(true);
    expect(regionViewValidators.search(3)).toBe(false);
    expect(regionViewValidators.selected("US-EAST")).toBe(true);
    expect(regionViewValidators.selected(null)).toBe(true);
    expect(regionViewValidators.selected({})).toBe(false);
  });
});
