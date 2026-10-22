import { order_by, Selector } from "~/generated/zeus";

// Everything the team page reads off each of a team's matches: the activity
// feed (components/team/teamActivity.ts) and the match count. Nothing per
// player, since the page loads every match the team has played.
export const teamActivityMatchFields = Selector("matches")({
  id: true,
  status: true,
  created_at: true,
  started_at: true,
  scheduled_at: true,
  ended_at: true,
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  options: {
    best_of: true,
    type: true,
  },
  match_maps: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      winning_lineup_id: true,
      lineup_1_score: true,
      lineup_2_score: true,
      map: {
        name: true,
        label: true,
      },
    },
  ],
  lineup_1: {
    id: true,
    team_id: true,
    name: true,
    team: {
      name: true,
    },
  },
  lineup_2: {
    id: true,
    team_id: true,
    name: true,
    team: {
      name: true,
    },
  },
  tournament_brackets: [
    { limit: 1 },
    {
      stage: {
        tournament: {
          name: true,
        },
      },
    },
  ],
});

export const teamMatchCountFields = Selector("matches")({
  id: true,
  created_at: true,
  started_at: true,
  scheduled_at: true,
});
