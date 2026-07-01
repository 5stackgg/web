// Single source of truth for turning a player's stored CS2 presence
// (player_steam_bot_friend.last_presence_state) into display text, so the
// friends list and the user's own settings page render it identically.

export type Cs2PresenceState = {
  inCs2?: boolean;
  inGame?: boolean;
  mode?: string | null;
  map?: string | null;
  score?: string | null;
  // Steam's own localized friends-list string, e.g. "Deathmatch - Dust II".
  display?: string | null;
};

const MODE_LABELS: Record<string, string> = {
  competitive: "Competitive",
  premier: "Premier",
  scrimcomp2v2: "Wingman",
  wingman: "Wingman",
  scrimcomp5v5: "5v5 Scrim",
  casual: "Casual",
  deathmatch: "Deathmatch",
  survival: "Danger Zone",
  cooperative: "Co-op Strike",
  coopmission: "Guardian",
};

// jsonb can arrive as an object or a JSON string depending on the client.
export function parseCs2Presence(raw: unknown): Cs2PresenceState | null {
  let s = raw;
  if (typeof s === "string") {
    try {
      s = JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (!s || typeof s !== "object") {
    return null;
  }
  return s as Cs2PresenceState;
}

export function isInCs2(raw: unknown): boolean {
  return parseCs2Presence(raw)?.inCs2 === true;
}

// "Playing Counter-Strike 2 · In menu"
// "Playing Counter-Strike 2 · Premier · de_mirage · 5:3"
// null when the player isn't in CS2.
export function cs2PresenceText(raw: unknown): string | null {
  const s = parseCs2Presence(raw);
  if (!s?.inCs2) {
    return null;
  }
  // Steam's own string is the most accurate ("Deathmatch - Dust II").
  if (s.display) {
    return s.display;
  }
  if (!s.inGame) {
    return "Playing Counter-Strike 2 · In menu";
  }
  const mode = s.mode
    ? (MODE_LABELS[s.mode] ?? s.mode.charAt(0).toUpperCase() + s.mode.slice(1))
    : null;
  const detail = [mode, s.map, s.score].filter(Boolean).join(" · ");
  return detail
    ? `Playing Counter-Strike 2 · ${detail}`
    : "Playing Counter-Strike 2";
}
