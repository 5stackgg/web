export const PLAYER_BLOCKED_ERROR = "player_blocked";

// The api refuses with this one code whichever of the two did the blocking, and
// the wording it maps to must stay just as silent about the direction.
export function playerBlockErrorKey(message?: string | null): string | null {
  return message?.trim() === PLAYER_BLOCKED_ERROR
    ? "player_blocks.errors.player_blocked"
    : null;
}

export function blockedIdsChange(
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
) {
  return {
    added: [...next].filter((steamId) => !previous.has(steamId)),
    removed: [...previous].filter((steamId) => !next.has(steamId)),
  };
}
