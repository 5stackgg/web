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

const KEY_FOR_SLOT = (slot: number) => (slot === 10 ? "0" : String(slot));

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
