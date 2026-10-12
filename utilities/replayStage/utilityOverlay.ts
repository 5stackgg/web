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
import { GRENADE_ICON, ICON, ICON_GRID, createIconAtlas } from "./stageIcons";
import type { IconAtlas } from "./stageIcons";
import { UTILITY_MARKER_COLORS } from "./teamColors";
import type {
  StageContext,
  StageGrenadeType,
  StageModule,
  StageThrowPath,
  Vec3,
} from "./types";

/**
 * The viewer's utility layers: the heatmap (every detonation of the round as
 * a soft disc on the floor, in its utility's colour with its icon over it)
 * and the grenades picked in the viewer, each with its whole flight held as
 * an arc from where it was thrown to where it went off. Clicks find a disc
 * or a landing through `pickUtility`.
 */
export type UtilityOverlayModule = StageModule & {
  /** Where the equipment SVGs are served, "/img/equipment/" in the app. */
  setIconBase(base: string): void;
  /** The grenade whose disc or landing is under canvas point (x, y), CSS px. */
  pickUtility(x: number, y: number, slop: number): number | null;
};

const HEAT_RADIUS = 96;
/** Smallest a disc is drawn across, CSS px, however far out the camera is. */
const HEAT_MIN_PX = 30;
const LANDING_RADIUS = 70;
const LANDING_MIN_PX = 32;
const ICON_PX = 22;
const CHIP_PX = 27;
/** Icons float this far over the floor so they never sink into it in 3D. */
const ICON_LIFT = 22;
const ARC_POINTS = 72;
const MAX_THROWS = 16;
const MAX_TARGETS = 96;

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

type Target = {
  gid: number;
  x: number;
  y: number;
  z: number;
  r: number;
  minPx: number;
};

export function createUtilityOverlayModule(): UtilityOverlayModule {
  let ctx: StageContext | null = null;
  let decals: FxBatch | null = null;
  let icons: SpriteBatch | null = null;
  let ribbons: ReturnType<typeof createRibbons> | null = null;
  let atlas: IconAtlas | null = null;
  let iconBase = "/img/equipment/";
  const floors = new Map<string, number>();
  const targets: Target[] = Array.from({ length: MAX_TARGETS }, () => ({
    gid: 0,
    x: 0,
    y: 0,
    z: 0,
    r: 0,
    minPx: 0,
  }));
  let targetCount = 0;

  const at = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const src: Vec3 = { x: 0, y: 0, z: 0 };
  const tan: Vec3 = { x: 0, y: 0, z: 0 };
  const view = new THREE.Vector3();

  /** The floor under a point, looked up once per key. */
  function floorOf(key: string, p: Vec3) {
    let z = floors.get(key);
    if (z === undefined) {
      z = groundIndexFor(ctx?.map?.tri)?.floorAt(p.x, p.y, p.z + 16) ?? p.z;
      floors.set(key, z);
    }
    return z;
  }

  function target(gid: number, p: THREE.Vector3, r: number, minPx: number) {
    if (targetCount >= MAX_TARGETS) {
      return;
    }
    const t = targets[targetCount++];
    t.gid = gid;
    t.x = p.x;
    t.y = p.y;
    t.z = p.z;
    t.r = r;
    t.minPx = minPx;
  }

  /**
   * The utility's icon on a dark chip over its spot. Chips read through
   * walls, so a detonation in an alley still shows from a 3D angle.
   */
  function icon(
    type: StageGrenadeType,
    x: number,
    y: number,
    z: number,
    alpha: number,
  ) {
    at.set(x, z + ICON_LIFT, -y);
    icons!.push(at, CHIP_PX, CHIP_PX, BACK, 0.82 * alpha, 0, ICON.disc);
    icons!.push(
      at,
      ICON_PX,
      ICON_PX,
      TINTS[type].mark,
      alpha,
      0,
      GRENADE_ICON[type],
    );
  }

  /** `marked`: the heatmap already rings where it went off. */
  function drawThrow(t: StageThrowPath, marked: boolean) {
    const c = ctx!;
    const r = ribbons!;
    const d = decals!;
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
      const fromZ = floorOf(`${t.key}:from`, from);
      at.set(from.x, fromZ + 1.5, -from.y);
      d.push(at, 48, 48, SHADOW, 0.45, CELL.disc, 0, 0, 16);
      d.push(at, 30, 30, tint.mark, 1, CELL.disc, 0, 0, 10);
      d.push(at, 36, 36, WHITE, 0.9, CELL.ring, 0, 0, 12);
    }
    if (marked) {
      return;
    }
    const z = floorOf(t.key, t.at);
    at.set(t.at.x, z + 1.5, -t.at.y);
    d.push(
      at,
      LANDING_RADIUS * 2.5,
      LANDING_RADIUS * 2.5,
      SHADOW,
      0.4,
      CELL.disc,
      0,
      0,
      LANDING_MIN_PX * 1.25,
    );
    d.push(
      at,
      LANDING_RADIUS * 2,
      LANDING_RADIUS * 2,
      tint.mark,
      0.55,
      CELL.disc,
      0,
      0.2,
      LANDING_MIN_PX,
    );
    d.push(
      at,
      LANDING_RADIUS * 2.1,
      LANDING_RADIUS * 2.1,
      WHITE,
      1,
      CELL.ring,
      0,
      0.3,
      LANDING_MIN_PX * 1.05,
    );
    d.push(
      at,
      LANDING_RADIUS * 1.85,
      LANDING_RADIUS * 1.85,
      tint.mark,
      0.9,
      CELL.ring,
      0,
      0.3,
      LANDING_MIN_PX * 0.92,
    );
    target(t.gid, at, LANDING_RADIUS, LANDING_MIN_PX);
    icon(t.type, t.at.x, t.at.y, z, 1);
  }

  return {
    name: "utility-overlay",
    init(context) {
      ctx = context;
      decals = createFxBatch({
        texture: acquireFxAtlas(),
        max: 256,
        ground: true,
        renderOrder: 3,
      });
      atlas = createIconAtlas(iconBase);
      icons = createSpriteBatch({
        texture: atlas.texture,
        grid: ICON_GRID,
        max: 192,
        screenSpace: true,
        depthTest: false,
        renderOrder: 12,
      });
      icons.setViewport(context.width, context.height);
      ribbons = createRibbons(MAX_THROWS * ARC_POINTS * 2);
      // Over the smoke: a picked grenade's flight is what was asked for.
      ribbons.mesh.renderOrder = 12;
      context.scene.add(decals.mesh, icons.mesh, ribbons.mesh);
    },
    onMap() {
      floors.clear();
    },
    update(frame, context) {
      ctx = context;
      const d = decals!;
      const s = icons!;
      const r = ribbons!;
      d.begin();
      s.begin();
      r.begin();
      targetCount = 0;
      const heat = frame.heat;
      if (heat?.length) {
        let anySelected = false;
        for (const h of heat) {
          anySelected ||= h.selected;
        }
        for (const h of heat) {
          const tint = TINTS[h.type] ?? TINTS.smoke;
          const z = floorOf(h.key, h.at);
          at.set(h.at.x, z + 1.5, -h.at.y);
          // Picked ones lead; while any are, the rest step back.
          const k = h.selected ? 1 : anySelected ? 0.4 : 0.8;
          d.push(
            at,
            HEAT_RADIUS * 2.4,
            HEAT_RADIUS * 2.4,
            SHADOW,
            0.34 * k,
            CELL.disc,
            0,
            0,
            HEAT_MIN_PX * 1.2,
          );
          d.push(
            at,
            HEAT_RADIUS * 2,
            HEAT_RADIUS * 2,
            tint.mark,
            0.75 * k,
            CELL.disc,
            0,
            0.15,
            HEAT_MIN_PX,
          );
          d.push(
            at,
            HEAT_RADIUS * 2,
            HEAT_RADIUS * 2,
            h.selected ? WHITE : tint.mark,
            h.selected ? 1 : 0.7 * k,
            CELL.ring,
            0,
            0.2,
            HEAT_MIN_PX,
          );
          if (h.gid >= 0) {
            target(h.gid, at, HEAT_RADIUS, HEAT_MIN_PX);
          }
          icon(h.type, h.at.x, h.at.y, z, h.selected ? 1 : 0.3 + 0.7 * k);
        }
      }
      const throws = frame.throws;
      if (throws) {
        for (let i = 0; i < throws.length && i < MAX_THROWS; i++) {
          drawThrow(throws[i], !!heat?.length);
        }
      }
      d.sync(context);
      d.end();
      s.end();
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
    pickUtility(x, y, slop) {
      const c = ctx;
      if (!c || !targetCount) {
        return null;
      }
      const camera = c.camera;
      const scale = pxScale(c);
      let best: number | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < targetCount; i++) {
        const t = targets[i];
        view.set(t.x, t.y, t.z).applyMatrix4(camera.matrixWorldInverse);
        const depth = -view.z;
        if (depth <= camera.near) {
          continue;
        }
        view.applyMatrix4(camera.projectionMatrix);
        const sx = (view.x * 0.5 + 0.5) * c.width;
        const sy = (0.5 - view.y * 0.5) * c.height;
        const radius = Math.max(t.r / (depth * scale), t.minPx / 2);
        const dist = Math.hypot(x - sx, y - sy);
        if (dist <= radius + slop && dist < bestDist) {
          best = t.gid;
          bestDist = dist;
        }
      }
      return best;
    },
    dispose() {
      for (const mesh of [decals?.mesh, icons?.mesh, ribbons?.mesh]) {
        mesh?.removeFromParent();
      }
      decals?.dispose();
      icons?.dispose();
      ribbons?.dispose();
      atlas?.dispose();
      if (decals) {
        releaseFxAtlas();
      }
      decals = null;
      icons = null;
      ribbons = null;
      atlas = null;
      floors.clear();
      targetCount = 0;
      ctx = null;
    },
  };
}
