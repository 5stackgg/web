import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { teamVetoStatsQuery } from "~/graphql/teamVetoStatsGraphql";
import type { ScoutLineup, ScoutMap } from "~/utilities/vetoScouting";

// Loads veto scouting for both lineups of a match. A team lineup reads the
// team's past vetoes and the maps they decided; a pickup lineup reads its five
// players' own map results and its captain's past vetoes as captain. The
// match's own veto is left out -- it is still being made.

const emptyMap = (): ScoutMap => ({ wins: 0, played: 0, bans: 0, picks: 0 });

async function loadTeam(match: any, lineup: any): Promise<ScoutLineup> {
  const { data } = await getGraphqlClient().query({
    query: teamVetoStatsQuery,
    variables: { teamId: lineup.team_id },
    fetchPolicy: "network-only",
  });

  const maps: Record<string, ScoutMap> = {};
  const vetoes = new Set<string>();
  const counted = new Set<string>();

  for (const pick of (data as any)?.match_map_veto_picks ?? []) {
    // This veto is still being made; it is not history yet.
    if (!pick.map_id || pick.match_id === match.id) continue;
    const map = (maps[pick.map_id] ??= emptyMap());

    if (pick.type === "Ban" || pick.type === "Pick") {
      vetoes.add(pick.match_id);
      if (pick.type === "Ban") map.bans++;
      else map.picks++;
    }

    // Results only from maps that were decided.
    const played = pick.match?.match_maps?.find(
      (matchMap: any) =>
        matchMap.map_id === pick.map_id && matchMap.winning_lineup_id,
    );
    if (played && !counted.has(played.id)) {
      counted.add(played.id);
      map.played++;
      if (played.winning_lineup_id === pick.match_lineup_id) map.wins++;
    }
  }

  return {
    source: "team",
    owner: lineup.team?.name || lineup.name || "",
    vetoes: vetoes.size,
    maps,
  };
}

function playerResultsQuery(mapIds: string[]) {
  const aliases: Record<string, unknown> = {};
  mapIds.forEach((_, index) => {
    aliases[`wins_${index}`] = {
      v_player_map_wins_aggregate: [
        { where: $(`wins_${index}`, "v_player_map_wins_bool_exp!") },
        { aggregate: { count: true } },
      ],
    };
    aliases[`losses_${index}`] = {
      v_player_map_losses_aggregate: [
        { where: $(`losses_${index}`, "v_player_map_losses_bool_exp!") },
        { aggregate: { count: true } },
      ],
    };
  });
  return generateQuery({ __alias: aliases } as any);
}

const captainVetoesQuery = generateQuery({
  match_map_veto_picks: [
    {
      where: $("where", "match_map_veto_picks_bool_exp!"),
    },
    {
      type: true,
      map_id: true,
      match_id: true,
    },
  ],
});

async function loadPlayers(
  match: any,
  lineup: any,
  mapIds: string[],
): Promise<ScoutLineup | null> {
  const members = lineup.lineup_players ?? [];
  const steamIds = members
    .map((member: any) => member.steam_id)
    .filter(Boolean);
  if (!steamIds.length || !mapIds.length) return null;

  const variables: Record<string, unknown> = {};
  mapIds.forEach((mapId, index) => {
    const where = { steam_id: { _in: steamIds }, map_id: { _eq: mapId } };
    variables[`wins_${index}`] = where;
    variables[`losses_${index}`] = where;
  });

  const captain = members.find((member: any) => member.captain);
  const [results, captainPicks] = await Promise.all([
    getGraphqlClient().query({
      query: playerResultsQuery(mapIds),
      variables,
      fetchPolicy: "network-only",
    }),
    captain?.steam_id
      ? getGraphqlClient().query({
          query: captainVetoesQuery,
          variables: {
            where: {
              match_id: { _neq: match.id },
              type: { _in: ["Ban", "Pick"] },
              match_lineup: {
                lineup_players: {
                  steam_id: { _eq: captain.steam_id },
                  captain: { _eq: true },
                },
              },
            },
          },
          fetchPolicy: "network-only",
        })
      : null,
  ]);

  const maps: Record<string, ScoutMap> = {};
  mapIds.forEach((mapId, index) => {
    const data = results.data as any;
    const wins = data?.[`wins_${index}`]?.aggregate?.count ?? 0;
    const losses = data?.[`losses_${index}`]?.aggregate?.count ?? 0;
    maps[mapId] = { ...emptyMap(), wins, played: wins + losses };
  });

  const vetoes = new Set<string>();
  for (const pick of (captainPicks?.data as any)?.match_map_veto_picks ?? []) {
    if (!pick.map_id) continue;
    vetoes.add(pick.match_id);
    const map = (maps[pick.map_id] ??= emptyMap());
    if (pick.type === "Ban") map.bans++;
    else map.picks++;
  }

  return {
    source: "players",
    owner:
      captain?.player?.name || captain?.placeholder_name || lineup.name || "",
    vetoes: vetoes.size,
    maps,
  };
}

async function loadLineup(
  match: any,
  lineup: any,
  mapIds: string[],
): Promise<ScoutLineup | null> {
  if (!lineup) return null;
  try {
    return lineup.team_id
      ? await loadTeam(match, lineup)
      : await loadPlayers(match, lineup, mapIds);
  } catch {
    // Scouting is extra; the veto works the same without it.
    return null;
  }
}

export async function loadVetoScouting(
  match: any,
  mapIds: string[],
): Promise<[ScoutLineup | null, ScoutLineup | null]> {
  const [first, second] = await Promise.all([
    loadLineup(match, match?.lineup_1, mapIds),
    loadLineup(match, match?.lineup_2, mapIds),
  ]);
  return [first, second];
}
