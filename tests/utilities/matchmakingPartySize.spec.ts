import { describe, expect, it } from "vitest";
import { canPartyQueue } from "~/utilities/matchmakingPartySize";
import { e_match_types_enum } from "~/generated/zeus";

const RUSH = e_match_types_enum.Rush;

describe("canPartyQueue", () => {
  it("lets a Rush party of up to 3 queue into one lineup", () => {
    expect(canPartyQueue(RUSH, 1)).toBe(true);
    expect(canPartyQueue(RUSH, 3)).toBe(true);
  });

  it("lets a full Rush party of 6 queue on its own", () => {
    expect(canPartyQueue(RUSH, 6)).toBe(true);
  });

  it("refuses a Rush party that fits neither one lineup nor the whole match", () => {
    expect(canPartyQueue(RUSH, 4)).toBe(false);
    expect(canPartyQueue(RUSH, 5)).toBe(false);
  });
});
