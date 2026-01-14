import { $, e_map_pool_types_enum, e_player_roles_enum} from "~/generated/zeus";
import { type FormContext } from "vee-validate";

export const setupOptions = (
  form: FormContext<any>,
  options: any,
  overrides: any = {},
) => {
  form.setValues({
    overtime: options.overtime,
    knife_round: options.knife_round,
    mr: options.mr.toString(),
    best_of: options.best_of.toString(),
    coaches: options.coaches,
    number_of_substitutes: options.number_of_substitutes,
    map_veto: options.map_veto,
    timeout_setting: options.timeout_setting,
    tech_timeout_setting: options.tech_timeout_setting,
    type: options.type,
    default_models: options.default_models,
    region_veto: options.region_veto,
    ready_setting: options.ready_setting,
    map_pool_id: options.map_pool.id,
    regions: options.regions || [],
    tv_delay: options.tv_delay,
    check_in_setting: options.check_in_setting,
    ...overrides,
  });
};

export function setupOptionsVariables(
  values: {
    id?: string;
    mr: string;
    type: string;
    best_of: number;
    knife_round: boolean;
    default_models: boolean;
    overtime: boolean;
    coaches: boolean;
    region_veto: boolean;
    regions: string[];
    number_of_substitutes: number;
    timeout_setting: string;
    ready_setting: string;
    tech_timeout_setting: string;
    check_in_setting: string;
    map_pool_id?: string;
    tv_delay: number;
    map_pool?: {
      id: string;
    };
  },
  additional?: {
    mapPoolId?: string;
    matchOptionsId?: string;
  },
) {
  let mapPoolId;

  if (!!additional?.mapPoolId) {
    mapPoolId = additional.mapPoolId;
  } else if (!!values.map_pool_id) {
    mapPoolId = values.map_pool_id;
  }

  if (values.mr === undefined || values.mr === null) {
    throw new Error("mr is required");
  }

  if (values.type === undefined || values.type === null) {
    throw new Error("type is required");
  }

  if (values.best_of === undefined || values.best_of === null) {
    throw new Error("best_of is required");
  }

  if (values.knife_round === undefined || values.knife_round === null) {
    throw new Error("knife_round is required");
  }

  if (values.default_models === undefined || values.default_models === null) {
    throw new Error("default_models is required");
  }

  if (values.overtime === undefined || values.overtime === null) {
    throw new Error("overtime is required");
  }

  if (values.coaches === undefined || values.coaches === null) {
    throw new Error("coaches is required");
  }

  if (values.region_veto === undefined || values.region_veto === null) {
    throw new Error("region_veto is required");
  }

  if (values.regions === undefined || values.regions === null) {
    throw new Error("regions is required");
  }

  if (
    values.number_of_substitutes === undefined ||
    values.number_of_substitutes === null
  ) {
    throw new Error("number_of_substitutes is required");
  }

  if (values.timeout_setting === undefined || values.timeout_setting === null) {
    throw new Error("timeout_setting is required");
  }

  if (values.ready_setting === undefined || values.ready_setting === null) {
    throw new Error("ready_setting is required");
  }

  if (
    values.tech_timeout_setting === undefined ||
    values.tech_timeout_setting === null
  ) {
    throw new Error("tech_timeout_setting is required");
  }

  if (values.tv_delay === undefined || values.tv_delay === null) {
    throw new Error("tv_delay is required");
  }

  if (
    values.check_in_setting === undefined ||
    values.check_in_setting === null
  ) {
    throw new Error("check_in_setting is required");
  }

  if (!mapPoolId && !values?.map_pool) {
    throw new Error("map_pool is required");
  }

  return {
    ...(additional?.matchOptionsId ? { id: additional.matchOptionsId } : {}),
    mr: values.mr,
    type: values.type,
    best_of: values.best_of,
    knife_round: values.knife_round,
    default_models: values.default_models,
    overtime: values.overtime,
    coaches: values.coaches,
    region_veto: values.region_veto,
    regions: values.regions,
    number_of_substitutes: values.number_of_substitutes,
    timeout_setting: values.timeout_setting,
    ready_setting: values.ready_setting,
    tech_timeout_setting: values.tech_timeout_setting,
    tv_delay: values.tv_delay,
    ...(useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer) ? {
      check_in_setting: values.check_in_setting,
    } : {}),
    ...(mapPoolId
      ? {
          map_pool_id: mapPoolId,
        }
      : {}),
    map_pool: !mapPoolId
      ? {
          data: {
            type: e_map_pool_types_enum.Custom,
            maps: {
              data: values?.map_pool?.map((map_id: string) => {
                return {
                  id: map_id,
                };
              }),
            },
          },
        }
      : null,
  };
}

export function setupOptionsSetMutation(hasMapPoolId: boolean = true) {
  return {
    mr: $("mr", "Int!"),
    type: $("type", "e_match_types_enum!"),
    best_of: $("best_of", "Int!"),
    knife_round: $("knife_round", "Boolean!"),
    default_models: $("default_models", "Boolean!"),
    overtime: $("overtime", "Boolean!"),
    map_veto: true,
    region_veto: $("region_veto", "Boolean!"),
    regions: $("regions", "[String!]!"),
    coaches: $("coaches", "Boolean!"),
    number_of_substitutes: $("number_of_substitutes", "Int!"),
    ready_setting: $("ready_setting", "e_ready_settings_enum!"),
    timeout_setting: $("timeout_setting", "e_timeout_settings_enum!"),
    tech_timeout_setting: $("tech_timeout_setting", "e_timeout_settings_enum!"),
    tv_delay: $("tv_delay", "Int!"),
    ...(useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer) ? {
      check_in_setting: $("check_in_setting", "e_check_in_settings_enum!"),
    } : {}),
    ...(hasMapPoolId
      ? {
          map_pool_id: $("map_pool_id", "uuid!"),
        }
      : {
          map_pool: $("map_pool", "map_pools_obj_rel_insert_input!"),
        }),
  };
}
