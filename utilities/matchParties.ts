// Party colouring for a match's lineups. party_id is a uuid (or a lobby id),
// which is meaningless to look at, so each distinct party in the match gets a
// small index that the badge turns into a colour.
//
// Indexed across the whole match rather than per lineup: a 5stack lobby big
// enough to fill both sides is split across them and must keep one colour.

export type PartyMember = {
  party_id?: string | null;
  party_source?: string | null;
};

// Ordered by first appearance so colours don't shuffle between renders.
export function matchPartyOrder(match: any): Map<string, number> {
  const order = new Map<string, number>();

  for (const lineup of [match?.lineup_1, match?.lineup_2]) {
    for (const member of lineup?.lineup_players ?? []) {
      const partyId = member?.party_id;
      if (partyId && !order.has(partyId)) {
        order.set(partyId, order.size);
      }
    }
  }

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

// Everyone who queued alongside this player, for the rail's tooltip. Spans both
// lineups: a 5stack lobby that fills the whole match is split across the two
// sides and they still queued together.
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
