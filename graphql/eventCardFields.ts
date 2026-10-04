import gql from "graphql-tag";
import { order_by } from "~/generated/zeus";

const count = [{}, { aggregate: { count: true } }] as const;

export const compactEventFields = {
  id: true,
  name: true,
  starts_at: true,
  ends_at: true,
  banner: { id: true, filename: true, mime_type: true },
  tournaments_aggregate: count,
  teams_aggregate: count,
  players_aggregate: count,
  media_aggregate: count,
};

export const featuredEventFields = {
  ...compactEventFields,
  banner_media_id: true,
  hide_creator_organizer: true,
  organizer_steam_id: true,
  organizer: { name: true },
  organizers: [{}, { steam_id: true, organizer: { name: true } }],
  tournaments: [
    {},
    {
      tournament_id: true,
      tournament: {
        id: true,
        name: true,
        status: true,
        start: true,
        options: { type: true },
        prizes: [{}, { prize: true }],
        teams_aggregate: count,
        stages: [
          { order_by: [{ order: order_by.asc }] },
          {
            type: true,
            order: true,
            results: [
              {},
              {
                rank: true,
                team: { name: true, team: { name: true, short_name: true } },
              },
            ],
          },
        ],
        awards: [
          { where: { placement: { _eq: 1 } } },
          {
            placement: true,
            tournament_team: {
              name: true,
              team: { name: true, short_name: true },
            },
          },
        ],
      },
    },
  ],
};

// Top three by rating; empty until the event's matches have been played.
export const eventLeaderboardQuery = gql`
  query WatchEventLeaderboard($eventId: uuid!) {
    get_event_leaderboard(
      args: {
        _event_id: $eventId
        _category: "rating"
        _match_type: null
        _min_rounds: 0
      }
      order_by: [{ value: desc }]
      limit: 3
    ) {
      player_steam_id
      player_name
      player_avatar_url
      value
      matches_played
    }
  }
`;
