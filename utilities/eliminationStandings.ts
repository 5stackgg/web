// Standings for a single or double elimination bracket. Nobody is ranked by
// wins: a team gets a place only once the bracket has decided it, and teams
// knocked out in the same round share that round's range (5th–8th).

export type PlaceRange = { from: number; to: number };

export type StandingsTeam = {
  id: string;
  name: string;
  teamId: string | null;
  seed: number | null;
  wins: number;
  losses: number;
};

export type StandingsSlot = {
  team: StandingsTeam | null;
  score: number | null;
};

export type StandingsGame = {
  bracket: any;
  live: boolean;
  slots: [StandingsSlot, StandingsSlot];
  // Where the winner and the loser go next; null when they're done here.
  winnerTo: any | null;
  loserTo: any | null;
  // The place this match settles when nobody moves on from it.
  winnerPlace: PlaceRange | null;
  loserPlace: PlaceRange | null;
};

export type StandingsEntry = {
  team: StandingsTeam;
  opponent: StandingsTeam | null;
  score: [number, number] | null;
  won: boolean;
};

export type StandingsBand = PlaceRange & {
  // The match the band's teams went out in.
  bracket: any;
  eliminated: boolean;
  entries: StandingsEntry[];
};

export type EliminationStandings = {
  games: StandingsGame[];
  bands: StandingsBand[];
  total: number;
  remaining: number;
};

const LIVE_STATUSES = ["Live", "Veto"];

type Outcome = "won" | "lost";

function slotTeam(bracket: any, slot: 1 | 2) {
  return slot === 1 ? bracket.team_1 : bracket.team_2;
}

function winnerSlot(bracket: any): 1 | 2 | null {
  const match = bracket.match;
  const winner = match?.winning_lineup_id;
  if (!winner) return null;
  if (winner === match.lineup_1_id) return 1;
  if (winner === match.lineup_2_id) return 2;
  return null;
}

// Rounds on the map for a Bo1, maps won for a series.
export function slotScore(bracket: any, slot: 1 | 2): number | null {
  const match = bracket.match;
  if (!match) return null;
  const maps = match.match_maps || [];
  if ((match.options?.best_of ?? 1) === 1) {
    const map = maps[0];
    if (!map) return null;
    return (slot === 1 ? map.lineup_1_score : map.lineup_2_score) ?? null;
  }
  const lineupId = slot === 1 ? match.lineup_1_id : match.lineup_2_id;
  return maps.filter((map: any) => map.winning_lineup_id === lineupId).length;
}

export function eliminationStandings(brackets: any[]): EliminationStandings {
  const byId = new Map<string, any>(
    brackets.map((bracket) => [bracket.id, bracket]),
  );

  // Matches left to play after this one on the winner's path: the final is 0,
  // the semifinals 1. Going out deeper in the tree is a worse finish.
  const depthCache = new Map<string, number>();
  function depth(bracket: any): number {
    const cached = depthCache.get(bracket.id);
    if (cached !== undefined) return cached;
    let d = 0;
    let current = bracket;
    const seen = new Set<string>();
    while (current?.parent_bracket?.id && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parent_bracket.id);
      if (!current) break;
      d++;
    }
    depthCache.set(bracket.id, d);
    return d;
  }

  // A last-round match fed only by losers is the third-place decider, which
  // ranks below the final at the same depth.
  function decider(bracket: any) {
    const feeds = bracket.feeding_brackets || [];
    return (
      feeds.length > 0 &&
      feeds.every((feed: any) => feed.loser_parent_bracket_id === bracket.id)
    );
  }

  function exitKey(bracket: any, outcome: Outcome) {
    return [
      depth(bracket),
      decider(bracket) ? 1 : 0,
      outcome === "won" ? 0 : 1,
    ];
  }

  // Every finish the bracket can hand out, counted from its shape so a range
  // reads 5th–8th before all four quarterfinals are played.
  const finishes = new Map<string, { key: number[]; count: number }>();
  function addFinish(bracket: any, outcome: Outcome) {
    const key = exitKey(bracket, outcome);
    const id = key.join(":");
    const finish = finishes.get(id) ?? { key, count: 0 };
    finish.count++;
    finishes.set(id, finish);
  }
  for (const bracket of brackets) {
    if (bracket.bye) continue;
    if (!bracket.loser_bracket?.id) addFinish(bracket, "lost");
    if (!bracket.parent_bracket?.id) addFinish(bracket, "won");
  }

  const places = new Map<string, PlaceRange>();
  let total = 0;
  for (const finish of [...finishes.values()].sort((a, b) =>
    compareKeys(a.key, b.key),
  )) {
    places.set(finish.key.join(":"), {
      from: total + 1,
      to: total + finish.count,
    });
    total += finish.count;
  }
  const placeOf = (bracket: any, outcome: Outcome) =>
    places.get(exitKey(bracket, outcome).join(":")) ?? null;

  const teams = new Map<string, StandingsTeam>();
  function teamFor(bracket: any, slot: 1 | 2): StandingsTeam | null {
    const team = slotTeam(bracket, slot);
    if (!team?.id) return null;
    let entry = teams.get(team.id);
    if (!entry) {
      entry = {
        id: team.id,
        name: team.team?.name || team.name || "",
        teamId: team.team_id ?? null,
        seed: null,
        wins: 0,
        losses: 0,
      };
      teams.set(team.id, entry);
    }
    return entry;
  }

  const ordered = [...brackets].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  for (const bracket of ordered) {
    for (const slot of [1, 2] as const) {
      const team = teamFor(bracket, slot);
      const seed = slot === 1 ? bracket.team_1_seed : bracket.team_2_seed;
      if (team && team.seed == null && seed != null) team.seed = seed;
    }
    const won = winnerSlot(bracket);
    if (!won) continue;
    teamFor(bracket, won)!.wins++;
    const lost = teamFor(bracket, won === 1 ? 2 : 1);
    if (lost) lost.losses++;
  }

  const bands = new Map<string, StandingsBand & { key: number[] }>();
  let placed = 0;
  function place(bracket: any, outcome: Outcome, slot: 1 | 2) {
    const team = teamFor(bracket, slot);
    const range = placeOf(bracket, outcome);
    if (!team || !range) return;
    const other = slot === 1 ? 2 : 1;
    const own = slotScore(bracket, slot);
    const theirs = slotScore(bracket, other);
    const key = exitKey(bracket, outcome);
    const id = key.join(":");
    const band = bands.get(id) ?? {
      ...range,
      key,
      bracket,
      eliminated: outcome === "lost",
      entries: [],
    };
    band.entries.push({
      team,
      opponent: teamFor(bracket, other),
      score: own != null && theirs != null ? [own, theirs] : null,
      won: outcome === "won",
    });
    bands.set(id, band);
    placed++;
  }

  const games: StandingsGame[] = [];
  for (const bracket of brackets) {
    if (bracket.bye) continue;
    const won = winnerSlot(bracket);
    if (won) {
      const lost = won === 1 ? 2 : 1;
      if (!bracket.loser_bracket?.id) place(bracket, "lost", lost);
      if (!bracket.parent_bracket?.id) place(bracket, "won", won);
      continue;
    }
    if (bracket.finished || (!bracket.team_1 && !bracket.team_2)) continue;
    games.push({
      bracket,
      live: LIVE_STATUSES.includes(bracket.match?.status),
      slots: [1, 2].map((slot) => ({
        team: teamFor(bracket, slot as 1 | 2),
        score: bracket.match ? slotScore(bracket, slot as 1 | 2) : null,
      })) as [StandingsSlot, StandingsSlot],
      winnerTo: byId.get(bracket.parent_bracket?.id) ?? null,
      loserTo: byId.get(bracket.loser_bracket?.id) ?? null,
      winnerPlace: bracket.parent_bracket?.id ? null : placeOf(bracket, "won"),
      loserPlace: bracket.loser_bracket?.id ? null : placeOf(bracket, "lost"),
    });
  }

  games.sort(
    (a, b) =>
      Number(b.live) - Number(a.live) ||
      startsAt(a.bracket) - startsAt(b.bracket) ||
      depth(b.bracket) - depth(a.bracket) ||
      (a.bracket.match_number ?? 0) - (b.bracket.match_number ?? 0),
  );

  return {
    games,
    bands: [...bands.values()]
      .sort((a, b) => compareKeys(a.key, b.key))
      .map(({ key: _key, ...band }) => ({
        ...band,
        entries: band.entries.sort(
          (a, b) => (a.team.seed ?? Infinity) - (b.team.seed ?? Infinity),
        ),
      })),
    total,
    remaining: Math.max(total - placed, 0),
  };
}

function startsAt(bracket: any) {
  const at =
    bracket.scheduled_at ||
    bracket.match?.scheduled_at ||
    bracket.scheduled_eta;
  return at ? new Date(at).getTime() : Infinity;
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
