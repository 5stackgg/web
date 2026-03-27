export interface Bracket {
  id: string;
  round?: number;
  bye?: boolean;
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
    parent_bracket_id?: string;
    loser_parent_bracket_id?: string;
    team_1_seed?: number;
    team_2_seed?: number;
  }>;
  match?: {
    id: string;
    status?: string;
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
    name?: string;
    team?: {
      name?: string;
    };
  };
  team_2?: {
    name?: string;
    team?: {
      name?: string;
    };
  };
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
