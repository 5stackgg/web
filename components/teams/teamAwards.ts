import { order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";

// A team's award grant as the teams list shows it.
export type TeamAwardEntry = {
  id: string;
  placement?: number | null;
  source?: string | null;
  tournament_id?: string | null;
  created_at?: string | null;
  award?: {
    id: string;
    name?: string | null;
    tier?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
  tournament?: {
    id?: string;
    name?: string | null;
    start?: string | null;
    stages?: Array<{ type?: string | null }> | null;
  } | null;
  tournament_award?: {
    custom_name?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
};

// Every team award (player awards excluded): the list rows show them and
// "Tournament winners" filters on them.
export const teamAwardsSubscription = generateSubscription({
  award_recipients: [
    { where: { player_steam_id: { _is_null: true } } },
    {
      id: true,
      team_id: true,
      source: true,
      placement: true,
      placement_tier: true,
      tournament_id: true,
      created_at: true,
      award: {
        id: true,
        name: true,
        tier: true,
        silhouette: true,
        image_url: true,
      },
      tournament: {
        id: true,
        name: true,
        start: true,
        stages: [
          { order_by: [{ order: order_by.desc }], limit: 1 },
          { type: true },
        ],
      },
      tournament_award: {
        custom_name: true,
        silhouette: true,
        image_url: true,
      },
    },
  ],
} as any);

export function groupAwardsByTeam<T extends { team_id?: string | null }>(
  grants: T[],
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const grant of grants) {
    if (grant.team_id) (map[grant.team_id] ??= []).push(grant);
  }
  return map;
}

// Only placements won in a tournament count: a hand-granted award doesn't
// make a team a tournament winner.
export function tournamentWinnerTeamIds(
  grants: Array<{ team_id?: string | null; source?: string | null }>,
): string[] {
  return [
    ...new Set(
      grants
        .filter((grant) => grant.team_id && grant.source === "tournament")
        .map((grant) => grant.team_id as string),
    ),
  ];
}
