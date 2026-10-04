import cleanMapName from "~/utilities/cleanMapName";
import {
  teamLineupId,
  teamOpponent,
  teamResult,
  type TeamResult,
} from "~/utilities/teamResults";
import { resolveAwardTier, type AwardTier } from "~/utilities/awardSeed";
import type { Clip } from "~/types/clip";

export type ActivityEvent =
  | {
      kind: "result";
      key: string;
      at: string;
      result: TeamResult;
      matchId: string;
      opponent: { name: string; teamId: string | null };
      score: [number, number] | null;
      context: string[];
      // Public clips from this match, top play first.
      clips: Clip[];
    }
  | {
      kind: "award";
      key: string;
      at: string;
      grant: any;
      tier: AwardTier;
      placement: number | null;
      name: string;
      manual: boolean;
    }
  | {
      kind: "league";
      key: string;
      at: string;
      move: "promote" | "relegate" | "stay" | "start";
      seasonId: string;
      season: string;
      division: string | null;
      rank: number | null;
    }
  | { kind: "invite"; key: string; at: string; name: string; by: string | null }
  | { kind: "created"; key: string; at: string };

export type ActivitySources = {
  teamId: string;
  matches: any[];
  awards: any[];
  leagueTeams: any[];
  clips: Clip[];
  invites: any[];
  createdAt: string | null;
  now: Date;
};

const PROMOTE = ["Promote", "DirectPromote", "RelegationUp"];
const RELEGATE = ["Relegate", "DirectRelegate", "RelegationDown"];
const STAY = ["Stay", "Hold"];

function mapLabel(map: any): string {
  return map?.label || (map?.name ? cleanMapName(map.name) : "");
}

// Our score first: maps won in a series, round score in a single map.
function resultScore(match: any, teamId: string): [number, number] | null {
  const ours = teamLineupId(match, teamId);
  const maps: any[] = match?.match_maps ?? [];
  const oursIsOne = ours === match?.lineup_1_id;
  if ((match?.options?.best_of ?? 1) > 1) {
    const won = (id: string | null) =>
      maps.filter((mm) => id && mm.winning_lineup_id === id).length;
    const theirs = oursIsOne ? match.lineup_2_id : match.lineup_1_id;
    return [won(ours), won(theirs)];
  }
  const played = [...maps]
    .reverse()
    .find((mm) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0);
  if (!played) return null;
  const one = played.lineup_1_score ?? 0;
  const two = played.lineup_2_score ?? 0;
  return oursIsOne ? [one, two] : [two, one];
}

// Most kills, then the shortest clip, then the most watched -- the same
// "top play" order the highlights tab uses.
function byTopPlay(a: Clip, b: Clip) {
  return (
    (b.kills_count ?? 0) - (a.kills_count ?? 0) ||
    (a.duration_ms ?? 0) - (b.duration_ms ?? 0) ||
    (b.views_count ?? 0) - (a.views_count ?? 0)
  );
}

function clipsByMatch(clips: Clip[]) {
  const byMatch = new Map<string, Clip[]>();
  for (const clip of clips) {
    const matchId = clip.match_map?.match?.id;
    if (!matchId) continue;
    byMatch.set(matchId, [...(byMatch.get(matchId) ?? []), clip]);
  }
  for (const list of byMatch.values()) list.sort(byTopPlay);
  return byMatch;
}

function resultEvents(
  teamId: string,
  matches: any[],
  clips: Clip[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const matchClips = clipsByMatch(clips);
  for (const match of matches) {
    const result = teamResult(match, teamId);
    if (!result || !match.ended_at) continue;
    const opponent = teamOpponent(match, teamId);
    const maps = (match.match_maps ?? [])
      .filter((mm: any) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0))
      .map((mm: any) => mapLabel(mm.map))
      .filter(Boolean);
    events.push({
      kind: "result",
      key: `match-${match.id}`,
      at: match.ended_at,
      result,
      matchId: match.id,
      opponent: {
        name: opponent?.team?.name || opponent?.name || "",
        teamId: opponent?.team_id ?? null,
      },
      score: resultScore(match, teamId),
      context: [
        match.tournament_brackets?.[0]?.stage?.tournament?.name ??
          match.options?.type,
        maps.join(", "),
      ].filter(Boolean),
      clips: matchClips.get(match.id) ?? [],
    });
  }
  return events;
}

// Same naming and dating rule as the award case: a manual grant is its award
// and the day it was given; a tournament grant is the tournament and its start.
function awardEvents(awards: any[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const grant of awards) {
    // Team pages hide MVP grants; they belong to a player.
    if (grant.placement === 0) continue;
    const manual = grant.source === "manual";
    const name = manual
      ? grant.tournament_award?.custom_name ||
        grant.award?.name ||
        grant.tournament?.name
      : grant.tournament_award?.custom_name ||
        grant.tournament?.name ||
        grant.award?.name;
    const at = manual
      ? grant.created_at
      : grant.tournament?.start || grant.created_at;
    if (!name || !at) continue;
    events.push({
      kind: "award",
      key: `award-${grant.id}`,
      at,
      grant,
      tier: resolveAwardTier(grant.placement, grant.award?.tier),
      placement: grant.placement ?? null,
      name,
      manual,
    });
  }
  return events;
}

function leagueEvents(leagueTeams: any[], now: Date): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const leagueTeam of leagueTeams) {
    const seasons: any[] = leagueTeam.team_seasons ?? [];
    for (const teamSeason of seasons) {
      const startsAt = teamSeason.season?.starts_at;
      if (
        teamSeason.status !== "Approved" ||
        !startsAt ||
        new Date(startsAt) > now
      ) {
        continue;
      }
      events.push({
        kind: "league",
        key: `season-${teamSeason.id}`,
        at: startsAt,
        move: "start",
        seasonId: teamSeason.league_season_id,
        season: teamSeason.season.name,
        division: teamSeason.assigned_division?.name ?? null,
        rank: null,
      });
    }
    for (const movement of leagueTeam.movements ?? []) {
      if (!movement.approved_at) continue;
      const move = PROMOTE.includes(movement.type)
        ? "promote"
        : RELEGATE.includes(movement.type)
          ? "relegate"
          : STAY.includes(movement.type)
            ? "stay"
            : null;
      if (!move) continue;
      const season =
        movement.season?.name ??
        seasons.find((s) => s.league_season_id === movement.league_season_id)
          ?.season?.name;
      if (!season) continue;
      const to =
        movement.final_to_division?.name ?? movement.computed_to_division?.name;
      events.push({
        kind: "league",
        key: `movement-${movement.id}`,
        at: movement.approved_at,
        move,
        seasonId: movement.league_season_id,
        season,
        division:
          move === "stay"
            ? (movement.from_division?.name ?? null)
            : (to ?? null),
        rank: movement.final_rank ?? null,
      });
    }
  }
  return events.filter(
    (event) =>
      event.kind !== "league" || event.move === "start" || event.division,
  );
}

export function buildTeamActivity(
  sources: ActivitySources,
  limit = 40,
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...resultEvents(sources.teamId, sources.matches, sources.clips),
    ...awardEvents(sources.awards),
    ...leagueEvents(sources.leagueTeams, sources.now),
    ...sources.invites
      .filter((invite) => invite.created_at && invite.player?.name)
      .map((invite): ActivityEvent => ({
        kind: "invite",
        key: `invite-${invite.id}`,
        at: invite.created_at,
        name: invite.player.name,
        by: invite.invited_by?.name ?? null,
      })),
  ];
  if (sources.createdAt) {
    events.push({ kind: "created", key: "created", at: sources.createdAt });
  }
  return events
    .filter((event) => !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
