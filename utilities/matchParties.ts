// Indexed across the whole match, not per lineup: a lobby big enough to fill
// both sides is split across them and must keep one colour.

// Picked in OKLCH at a fixed L 0.75 / C 0.12 so all five read as equally bright
// on the card — plain HSL at one lightness makes the violet look half-dead next
// to the cyan. Hues dodge every colour that already carries meaning here:
// tac-amber (you / captain), the green-yellow-red status ping, and the elo blue.
// Ordered so the smallest lineups get the furthest-apart hues: parties are
// numbered by first appearance, so each prefix of this list has to hold up on
// its own. Cyan sits last because it is the closest pair with teal.
export const PARTY_COLORS = [
  { ring: "#e18fc6", text: "#f7acdd" }, // pink
  { ring: "#4fc6a2", text: "#78debd" }, // teal
  { ring: "#a6a3f7", text: "#c0beff" }, // violet
  { ring: "#56baef", text: "#7dd3ff" }, // azure
  { ring: "#2cc5c5", text: "#65dddd" }, // cyan
];

export function partyColor(index: number): { ring: string; text: string } {
  return PARTY_COLORS[index % PARTY_COLORS.length];
}

// The avatar is 40px in a row with ~10px of headroom, and the rows above and
// below paint opaque backgrounds over anything that spills out of the cell —
// so the ring plus its glow has to stay inside that budget or it gets sheared.
export function partyRingShadow(index: number): string {
  const { ring } = partyColor(index);
  return `0 0 0 2px ${ring}, 0 0 6px -2px ${ring}`;
}

export type PartyMember = {
  steam_id?: string | number | null;
  party_id?: string | null;
  party_source?: string | null;
};

// Every row asks for its own index, so without this the match is re-walked once
// per row per render. Keyed on identity, so a new result object busts it.
const orderCache = new WeakMap<object, Map<string, number>>();
const partyBySteamIdCache = new WeakMap<object, Map<string, string>>();

function walk(match: any) {
  const order = new Map<string, number>();
  const bySteamId = new Map<string, string>();

  for (const lineup of [match.lineup_1, match.lineup_2]) {
    for (const member of lineup?.lineup_players ?? []) {
      const partyId = member?.party_id;
      if (!partyId) {
        continue;
      }
      if (!order.has(partyId)) {
        // Ordered by first appearance so colours don't shuffle between renders.
        order.set(partyId, order.size);
      }
      if (member?.steam_id != null) {
        bySteamId.set(String(member.steam_id), partyId);
      }
    }
  }

  orderCache.set(match, order);
  partyBySteamIdCache.set(match, bySteamId);
}

export function matchPartyOrder(match: any): Map<string, number> {
  if (!match || typeof match !== "object") {
    return new Map();
  }

  if (!orderCache.has(match)) {
    walk(match);
  }

  return orderCache.get(match)!;
}

// The scoreboard replaces lineup_players wholesale with rows from the stats
// query, which doesn't select party_id, so the row itself may not carry the
// party — the match shell always does.
function partyIdFor(match: any, member: PartyMember | null | undefined) {
  if (member?.party_id) {
    return member.party_id;
  }

  if (!match || typeof match !== "object" || member?.steam_id == null) {
    return null;
  }

  if (!partyBySteamIdCache.has(match)) {
    walk(match);
  }

  return partyBySteamIdCache.get(match)!.get(String(member.steam_id)) ?? null;
}

export function partyIndexOf(
  match: any,
  member: PartyMember | null | undefined,
): number | null {
  const partyId = partyIdFor(match, member);
  if (!partyId) {
    return null;
  }
  return matchPartyOrder(match).get(partyId) ?? null;
}

export function partyMemberNames(
  match: any,
  member: PartyMember | null,
): string[] {
  const partyId = partyIdFor(match, member);
  if (!partyId) {
    return [];
  }

  const names: string[] = [];
  for (const lineup of [match?.lineup_1, match?.lineup_2]) {
    for (const other of lineup?.lineup_players ?? []) {
      if (other?.party_id !== partyId) {
        continue;
      }
      const name = other?.player?.name ?? other?.placeholder_name;
      if (name) {
        names.push(name);
      }
    }
  }
  return names;
}
