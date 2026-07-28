// Indexed across the whole match, not per lineup: a lobby big enough to fill
// both sides is split across them and must keep one colour.

export type PartyMember = {
  party_id?: string | null;
  party_source?: string | null;
};

// Every row asks for its own index, so without this the match is re-walked once
// per row per render. Keyed on identity, so a new result object busts it.
const orderCache = new WeakMap<object, Map<string, number>>();

// Ordered by first appearance so colours don't shuffle between renders.
export function matchPartyOrder(match: any): Map<string, number> {
  if (!match || typeof match !== "object") {
    return new Map();
  }

  const cached = orderCache.get(match);
  if (cached) {
    return cached;
  }

  const order = new Map<string, number>();
  for (const lineup of [match.lineup_1, match.lineup_2]) {
    for (const member of lineup?.lineup_players ?? []) {
      const partyId = member?.party_id;
      if (partyId && !order.has(partyId)) {
        order.set(partyId, order.size);
      }
    }
  }

  orderCache.set(match, order);
  return order;
}

export function partyIndexOf(
  match: any,
  member: PartyMember | null | undefined,
): number | null {
  const partyId = member?.party_id;
  if (!partyId) {
    return null;
  }
  return matchPartyOrder(match).get(partyId) ?? null;
}

export function partyMemberNames(
  match: any,
  member: (PartyMember & { steam_id?: string | number | null }) | null,
): string[] {
  const partyId = member?.party_id;
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
