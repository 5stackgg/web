import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PLAYER_BLOCKED_ERROR,
  blockedIdsChange,
  playerBlockErrorKey,
} from "~/utilities/playerBlocks";

const LOCALES = path.resolve(__dirname, "../../i18n/locales");

function locale(file: string) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, file), "utf8"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
      const errors = locale(file).player_blocks.errors;

      for (const text of Object.values(errors) as string[]) {
        expect(text, file).toBeTruthy();
        expect(text, file).not.toMatch(/\{[^}]*\}/);
      }
    }

    for (const text of Object.values(en.player_blocks.errors) as string[]) {
      expect(text).not.toMatch(/block/i);
    }
  });
});

describe("blockedIdsChange", () => {
  it("names the ids that joined and left the set", () => {
    expect(
      blockedIdsChange(new Set(["a", "b"]), new Set(["b", "c", "d"])),
    ).toEqual({ added: ["c", "d"], removed: ["a"] });
  });

  it("reports nothing for the same set", () => {
    expect(blockedIdsChange(new Set(["a"]), new Set(["a"]))).toEqual({
      added: [],
      removed: [],
    });
  });
});

describe("global apollo error toast", () => {
  async function reportedKeys(message: string) {
    const app = useNuxtApp() as any;
    const t = vi.spyOn(app.$i18n, "t");

    await app.callHook("apollo:error", { graphQLErrors: [{ message }] });

    return t.mock.calls.map(([key]) => key);
  }

  it("words player_blocked under the neutral title instead of the raw code", async () => {
    expect(await reportedKeys("player_blocked")).toEqual([
      "player_blocks.errors.title",
      "player_blocks.errors.player_blocked",
    ]);
  });

  it("leaves every other refusal to the generic toast", async () => {
    expect(await reportedKeys("tournament not found")).toEqual([
      "common.error",
    ]);
  });
});
