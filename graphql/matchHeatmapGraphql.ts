import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export const matchHeatmapQuery = generateQuery({
  player_kills: [
    {
      where: {
        match_id: { _eq: $("matchId", "uuid!") },
      },
    },
    {
      round: true,
      match_map_id: true,
      attacker_steam_id: true,
      attacked_steam_id: true,
      attacker_location_coordinates: true,
      attacked_location_coordinates: true,
    },
  ],
  player_utility: [
    {
      where: {
        match_id: { _eq: $("matchId", "uuid!") },
      },
    },
    {
      round: true,
      type: true,
      match_map_id: true,
      attacker_steam_id: true,
      attacker_location_coordinates: true,
    },
  ],
  // Utility damage (HE + molotov/incendiary), plotted at the victim's location
  // and weighted by damage dealt — "where utility actually does work".
  player_damages: [
    {
      where: {
        match_id: { _eq: $("matchId", "uuid!") },
        with: { _in: ["hegrenade", "molotov", "inferno", "incgrenade"] },
      },
    },
    {
      round: true,
      match_map_id: true,
      attacker_steam_id: true,
      with: true,
      damage: true,
      attacked_location_coordinates: true,
    },
  ],
});
