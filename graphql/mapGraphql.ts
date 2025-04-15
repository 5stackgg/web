import { Selector } from "@/generated/zeus";

export const mapFields = Selector("maps")({
  id: true,
  name: true,
  type: true,
  label: true,
  patch: true,
  poster: true,
  active_pool: true,
  workshop_map_id: true,
});
