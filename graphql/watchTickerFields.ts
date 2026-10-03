import { order_by, Selector } from "~/generated/zeus";

const watchLineupFields = Selector("match_lineups")({
  id: true,
  name: true,
  team: {
    name: true,
    short_name: true,
    avatar_url: true,
  },
  lineup_players: [{}, { checked_in: true }],
});

// What a /watch ticker cell shows. Kept slim (not simpleMatchFields): the
// live list is a subscription and results page in as the row scrolls.
export const watchTickerMatchFields = Selector("matches")({
  id: true,
  status: true,
  scheduled_at: true,
  started_at: true,
  ended_at: true,
  is_in_lineup: true,
  is_coach: true,
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  max_players_per_lineup: true,
  options: {
    best_of: true,
    mr: true,
    type: true,
  },
  lineup_1: watchLineupFields,
  lineup_2: watchLineupFields,
  match_maps: [
    { order_by: [{ order: order_by.asc }] },
    {
      id: true,
      order: true,
      status: true,
      is_current_map: true,
      lineup_1_score: true,
      lineup_2_score: true,
      winning_lineup_id: true,
      map: { name: true, label: true, poster: true },
    },
  ],
  tournament_brackets: [
    { limit: 1 },
    { stage: { tournament: { id: true, name: true } } },
  ],
  event_links: [{ limit: 1 }, { event: { id: true, name: true } }],
  streams: [
    { order_by: [{ priority: order_by.asc }] },
    {
      id: true,
      link: true,
      title: true,
      priority: true,
      is_game_streamer: true,
      is_live: true,
    },
  ],
});
