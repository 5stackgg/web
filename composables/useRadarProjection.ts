import { computed, onMounted, ref, unref, watch, type Ref } from "vue";

export type MapSplit = {
  bounds: { top: number; bottom: number };
  offset: { x: number; y: number };
};

export type RadarVolume = {
  name: string;
  resolution: number;
  offset: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

export type RadarMeta = {
  resolution: number;
  offset: { x: number; y: number };
  splits?: MapSplit[];
  volumes?: RadarVolume[];
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

// A map that splits its radar into rooms (Rush) gets one radar per volume. The
// room shown is the one MOST of the points stand in, not the first that holds
// one: a player caught mid-teleport, or on a doorway where two rooms' bounds
// meet, would otherwise flip the whole board.
export function pickRadarVolume(
  meta: Pick<RadarMeta, "volumes"> | null | undefined,
  points: RadarPoint[],
): RadarVolume | null {
  const volumes = meta?.volumes;
  if (!volumes?.length || !points.length) {
    return null;
  }

  const counts = new Map<RadarVolume, number>();
  let sumX = 0;
  let sumY = 0;
  let valid = 0;
  for (const point of points) {
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    sumX += x;
    sumY += y;
    valid += 1;
    for (const volume of volumes) {
      const { minX, maxX, minY, maxY } = volume.bounds;
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        counts.set(volume, (counts.get(volume) ?? 0) + 1);
      }
    }
  }
  if (!counts.size) {
    return null;
  }

  const centroidX = sumX / valid;
  const centroidY = sumY / valid;
  let best: RadarVolume | null = null;
  let bestCount = 0;
  let bestDistance = Infinity;
  for (const [volume, count] of counts) {
    const { minX, maxX, minY, maxY } = volume.bounds;
    const distance = Math.hypot(
      (minX + maxX) / 2 - centroidX,
      (minY + maxY) / 2 - centroidY,
    );
    if (count > bestCount || (count === bestCount && distance < bestDistance)) {
      best = volume;
      bestCount = count;
      bestDistance = distance;
    }
  }
  return best;
}

// Volume names are Valve's own -- "room101", "roomparty", "convoy".
export function radarVolumeLabel(
  name: string,
  t: (key: string, params: Record<string, string>) => string,
): string {
  const capitalize = (word: string) =>
    word.charAt(0).toUpperCase() + word.slice(1);
  const room = /^room(.+)$/i.exec(name);
  if (!room) {
    return capitalize(name);
  }
  return t("maps.radar_room.room", {
    name: /^\d+$/.test(room[1]) ? room[1] : capitalize(room[1]),
  });
}

export function projectWithCalibration(
  p: RadarPoint,
  meta: RadarMeta,
): { x: number; y: number } {
  const { resolution, offset, splits } = meta;
  // Hasura serialises double precision as a string so it cannot lose digits,
  // which turns `p.x + offset.x` into string concatenation and throws the point
  // off the map entirely. Coerce here rather than trusting every caller.
  const px = Number(p.x);
  const py = Number(p.y);
  const split = applyRadarSplit(Number(p.z ?? 0), splits);
  const gameX = px + offset.x;
  const gameY = py + offset.y;
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
// board and the utility library all mount against the same file.
export function loadRadarCalibrations(): Promise<Record<
  string,
  RadarMeta
> | null> {
  if (sharedCalibrations) {
    return Promise.resolve(sharedCalibrations);
  }
  if (sharedLoad) {
    return sharedLoad;
  }

  const load = (async () => {
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

  sharedLoad = load;

  // A failure must not be memoised. This promise is what every later caller --
  // the replay viewer, the analysis board, every utility panel -- gets back, so
  // holding a resolved null here would leave the whole page with no calibration
  // over one blip. Dropped instead, and the next caller re-fetches.
  void load.then((result) => {
    if (!result && sharedLoad === load) {
      sharedLoad = null;
    }
  });

  return load;
}

export function useRadarProjection(
  mapName: Ref<string | null | undefined> | (() => string | null | undefined),
  options: {
    radarFailed?: Ref<boolean>;
    volumePoints?: () => RadarPoint[];
  } = {},
) {
  // Already read once this session: start with it, so a radar is on the first
  // frame instead of one tick behind it.
  const calibrations = ref<Record<string, RadarMeta> | null>(
    sharedCalibrations,
  );

  const normalizedMap = computed(() =>
    normalizeRadarMapName(
      typeof mapName === "function" ? mapName() : unref(mapName),
    ),
  );

  const mapCalibration = computed<RadarMeta | null>(() => {
    if (!calibrations.value || !normalizedMap.value) {
      return null;
    }
    return calibrations.value[normalizedMap.value] ?? null;
  });

  const volumes = computed<RadarVolume[]>(
    () => mapCalibration.value?.volumes ?? [],
  );

  // A volume name picked by hand. It means nothing on the next map.
  const volumeOverride = ref<string | null>(null);
  watch(normalizedMap, () => {
    volumeOverride.value = null;
  });

  const activeVolume = computed<RadarVolume | null>(() => {
    if (!volumes.value.length) {
      return null;
    }
    if (volumeOverride.value) {
      const picked = volumes.value.find(
        (volume) => volume.name === volumeOverride.value,
      );
      if (picked) {
        return picked;
      }
    }
    if (!options.volumePoints) {
      return null;
    }
    return pickRadarVolume(mapCalibration.value, options.volumePoints());
  });

  // The volume object itself rather than a copy: the pick re-runs on every
  // point update, and an identical result must not re-project everything.
  const calibration = computed<RadarMeta | null>(
    () => activeVolume.value ?? mapCalibration.value,
  );

  const radarSrc = computed(() => {
    if (
      !calibration.value ||
      !normalizedMap.value ||
      options.radarFailed?.value
    ) {
      return null;
    }
    if (activeVolume.value) {
      return `/radars/${normalizedMap.value}_${activeVolume.value.name}.png`;
    }
    return `/radars/${normalizedMap.value}.png`;
  });

  // Undecided until the fetch resolves, so a caller does not flash "no radar"
  // for a map that does in fact have one.
  const hasCalibration = computed(() =>
    calibrations.value === null ? true : !!mapCalibration.value,
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
    volumes,
    activeVolume,
    volumeOverride,
    radarSrc,
    hasCalibration,
    projectCalibrated,
    unprojectCalibrated,
    load,
    CANVAS: RADAR_CANVAS,
    RADAR_PX,
  };
}
