import { Selector } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";

export const matchOptionsFields = Selector("match_options")({
  id: true,
  type: true,
  mr: true,
  map_veto: true,
  coaches: true,
  knife_round: true,
  default_models: true,
  check_in_setting: true,
  overtime: true,
  region_veto: true,
  best_of: true,
  tv_delay: true,
  number_of_substitutes: true,
  timeout_setting: true,
  tech_timeout_setting: true,
  ready_setting: true,
  map_pool_id: true,
  map_pool: {
    id: true,
    type: true,
    e_type: {
      description: true,
    },
    maps: [{}, mapFields],
  },
});
