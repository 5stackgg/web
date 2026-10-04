import { $, Selector } from "~/generated/zeus";
import { watchTickerMatchFields } from "~/graphql/watchTickerFields";

// A finished match as far as a team's form needs: who won, and which lineup
// was the team.
export const teamResultMatchFields = Selector("matches")({
  id: true,
  status: true,
  ended_at: true,
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  lineup_1: { id: true, team_id: true, name: true },
  lineup_2: { id: true, team_id: true, name: true },
});

// Everything CheckIntoMatch reads, for a match waiting on check-in.
export const teamCheckInMatchFields = Selector("matches")({
  id: true,
  status: true,
  cancels_at: true,
  can_check_in: true,
  is_in_lineup: true,
  scheduled_at: true,
  min_players_per_lineup: true,
  options: { check_in_setting: true, camera_required: true, best_of: true },
  lineup_1: {
    id: true,
    team_id: true,
    name: true,
    lineup_players: [
      {},
      {
        steam_id: true,
        checked_in: true,
        captain: true,
        player: { name: true },
      },
    ],
  },
  lineup_2: {
    id: true,
    team_id: true,
    name: true,
    lineup_players: [
      {},
      {
        steam_id: true,
        checked_in: true,
        captain: true,
        player: { name: true },
      },
    ],
  },
});

const scrimTeamFields = {
  id: true,
  name: true,
  short_name: true,
  avatar_url: true,
};

export const teamScrimRequestFields = Selector("team_scrim_requests")({
  id: true,
  status: true,
  from_team_id: true,
  to_team_id: true,
  awaiting_team_id: true,
  proposed_scheduled_at: true,
  created_at: true,
  from_team: scrimTeamFields,
  to_team: scrimTeamFields,
  match_options: { best_of: true },
});

export const teamPendingInviteFields = Selector("team_invites")({
  id: true,
  created_at: true,
  player: { steam_id: true, name: true },
});

// Matches a team played, for a `matches` where: as a lineup, or as a side of a
// tournament bracket (those lineups don't always carry the team_id). Takes a
// `teamId: uuid!` variable.
export const teamMatchesFilter = {
  _or: [
    { lineup_1: { team_id: { _eq: $("teamId", "uuid!") } } },
    { lineup_2: { team_id: { _eq: $("teamId", "uuid!") } } },
    {
      tournament_brackets: {
        _or: [
          { team_1: { team_id: { _eq: $("teamId", "uuid!") } } },
          { team_2: { team_id: { _eq: $("teamId", "uuid!") } } },
        ],
      },
    },
  ],
};

const stageLineupFields = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  team: { id: true, name: true, short_name: true, avatar_url: true },
  lineup_players: [{}, { checked_in: true, captain: true }],
});

// The /watch ticker fields plus each lineup's team_id, so a team page can tell
// its own side from the opponent's.
export const teamStageMatchFields = Selector("matches")({
  ...watchTickerMatchFields,
  lineup_1: stageLineupFields,
  lineup_2: stageLineupFields,
});
