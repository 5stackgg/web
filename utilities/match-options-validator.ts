import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { e_match_types_enum, e_timeout_settings_enum } from "~/generated/zeus";

export default function matchOptionsValidator(additional: any) {
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
      timeout_setting: z
        .string()
        .default(e_timeout_settings_enum.CoachAndPlayers),
      tech_timeout_setting: z.string().default(e_timeout_settings_enum.Admin),
      map_pool_id: z.string().nullable(),
      map_pool: z.string().array().default([]),
      custom_map_pool: z.boolean().default(false),
      ...additional,
    }),
  );
}
