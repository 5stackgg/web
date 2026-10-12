import * as THREE from "three";
import {
  CELL,
  acquireFxAtlas,
  clamp01,
  createFxBatch,
  createNoiseTexture,
  groundIndexFor,
  hashKey,
  premultipliedBlending,
  rand,
  releaseFxAtlas,
  shimmerClock,
  smoothstep,
  topDownness,
} from "./fx";
import type { FxBatch } from "./fx";
import type { StageContext, StageFlame, StageModule } from "./types";
import { FIRE_GLOW as FIRE_GLOW_HEX } from "./teamColors";

/** Flames the pool shader can see at once, across every inferno. */
const MAX_FLAMES = 64;
/** Burning radius of one flame on the floor; CS2 spaces flames ~42u apart. */
const POOL_RADIUS = 44;
const POOL_HALF = POOL_RADIUS * 2.7;

/** Display-referred fire colours (sRGB), cool edge to white-hot. kind 0 molotov, 1 incendiary. */
const GLSL_FIRE_RAMP = /* glsl */ `
vec3 fireRamp(float h, float kind) {
  vec3 c0 = mix(vec3(0.32, 0.03, 0.01), vec3(0.40, 0.07, 0.01), kind);
  vec3 c1 = mix(vec3(0.80, 0.12, 0.02), vec3(0.92, 0.26, 0.03), kind);
  vec3 c2 = mix(vec3(1.00, 0.40, 0.04), vec3(1.00, 0.58, 0.10), kind);
  vec3 c3 = mix(vec3(1.00, 0.73, 0.20), vec3(1.00, 0.87, 0.40), kind);
  vec3 c4 = mix(vec3(1.00, 0.96, 0.78), vec3(1.00, 1.00, 0.92), kind);
  h = clamp(h, 0.0, 1.0) * 4.0;
  if (h < 1.0) return mix(c0, c1, h);
  if (h < 2.0) return mix(c1, c2, h - 1.0);
  if (h < 3.0) return mix(c2, c3, h - 2.0);
  return mix(c3, c4, h - 3.0);
}
`;

const POOL_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iA;
attribute vec2 iB;
varying vec2 vXZ;
varying vec4 vA;
varying vec2 vB;
void main() {
  vec3 world = iPos + vec3(position.x, 0.0, -position.y) * iA.x * 2.0;
  vXZ = world.xz;
  vA = iA;
  vB = iB;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

/**
 * The burning floor. Every flame draws a quad at its own height, but a quad
 * only shades the floor its flame is nearest to, while the colour comes from
 * the summed field of all the inferno's flames: one connected pool with no
 * double-blended overlaps, that still steps down stairs.
 */
const POOL_FRAG = /* glsl */ `
#define MAX_FLAMES ${MAX_FLAMES}
uniform vec4 uFlames[MAX_FLAMES];
uniform float uScorch[MAX_FLAMES];
uniform sampler2D uNoise;
uniform float uLow;
varying vec2 vXZ;
varying vec4 vA;
varying vec2 vB;
${GLSL_FIRE_RAMP}
void main() {
  int start = int(vA.y + 0.5);
  int count = int(vA.z + 0.5);
  int own = int(vA.w + 0.5);
  vec2 p = vXZ;
  vec2 dm = p - uFlames[start + own].xy;
  float ownD2 = dot(dm, dm);
  // Ownership first: most fragments of an overlapping quad leave here,
  // before paying for the field.
  for (int j = 0; j < MAX_FLAMES; j++) {
    if (j >= count) break;
    vec2 d = p - uFlames[start + j].xy;
    float d2 = dot(d, d);
    if (j != own && (d2 < ownD2 || (d2 == ownD2 && j < own))) discard;
  }
  float field = 0.0;
  float scorch = 0.0;
  float light = 0.0;
  for (int j = 0; j < MAX_FLAMES; j++) {
    if (j >= count) break;
    vec4 f = uFlames[start + j];
    vec2 d = p - f.xy;
    float d2 = dot(d, d);
    float r2 = f.z * f.z;
    field += f.w * exp(-d2 / r2);
    scorch += uScorch[start + j] * exp(-d2 / (r2 * 2.2));
    light += f.w * exp(-d2 / (r2 * 6.0));
  }
  float edge = 1.0 - smoothstep(vA.x * 0.7, vA.x, sqrt(ownD2));
  float t = vB.x;
  float kind = vB.y;
  float n1 = texture2D(uNoise, p / 300.0 + vec2(t * 0.020, -t * 0.035)).r;
  float n2 = texture2D(uNoise, p / 120.0 + vec2(-t * 0.07, t * 0.09)).g;
  float n3 = uLow > 0.5 ? 0.35 : texture2D(uNoise, p / 46.0 + vec2(t * 0.21, t * 0.15)).b;
  float n = n1 * 0.45 + n2 * 0.35 + n3 * 0.2;
  // Saturate the summed field so a dense middle glows hot, not white.
  float heat = 1.0 - exp(-field * 1.1);
  float burn = heat * (0.35 + 1.25 * n);
  float fire = smoothstep(0.28, 0.46, burn) * edge;
  float flicker = 0.9 + 0.1 * sin(t * 7.0 + n2 * 9.0);
  // Ridged noise: bright veins of burning fuel over darker pockets.
  float vein = 1.0 - abs(n3 * 2.0 - 1.0);
  float glowing = (burn - 0.28) * (0.75 + 0.5 * n3) + smoothstep(0.7, 0.95, vein) * heat * 0.25;
  vec3 col = fireRamp(glowing * 1.05 * flicker, kind);
  float char = smoothstep(0.15, 0.7, scorch * (0.6 + 0.8 * n2)) * 0.52 * edge;
  vec3 glow = fireRamp(0.3, kind) * (1.0 - exp(-light)) * 0.32 * edge;
  float a = max(fire * 0.92, char);
  vec3 rgb = col * fire + glow * (1.0 - fire);
  if (a < 0.003 && dot(rgb, rgb) < 0.00001) discard;
  gl_FragColor = vec4(rgb, a);
}
`;

const TONGUE_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iP;
uniform float uTop;
varying vec2 vUv;
varying vec4 vP;
void main() {
  // From above the quad lies flat; lift it off the floor it would z-fight.
  vec4 mv = modelViewMatrix * vec4(iPos + vec3(0.0, uTop * iSize.y * 0.3, 0.0), 1.0);
  vec2 corner = position.xy;
  vec2 side = vec2(corner.x * iSize.x, (corner.y + 0.5) * iSize.y - iSize.y * 0.05);
  vec2 top = corner * iSize.x * 1.35;
  mv.xy += mix(side, top, uTop);
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vP = iP;
}
`;

/**
 * One flame tongue: noise scrolling up through a teardrop, licking sideways
 * more towards the tip. Seen from straight above it becomes a flame rosette
 * licking outwards instead, since an upright billboard would vanish edge-on.
 */
const TONGUE_FRAG = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTop;
varying vec2 vUv;
varying vec4 vP;
${GLSL_FIRE_RAMP}
float turbulence(vec2 p) {
  return texture2D(uNoise, p).r * 0.65 + texture2D(uNoise, p * 2.1 + 0.31).g * 0.35;
}
void main() {
  float seed = vP.x;
  float t = vP.y;
  float heat = vP.z;
  float kind = vP.w;
  float side = 0.0;
  float sideA = 0.0;
  float top = 0.0;
  float topA = 0.0;
  if (uTop < 0.999) {
    // A teardrop whose outline is eaten by rising noise, so it splits into
    // licking tips that change every frame.
    vec2 q = vec2(vUv.x - 0.5, vUv.y - 0.22);
    float n = turbulence(vec2(q.x * 0.55 + seed, q.y * 0.42 - t * 0.75));
    float d = length(q * vec2(1.45 + q.y * 1.5, 0.8)) - n * max(0.0, q.y + 0.28);
    float c = 1.0 - 16.0 * pow(max(0.0, d), 1.2);
    side = clamp(n * c * (1.55 - pow(1.2 * vUv.y, 4.0)), 0.0, 1.0);
    sideA = clamp(c, 0.0, 1.0) * (1.0 - pow(vUv.y, 3.0));
  }
  if (uTop > 0.001) {
    // From above: a blob whose edge is eaten by two drifting noise layers.
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float n = turbulence(q * 0.3 + vec2(seed + t * 0.11, -t * 0.17)) * 0.6
      + turbulence(q * 0.55 + vec2(-t * 0.23, seed + t * 0.08)) * 0.4;
    float d = r * 0.6 - n * (r * 0.45 + 0.2);
    float c = 1.0 - 14.0 * pow(max(0.0, d), 1.2);
    top = clamp(n * c * (1.45 - r * r), 0.0, 1.0);
    topA = clamp(c, 0.0, 1.0) * (1.0 - r * r);
  }
  float h = mix(side, top, uTop) * heat;
  float alpha = mix(sideA, topA, uTop) * smoothstep(0.02, 0.2, h);
  if (alpha < 0.003) discard;
  vec3 col = fireRamp(h * 0.98, kind);
  gl_FragColor = vec4(col * alpha, alpha * 0.4);
}
`;

const FIRE_GLOW = new THREE.Color(FIRE_GLOW_HEX.molotov);
const FIRE_GLOW_CT = new THREE.Color(FIRE_GLOW_HEX.incendiary);
const EMBER_HOT = new THREE.Color(0xffd36a);
const EMBER_COOL = new THREE.Color(0xff4a12);
const SMOKE = new THREE.Color(0x2a221c);

function instanced(max: number, layout: Record<string, number>) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("uv", base.getAttribute("uv"));
  const attrs: Record<string, THREE.InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(layout)) {
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(max * size),
      size,
    );
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
    attrs[name] = attr;
  }
  geometry.instanceCount = 0;
  const list = Object.values(attrs);
  return {
    geometry,
    base,
    attrs,
    commit(count: number) {
      geometry.instanceCount = count;
      for (const attr of list) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, count * attr.itemSize);
        attr.needsUpdate = true;
      }
    },
  };
}

function flameSeed(flame: StageFlame) {
  return Math.floor(flame.seed * 2147483647) ^ 0x5bd1e995;
}

/** molotov and incendiary flames, scorch, embers. */
export function createFireModule(): StageModule {
  let ctx: StageContext | null = null;
  let low = false;
  let noise: THREE.DataTexture | null = null;
  let sprites: FxBatch | null = null;
  let pool: ReturnType<typeof instanced> | null = null;
  let tongues: ReturnType<typeof instanced> | null = null;
  let poolMesh: THREE.Mesh | null = null;
  let tongueMesh: THREE.Mesh | null = null;
  let poolMaterial: THREE.ShaderMaterial | null = null;
  let tongueMaterial: THREE.ShaderMaterial | null = null;

  const flamesA = Array.from({ length: MAX_FLAMES }, () => new THREE.Vector4());
  const scorch = new Float32Array(MAX_FLAMES);
  const maxTongues = MAX_FLAMES * 2;
  // Tongues are gathered unsorted, then written back to front.
  const stage = new Float32Array(maxTongues * 9);
  const depth = new Float32Array(maxTongues);
  const order = new Uint16Array(maxTongues);
  const at = new THREE.Vector3();
  const shift = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const tint = new THREE.Color();

  return {
    name: "fire",
    init(context) {
      ctx = context;
      low = context.quality === "low";
      noise = createNoiseTexture();
      const texture = acquireFxAtlas();

      pool = instanced(MAX_FLAMES, { iPos: 3, iA: 4, iB: 2 });
      poolMaterial = new THREE.ShaderMaterial({
        vertexShader: POOL_VERT,
        fragmentShader: POOL_FRAG,
        uniforms: {
          uFlames: { value: flamesA },
          uScorch: { value: scorch },
          uNoise: { value: noise },
          uLow: { value: low ? 1 : 0 },
        },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -8,
      });
      premultipliedBlending(poolMaterial);
      poolMesh = new THREE.Mesh(pool.geometry, poolMaterial);
      poolMesh.frustumCulled = false;
      poolMesh.renderOrder = 2;
      poolMesh.visible = false;

      tongues = instanced(maxTongues, { iPos: 3, iSize: 2, iP: 4 });
      tongueMaterial = new THREE.ShaderMaterial({
        vertexShader: TONGUE_VERT,
        fragmentShader: TONGUE_FRAG,
        uniforms: { uNoise: { value: noise }, uTop: { value: 0 } },
        transparent: true,
        depthWrite: false,
      });
      premultipliedBlending(tongueMaterial);
      tongueMesh = new THREE.Mesh(tongues.geometry, tongueMaterial);
      tongueMesh.frustumCulled = false;
      tongueMesh.renderOrder = 4;
      tongueMesh.visible = false;

      sprites = createFxBatch({
        texture,
        max: low ? 400 : 900,
        renderOrder: 5,
      });
      context.scene.add(poolMesh, tongueMesh, sprites.mesh);
    },
    update(frame, context) {
      ctx = context;
      const s = sprites!;
      const poolBuf = pool!;
      const tongueBuf = tongues!;
      const top = topDownness(context.camera, forward);
      context.camera.getWorldPosition(camPos);
      tongueMaterial!.uniforms.uTop.value = top;
      const shimmer = shimmerClock(context) * 0.25;
      const perFlame = low ? 1 : 2;
      const embersPer = low ? 2 : 4;

      const pos = poolBuf.attrs.iPos.array as Float32Array;
      const pa = poolBuf.attrs.iA.array as Float32Array;
      const pb = poolBuf.attrs.iB.array as Float32Array;
      let flames = 0;
      let tongueCount = 0;
      const ground = groundIndexFor(context.map?.tri);
      s.begin();

      for (const inferno of frame.infernos) {
        const start = flames;
        const count = Math.min(inferno.flames.length, MAX_FLAMES - start);
        if (count <= 0) {
          continue;
        }
        const kind = inferno.type === "incendiary" ? 1 : 0;
        const time = inferno.age + shimmer;
        // Where `wpos` puts this fire against plain (x, z, -y): a stacked
        // map laid side by side moves a lower storey's fires with it.
        const first = inferno.flames[0];
        context.wpos(first, shift);
        shift.x -= first.x;
        shift.y -= first.z;
        shift.z += first.y;
        let cx = 0;
        let cy = 0;
        let cz = 0;
        let heat = 0;
        for (let i = 0; i < count; i++) {
          const flame = inferno.flames[i];
          const seed = flameSeed(flame);
          const intensity = clamp01(flame.intensity);
          // Scorch builds as the flame burns and stays while it is listed,
          // so a smoked-out fire leaves its burn on the floor.
          const char =
            smoothstep(0, 0.6, flame.age) *
            (1 - smoothstep(0.92, 1, flame.life));
          const f = start + i;
          // Sit on the drawn floor: a flame's z can be a few units under it.
          const floor = ground?.floorAt(flame.x, flame.y, flame.z + 8);
          const z =
            floor !== null && floor !== undefined && floor > flame.z - 24
              ? floor
              : flame.z;
          flamesA[f].set(
            flame.x + shift.x,
            -flame.y + shift.z,
            POOL_RADIUS * (0.85 + 0.3 * rand(seed, 1)),
            intensity,
          );
          scorch[f] = char;
          pos[f * 3] = flame.x + shift.x;
          pos[f * 3 + 1] = z + 1.5 + shift.y;
          pos[f * 3 + 2] = -flame.y + shift.z;
          pa[f * 4] = POOL_HALF;
          pa[f * 4 + 1] = start;
          pa[f * 4 + 2] = count;
          pa[f * 4 + 3] = i;
          pb[f * 2] = time;
          pb[f * 2 + 1] = kind;
          cx += flame.x * intensity;
          cy += flame.y * intensity;
          cz += z * intensity;
          heat += intensity;

          if (intensity <= 0.01) {
            continue;
          }
          const tall = (1 - 0.35 * flame.life) * Math.pow(intensity, 0.7);
          const flameTime = flame.age + shimmer;
          for (let j = 0; j < perFlame && tongueCount < maxTongues; j++) {
            const angle = rand(seed, 10 + j) * Math.PI * 2;
            const reach = j === 0 ? 0 : 10 + rand(seed, 20 + j) * 16;
            const breath =
              0.88 +
              0.12 * Math.sin(flameTime * (2.6 + j) + rand(seed, 30 + j) * 6);
            const height =
              (j === 0
                ? 92 + 24 * rand(seed, 40)
                : 58 + 22 * rand(seed, 40 + j)) *
              tall *
              breath;
            const t = tongueCount++;
            const o = t * 9;
            stage[o] = flame.x + Math.cos(angle) * reach + shift.x;
            stage[o + 1] = z + shift.y;
            stage[o + 2] = -(flame.y + Math.sin(angle) * reach) + shift.z;
            stage[o + 3] = height * (0.95 + 0.2 * rand(seed, 50 + j));
            stage[o + 4] = height;
            stage[o + 5] = rand(seed, 60 + j) * 7;
            stage[o + 6] = flameTime * (0.9 + 0.2 * rand(seed, 70 + j));
            stage[o + 7] = 0.8 + 0.25 * intensity;
            stage[o + 8] = kind;
            depth[t] =
              (stage[o] - camPos.x) * forward.x +
              (stage[o + 1] + height * 0.4 - camPos.y) * forward.y +
              (stage[o + 2] - camPos.z) * forward.z;
          }

          // Embers rising off the flame, recycled on a seeded period.
          for (let e = 0; e < embersPer; e++) {
            const period = 1.1 + 0.9 * rand(seed, 80 + e);
            const phase = (flame.age / period + rand(seed, 90 + e)) % 1;
            const rise = phase * (90 + 110 * rand(seed, 100 + e));
            const sway = Math.sin(phase * 7 + rand(seed, 110 + e) * 6) * 12;
            at.set(
              flame.x + (rand(seed, 120 + e) - 0.5) * 50 + sway,
              z + 10 + rise,
              -(flame.y + (rand(seed, 130 + e) - 0.5) * 50),
            ).add(shift);
            tint.copy(EMBER_HOT).lerp(EMBER_COOL, phase);
            const alpha = Math.pow(Math.sin(Math.PI * phase), 1.5) * intensity;
            s.push(at, 5, 5, tint, alpha, CELL.glow, 0, 1, 2);
          }
        }
        flames += count;
        if (heat <= 0.01) {
          continue;
        }
        cx /= heat;
        cy /= heat;
        cz /= heat;
        let reach = 0;
        for (let i = 0; i < count; i++) {
          const flame = inferno.flames[i];
          reach = Math.max(reach, Math.hypot(flame.x - cx, flame.y - cy));
        }
        const glow = clamp01(heat / 6);
        const flicker =
          0.88 + 0.12 * Math.sin(time * 9.1) * Math.sin(time * 5.3 + 1);
        // Heat glow hanging over the whole fire.
        at.set(cx, cz + 40, -cy).add(shift);
        const size = (reach + POOL_RADIUS * 2) * 2.4;
        s.push(
          at,
          size,
          size,
          kind ? FIRE_GLOW_CT : FIRE_GLOW,
          0.32 * glow * flicker,
          CELL.glow,
          0,
          1,
          40,
        );

        // A thin dark smoke column off the top, kept faint from above.
        const wisps = low ? 4 : 9;
        const key = hashKey(inferno.key);
        for (let w = 0; w < wisps; w++) {
          const period = 2.2 + rand(key, w * 3) * 1.4;
          const phase = (inferno.age / period + w / wisps) % 1;
          const angle = rand(key, w * 3 + 1) * Math.PI * 2;
          const spread = reach * 0.6 * rand(key, w * 3 + 2);
          at.set(
            cx + Math.cos(angle) * spread + phase * 30,
            cz + 70 + phase * 240,
            -(cy + Math.sin(angle) * spread),
          ).add(shift);
          const wSize = 70 + 130 * phase;
          const alpha =
            0.22 * glow * Math.sin(Math.PI * phase) * (1 - top * 0.7);
          s.push(
            at,
            wSize,
            wSize,
            SMOKE,
            alpha,
            CELL.puff,
            angle + phase,
            0,
            0,
          );
        }
      }

      poolBuf.commit(flames);
      poolMesh!.visible = flames > 0;

      for (let i = 0; i < tongueCount; i++) {
        order[i] = i;
      }
      // Insertion sort, far to near: n is small.
      for (let i = 1; i < tongueCount; i++) {
        const v = order[i];
        const dv = depth[v];
        let j = i - 1;
        while (j >= 0 && depth[order[j]] < dv) {
          order[j + 1] = order[j];
          j--;
        }
        order[j + 1] = v;
      }
      const tp = tongueBuf.attrs.iPos.array as Float32Array;
      const ts = tongueBuf.attrs.iSize.array as Float32Array;
      const tq = tongueBuf.attrs.iP.array as Float32Array;
      for (let i = 0; i < tongueCount; i++) {
        const o = order[i] * 9;
        tp[i * 3] = stage[o];
        tp[i * 3 + 1] = stage[o + 1];
        tp[i * 3 + 2] = stage[o + 2];
        ts[i * 2] = stage[o + 3];
        ts[i * 2 + 1] = stage[o + 4];
        tq[i * 4] = stage[o + 5];
        tq[i * 4 + 1] = stage[o + 6];
        tq[i * 4 + 2] = stage[o + 7];
        tq[i * 4 + 3] = stage[o + 8];
      }
      tongueBuf.commit(tongueCount);
      tongueMesh!.visible = tongueCount > 0;

      s.sync(context);
      s.end();
    },
    dispose() {
      for (const mesh of [poolMesh, tongueMesh, sprites?.mesh]) {
        if (mesh && ctx) {
          ctx.scene.remove(mesh);
        }
      }
      pool?.geometry.dispose();
      pool?.base.dispose();
      tongues?.geometry.dispose();
      tongues?.base.dispose();
      poolMaterial?.dispose();
      tongueMaterial?.dispose();
      noise?.dispose();
      sprites?.dispose();
      releaseFxAtlas();
      sprites = null;
      ctx = null;
    },
  };
}
