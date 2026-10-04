// Pure logic behind the /play matchmaking hero: how a mode's seats fill for a
// party, and which state the hero is in. Kept out of the components so the
// rules are testable without the stores and the socket.

export type SeatLayout = {
  perSide: number;
  // Amber seats on your side (top row).
  mine: number;
  // Hollow red seats past the end of your row: the part of the party that
  // can't fit on one side.
  overflow: number;
  // Amber seats on the other side -- only when the party fills the match.
  theirs: number;
};

// A party fits a mode when it fits one side (the other side is matchmade) or
// fills both sides exactly -- the same rule as canPartyQueue. `party` is 0 for
// a guest, so nothing is amber.
export function seatLayout(expected: number, party: number): SeatLayout {
  const perSide = Math.max(1, Math.floor(expected / 2));
  if (party > 0 && party === expected) {
    return { perSide, mine: perSide, overflow: 0, theirs: perSide };
  }
  return {
    perSide,
    mine: Math.min(party, perSide),
    overflow: Math.max(0, party - perSide),
    theirs: 0,
  };
}

export type HeroState =
  | "hidden"
  | "guest"
  | "banned"
  | "cooldown"
  | "match"
  | "found"
  | "searching"
  | "no-region"
  | "member"
  | "idle";

export type HeroInputs = {
  matchmakingAllowed: boolean;
  matchmakingEnabled: boolean;
  isGuest: boolean;
  isBanned: boolean;
  hasCooldown: boolean;
  // A ready check is pending or its match was created.
  hasConfirmation: boolean;
  // The confirmation's match has loaded.
  hasMatch: boolean;
  isSearching: boolean;
  // Node regions exist but every one is over the player's latency limit.
  noRegions: boolean;
  // In a party that someone else leads.
  isMember: boolean;
};

// Order matters: a sanction outranks the queue, a match outranks the ready
// check that produced it, and the ready check outranks the search under it.
export function heroState(inputs: HeroInputs): HeroState {
  if (inputs.isGuest) {
    return inputs.matchmakingEnabled ? "guest" : "hidden";
  }
  if (!inputs.matchmakingAllowed) return "hidden";
  if (inputs.isBanned) return "banned";
  if (inputs.hasCooldown) return "cooldown";
  if (inputs.hasConfirmation && inputs.hasMatch) return "match";
  if (inputs.hasConfirmation) return "found";
  if (inputs.isSearching) return "searching";
  if (inputs.noRegions) return "no-region";
  if (inputs.isMember) return "member";
  return "idle";
}

// The hero swaps between three shapes; everything that isn't a search or a
// match is the mode picker with a different footer.
export function heroShape(state: HeroState): "picker" | "search" | "match" {
  if (state === "searching" || state === "found") return "search";
  if (state === "match") return "match";
  return "picker";
}

// Latency arrives as a fixed-2 string; the hero shows whole milliseconds.
export function roundedPing(latency: string | undefined): number | null {
  if (latency === undefined) return null;
  const value = Number(latency);
  // A LAN answers in under a millisecond; "0 ms" reads as broken.
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : null;
}
