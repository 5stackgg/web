import * as THREE from "three";
import {
  CELL,
  acquireFxAtlas,
  createFxBatch,
  groundIndexFor,
  pxScale,
  releaseFxAtlas,
  smoothstep,
} from "./fx";
import type { FxBatch } from "./fx";
import { createRibbons, pathAt } from "./grenades";
import { createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import {
  GRENADE_ICON,
  ICON,
  ICON_GRID,
  countCell,
  createIconAtlas,
} from "./stageIcons";
import type { IconAtlas } from "./stageIcons";
import { UTILITY_MARKER_COLORS } from "./teamColors";
import type {
  StageContext,
  StageFrame,
  StageGrenadeType,
  StageHeatPoint,
  StageModule,
  StageThrowPath,
  Vec3,
} from "./types";

/**
 * The viewer's utility layers: the heatmap (the round's detonations as soft
 * discs on the floor, in the legend's colours, with the utility's icon on a
 * chip over each) and the grenades picked in the viewer, each with its whole
 * flight held as an arc from where it was thrown to where it went off.
 *
 * Detonations of one type close together share a disc with a "×n" tag, and
 * chips that would overlap on screen fan apart. In 2D the discs are an
 * overlay, never cut by walls or roofs; in 3D they lie on the floor and a
 * faint second pass shows the part a wall hides. Clicks find a disc, a chip
 * or a landing through `pickUtilities`.
 */
export type UtilityOverlayModule = StageModule & {
  /** Where the equipment SVGs are served, "/img/equipment/" in the app. */
  setIconBase(base: string): void;
  /** The grenades whose disc, chip or landing is under canvas (x, y), CSS px. */
  pickUtilities(x: number, y: number, slop: number): readonly number[] | null;
  /** The first of them. */
  pickUtility(x: number, y: number, slop: number): number | null;
};

const HEAT_RADIUS = 96;
/** Smallest a disc is drawn across, CSS px, however far out the camera is. */
const HEAT_MIN_PX = 30;
/** Same-type detonations this close (source units) share a disc. */
const CLUSTER_REACH = 120;
const CLUSTER_STOREY = 96;
const LANDING_RADIUS = 70;
const LANDING_MIN_PX = 32;
const ICON_PX = 22;
const CHIP_PX = 27;
/** Chips closer than this on screen, CSS px, are pushed apart. */
const CHIP_GAP = CHIP_PX + 3;
const TAG_PX = 26;
/** Icons float this far over the floor so they never sink into it in 3D. */
const ICON_LIFT = 22;
/** How strong the 3D pass through walls is, against the floor decal. */
const XRAY = 0.3;
const ARC_POINTS = 72;
const MAX_THROWS = 16;
const MAX_CHIPS = 128;
const MAX_OBSTACLES = 48;
/** A utility timer badge: its radius and how far over its spot, CSS px. */
const BADGE_RADIUS = 22;
const BADGE_RISE = 24;

const WHITE = new THREE.Color(0xffffff);
const SHADOW = new THREE.Color(0x000000);
const BACK = new THREE.Color(0x15110d);

// The chrome legend's hues, so a disc reads as the filter button it toggles.
const TINTS = Object.fromEntries(
  Object.entries(UTILITY_MARKER_COLORS).map(([type, hex]) => [
    type,
    {
      mark: new THREE.Color(hex),
      arc: new THREE.Color(hex).lerp(WHITE, 0.15),
    },
  ]),
) as Record<StageGrenadeType, { mark: THREE.Color; arc: THREE.Color }>;

type Cluster = {
  type: StageGrenadeType;
  /** Mean landing, source units; `z` is the floor. */
  x: number;
  y: number;
  z: number;
  gids: number[];
  /** Detonations in it, including any without an id. */
  count: number;
  /** Any of them picked. */
  selected: boolean;
};

/** A chip on screen this frame, with what clicking it picks. */
type Chip = {
  gids: readonly number[];
  type: StageGrenadeType;
  count: number;
  alpha: number;
  /** World anchor (over its spot), screen anchor and the fan's offset, px. */
  anchor: THREE.Vector3;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  /** World units per CSS px at its depth; 0 when behind the camera. */
  perPx: number;
};

/** A disc or landing on the floor, picked by its footprint. */
type Spot = {
  gids: readonly number[];
  at: THREE.Vector3;
  r: number;
  minPx: number;
};

/**
 * Same-type detonations near each other, in the heat list's order. Pure: the
 * floor height of each comes from `floorOf`.
 */
export function clusterHeat(
  heat: readonly StageHeatPoint[],
  floorOf: (point: StageHeatPoint) => number,
): Cluster[] {
  const out: Cluster[] = [];
  for (const h of heat) {
    const z = floorOf(h);
    let into: Cluster | null = null;
    for (const c of out) {
      if (
        c.type === h.type &&
        Math.hypot(c.x - h.at.x, c.y - h.at.y) <= CLUSTER_REACH &&
        Math.abs(c.z - z) <= CLUSTER_STOREY
      ) {
        into = c;
        break;
      }
    }
    if (!into) {
      out.push({
        type: h.type,
        x: h.at.x,
        y: h.at.y,
        z,
        gids: h.gid >= 0 ? [h.gid] : [],
        count: 1,
        selected: h.selected,
      });
      continue;
    }
    const n = into.count++;
    into.x = (into.x * n + h.at.x) / (n + 1);
    into.y = (into.y * n + h.at.y) / (n + 1);
    if (h.gid >= 0) {
      into.gids.push(h.gid);
    }
    into.selected ||= h.selected;
  }
  return out;
}

export function createUtilityOverlayModule(): UtilityOverlayModule {
  let ctx: StageContext | null = null;
  let decals: FxBatch | null = null;
  let xray: FxBatch | null = null;
  let icons: SpriteBatch | null = null;
  let ribbons: ReturnType<typeof createRibbons> | null = null;
  let atlas: IconAtlas | null = null;
  let iconBase = "/img/equipment/";
  const floors = new Map<string, number>();

  let clusteredFrom: readonly StageHeatPoint[] | null = null;
  let clusters: Cluster[] = [];
  const singles = new Map<number, readonly number[]>();

  const chips: Chip[] = Array.from({ length: MAX_CHIPS }, () => ({
    gids: [],
    type: "smoke" as StageGrenadeType,
    count: 1,
    alpha: 1,
    anchor: new THREE.Vector3(),
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
    perPx: 0,
  }));
  let chipCount = 0;
  const spots: Spot[] = Array.from({ length: MAX_CHIPS }, () => ({
    gids: [],
    at: new THREE.Vector3(),
    r: 0,
    minPx: 0,
  }));
  let spotCount = 0;
  const obstacles = new Float32Array(MAX_OBSTACLES * 2);
  let obstacleCount = 0;

  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const view = new THREE.Vector3();
  const src: Vec3 = { x: 0, y: 0, z: 0 };
  const tan: Vec3 = { x: 0, y: 0, z: 0 };
  const spot: Vec3 = { x: 0, y: 0, z: 0 };

  /** Where (x, y) on floor `z` is drawn, through `wpos` (stacked storeys). */
  function floorAt(x: number, y: number, z: number, out: THREE.Vector3) {
    spot.x = x;
    spot.y = y;
    spot.z = z;
    return ctx!.wpos(spot, out);
  }

  /** The floor under a point, looked up once per key. */
  function floorOf(key: string, p: Vec3) {
    let z = floors.get(key);
    if (z === undefined) {
      z = groundIndexFor(ctx?.map?.tri)?.floorAt(p.x, p.y, p.z + 16) ?? p.z;
      floors.set(key, z);
    }
    return z;
  }

  function single(gid: number) {
    let gids = singles.get(gid);
    if (!gids) {
      gids = [gid];
      singles.set(gid, gids);
    }
    return gids;
  }

  /** A disc (or ring) on the floor, and its faint through-the-wall twin in 3D. */
  function floorDecal(
    p: THREE.Vector3,
    size: number,
    color: THREE.Color,
    alpha: number,
    cell: number,
    add: number,
    minPx: number,
  ) {
    decals!.push(p, size, size, color, alpha, cell, 0, add, minPx);
    // Shadows stay on the floor: through a wall they read as dirt.
    if (ctx!.view === "3d" && color !== SHADOW) {
      xray!.push(p, size, size, color, alpha * XRAY, cell, 0, add, minPx);
    }
  }

  function addSpot(
    gids: readonly number[],
    p: THREE.Vector3,
    r: number,
    minPx: number,
  ) {
    if (spotCount >= MAX_CHIPS || !gids.length) {
      return;
    }
    const s = spots[spotCount++];
    s.gids = gids;
    s.at.copy(p);
    s.r = r;
    s.minPx = minPx;
  }

  function addChip(
    gids: readonly number[],
    type: StageGrenadeType,
    count: number,
    floor: THREE.Vector3,
    alpha: number,
  ) {
    if (chipCount >= MAX_CHIPS) {
      return;
    }
    const c = chips[chipCount++];
    c.gids = gids;
    c.type = type;
    c.count = count;
    c.alpha = alpha;
    c.anchor.copy(floor);
    c.anchor.y += ICON_LIFT;
    c.ox = 0;
    c.oy = 0;
    view.copy(c.anchor).project(ctx!.camera);
    const depth =
      (c.anchor.x - eye.x) * forward.x +
      (c.anchor.y - eye.y) * forward.y +
      (c.anchor.z - eye.z) * forward.z;
    c.perPx = depth > ctx!.camera.near ? depth * pxScale(ctx!) : 0;
    c.sx = (view.x * 0.5 + 0.5) * ctx!.width;
    c.sy = (0.5 - view.y * 0.5) * ctx!.height;
  }

  /** Pushes chips apart on screen until none overlap (a few passes). */
  /**
   * The smoke, fire and decoy timer badges (combatTimers) over the utility
   * burning now, as screen circles chips keep clear of. Their spot is the
   * badge's usual one: above the cloud or flames, a pointer's length up.
   */
  function addObstacle(x: number, y: number, z: number) {
    if (obstacleCount >= MAX_OBSTACLES) {
      return;
    }
    spot.x = x;
    spot.y = y;
    spot.z = z;
    ctx!.wpos(spot, view).project(ctx!.camera);
    if (view.z > 1) {
      return;
    }
    obstacles[obstacleCount * 2] = (view.x * 0.5 + 0.5) * ctx!.width;
    obstacles[obstacleCount * 2 + 1] =
      (0.5 - view.y * 0.5) * ctx!.height - BADGE_RISE;
    obstacleCount++;
  }

  function timerBadges(frame: StageFrame) {
    obstacleCount = 0;
    for (const smoke of frame.smokes) {
      if (smoke.remaining !== null) {
        addObstacle(smoke.at.x, smoke.at.y, smoke.at.z + 128);
      }
    }
    for (const inferno of frame.infernos) {
      if (inferno.remaining === null || !inferno.flames.length) {
        continue;
      }
      let x = 0;
      let y = 0;
      let z = -Infinity;
      for (const flame of inferno.flames) {
        x += flame.x;
        y += flame.y;
        z = Math.max(z, flame.z);
      }
      addObstacle(x / inferno.flames.length, y / inferno.flames.length, z + 64);
    }
    for (const det of frame.detonations) {
      if (det.type === "decoy" && det.remaining != null) {
        addObstacle(det.at.x, det.at.y, det.at.z + 24);
      }
    }
  }

  function fan() {
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      // Off the timer badges, which do not move.
      for (let i = 0; i < chipCount; i++) {
        const a = chips[i];
        if (!a.perPx) {
          continue;
        }
        for (let k = 0; k < obstacleCount; k++) {
          let dx = a.sx + a.ox - obstacles[k * 2];
          let dy = a.sy + a.oy - obstacles[k * 2 + 1];
          const d = Math.hypot(dx, dy);
          const need = BADGE_RADIUS + CHIP_PX / 2 + 2;
          if (d >= need) {
            continue;
          }
          if (d < 0.01) {
            dx = 0;
            dy = 1;
          } else {
            dx /= d;
            dy /= d;
          }
          a.ox += dx * (need - d);
          a.oy += dy * (need - d);
          moved = true;
        }
      }
      for (let i = 0; i < chipCount; i++) {
        const a = chips[i];
        if (!a.perPx) {
          continue;
        }
        for (let j = i + 1; j < chipCount; j++) {
          const b = chips[j];
          if (!b.perPx) {
            continue;
          }
          let dx = a.sx + a.ox - (b.sx + b.ox);
          let dy = a.sy + a.oy - (b.sy + b.oy);
          let d = Math.hypot(dx, dy);
          if (d >= CHIP_GAP) {
            continue;
          }
          if (d < 0.01) {
            // Stacked exactly: split along a fixed direction per pair.
            const angle = (i * 7 + j * 3) * 0.9;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            d = 1;
          } else {
            dx /= d;
            dy /= d;
          }
          const push = (CHIP_GAP - Math.min(d, CHIP_GAP)) / 2;
          a.ox += dx * push;
          a.oy += dy * push;
          b.ox -= dx * push;
          b.oy -= dy * push;
          moved = true;
        }
      }
      if (!moved) {
        break;
      }
    }
  }

  function drawChips() {
    const s = icons!;
    for (let i = 0; i < chipCount; i++) {
      const c = chips[i];
      if (!c.perPx) {
        continue;
      }
      at.copy(c.anchor)
        .addScaledVector(right, c.ox * c.perPx)
        .addScaledVector(up, -c.oy * c.perPx);
      s.push(at, CHIP_PX, CHIP_PX, BACK, 0.82 * c.alpha, 0, ICON.disc);
      s.push(
        at,
        ICON_PX,
        ICON_PX,
        TINTS[c.type].mark,
        c.alpha,
        0,
        GRENADE_ICON[c.type],
      );
      if (c.count > 1) {
        at.addScaledVector(right, CHIP_PX * 0.62 * c.perPx).addScaledVector(
          up,
          -CHIP_PX * 0.42 * c.perPx,
        );
        s.push(at, TAG_PX, TAG_PX, WHITE, c.alpha, 0, countCell(c.count));
      }
    }
  }

  function drawThrow(t: StageThrowPath, marked: boolean) {
    const c = ctx!;
    const r = ribbons!;
    const tint = TINTS[t.type] ?? TINTS.smoke;
    const path = t.path;
    if (path.length > 1) {
      // A dark underlay first, so the arc reads on bright floors.
      for (let pass = 0; pass < 2; pass++) {
        if (!r.strip(ARC_POINTS)) {
          break;
        }
        for (let j = 0; j < ARC_POINTS; j++) {
          const u = j / (ARC_POINTS - 1);
          pathAt(path, u, src, tan);
          c.wpos(src, at);
          dir.set(tan.x, tan.z, -tan.y);
          const ends = smoothstep(0, 0.02, u);
          if (pass === 0) {
            r.point(at, dir, 18, 8, SHADOW, 0.4 * ends, 0);
          } else {
            r.point(at, dir, 8, 3.6, tint.arc, ends, 0.25);
          }
        }
        r.endStrip();
      }
      const from = path[0];
      floorAt(from.x, from.y, floorOf(`${t.key}:from`, from) + 1.5, at);
      floorDecal(at, 48, SHADOW, 0.45, CELL.disc, 0, 16);
      floorDecal(at, 30, tint.mark, 1, CELL.disc, 0, 10);
      floorDecal(at, 36, WHITE, 0.9, CELL.ring, 0, 12);
    }
    // The heatmap already rings where a picked grenade went off.
    if (marked) {
      return;
    }
    floorAt(t.at.x, t.at.y, floorOf(t.key, t.at) + 1.5, at);
    floorDecal(
      at,
      LANDING_RADIUS * 2.5,
      SHADOW,
      0.4,
      CELL.disc,
      0,
      LANDING_MIN_PX * 1.25,
    );
    floorDecal(
      at,
      LANDING_RADIUS * 2,
      tint.mark,
      0.55,
      CELL.disc,
      0.2,
      LANDING_MIN_PX,
    );
    floorDecal(
      at,
      LANDING_RADIUS * 2.1,
      WHITE,
      1,
      CELL.ring,
      0.3,
      LANDING_MIN_PX * 1.05,
    );
    floorDecal(
      at,
      LANDING_RADIUS * 1.85,
      tint.mark,
      0.9,
      CELL.ring,
      0.3,
      LANDING_MIN_PX * 0.92,
    );
    const gids = single(t.gid);
    addSpot(gids, at, LANDING_RADIUS, LANDING_MIN_PX);
    addChip(gids, t.type, 1, at, 1);
  }

  function drawHeat(heat: readonly StageHeatPoint[]) {
    if (heat !== clusteredFrom) {
      clusteredFrom = heat;
      clusters = clusterHeat(heat, (h) => floorOf(h.key, h.at));
    }
    let anySelected = false;
    for (const c of clusters) {
      anySelected ||= c.selected;
    }
    for (const c of clusters) {
      const tint = TINTS[c.type] ?? TINTS.smoke;
      floorAt(c.x, c.y, c.z + 1.5, at);
      // Picked ones lead; while any are, the rest step back.
      const k = c.selected ? 1 : anySelected ? 0.4 : 0.8;
      const radius = HEAT_RADIUS * Math.min(1.5, 1 + 0.12 * (c.count - 1));
      floorDecal(
        at,
        radius * 2.4,
        SHADOW,
        0.34 * k,
        CELL.disc,
        0,
        HEAT_MIN_PX * 1.2,
      );
      floorDecal(
        at,
        radius * 2,
        tint.mark,
        0.75 * k,
        CELL.disc,
        0.15,
        HEAT_MIN_PX,
      );
      floorDecal(
        at,
        radius * 2,
        c.selected ? WHITE : tint.mark,
        c.selected ? 1 : 0.7 * k,
        CELL.ring,
        0.2,
        HEAT_MIN_PX,
      );
      addSpot(c.gids, at, radius, HEAT_MIN_PX);
      addChip(c.gids, c.type, c.count, at, c.selected ? 1 : 0.3 + 0.7 * k);
    }
  }

  function pick(x: number, y: number, slop: number) {
    const c = ctx;
    if (!c) {
      return null;
    }
    // Chips first: they sit over the discs, and fanned ones away from them.
    let best: readonly number[] | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < chipCount; i++) {
      const chip = chips[i];
      if (!chip.perPx || !chip.gids.length) {
        continue;
      }
      const d = Math.hypot(x - (chip.sx + chip.ox), y - (chip.sy + chip.oy));
      if (d <= CHIP_PX / 2 + slop && d < bestDist) {
        best = chip.gids;
        bestDist = d;
      }
    }
    if (best) {
      return best;
    }
    const camera = c.camera;
    const scale = pxScale(c);
    for (let i = 0; i < spotCount; i++) {
      const s = spots[i];
      view.copy(s.at).applyMatrix4(camera.matrixWorldInverse);
      const depth = -view.z;
      if (depth <= camera.near) {
        continue;
      }
      view.applyMatrix4(camera.projectionMatrix);
      const sx = (view.x * 0.5 + 0.5) * c.width;
      const sy = (0.5 - view.y * 0.5) * c.height;
      const radius = Math.max(s.r / (depth * scale), s.minPx / 2);
      const d = Math.hypot(x - sx, y - sy);
      if (d <= radius + slop && d < bestDist) {
        best = s.gids;
        bestDist = d;
      }
    }
    return best;
  }

  return {
    name: "utility-overlay",
    init(context) {
      ctx = context;
      const texture = acquireFxAtlas();
      decals = createFxBatch({
        texture,
        max: 384,
        ground: true,
        renderOrder: 3,
      });
      xray = createFxBatch({
        texture: acquireFxAtlas(),
        max: 384,
        ground: true,
        renderOrder: 2.9,
      });
      (xray.mesh.material as THREE.ShaderMaterial).depthTest = false;
      atlas = createIconAtlas(iconBase);
      icons = createSpriteBatch({
        texture: atlas.texture,
        grid: ICON_GRID,
        max: MAX_CHIPS * 3,
        screenSpace: true,
        depthTest: false,
        renderOrder: 12,
      });
      icons.setViewport(context.width, context.height);
      ribbons = createRibbons(MAX_THROWS * ARC_POINTS * 2);
      // Over the smoke: a picked grenade's flight is what was asked for.
      ribbons.mesh.renderOrder = 12;
      context.scene.add(xray.mesh, decals.mesh, icons.mesh, ribbons.mesh);
    },
    onMap() {
      floors.clear();
      clusteredFrom = null;
    },
    update(frame, context) {
      ctx = context;
      const d = decals!;
      const x = xray!;
      const r = ribbons!;
      // From straight above the discs are a radar's: no wall or roof cuts
      // them. In 3D they lie on the floor, and the x-ray pass shows the rest.
      const flat = context.view === "2d";
      (d.mesh.material as THREE.ShaderMaterial).depthTest = !flat;
      (r.mesh.material as THREE.ShaderMaterial).depthTest = !flat;
      d.begin();
      x.begin();
      icons!.begin();
      r.begin();
      chipCount = 0;
      spotCount = 0;
      const camera = context.camera;
      camera.updateMatrixWorld();
      eye.setFromMatrixPosition(camera.matrixWorld);
      camera.getWorldDirection(forward);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);

      const heat = frame.heat;
      if (heat?.length) {
        drawHeat(heat);
      }
      const throws = frame.throws;
      if (throws) {
        for (let i = 0; i < throws.length && i < MAX_THROWS; i++) {
          drawThrow(throws[i], !!heat?.length);
        }
      }
      timerBadges(frame);
      fan();
      drawChips();
      d.sync(context);
      x.sync(context);
      d.end();
      x.end();
      icons!.end();
      r.end(context);
    },
    resize(context) {
      icons?.setViewport(context.width, context.height);
    },
    settle() {
      return atlas?.settle() ?? Promise.resolve();
    },
    setIconBase(base) {
      iconBase = base;
    },
    pickUtilities(x, y, slop) {
      return pick(x, y, slop);
    },
    pickUtility(x, y, slop) {
      return pick(x, y, slop)?.[0] ?? null;
    },
    dispose() {
      for (const mesh of [
        decals?.mesh,
        xray?.mesh,
        icons?.mesh,
        ribbons?.mesh,
      ]) {
        mesh?.removeFromParent();
      }
      decals?.dispose();
      xray?.dispose();
      icons?.dispose();
      ribbons?.dispose();
      atlas?.dispose();
      if (decals) {
        releaseFxAtlas();
        releaseFxAtlas();
      }
      decals = null;
      xray = null;
      icons = null;
      ribbons = null;
      atlas = null;
      floors.clear();
      singles.clear();
      clusteredFrom = null;
      clusters = [];
      chipCount = 0;
      spotCount = 0;
      ctx = null;
    },
  };
}
