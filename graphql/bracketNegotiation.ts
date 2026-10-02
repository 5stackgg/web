import gql from "graphql-tag";
import { e_league_proposal_statuses_enum, order_by } from "~/generated/zeus";
import { NOT_LEAGUE_TOURNAMENT } from "~/graphql/tournamentFilters";

export const BRACKET_PROPOSAL_HISTORY_LIMIT = 5;

const proposalFields = {
  id: true,
  proposed_time: true,
  status: true,
  message: true,
  proposed_by_steam_id: true,
  proposed_by: {
    steam_id: true,
    name: true,
  },
};

// League division fixtures are negotiated on the league schedule, and a league
// season can hold thousands of proposals, so the bracket cards never load them.
const negotiatedOnBracket = {
  bracket: {
    stage: {
      tournament: NOT_LEAGUE_TOURNAMENT,
    },
  },
};

// Typed loosely: spread into the tournament subscription, the full zeus
// argument types push that selection past the TS instantiation limit.
export const bracketProposalSelection: any = {
  scheduling_proposals: [
    {
      where: {
        status: { _eq: e_league_proposal_statuses_enum.Pending },
        ...negotiatedOnBracket,
      },
      order_by: [{ created_at: order_by.desc }],
    },
    proposalFields,
  ],
  __alias: {
    recent_proposals: {
      scheduling_proposals: [
        {
          where: {
            status: { _neq: e_league_proposal_statuses_enum.Pending },
            ...negotiatedOnBracket,
          },
          order_by: [{ created_at: order_by.desc }],
          limit: BRACKET_PROPOSAL_HISTORY_LIMIT,
        },
        proposalFields,
      ],
    },
  },
};

export const MY_TEAM_MANAGERS_QUERY = gql`
  query GetMyTeamManagers($steamId: bigint!) {
    teams(
      where: {
        _or: [
          { owner_steam_id: { _eq: $steamId } }
          { captain_steam_id: { _eq: $steamId } }
          {
            roster: { player_steam_id: { _eq: $steamId }, role: { _eq: Admin } }
          }
        ]
      }
    ) {
      id
      owner_steam_id
      captain_steam_id
      roster(where: { role: { _eq: Admin } }) {
        player_steam_id
      }
    }
  }
`;
