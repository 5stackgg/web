import { e_match_types_enum } from "~/generated/zeus";
import { normalizeMapName } from "~/utilities/mapAssets";

// Active Duty is the Competitive pool. Wingman and Duel flag pools of their
// own, which hold Overpass and Vertigo without making them Active Duty.
export default function activeDutyMaps(
  rows: Array<{
    name: string;
    type?: string | null;
    active_pool?: boolean | null;
  }>,
) {
  return new Set(
    rows
      .filter(
        (map) =>
          map.type === e_match_types_enum.Competitive && !!map.active_pool,
      )
      .map((map) => normalizeMapName(map.name)),
  );
}
