// Spec-target layout per match type. CS2's `spec_player <n>` uses
// absolute slot numbers tied to join order, so the numbering changes
// with team size — for 5v5 competitive team 2 starts at slot 6, but
// for Wingman it starts at slot 3, and for Duel at slot 2.
//
// Keys map digit row keys to slots: slot 10 binds to "0" so the
// number row is contiguous on the keyboard. For Wingman / Duel we
// only ever produce slots 1..4 / 1..2, so the "0" mapping is unused.

export type SpecSlot = {
  slot: number;
  team: 1 | 2;
  key: string;
};

// Slot 10 binds to keyboard "0" so the digit row covers all slots.
// Exposed so UI badges (player switcher buttons) can display the
// keypress instead of the raw slot number — operators expect to see
// the key they actually press.
export const keyForSlot = (slot: number): string =>
  slot === 10 ? "0" : String(slot);
const KEY_FOR_SLOT = keyForSlot;

function buildSlots(perTeam: number): SpecSlot[] {
  const out: SpecSlot[] = [];
  for (let i = 0; i < perTeam; i++) {
    const slot = 1 + i;
    out.push({ slot, team: 1, key: KEY_FOR_SLOT(slot) });
  }
  for (let i = 0; i < perTeam; i++) {
    const slot = 1 + perTeam + i;
    out.push({ slot, team: 2, key: KEY_FOR_SLOT(slot) });
  }
  return out;
}

const COMPETITIVE = buildSlots(5);
const WINGMAN = buildSlots(2);
const DUEL = buildSlots(1);

// `type` comes from match_streams.match.options.type — matches the
// e_match_types_enum values: "Competitive" | "Wingman" | "Duel".
// Anything unrecognized falls through to Competitive so a misconfigured
// row doesn't render an empty grid.
export function specSlotsForMatchType(
  type: string | null | undefined,
): SpecSlot[] {
  if (type === "Wingman") return WINGMAN;
  if (type === "Duel") return DUEL;
  return COMPETITIVE;
}

// Total players per team (1 / 2 / 5) — handy for grid-cols sizing.
export function teamSizeForMatchType(type: string | null | undefined): number {
  if (type === "Wingman") return 2;
  if (type === "Duel") return 1;
  return 5;
}

// Effective per-side slot count for layout/keymap. The match type
// gives the *minimum* (so an empty Duel still renders 1v1 placeholders)
// but a demo that contains more players than that — common when a
// Duel/Wingman lobby was actually full of bots, or when the match
// type metadata is stale — gets enough slots to show every player.
// Both sides share the same effective size to keep CT/T digit-key
// numbering contiguous (CT = 1..N, T = N+1..2N).
export function effectivePerSideSize(
  type: string | null | undefined,
  ctCount: number,
  tCount: number,
): number {
  return Math.max(teamSizeForMatchType(type), ctCount, tCount);
}

// Resolve a digit-row keypress to the real GSI slot of whoever is
// rendered at that UI position. Mirrors the team-grouped placement
// in components/stream-deck/SpectatorSlots.vue so keyboard shortcuts
// agree with the chip the operator sees: pressing "6" specs the
// first T-side player, pressing "1" specs the first CT-side player,
// regardless of cs2's join-order slot numbering. Returns null when
// the digit doesn't map to a populated tile (placeholder slot, or
// digit out of range for the match type).
type SlotLike = { slot: number; team: "CT" | "T" | null };
export function resolveKeyToRealSlot(
  key: string,
  ctSlots: SlotLike[],
  tSlots: SlotLike[],
  matchType: string | null | undefined,
): number | null {
  const uiSlot = key === "0" ? 10 : Number(key);
  if (!Number.isInteger(uiSlot) || uiSlot < 1 || uiSlot > 10) return null;
  const size = effectivePerSideSize(matchType, ctSlots.length, tSlots.length);
  if (uiSlot > 2 * size) return null;
  const onCt = uiSlot <= size;
  const source = onCt ? ctSlots : tSlots;
  const index = onCt ? uiSlot - 1 : uiSlot - size - 1;
  const sorted = [...source].sort((a, b) => a.slot - b.slot);
  return sorted[index]?.slot ?? null;
}
