import { describe, expect, it } from "vitest";
import {
  heroShape,
  heroState,
  roundedPing,
  seatLayout,
  type HeroInputs,
} from "~/components/play/matchmakingHero";

describe("seatLayout", () => {
  it("fills one side for a party that fits it", () => {
    expect(seatLayout(10, 3)).toEqual({
      perSide: 5,
      mine: 3,
      overflow: 0,
      theirs: 0,
    });
  });

  it("fills both sides when the party is the whole match", () => {
    expect(seatLayout(6, 6)).toEqual({
      perSide: 3,
      mine: 3,
      overflow: 0,
      theirs: 3,
    });
  });

  it("spills a party too big for one side past the row", () => {
    expect(seatLayout(4, 3)).toEqual({
      perSide: 2,
      mine: 2,
      overflow: 1,
      theirs: 0,
    });
    expect(seatLayout(2, 3)).toEqual({
      perSide: 1,
      mine: 1,
      overflow: 2,
      theirs: 0,
    });
  });

  it("shows nothing as yours for a guest", () => {
    expect(seatLayout(10, 0)).toEqual({
      perSide: 5,
      mine: 0,
      overflow: 0,
      theirs: 0,
    });
  });
});

const base: HeroInputs = {
  matchmakingAllowed: true,
  matchmakingEnabled: true,
  isGuest: false,
  isBanned: false,
  hasCooldown: false,
  hasConfirmation: false,
  hasMatch: false,
  isSearching: false,
  noRegions: false,
  isMember: false,
};

describe("heroState", () => {
  it("is idle by default", () => {
    expect(heroState(base)).toBe("idle");
  });

  it("shows guests the picker while matchmaking is on, and nothing when off", () => {
    expect(heroState({ ...base, isGuest: true })).toBe("guest");
    expect(
      heroState({ ...base, isGuest: true, matchmakingEnabled: false }),
    ).toBe("hidden");
  });

  it("hides for players below the matchmaking role", () => {
    expect(heroState({ ...base, matchmakingAllowed: false })).toBe("hidden");
  });

  it("puts sanctions ahead of the queue", () => {
    expect(heroState({ ...base, isBanned: true, isSearching: true })).toBe(
      "banned",
    );
    expect(heroState({ ...base, hasCooldown: true, isSearching: true })).toBe(
      "cooldown",
    );
  });

  it("walks searching → found → match", () => {
    expect(heroState({ ...base, isSearching: true })).toBe("searching");
    expect(
      heroState({ ...base, isSearching: true, hasConfirmation: true }),
    ).toBe("found");
    expect(heroState({ ...base, hasConfirmation: true, hasMatch: true })).toBe(
      "match",
    );
  });

  it("asks for regions before letting a leader pick", () => {
    expect(heroState({ ...base, noRegions: true })).toBe("no-region");
  });

  it("locks the picker for a party member", () => {
    expect(heroState({ ...base, isMember: true })).toBe("member");
    // A member still sees the leader's search.
    expect(heroState({ ...base, isMember: true, isSearching: true })).toBe(
      "searching",
    );
  });
});

describe("heroShape", () => {
  it("groups states into the three hero layouts", () => {
    expect(heroShape("idle")).toBe("picker");
    expect(heroShape("guest")).toBe("picker");
    expect(heroShape("member")).toBe("picker");
    expect(heroShape("banned")).toBe("picker");
    expect(heroShape("no-region")).toBe("picker");
    expect(heroShape("searching")).toBe("search");
    expect(heroShape("found")).toBe("search");
    expect(heroShape("match")).toBe("match");
  });
});

describe("roundedPing", () => {
  it("rounds the stored reading and drops missing ones", () => {
    expect(roundedPing("18.42")).toBe(18);
    expect(roundedPing(undefined)).toBeNull();
    expect(roundedPing("n/a")).toBeNull();
  });
});
