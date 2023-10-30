import { Selector } from "@/generated/zeus";

export const mapFields = Selector("maps")({
  name: true,
  type: true,
  active_pool: true,
  workshop_map_id: true,
});
