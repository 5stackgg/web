import type { UtilityThrowStrength } from "~/types/utility";

export type UtilityDiscoveryStatus =
  | "Predicting"
  | "Queued"
  | "Verifying"
  | "Done"
  | "Failed"
  | "Cancelled";

export type UtilityDiscoveryDirection = "forward" | "back" | "left" | "right";

export type UtilityDiscoveryGait = "walk" | "run";

export type UtilityDiscoveryTechnique = {
  direction: UtilityDiscoveryDirection | null;
  gait: UtilityDiscoveryGait | null;
  jump_throw: boolean;
};

export type UtilityDiscoveryResult = {
  id: string;
  rank: number;
  technique: string;
  move_direction: UtilityDiscoveryDirection | null;
  move_gait: UtilityDiscoveryGait | null;
  jump_throw: boolean;
  measured: boolean;
  strength: UtilityThrowStrength;
  stand_x: number;
  stand_y: number;
  stand_z: number;
  eye_z: number;
  pitch: number;
  yaw: number;
  predicted_land_x: number;
  predicted_land_y: number;
  predicted_land_z: number;
  predicted_distance: number;
  predicted_spread: number;
  predicted_bounces: number;
  status: "predicted" | "verified" | "missed";
  land_x: number | null;
  land_y: number | null;
  land_z: number | null;
  distance: number | null;
  bounces: number | null;
  flight_time_ms: number | null;
  forgiveness: number | null;
  grenades: number | null;
  path: Array<{ x: number; y: number; z: number }> | null;
  is_new: boolean | null;
  utility_lineup_id: string | null;
};

export type UtilityDiscovery = {
  id: string;
  map_name: string;
  status: UtilityDiscoveryStatus;
  predicted: number;
  verified: number;
  missed: number;
  grenades: number;
  error: string | null;
  target_x: number;
  target_y: number;
  target_z: number;
  radius: number;
  area: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    radius?: number;
  };
  techniques: UtilityDiscoveryTechnique[];
  strengths: UtilityThrowStrength[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  results: UtilityDiscoveryResult[];
};

export type UtilityDiscoverySummary = Pick<
  UtilityDiscovery,
  "id" | "status" | "predicted" | "verified" | "created_at"
>;

export type UtilitySmokePreview = {
  x: number;
  y: number;
  z: number;
  ox: number | null;
  oy: number | null;
  oz: number | null;
  vs: number | null;
  dx: number | null;
  dy: number | null;
  dz: number | null;
  den: string | null;
};
