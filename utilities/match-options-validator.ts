import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { e_match_types_enum } from "~/generated/zeus";

export default function matchOptionsValidator(additional: any) {
  return toTypedSchema(
    z.object({
      mr: z.string().default("12"),
      map_veto: z.boolean().default(false),
      coaches: z.boolean().default(false),
      knife_round: z.boolean().default(true),
      overtime: z.boolean().default(true),
      best_of: z.string().default("1"),
      number_of_substitutes: z.number().min(0).max(5).default(0),
      type: z.string().default(e_match_types_enum.Competitive),
      ...additional,
    }),
  );
}
