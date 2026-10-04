import { order_by } from "~/generated/zeus";
import { matchOptionsFields } from "./matchOptionsFields";

const bracketRef = {
  id: true,
  round: true,
  group: true,
  match_number: true,
  path: true,
};

// Everything TournamentStage needs to draw a stage's bracket.
export const tournamentBracketStageFields = [
  { order_by: [{ order: order_by.asc }] },
  {
    id: true,
    type: true,
    order: true,
    groups: true,
    third_place_match: true,
    e_tournament_stage_type: { description: true },
    options: matchOptionsFields,
    brackets: [
      {
        order_by: [
          { round: order_by.asc },
          { group: order_by.asc },
          { path: order_by.desc },
          { match_number: order_by.asc },
        ],
      },
      {
        id: true,
        round: true,
        group: true,
        bye: true,
        match_number: true,
        scheduled_at: true,
        scheduled_eta: true,
        team_1_seed: true,
        team_2_seed: true,
        path: true,
        loser_parent_bracket_id: true,
        match_options_id: true,
        options: { best_of: true },
        parent_bracket: bracketRef,
        loser_bracket: bracketRef,
        feeding_brackets: {
          ...bracketRef,
          parent_bracket_id: true,
          loser_parent_bracket_id: true,
          team_1_seed: true,
          team_2_seed: true,
        },
        match: {
          id: true,
          status: true,
          winning_lineup_id: true,
          lineup_1_id: true,
          lineup_2_id: true,
          options: { best_of: true },
          match_maps: [
            { order_by: [{ order: order_by.asc }] },
            {
              lineup_1_score: true,
              lineup_2_score: true,
              winning_lineup_id: true,
              order: true,
              status: true,
            },
          ],
          lineup_1: { id: true, name: true, team_id: true },
          lineup_2: { id: true, name: true, team_id: true },
        },
        team_1: { id: true, name: true, team: { name: true } },
        team_2: { id: true, name: true, team: { name: true } },
        created_at: true,
      },
    ],
  },
] as const;
