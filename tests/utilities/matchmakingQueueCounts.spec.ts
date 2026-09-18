import { describe, expect, it } from "vitest";
import { playersInQueue } from "~/utilities/matchmakingPartySize";
import { e_match_types_enum } from "~/generated/zeus";

const COMPETITIVE = e_match_types_enum.Competitive;

describe("playersInQueue", () => {
  it("counts players rather than lobbies", () => {
    const stats = {
      "us-east": {
        [COMPETITIVE]: [
          { lobby: 0, players: 3 },
          { lobby: 1, players: 1 },
        ],
      },
    };

    expect(playersInQueue(stats, COMPETITIVE, ["us-east"])).toBe(4);
  });

  it("counts a lobby queued in several regions once", () => {
    const stats = {
      "us-east": { [COMPETITIVE]: [{ lobby: 0, players: 2 }] },
      "eu-west": { [COMPETITIVE]: [{ lobby: 0, players: 2 }] },
    };

    expect(playersInQueue(stats, COMPETITIVE, ["us-east", "eu-west"])).toBe(2);
  });

  it("adds up the regions the player is actually queued for", () => {
    const stats = {
      "us-east": { [COMPETITIVE]: [{ lobby: 0, players: 2 }] },
      "eu-west": { [COMPETITIVE]: [{ lobby: 1, players: 5 }] },
      "ap-south": { [COMPETITIVE]: [{ lobby: 2, players: 4 }] },
    };

    expect(playersInQueue(stats, COMPETITIVE, ["us-east", "eu-west"])).toBe(7);
  });

  it("is zero when nothing is queued", () => {
    expect(playersInQueue({}, COMPETITIVE, ["us-east"])).toBe(0);
  });
});
