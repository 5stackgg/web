import { describe, expect, it } from "vitest";
import {
  adminModeStageOrders,
  isBracketManuallyScheduled,
  isStageManuallyScheduled,
} from "~/utilities/tournamentManualScheduling";

const tournament = (overrides: Record<string, unknown> = {}) => ({
  auto_start: true,
  scheduling_mode: "auto",
  options: { match_mode: "auto" },
  ...overrides,
});

describe("isStageManuallyScheduled", () => {
  it("is automatic with auto start on and Auto match mode", () => {
    expect(isStageManuallyScheduled(tournament(), { options: null })).toBe(
      false,
    );
  });

  it("is manual once auto start is off", () => {
    expect(
      isStageManuallyScheduled(tournament({ auto_start: false }), null),
    ).toBe(true);
  });

  it("is manual for a stage whose own options are in Admin mode, whatever auto start says", () => {
    expect(
      isStageManuallyScheduled(tournament(), {
        options: { match_mode: "admin" },
      }),
    ).toBe(true);
  });

  it("follows the tournament's match mode for a stage without options of its own", () => {
    expect(
      isStageManuallyScheduled(
        tournament({ options: { match_mode: "admin" } }),
        { options: null },
      ),
    ).toBe(true);
    expect(
      isStageManuallyScheduled(
        tournament({ options: { match_mode: "admin" } }),
        { options: { match_mode: "auto" } },
      ),
    ).toBe(false);
  });

  it("leaves negotiated tournaments to the captains", () => {
    expect(
      isStageManuallyScheduled(
        tournament({ scheduling_mode: "negotiated", auto_start: false }),
        { options: { match_mode: "admin" } },
      ),
    ).toBe(false);
  });

  it("does not guess manual when the tournament's auto start was not loaded", () => {
    expect(
      isStageManuallyScheduled({ scheduling_mode: "auto" }, { options: null }),
    ).toBe(false);
  });
});

describe("adminModeStageOrders", () => {
  it("lists the stages whose own options are in Admin mode, in order", () => {
    expect(
      adminModeStageOrders({
        stages: [
          { order: 3, options: { match_mode: "admin" } },
          { order: 2, options: null },
          { order: 1, options: { match_mode: "admin" } },
          { order: 4, options: { match_mode: "auto" } },
        ],
      }),
    ).toEqual([1, 3]);
  });

  it("is empty without stages", () => {
    expect(adminModeStageOrders({})).toEqual([]);
  });

  it("lists the stages that follow a tournament in Admin mode", () => {
    expect(
      adminModeStageOrders({
        options: { match_mode: "admin" },
        stages: [
          { order: 2, options: null },
          { order: 1, options: null },
          { order: 3, options: { match_mode: "auto" } },
        ],
      }),
    ).toEqual([1, 2]);
  });
});

describe("isBracketManuallyScheduled", () => {
  it("reads the bracket's own options before the stage's", () => {
    expect(
      isBracketManuallyScheduled(
        tournament(),
        { options: { match_mode: "admin" } },
        { options: { match_mode: "auto" } },
      ),
    ).toBe(false);
    expect(
      isBracketManuallyScheduled(
        tournament(),
        { options: { match_mode: "auto" } },
        { options: { match_mode: "admin" } },
      ),
    ).toBe(true);
  });

  it("falls back to the stage, then the tournament", () => {
    expect(
      isBracketManuallyScheduled(
        tournament(),
        { options: { match_mode: "admin" } },
        { options: null },
      ),
    ).toBe(true);
    expect(
      isBracketManuallyScheduled(
        tournament({ options: { match_mode: "admin" } }),
        { options: null },
        null,
      ),
    ).toBe(true);
  });

  it("leaves negotiated tournaments to the captains", () => {
    expect(
      isBracketManuallyScheduled(
        tournament({ scheduling_mode: "negotiated" }),
        null,
        { options: { match_mode: "admin" } },
      ),
    ).toBe(false);
  });
});
