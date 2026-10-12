import * as THREE from "three";
import {
  CELL,
  GLSL_PREMULTIPLIED_OUT,
  acquireFxAtlas,
  clamp01,
  createFxBatch,
  easeOutCubic,
  groundIndexFor,
  hashKey,
  premultipliedBlending,
  pxScale,
  rand,
  releaseFxAtlas,
  smoothstep,
} from "./fx";
import type { FxBatch } from "./fx";
import type {
  StageContext,
  StageDetonation,
  StageGrenadeType,
  StageModule,
  StageProjectile,
  Vec3,
} from "./types";
import { UTILITY_COLORS } from "./teamColors";

/** Seconds of flight the glowing trail covers behind a grenade. */
const TRAIL_SECONDS = 0.24;
const TRAIL_POINTS = 16;
/** Real paths are sampled every two ticks; up to this many are drawn as-is. */
const ARC_POINTS = 96;
const MAX_PROJECTILES = 24;
const MAX_RIBBON_POINTS = MAX_PROJECTILES * (ARC_POINTS + 2 * TRAIL_POINTS);

const TYPE_COLORS = UTILITY_COLORS;

function color(hex: number) {
  return new THREE.Color(hex);
}

const WHITE = color(0xffffff);
const FLASH_SHELL = color(0xeaf5ff);
const FLASH_LIGHT = color(0xf4f8ff);
const HE_FIRE = color(0xff9a3a);
const HE_YELLOW = color(0xffd84a);
const HE_LIT_DUST = color(0xf0a050);
const HE_DUST = color(0xb98352);
const HE_DUST_DARK = color(0x7d5a3c);
const HE_HOT_SHARD = color(0xffb347);
const HE_COLD_SHARD = color(0x4a3020);
const HE_SCORCH = color(0x24170e);
const HE_RING = color(0xffd07a);
const SHADOW = color(0x000000);
const DECOY_SPARK = color(0xffe9a8);

type TypeColors = {
  core: THREE.Color;
  glow: THREE.Color;
  trail: THREE.Color;
  arc: THREE.Color;
};

const PROJECTILE_COLORS = Object.fromEntries(
  Object.entries(TYPE_COLORS).map(([type, [core, glow]]) => [
    type,
    {
      core: color(core),
      glow: color(glow),
      trail: color(glow).lerp(WHITE, 0.25),
      arc: color(core).lerp(WHITE, 0.45),
    },
  ]),
) as Record<StageGrenadeType, TypeColors>;

const RIBBON_VERT = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aColor;
attribute vec4 aMisc;
attribute vec2 aDash;
uniform float uPxScale;
varying vec4 vColor;
varying float vSide;
varying vec2 vDash;
varying float vAdd;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 dir = (modelViewMatrix * vec4(aDir, 0.0)).xyz;
  vec3 side = cross(dir, mv.xyz);
  float len = length(side);
  side = len > 1e-6 ? side / len : vec3(1.0, 0.0, 0.0);
  float width = max(aMisc.y, aMisc.z * -mv.z * uPxScale);
  mv.xyz += side * width * 0.5 * aMisc.x;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vSide = aMisc.x;
  vDash = aDash;
  vAdd = aMisc.w;
}
`;

const RIBBON_FRAG = /* glsl */ `
varying vec4 vColor;
varying float vSide;
varying vec2 vDash;
varying float vAdd;
${GLSL_PREMULTIPLIED_OUT}
void main() {
  if (vDash.y > 0.0 && fract(vDash.x / vDash.y) > 0.55) discard;
  float e = 1.0 - abs(vSide);
  float a = vColor.a * smoothstep(0.0, 0.6, e);
  if (a < 0.003) discard;
  vec3 c = mix(vColor.rgb, vec3(1.0), smoothstep(0.5, 1.0, e) * vAdd * 0.9);
  gl_FragColor = fxOut(c, a, vAdd);
}
`;

/** Camera-facing ribbons (grenade trails and arc previews), one draw call. */
export function createRibbons(max: number) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3);
  const dir = new THREE.BufferAttribute(new Float32Array(max * 2 * 3), 3);
  const col = new THREE.BufferAttribute(new Float32Array(max * 2 * 4), 4);
  const misc = new THREE.BufferAttribute(new Float32Array(max * 2 * 4), 4);
  const dash = new THREE.BufferAttribute(new Float32Array(max * 2 * 2), 2);
  const index = new THREE.BufferAttribute(new Uint16Array(max * 6), 1);
  const attrs = [position, dir, col, misc, dash];
  for (const attr of [...attrs, index]) {
    attr.setUsage(THREE.DynamicDrawUsage);
  }
  geometry.setAttribute("position", position);
  geometry.setAttribute("aDir", dir);
  geometry.setAttribute("aColor", col);
  geometry.setAttribute("aMisc", misc);
  geometry.setAttribute("aDash", dash);
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms: { uPxScale: { value: 0.001 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  premultipliedBlending(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const pa = position.array as Float32Array;
  const da = dir.array as Float32Array;
  const ca = col.array as Float32Array;
  const ma = misc.array as Float32Array;
  const sa = dash.array as Float32Array;
  const ia = index.array as Uint16Array;
  let vertices = 0;
  let indices = 0;
  let stripStart = 0;

  function vertex(
    p: THREE.Vector3,
    d: THREE.Vector3,
    side: number,
    width: number,
    minPx: number,
    c: THREE.Color,
    alpha: number,
    add: number,
    dist: number,
    dashLen: number,
  ) {
    const v = vertices++;
    pa[v * 3] = p.x;
    pa[v * 3 + 1] = p.y;
    pa[v * 3 + 2] = p.z;
    da[v * 3] = d.x;
    da[v * 3 + 1] = d.y;
    da[v * 3 + 2] = d.z;
    ca[v * 4] = c.r;
    ca[v * 4 + 1] = c.g;
    ca[v * 4 + 2] = c.b;
    ca[v * 4 + 3] = alpha;
    ma[v * 4] = side;
    ma[v * 4 + 1] = width;
    ma[v * 4 + 2] = minPx;
    ma[v * 4 + 3] = add;
    sa[v * 2] = dist;
    sa[v * 2 + 1] = dashLen;
  }

  return {
    mesh,
    begin() {
      vertices = 0;
      indices = 0;
    },
    /** Starts a strip; false when there is no room for `points` more. */
    strip(points: number) {
      if ((vertices + points * 2) > max * 2) {
        return false;
      }
      stripStart = vertices;
      return true;
    },
    point(
      p: THREE.Vector3,
      d: THREE.Vector3,
      width: number,
      minPx: number,
      c: THREE.Color,
      alpha: number,
      add: number,
      dist = 0,
      dashLen = 0,
    ) {
      vertex(p, d, -1, width, minPx, c, alpha, add, dist, dashLen);
      vertex(p, d, 1, width, minPx, c, alpha, add, dist, dashLen);
    },
    endStrip() {
      for (let v = stripStart; v + 3 < vertices; v += 2) {
        ia[indices++] = v;
        ia[indices++] = v + 1;
        ia[indices++] = v + 2;
        ia[indices++] = v + 1;
        ia[indices++] = v + 3;
        ia[indices++] = v + 2;
      }
    },
    end(ctx: StageContext) {
      for (const attr of attrs) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, vertices * attr.itemSize);
        attr.needsUpdate = true;
      }
      index.clearUpdateRanges();
      index.addUpdateRange(0, indices);
      index.needsUpdate = true;
      geometry.setDrawRange(0, indices);
      material.uniforms.uPxScale.value = pxScale(ctx);
      mesh.visible = indices > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Position (and tangent) on a flight path whose points are uniform in time,
 * through a Catmull-Rom spline so the grenade glides instead of stepping.
 */
export function pathAt(path: Vec3[], k: number, out: Vec3, tangent: Vec3) {
  const n = path.length;
  if (n === 1) {
    out.x = path[0].x;
    out.y = path[0].y;
    out.z = path[0].z;
    tangent.x = 1;
    tangent.y = 0;
    tangent.z = 0;
    return;
  }
  const f = clamp01(k) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const t = f - i;
  const p1 = path[i];
  const p2 = path[i + 1];
  const p0 = i > 0 ? path[i - 1] : null;
  const p3 = i + 2 < n ? path[i + 2] : null;
  const t2 = t * t;
  const t3 = t2 * t;
  out.x = spline(p0 ? p0.x : 2 * p1.x - p2.x, p1.x, p2.x, p3 ? p3.x : 2 * p2.x - p1.x, t, t2, t3);
  out.y = spline(p0 ? p0.y : 2 * p1.y - p2.y, p1.y, p2.y, p3 ? p3.y : 2 * p2.y - p1.y, t, t2, t3);
  out.z = spline(p0 ? p0.z : 2 * p1.z - p2.z, p1.z, p2.z, p3 ? p3.z : 2 * p2.z - p1.z, t, t2, t3);
  tangent.x = slope(p0 ? p0.x : 2 * p1.x - p2.x, p1.x, p2.x, p3 ? p3.x : 2 * p2.x - p1.x, t, t2);
  tangent.y = slope(p0 ? p0.y : 2 * p1.y - p2.y, p1.y, p2.y, p3 ? p3.y : 2 * p2.y - p1.y, t, t2);
  tangent.z = slope(p0 ? p0.z : 2 * p1.z - p2.z, p1.z, p2.z, p3 ? p3.z : 2 * p2.z - p1.z, t, t2);
}

/** Uniform Catmull-Rom between b and c. */
function spline(a: number, b: number, c: number, d: number, t: number, t2: number, t3: number) {
  return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
}

function slope(a: number, b: number, c: number, d: number, t: number, t2: number) {
  return 0.5 * (c - a + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (3 * b - a - 3 * c + d) * t2);
}

/** projectiles in flight with trails, flash bursts, HE starbursts and dust, decoys. */
export function createGrenadesModule(): StageModule {
  let ctx: StageContext | null = null;
  let sprites: FxBatch | null = null;
  let decals: FxBatch | null = null;
  let ribbons: ReturnType<typeof createRibbons> | null = null;
  let low = false;

  const src: Vec3 = { x: 0, y: 0, z: 0 };
  const tan: Vec3 = { x: 0, y: 0, z: 0 };
  const at = new THREE.Vector3();
  const at2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tint = new THREE.Color();

  function floorUnder(x: number, y: number, z: number, fallback: number) {
    return groundIndexFor(ctx?.map?.tri)?.floorAt(x, y, z) ?? fallback;
  }

  /** World position of a source point offset in the camera's screen plane. */
  function screenOffset(
    centre: THREE.Vector3,
    angle: number,
    dist: number,
    out: THREE.Vector3,
  ) {
    return out
      .copy(centre)
      .addScaledVector(right, Math.cos(angle) * dist)
      .addScaledVector(up, Math.sin(angle) * dist);
  }

  function screenAngle(vx: number, vy: number, vz: number) {
    return Math.atan2(
      vx * up.x + vy * up.y + vz * up.z,
      vx * right.x + vy * right.y + vz * right.z,
    );
  }

  function projectile(p: StageProjectile) {
    const c = ctx!;
    const s = sprites!;
    const d = decals!;
    const r = ribbons!;
    const path = p.path;
    if (!path.length) {
      return;
    }
    const colors = PROJECTILE_COLORS[p.type] ?? PROJECTILE_COLORS.smoke;
    const k = clamp01(p.progress);
    const flight = p.progress > 0.02 && p.age > 0 ? p.age / p.progress : 1.2;

    // The whole arc, faint and dashed: where it came from and where it lands.
    const arcPoints = Math.min(ARC_POINTS, Math.max(24, path.length));
    if (path.length > 1 && r.strip(arcPoints)) {
      let dist = 0;
      for (let j = 0; j < arcPoints; j++) {
        const u = j / (arcPoints - 1);
        pathAt(path, u, src, tan);
        c.wpos(src, at);
        if (j > 0) {
          dist += at.distanceTo(at2);
        }
        at2.copy(at);
        dir.set(tan.x, tan.z, -tan.y);
        const ahead = u >= k;
        const fade = smoothstep(0, 0.04, u) * smoothstep(1, 0.96, u);
        r.point(at, dir, 2.4, 1.5, colors.arc, (ahead ? 0.4 : 0.14) * fade, 0.3, dist, 22);
      }
      r.endStrip();
    }

    // The trail: the last fraction of a second of flight, tapering to
    // nothing, over a soft dark underlay so it reads on bright floors.
    const span = Math.min(k, TRAIL_SECONDS / flight);
    for (let pass = 0; pass < 2 && span > 0.001; pass++) {
      if (!r.strip(TRAIL_POINTS)) {
        break;
      }
      const under = pass === 0;
      for (let j = 0; j < TRAIL_POINTS; j++) {
        const u = j / (TRAIL_POINTS - 1);
        pathAt(path, k - span * (1 - u), src, tan);
        c.wpos(src, at);
        dir.set(tan.x, tan.z, -tan.y);
        const taper = Math.pow(u, 0.75);
        if (under) {
          r.point(at, dir, 30 * taper, 13 * taper, SHADOW, 0.3 * u, 0);
        } else {
          r.point(at, dir, 18 * taper, 8 * taper, colors.trail, Math.pow(u, 1.1), 0.45);
        }
      }
      r.endStrip();
    }

    pathAt(path, k, src, tan);
    c.wpos(src, at);

    // Shadow on the floor below and the landing mark at the end of the arc.
    const floor = floorUnder(src.x, src.y, src.z, path[path.length - 1].z);
    const height = Math.max(0, src.z - floor);
    at2.set(src.x, floor + 1.5, -src.y);
    d.push(at2, 18 + height * 0.04, 18 + height * 0.04, SHADOW, 0.32 * (1 - clamp01(height / 800)), CELL.disc, 0, 0, 6);
    const end = path[path.length - 1];
    const endFloor = floorUnder(end.x, end.y, end.z + 8, end.z);
    if (end.z - endFloor < 40) {
      at2.set(end.x, endFloor + 1.5, -end.y);
      d.push(at2, 46, 46, colors.core, 0.45 * smoothstep(0, 0.15, k), CELL.dashRing, k * 2.5, 0.5, 14);
    }

    // A burning rag drops embers behind a molotov.
    if (p.type === "molotov" || p.type === "incendiary") {
      const key = hashKey(p.key);
      const step = 0.035;
      const first = Math.max(0, Math.ceil((p.age - 0.4) / step));
      for (let m = first; m * step <= p.age; m++) {
        const born = m * step;
        const life = p.age - born;
        pathAt(path, born / flight, src, tan);
        src.x += (rand(key, m * 2) - 0.5) * 84 * life;
        src.y += (rand(key, m * 2 + 1) - 0.5) * 84 * life;
        src.z += 40 * life - 260 * life * life;
        c.wpos(src, at2);
        tint.copy(colors.core).lerp(HE_FIRE, clamp01(life / 0.4));
        s.push(at2, 6, 6, tint, (1 - life / 0.4) * 0.9, CELL.glow, 0, 1, 2.5);
      }
      const flicker = 0.8 + 0.2 * Math.sin(p.age * 47 + key);
      s.push(at, 38 * flicker, 38 * flicker, HE_FIRE, 0.75, CELL.glow, 0, 1, 14);
    }

    s.push(at, 70, 70, colors.glow, 0.9, CELL.glow, 0, 1, 34);
    s.push(at, 18, 18, colors.core, 1, CELL.ball, 0, 0, 12);
  }

  function flash(det: StageDetonation, seed: number) {
    const c = ctx!;
    const s = sprites!;
    const d = decals!;
    const a = det.age;
    if (a > 1.6) {
      return;
    }
    c.wpos(det.at, at);
    // Blinding for a beat, then a quick falloff.
    const burst = a < 0.03 ? a / 0.03 : a < 0.09 ? 1 : Math.exp(-(a - 0.09) * 9);

    // Light thrown on the floor underneath.
    const floor = floorUnder(det.at.x, det.at.y, det.at.z, det.at.z - 150);
    const height = Math.max(0, det.at.z - floor);
    at2.set(det.at.x, floor + 1.5, -det.at.y);
    const pool = 2 * (150 + 110 * (1 - burst));
    d.push(at2, pool, pool, FLASH_LIGHT, 0.5 * burst * (1 - clamp01(height / 700)), CELL.disc, 0, 1, 40);

    // Thin shell racing out.
    if (a < 0.8) {
      const grow = easeOutCubic(a / 0.8);
      const size = 2 * (40 + 380 * grow);
      const alpha = 0.75 * smoothstep(0, 0.03, a) * (1 - smoothstep(0.25, 0.8, a));
      s.push(at, size, size, FLASH_SHELL, alpha, CELL.shell, 0, 0.3, 140 * grow);
    }

    // Specks drifting out of the burst.
    const specks = low ? 16 : 40;
    const fade = smoothstep(0.03, 0.1, a) * (1 - smoothstep(0.7, 1.5, a));
    for (let i = 0; i < specks && fade > 0; i++) {
      const theta = rand(seed, i * 5) * Math.PI * 2;
      const zDir = (rand(seed, i * 5 + 1) * 2 - 1) * 0.6;
      const flat = Math.sqrt(1 - zDir * zDir);
      const speed = 150 + 300 * rand(seed, i * 5 + 2);
      const dist = (speed * (1 - Math.exp(-2.4 * a))) / 2.4;
      src.x = det.at.x + Math.cos(theta) * flat * dist;
      src.y = det.at.y + Math.sin(theta) * flat * dist;
      src.z = det.at.z + zDir * dist - 20 * a * a;
      c.wpos(src, at2);
      const twinkle = 0.65 + 0.35 * Math.sin(rand(seed, i * 5 + 3) * 40 + a * 18);
      const spin = rand(seed, i * 5 + 4) * 6 + a * (rand(seed, i * 5 + 3) - 0.5) * 6;
      s.push(at2, 10, 3.5, WHITE, fade * twinkle, CELL.disc, spin, 0.45, 3);
    }

    if (burst < 0.01) {
      return;
    }
    // Heavy bloom around a white-hot core.
    s.push(at, 820, 820, WHITE, 0.5 * burst, CELL.glow, 0, 1, 150);
    s.push(at, 380, 380, WHITE, burst, CELL.glow, 0, 1, 80);
    const core = 150 * (0.55 + 0.45 * burst);
    s.push(at, core, core, WHITE, Math.min(1, burst * 1.6), CELL.disc, 0, 0.25, 30);
  }

  function he(det: StageDetonation, seed: number) {
    const c = ctx!;
    const s = sprites!;
    const d = decals!;
    const a = det.age;
    if (a > 2.8) {
      return;
    }
    const floor = floorUnder(det.at.x, det.at.y, det.at.z + 16, det.at.z);
    const centreZ = Math.max(det.at.z, floor);

    // Ground: scorch, a bright shock ring, and the fireball's light.
    at2.set(det.at.x, floor + 1.5, -det.at.y);
    const scorch = 0.6 * smoothstep(0, 0.06, a) * (1 - smoothstep(0.9, 2.7, a));
    d.push(at2, 190, 190, HE_SCORCH, scorch, CELL.scorch, rand(seed, 7) * 6, 0, 16);
    if (a < 0.45) {
      const ring = 2 * (30 + 240 * easeOutCubic(a / 0.45));
      d.push(at2, ring, ring, HE_RING, 0.85 * Math.pow(1 - a / 0.45, 2), CELL.ring, 0, 0.7, 30);
    }
    if (a < 0.6) {
      d.push(at2, 460, 460, HE_FIRE, 0.75 * Math.exp(-a * 6), CELL.disc, 0, 1, 50);
    }

    // Brown-orange dust rolling out and settling.
    const puffs = low ? 7 : 13;
    for (let i = 0; i < puffs; i++) {
      const born = 0.02 + rand(seed, i * 7) * 0.06;
      const t = a - born;
      if (t <= 0 || t > 1.4) {
        continue;
      }
      const theta = (i / puffs) * Math.PI * 2 + rand(seed, i * 7 + 1) * 0.7;
      const reach = (i % 3 === 0 ? 30 : 80) + rand(seed, i * 7 + 2) * 110;
      const spread = reach * (1 - Math.exp(-t * 4.5));
      const size = (80 + 60 * rand(seed, i * 7 + 3)) * (0.4 + 0.9 * (1 - Math.exp(-t * 3.5)));
      src.x = det.at.x + Math.cos(theta) * spread;
      src.y = det.at.y + Math.sin(theta) * spread;
      src.z = centreZ + size * 0.3 + 45 * t * rand(seed, i * 7 + 4);
      c.wpos(src, at2);
      tint.copy(HE_LIT_DUST).lerp(i % 4 === 0 ? HE_DUST_DARK : HE_DUST, smoothstep(0.04, 0.4, t));
      const alpha = 0.95 * smoothstep(0, 0.05, t) * (1 - smoothstep(0.35, 1.35, t));
      const spin = theta + t * (rand(seed, i * 7 + 5) - 0.5) * 1.5;
      s.push(at2, size, size, tint, alpha, i % 2 ? CELL.puffB : CELL.puff, spin, 0, 18);
    }

    // Debris shards flung out on arcs, hot then cooling.
    const shards = low ? 6 : 14;
    for (let i = 0; i < shards; i++) {
      const t = a;
      if (t > 1) {
        break;
      }
      const theta = rand(seed, i * 11 + 100) * Math.PI * 2;
      const speed = 260 + 340 * rand(seed, i * 11 + 101);
      const lift = 140 + 260 * rand(seed, i * 11 + 102);
      const out = (speed * (1 - Math.exp(-2.2 * t))) / 2.2;
      src.x = det.at.x + Math.cos(theta) * out;
      src.y = det.at.y + Math.sin(theta) * out;
      src.z = Math.max(floor + 3, centreZ + 10 + lift * t - 520 * t * t);
      c.wpos(src, at2);
      tint.copy(HE_HOT_SHARD).lerp(HE_COLD_SHARD, smoothstep(0.1, 0.55, t));
      const size = 9 + 9 * rand(seed, i * 11 + 103);
      const spin = rand(seed, i * 11 + 104) * 6 + t * (rand(seed, i * 11 + 105) - 0.5) * 24;
      const alpha = 1 - smoothstep(0.65, 1, t);
      s.push(at2, size, size * 0.8, tint, alpha, CELL.shard, spin, 0.4 * (1 - smoothstep(0, 0.3, t)), 4);
    }

    // Fast sparks.
    const sparks = low ? 5 : 12;
    for (let i = 0; i < sparks; i++) {
      const t = a;
      if (t > 0.35) {
        break;
      }
      const theta = rand(seed, i * 13 + 200) * Math.PI * 2;
      const rise = 0.2 + 0.6 * rand(seed, i * 13 + 201);
      const speed = 700 + 600 * rand(seed, i * 13 + 202);
      const out = (speed * (1 - Math.exp(-4 * t))) / 4;
      const vx = Math.cos(theta);
      const vy = Math.sin(theta);
      src.x = det.at.x + vx * out;
      src.y = det.at.y + vy * out;
      src.z = centreZ + 20 + rise * out;
      c.wpos(src, at2);
      const angle = screenAngle(vx, rise, -vy);
      const len = 46 * (1 - t / 0.35) + 10;
      screenOffset(at2, angle, -len / 2, at2);
      s.push(at2, 7, len, HE_YELLOW, 1 - t / 0.35, CELL.streak, angle - Math.PI / 2, 1, 14);
    }

    // The comic starburst: white, then yellow, with long thin rays.
    if (a < 0.6) {
      src.x = det.at.x;
      src.y = det.at.y;
      src.z = centreZ + 30;
      c.wpos(src, at);
      s.push(at, 320, 320, HE_FIRE, 0.8 * Math.exp(-a * 8), CELL.glow, 0, 1, 60);
    }
    if (a < 0.24) {
      const pop = a < 0.05 ? 0.35 + 0.65 * easeOutCubic(a / 0.05) : 1 + (a - 0.05) * 0.8;
      const fade = 1 - smoothstep(0.12, 0.24, a);
      const white = 1 - smoothstep(0.02, 0.09, a);
      const spin = rand(seed, 300) * Math.PI * 2 + a * 0.8;
      const variant = rand(seed, 301) < 0.5;
      const size = 300 * pop;
      const rays = 7 + Math.floor(rand(seed, 302) * 4);
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + rand(seed, 310 + i) * 0.5 + spin;
        const len = size * (0.5 + 0.45 * rand(seed, 330 + i));
        screenOffset(at, angle, len / 2, at2);
        tint.copy(HE_YELLOW).lerp(WHITE, white);
        s.push(at2, 34 * pop, len, tint, fade, CELL.spike, angle - Math.PI / 2, 0.15, len * 0.22);
      }
      s.push(at, size, size, WHITE, fade, variant ? CELL.burstColor : CELL.burstColorB, spin, 0.1, 64);
      s.push(at, size, size, WHITE, fade * white, variant ? CELL.burstWhite : CELL.burstWhiteB, spin, 0.3, 64);
      s.push(at, 150 * pop, 150 * pop, WHITE, fade * (0.6 + 0.4 * white), CELL.disc, 0, 0.6, 26);
    }
  }

  function decoy(det: StageDetonation, seed: number) {
    const c = ctx!;
    const s = sprites!;
    const d = decals!;
    const a = det.age;
    const floor = floorUnder(det.at.x, det.at.y, det.at.z + 8, det.at.z);
    src.x = det.at.x;
    src.y = det.at.y;
    src.z = Math.max(det.at.z, floor) + 14;
    c.wpos(src, at);
    s.push(at, 26, 26, PROJECTILE_COLORS.decoy.glow, 0.55 + 0.2 * Math.sin(a * 9), CELL.glow, 0, 1, 10);
    s.push(at, 9, 9, PROJECTILE_COLORS.decoy.core, 1, CELL.ball, 0, 0, 7);
    // Fake gunfire: bursts of pops at seeded intervals, each a muzzle-flash
    // spark with a ring on the floor so it reads from above too.
    let pop = 0.15;
    for (let k = 0; pop <= a && k < 400; k++) {
      const t = a - pop;
      if (t < 0.3) {
        const fade = 1 - t / 0.3;
        const spin = rand(seed + k, 50) * Math.PI * 2;
        s.push(at, 120, 120, DECOY_SPARK, fade * 0.8, CELL.glow, 0, 1, 26);
        if (t < 0.08) {
          const size = 70 * (0.6 + 0.4 * (t / 0.08));
          s.push(at, size, size, WHITE, 1 - t / 0.08, CELL.burstColorB, spin, 0.3, 18);
        }
        for (let i = 0; i < 6; i++) {
          const angle = spin + (i / 6) * Math.PI * 2 + rand(seed + k, i) * 0.6;
          const out = 60 * (1 - Math.exp(-t * 12)) + 8;
          screenOffset(at, angle, out, at2);
          s.push(at2, 5, 22, DECOY_SPARK, fade, CELL.streak, angle - Math.PI / 2, 1, 7);
        }
        at2.set(det.at.x, floor + 1.5, -det.at.y);
        const ring = 30 + 90 * easeOutCubic(t / 0.3);
        d.push(at2, ring, ring, DECOY_SPARK, fade * 0.7, CELL.ring, 0, 0.8, 16);
      }
      const burst = rand(seed, k) < 0.7;
      pop += burst ? 0.09 + rand(seed, k + 500) * 0.08 : 0.5 + rand(seed, k + 900) * 1.1;
    }
  }

  return {
    name: "grenades",
    init(context) {
      ctx = context;
      low = context.quality === "low";
      const texture = acquireFxAtlas();
      decals = createFxBatch({ texture, max: 256, ground: true, renderOrder: 2 });
      sprites = createFxBatch({ texture, max: low ? 600 : 1400, renderOrder: 6 });
      ribbons = createRibbons(MAX_RIBBON_POINTS);
      ribbons.mesh.renderOrder = 5;
      context.scene.add(decals.mesh, ribbons.mesh, sprites.mesh);
    },
    onMap(context) {
      // Build the floor lookup while the map loads, not on the first grenade.
      groundIndexFor(context.map?.tri);
    },
    update(frame, context) {
      ctx = context;
      const s = sprites!;
      const d = decals!;
      const r = ribbons!;
      context.camera.updateMatrixWorld();
      right.setFromMatrixColumn(context.camera.matrixWorld, 0);
      up.setFromMatrixColumn(context.camera.matrixWorld, 1);
      s.begin();
      d.begin();
      r.begin();
      for (const det of frame.detonations) {
        const seed = hashKey(det.key);
        if (det.type === "he") {
          he(det, seed);
        } else if (det.type === "flash") {
          flash(det, seed);
        } else {
          decoy(det, seed);
        }
      }
      for (const p of frame.projectiles) {
        projectile(p);
      }
      s.sync(context);
      d.sync(context);
      s.end();
      d.end();
      r.end(context);
    },
    dispose() {
      if (ctx) {
        for (const mesh of [sprites?.mesh, decals?.mesh, ribbons?.mesh]) {
          if (mesh) {
            ctx.scene.remove(mesh);
          }
        }
      }
      sprites?.dispose();
      decals?.dispose();
      ribbons?.dispose();
      releaseFxAtlas();
      sprites = null;
      decals = null;
      ribbons = null;
      ctx = null;
    },
  };
}
