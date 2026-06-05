import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";

// The team's lineup in each match it played → drives the match list, who
// actually repped the team that match (handles stand-ins / roster changes),
// and the per-map win/loss record (match_map.winning_lineup_id === lineup.id).
export const teamCareerLineupsQuery = generateQuery({
  match_lineups: [
    {
      where: {
        team_id: { _eq: $("teamId", "uuid!") },
      },
    },
    {
      id: true,
      match_id: true,
      lineup_players: [{}, { steam_id: true }],
      match: {
        id: true,
        match_maps: [
          {},
          {
            id: true,
            map_id: true,
            winning_lineup_id: true,
            map: {
              id: true,
              name: true,
            },
          },
        ],
      },
    },
  ],
});

// Per-map HLTV-stat rows for every player across the team's matches. Filtered
// back down to the team's own players in JS via the (match_id, steam_id) pairs
// from the lineups query above.
export const teamCareerHltvQuery = generateQuery({
  v_player_match_map_hltv: [
    {
      where: {
        match_id: { _in: $("matchIds", "[uuid!]!") },
      },
    },
    {
      steam_id: true,
      match_id: true,
      match_map_id: true,
      hltv_rating: true,
      adr: true,
      kpr: true,
      dpr: true,
      kast_pct: true,
      rounds_played: true,
      player: playerFields,
    },
  ],
});
