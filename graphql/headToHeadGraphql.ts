import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export const headToHeadQuery = typedGql("query")({
  v_player_match_head_to_head: [
    {
      where: { match_id: { _eq: $("matchId", "uuid!") } },
    },
    {
      attacker_steam_id: true,
      attacked_steam_id: true,
      kills: true,
      headshot_kills: true,
      damage_dealt: true,
      hits: true,
      flash_count: true,
    },
  ],
});
