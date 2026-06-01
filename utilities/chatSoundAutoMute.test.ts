import { describe, expect, it } from "vitest";
import { shouldAutoMuteChatSound } from "./chatSoundAutoMute";

describe("shouldAutoMuteChatSound", () => {
  const steamId = "76561197966948546";
  const liveLineupMatch = {
    id: "match-1",
    status: "Live",
    is_in_lineup: true,
  };

  it("auto-mutes when the current player is in game for a live lineup match", () => {
    expect(
      shouldAutoMuteChatSound(steamId, [liveLineupMatch], {
        "match:match-1": new Map([[steamId, { inGame: true }]]),
      }),
    ).toBe(true);
  });

  it("does not auto-mute when the current player is not reported in game", () => {
    expect(
      shouldAutoMuteChatSound(steamId, [liveLineupMatch], {
        "match:match-1": new Map([[steamId, { inGame: false }]]),
      }),
    ).toBe(false);
  });

  it("does not auto-mute outside live lineup matches", () => {
    expect(
      shouldAutoMuteChatSound(
        steamId,
        [
          { ...liveLineupMatch, status: "WaitingForServer" },
          { ...liveLineupMatch, id: "match-2", is_in_lineup: false },
        ],
        {
          "match:match-1": new Map([[steamId, { inGame: true }]]),
          "match:match-2": new Map([[steamId, { inGame: true }]]),
        },
      ),
    ).toBe(false);
  });

  it("does not auto-mute without a current Steam ID", () => {
    expect(
      shouldAutoMuteChatSound(undefined, [liveLineupMatch], {
        "match:match-1": new Map([[steamId, { inGame: true }]]),
      }),
    ).toBe(false);
  });
});
