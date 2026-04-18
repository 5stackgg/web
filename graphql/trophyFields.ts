import { Selector } from "@/generated/zeus";

export const trophyFields = Selector("tournament_trophies")({
  id: true,
  tournament_id: true,
  tournament_team_id: true,
  placement: true,
  placement_tier: true,
  tournament_name: true,
  tournament_start: true,
  tournament_type: true,
  custom_name: true,
  silhouette: true,
  image_url: true,
});
