// Indexed across the whole match, not per lineup: a lobby big enough to fill
// both sides is split across them and must keep one colour.

// One hue, five depths, rather than five hues. A multi-hue set turns a 14px chip
// into something that looks like a status light, and every hue far enough from
// the others to be legible at that size lands on a colour that already means
// something here — tac-amber (you / captain), the green-yellow-red status ping,
// or the elo blue. A single periwinkle ramp says nothing except "party N", and
// it stays clear of all four. Parties are numbered by first appearance, so the
// lightest step carries almost every match; the ramp only deepens when a match
// actually has several parties in it.
export const PARTY_COLORS = [
  { ring: "#e2e6ff", text: "#eef1ff" }, // step 1
  { ring: "#bfc6fb", text: "#d5daff" }, // step 2
  { ring: "#9ba6f4", text: "#b6bfff" }, // step 3
  { ring: "#7b88ea", text: "#9aa5f7" }, // step 4
  { ring: "#5d6bd8", text: "#8391ee" }, // step 5
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
