import { describe, expect, it } from "vitest";
import {
  HOST_TYPES,
  hostModes,
  quickHostPayload,
  rehostPayload,
  snakeBoard,
} from "~/components/play/draftHost";

describe("draftHost", () => {
  it("lists the formats biggest first", () => {
    expect(HOST_TYPES.map((option) => option.perSide)).toEqual([5, 3, 2, 1]);
  });

  it("only auto-splits a duel", () => {
    expect(hostModes("Duel")).toEqual(["Pug"]);
    expect(hostModes("Competitive")).toEqual(["Captains", "Host", "Pug"]);
  });

  it("leaves match options to the api's matchmaking defaults", () => {
    const payload = quickHostPayload({
      type: "Competitive",
      mode: "Captains",
      access: "Open",
      regions: ["us-east"],
    });
    expect(payload).not.toHaveProperty("options");
    expect(payload).toMatchObject({
      captain_selection: "TopEloTwo",
      draft_order: "Snake",
    });
  });

  it("re-hosts a stored payload as-is and nothing without a preset", () => {
    const payload = { type: "Wingman", mode: "Pug" };
    expect(rehostPayload({ payload })).toBe(payload);
    expect(rehostPayload(null)).toBeNull();
  });

  it("snakes the picks between the captains", () => {
    const { teams, pool } = snakeBoard(5);
    expect(teams[0].map((slot) => slot.pick)).toEqual([1, 4, 5, 8]);
    expect(teams[1].map((slot) => slot.pick)).toEqual([2, 3, 6, 7]);
    expect(teams[0][1].state).toBe("picking");
    expect(pool).toBe(5);
  });

  it("leaves the last pick of a 2v2 to the second captain", () => {
    const { teams, pool } = snakeBoard(2);
    expect(teams[0]).toEqual([{ pick: 1, state: "picked" }]);
    expect(teams[1]).toEqual([{ pick: 2, state: "picking" }]);
    expect(pool).toBe(1);
  });
});
