// Role helpers for the UI. Classification itself now lives ONLY in the server
// view v_player_match_map_roles (within-team ranking). The client never
// re-classifies — it reads the per-map role and, for career / multi-map
// scopes, tallies which role the player held most.

export type CombatRole = "sniper" | "entry" | "support" | "rifler";

// The view stores the role capitalized ("Sniper"); the UI keys it lowercase.
// "awper" is accepted for back-compat with any cached/old rows.
export function normalizeViewRole(role: string | null | undefined): CombatRole {
  switch ((role ?? "").toLowerCase()) {
    case "sniper":
    case "awper":
      return "sniper";
    case "entry":
      return "entry";
    case "support":
      return "support";
    default:
      return "rifler";
  }
}

export interface RoleTally {
  role: CombatRole;
  rounds: number;
  maps: number;
}

// Rounds (and maps) the player spent in each role, highest first.
export function tallyRoles(
  rows: Array<{ role: string | null | undefined; rounds: number | null }>,
): RoleTally[] {
  const acc = new Map<CombatRole, { rounds: number; maps: number }>();
  for (const row of rows) {
    const role = normalizeViewRole(row.role);
    const cur = acc.get(role) ?? { rounds: 0, maps: 0 };
    cur.rounds += Number(row.rounds ?? 0);
    cur.maps += 1;
    acc.set(role, cur);
  }
  return [...acc.entries()]
    .map(([role, v]) => ({ role, rounds: v.rounds, maps: v.maps }))
    .sort((a, b) => b.rounds - a.rounds);
}
