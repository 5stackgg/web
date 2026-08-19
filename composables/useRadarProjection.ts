import { computed, onMounted, ref, unref, type Ref } from "vue";

export type MapSplit = {
  bounds: { top: number; bottom: number };
  offset: { x: number; y: number };
};

export type RadarMeta = {
  resolution: number;
  offset: { x: number; y: number };
  splits?: MapSplit[];
};

export type RadarPoint = { x: number; y: number; z?: number };

export const RADAR_CANVAS = 1024;
export const RADAR_PX = 1024;

export function normalizeRadarMapName(name: string | null | undefined): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/_night$/, "");
}

// Nuke and Vertigo stack two playable levels on one radar image. When a point's
// Z falls inside a split's bounds the whole point shifts by a percentage of the
// image, which is what puts the lower level on its own half.
export function applyRadarSplit(z: number, splits: MapSplit[] | undefined) {
  if (!splits) {
    return { dx: 0, dy: 0 };
  }
  for (const s of splits) {
    if (z > s.bounds.bottom && z < s.bounds.top) {
      return { dx: s.offset.x, dy: s.offset.y };
    }
  }
  return { dx: 0, dy: 0 };
}

export function projectWithCalibration(
  p: RadarPoint,
  meta: RadarMeta,
): { x: number; y: number } {
  const { resolution, offset, splits } = meta;
  const split = applyRadarSplit(p.z ?? 0, splits);
  const gameX = p.x + offset.x;
  const gameY = p.y + offset.y;
  const pxX = gameX / resolution + (split.dx / 100) * RADAR_PX;
  const pxYFromBottom = gameY / resolution + (split.dy / 100) * RADAR_PX;
  return {
    x: pxX * (RADAR_CANVAS / RADAR_PX),
    y: RADAR_CANVAS - pxYFromBottom * (RADAR_CANVAS / RADAR_PX),
  };
}

/**
 * Radar pixel back to world units. A point picked off the image carries no
 * height of its own, so the caller has to say which Z it means: on Nuke and
 * Vertigo that Z is what decides which of the two stacked levels the point
 * belongs to, and the wrong one lands it on the other floor.
 */
export function unprojectWithCalibration(
  point: { x: number; y: number },
  meta: RadarMeta,
  z = 0,
): { x: number; y: number; z: number } {
  const { resolution, offset, splits } = meta;
  const split = applyRadarSplit(z, splits);
  const pxX = point.x / (RADAR_CANVAS / RADAR_PX);
  const pxYFromBottom = (RADAR_CANVAS - point.y) / (RADAR_CANVAS / RADAR_PX);
  const gameX = (pxX - (split.dx / 100) * RADAR_PX) * resolution;
  const gameY = (pxYFromBottom - (split.dy / 100) * RADAR_PX) * resolution;
  return { x: gameX - offset.x, y: gameY - offset.y, z };
}

let sharedCalibrations: Record<string, RadarMeta> | null = null;
let sharedLoad: Promise<Record<string, RadarMeta> | null> | null = null;

// One fetch per page load, shared by every caller. The 2D viewer, the analysis
// board and the nade library all mount against the same file.
export function loadRadarCalibrations(): Promise<Record<
  string,
  RadarMeta
> | null> {
  if (sharedCalibrations) {
    return Promise.resolve(sharedCalibrations);
  }
  if (!sharedLoad) {
    sharedLoad = (async () => {
      try {
        const res = await fetch("/radars/metadata.json");
        if (!res.ok) {
          return null;
        }
        const data = await res.json();
        const { _comment, ...rest } = data;
        sharedCalibrations = rest as Record<string, RadarMeta>;
        return sharedCalibrations;
      } catch {
        return null;
      }
    })();
  }
  return sharedLoad;
}

export function useRadarProjection(
  mapName: Ref<string | null | undefined> | (() => string | null | undefined),
  options: { radarFailed?: Ref<boolean> } = {},
) {
  const calibrations = ref<Record<string, RadarMeta> | null>(null);

  const normalizedMap = computed(() =>
    normalizeRadarMapName(
      typeof mapName === "function" ? mapName() : unref(mapName),
    ),
  );

  const calibration = computed<RadarMeta | null>(() => {
    if (!calibrations.value || !normalizedMap.value) {
      return null;
    }
    return calibrations.value[normalizedMap.value] ?? null;
  });

  const radarSrc = computed(() => {
    if (
      !calibration.value ||
      !normalizedMap.value ||
      options.radarFailed?.value
    ) {
      return null;
    }
    return `/radars/${normalizedMap.value}.png`;
  });

  // Undecided until the fetch resolves, so a caller does not flash "no radar"
  // for a map that does in fact have one.
  const hasCalibration = computed(() =>
    calibrations.value === null ? true : !!calibration.value,
  );

  async function load() {
    calibrations.value = await loadRadarCalibrations();
  }

  onMounted(load);

  // Null when the map has no calibration; callers that want an auto-fit
  // fallback layer it on themselves.
  function projectCalibrated(p: RadarPoint) {
    if (!calibration.value) {
      return null;
    }
    return projectWithCalibration(p, calibration.value);
  }

  function unprojectCalibrated(point: { x: number; y: number }, z = 0) {
    if (!calibration.value) {
      return null;
    }
    return unprojectWithCalibration(point, calibration.value, z);
  }

  return {
    calibrations,
    normalizedMap,
    calibration,
    radarSrc,
    hasCalibration,
    projectCalibrated,
    unprojectCalibrated,
    load,
    CANVAS: RADAR_CANVAS,
    RADAR_PX,
  };
}
