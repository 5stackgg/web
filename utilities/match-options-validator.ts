import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import {
  e_match_types_enum,
  e_ready_settings_enum,
  e_timeout_settings_enum,
} from "~/generated/zeus";

export default function matchOptionsValidator(component: any, additional: any) {
  return toTypedSchema(
    z.object({
      mr: z.string().default("12"),
      map_veto: z.boolean().default(true),
      region_veto: z.boolean().default(true),
      regions: z.string().array().default([]),
      coaches: z.boolean().default(false),
      tv_delay: z.number().min(0).max(120).default(115),
      knife_round: z.boolean().default(true),
      overtime: z.boolean().default(true),
      best_of: z.string().default("1"),
      number_of_substitutes: z.number().min(0).max(5).default(0),
      type: z.string().default(e_match_types_enum.Competitive),
      ready_setting: z.string().default(e_ready_settings_enum.Players),
      timeout_setting: z
        .string()
        .default(e_timeout_settings_enum.CoachAndPlayers),
      tech_timeout_setting: z.string().default(e_timeout_settings_enum.Admin),
      map_pool_id: z.string().nullable(),
      map_pool: z
        .string()
        .array()
        .default([])
        .refine(
          (data) => {
            if (component.form.values.custom_map_pool) {
              return data.length > 0;
            }
            return !!component.form.values.map_pool_id;
          },
          {
            message: component.$t("validation.map_pool_required"),
            path: ["map_pool"],
          },
        ),
      custom_map_pool: z.boolean().default(false),
      ...additional,
    }),
  );
}
