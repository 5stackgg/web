import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PLAYER_BLOCKED_ERROR,
  playerBlockErrorKey,
} from "~/utilities/playerBlocks";

const LOCALES = path.resolve(__dirname, "../../i18n/locales");

function locale(file: string) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, file), "utf8"));
}

describe("playerBlockErrorKey", () => {
  it("maps the api's player_blocked refusal to the neutral message", () => {
    expect(PLAYER_BLOCKED_ERROR).toBe("player_blocked");
    expect(playerBlockErrorKey("player_blocked")).toBe(
      "player_blocks.errors.player_blocked",
    );
    expect(playerBlockErrorKey(" player_blocked\n")).toBe(
      "player_blocks.errors.player_blocked",
    );
  });

  it("leaves every other message to its own handling", () => {
    for (const message of [
      undefined,
      null,
      "",
      "invite_expired",
      "Player_Blocked",
      "player_blocked_by_you",
      "cannot add: player_blocked",
    ]) {
      expect(playerBlockErrorKey(message)).toBeNull();
    }
  });

  it("never words the refusal in a way that says who blocked whom", () => {
    const en = locale("en.json");

    expect(en.player_blocks.errors.player_blocked).toBe(
      "You can't do that with this player.",
    );

    for (const file of fs.readdirSync(LOCALES)) {
      const { title, player_blocked } = locale(file).player_blocks.errors;

      for (const text of [title, player_blocked]) {
        expect(text, file).toBeTruthy();
        expect(text, file).not.toMatch(/\{[^}]*\}/);
      }
    }

    for (const text of Object.values(en.player_blocks.errors) as string[]) {
      expect(text).not.toMatch(/block/i);
    }
  });
});
