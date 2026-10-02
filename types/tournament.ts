import type { Proposal } from "~/utilities/leagueFixtures";

export interface Bracket {
  id: string;
  round?: number;
  bye?: boolean;
  finished?: boolean;
  match_number?: number;
  path?: string;
  group?: number;
  scheduled_at?: string;
  scheduled_eta?: string;
  options?: any;
  feeding_brackets?: Array<{
    id: string;
    round: number;
    match_number?: number;
    path?: string;
    group?: number;
    parent_bracket_id?: string;
    loser_parent_bracket_id?: string;
    team_1_seed?: number;
    team_2_seed?: number;
  }>;
  match?: {
    id: string;
    status?: string;
    scheduled_at?: string | null;
    e_match_status?: {
      description: string;
    };
    options?: {
      best_of?: number;
    };
    lineup_1?: any;
    lineup_2?: any;
    match_maps?: Array<{ status?: string }>;
  };
  parent_bracket?: {
    id?: string;
    round: number;
    group?: number;
    match_number?: number;
    path?: string;
  };
  loser_bracket?: {
    id?: string;
    round: number;
    group?: number;
    match_number?: number;
    path?: string;
  };
  team_1?: {
    id?: string;
    name?: string;
    team_id?: string | null;
    team?: {
      name?: string;
    };
  };
  team_2?: {
    id?: string;
    name?: string;
    team_id?: string | null;
    team?: {
      name?: string;
    };
  };
  scheduling_proposals?: Proposal[];
  recent_proposals?: Proposal[];
  team_1_seed?: number;
  team_2_seed?: number;
  stage?: {
    options?: {
      best_of?: number;
    };
  };
  tournament?: {
    is_organizer?: boolean;
    status?: string;
    options?: {
      best_of?: number;
    };
  };
}
