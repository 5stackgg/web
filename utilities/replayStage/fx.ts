import * as THREE from "three";
import type { StageContext } from "./types";

/**
 * Shared pieces for the utility effects (grenades.ts, fire.ts): seeded
 * randomness, a tiling noise texture, one procedural sprite atlas, a batch
 * that mixes additive and normal blending in a single draw call, and a floor
 * lookup on the collision hull.
 */

export function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from a seed and an index: the same event always throws the same debris. */
export function rand(seed: number, i: number): number {
  let h = (seed ^ Math.imul((i + 0x9e3779b9) | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(a: number, b: number, v: number) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t: number) {
  const k = 1 - clamp01(t);
  return 1 - k * k * k;
}

/** World units per CSS pixel at a point, so effects keep a readable minimum size when zoomed out. */
export function pxScale(ctx: StageContext) {
  return (
    (2 * Math.tan((ctx.camera.fov * Math.PI) / 360)) / Math.max(1, ctx.height)
  );
}

/** 0 when the camera looks across the map, 1 when it looks straight down (2D, or a steep 3D view). */
export function topDownness(camera: THREE.Camera, scratch: THREE.Vector3) {
  camera.getWorldDirection(scratch);
  return smoothstep(0.86, 0.97, -scratch.y);
}

/** Wrapped wall clock: shader noise loses precision on raw performance.now() seconds. */
export function shimmerClock(ctx: StageContext) {
  return ctx.clock % 600;
}

/** Four independent tiling fbm fields in RGBA, for flame and dust shaders. */
export function createNoiseTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const field = new Float32Array(size * size);
  for (let ch = 0; ch < 4; ch++) {
    field.fill(0);
    let amp = 0.5;
    for (let period = 4; period <= 64; period *= 2) {
      const lattice = new Float32Array(period * period);
      for (let i = 0; i < lattice.length; i++) {
        lattice[i] = rand(ch * 7919 + period, i);
      }
      for (let y = 0; y < size; y++) {
        const fy = (y / size) * period;
        const iy = Math.floor(fy);
        const ty = fy - iy;
        const sy = ty * ty * (3 - 2 * ty);
        const y0 = iy % period;
        const y1 = (iy + 1) % period;
        for (let x = 0; x < size; x++) {
          const fx = (x / size) * period;
          const ix = Math.floor(fx);
          const tx = fx - ix;
          const sx = tx * tx * (3 - 2 * tx);
          const x0 = ix % period;
          const x1 = (ix + 1) % period;
          const a = lattice[y0 * period + x0];
          const b = lattice[y0 * period + x1];
          const c = lattice[y1 * period + x0];
          const d = lattice[y1 * period + x1];
          field[y * size + x] +=
            amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        }
      }
      amp *= 0.5;
    }
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < field.length; i++) {
      min = Math.min(min, field[i]);
      max = Math.max(max, field[i]);
    }
    for (let i = 0; i < field.length; i++) {
      data[i * 4 + ch] = Math.round(((field[i] - min) / (max - min)) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Cells of the shared atlas (4x4). Shapes are white; colour comes from the instance. */
export const CELL = {
  glow: 0,
  ball: 1,
  burstWhite: 2,
  burstColor: 3,
  burstWhiteB: 4,
  burstColorB: 5,
  shell: 6,
  puff: 7,
  puffB: 8,
  shard: 9,
  streak: 10,
  spike: 11,
  ring: 12,
  scorch: 13,
  disc: 14,
  dashRing: 15,
} as const;

const ATLAS_GRID: [number, number] = [4, 4];
const ATLAS_CELL = 256;

function lin(r: number, g: number, b: number, a = 1) {
  const f = (c: number) => {
    const v = c / 255;
    const l = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return Math.round(l * 255);
  };
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}

function drawStarburst(
  g: CanvasRenderingContext2D,
  seed: number,
  colored: boolean,
) {
  const c = ATLAS_CELL / 2;
  const rays = 9 + Math.floor(rand(seed, 0) * 3);
  const points: Array<[number, number]> = [];
  for (let i = 0; i < rays; i++) {
    const base = (i / rays) * Math.PI * 2 + rand(seed, i + 10) * 0.25;
    const tip = 0.62 + rand(seed, i + 30) * 0.36;
    const valley = 0.26 + rand(seed, i + 50) * 0.12;
    const half = Math.PI / rays;
    points.push([base, tip]);
    points.push([base + half * (0.9 + rand(seed, i + 70) * 0.3), valley]);
  }
  g.beginPath();
  points.forEach(([angle, radius], i) => {
    const x = c + Math.cos(angle) * radius * (c - 6);
    const y = c + Math.sin(angle) * radius * (c - 6);
    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  });
  g.closePath();
  if (colored) {
    const fill = g.createRadialGradient(c, c, 0, c, c, c);
    fill.addColorStop(0, lin(255, 255, 250));
    fill.addColorStop(0.22, lin(255, 246, 190));
    fill.addColorStop(0.42, lin(255, 216, 74));
    fill.addColorStop(0.8, lin(240, 168, 52));
    fill.addColorStop(1, lin(209, 128, 40));
    g.fillStyle = fill;
  } else {
    g.fillStyle = "#fff";
  }
  g.fill();
}

function drawPuff(g: CanvasRenderingContext2D, seed: number) {
  const c = ATLAS_CELL / 2;
  const blobs = 8;
  for (let i = 0; i < blobs; i++) {
    const angle = (i / blobs) * Math.PI * 2 + rand(seed, i) * 0.6;
    const reach = i === 0 ? 0 : 30 + rand(seed, i + 20) * 26;
    const radius = i === 0 ? 58 : 30 + rand(seed, i + 40) * 22;
    const x = c + Math.cos(angle) * reach;
    const y = c + Math.sin(angle) * reach;
    // Lit from the upper left, like the map's key light.
    const shade = g.createRadialGradient(
      x - radius * 0.4,
      y - radius * 0.45,
      radius * 0.05,
      x,
      y,
      radius,
    );
    shade.addColorStop(0, lin(255, 255, 255, 0.95));
    shade.addColorStop(0.65, lin(212, 212, 212, 0.85));
    shade.addColorStop(1, lin(175, 175, 175, 0.0));
    g.fillStyle = shade;
    g.beginPath();
    g.arc(x, y, radius, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCell(g: CanvasRenderingContext2D, cell: number) {
  const s = ATLAS_CELL;
  const c = s / 2;
  const r = c - 4;
  switch (cell) {
    case CELL.glow: {
      const grad = g.createRadialGradient(c, c, 0, c, c, r);
      for (let i = 0; i <= 16; i++) {
        const k = i / 16;
        grad.addColorStop(
          k,
          `rgba(255,255,255,${Math.exp(-k * k * 5.5) * (1 - k)})`,
        );
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case CELL.ball: {
      const grad = g.createRadialGradient(
        c - r * 0.3,
        c - r * 0.35,
        0,
        c,
        c,
        r * 0.8,
      );
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.7, lin(225, 225, 225));
      grad.addColorStop(1, lin(170, 170, 170));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(c, c, r * 0.8, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = r * 0.14;
      g.strokeStyle = lin(40, 40, 40, 0.9);
      g.beginPath();
      g.arc(c, c, r * 0.8, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case CELL.burstWhite:
      drawStarburst(g, 11, false);
      break;
    case CELL.burstColor:
      drawStarburst(g, 11, true);
      break;
    case CELL.burstWhiteB:
      drawStarburst(g, 23, false);
      break;
    case CELL.burstColorB:
      drawStarburst(g, 23, true);
      break;
    case CELL.shell: {
      const grad = g.createRadialGradient(c, c, 0, c, c, r);
      for (let i = 0; i <= 24; i++) {
        const k = i / 24;
        const a =
          k < 0.93 ? 0.1 + 0.9 * Math.pow(k / 0.93, 7) : 1 - (k - 0.93) / 0.07;
        grad.addColorStop(k, `rgba(255,255,255,${Math.max(0, a)})`);
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case CELL.puff:
      drawPuff(g, 5);
      break;
    case CELL.puffB:
      drawPuff(g, 17);
      break;
    case CELL.shard: {
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(c - r * 0.2, c - r * 0.95);
      g.lineTo(c + r * 0.5, c - r * 0.1);
      g.lineTo(c + r * 0.15, c + r * 0.9);
      g.lineTo(c - r * 0.55, c + r * 0.3);
      g.closePath();
      g.fill();
      g.fillStyle = lin(150, 150, 150);
      g.beginPath();
      g.moveTo(c - r * 0.2, c - r * 0.95);
      g.lineTo(c + r * 0.15, c + r * 0.9);
      g.lineTo(c - r * 0.55, c + r * 0.3);
      g.closePath();
      g.fill();
      break;
    }
    case CELL.streak: {
      // Long axis vertical, bright head at the top fading to the tail.
      for (let y = 4; y < s - 4; y++) {
        const k = (y - 4) / (s - 8);
        const along = Math.pow(1 - k, 1.6);
        const width = (6 + 22 * (1 - k)) * 0.5;
        const grad = g.createLinearGradient(c - width, 0, c + width, 0);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, `rgba(255,255,255,${along})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(c - width, y, width * 2, 1);
      }
      break;
    }
    case CELL.spike: {
      const grad = g.createLinearGradient(0, s, 0, 0);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(1, "rgba(255,255,255,0.6)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(c - 26, s - 4);
      g.lineTo(c, 4);
      g.lineTo(c + 26, s - 4);
      g.closePath();
      g.fill();
      break;
    }
    case CELL.ring: {
      const grad = g.createRadialGradient(c, c, 0, c, c, r);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.72, "rgba(255,255,255,0)");
      grad.addColorStop(0.86, "rgba(255,255,255,0.35)");
      grad.addColorStop(0.95, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case CELL.scorch: {
      const grad = g.createRadialGradient(c, c, 0, c, c, r * 0.8);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.55, "rgba(255,255,255,0.75)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(c, c, r * 0.8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineCap = "round";
      for (let i = 0; i < 18; i++) {
        const angle = rand(91, i) * Math.PI * 2;
        const len = r * (0.55 + rand(92, i) * 0.42);
        g.lineWidth = 3 + rand(93, i) * 9;
        g.beginPath();
        g.moveTo(c, c);
        g.lineTo(c + Math.cos(angle) * len, c + Math.sin(angle) * len);
        g.stroke();
      }
      break;
    }
    case CELL.disc: {
      const grad = g.createRadialGradient(c, c, 0, c, c, r);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.8)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      break;
    }
    case CELL.dashRing: {
      g.strokeStyle = "#fff";
      g.lineWidth = 14;
      g.lineCap = "round";
      const dashes = 12;
      for (let i = 0; i < dashes; i++) {
        const a0 = (i / dashes) * Math.PI * 2;
        g.beginPath();
        g.arc(c, c, r - 10, a0, a0 + (Math.PI * 2) / dashes / 1.9);
        g.stroke();
      }
      break;
    }
  }
}

/** Cells drawn soft, and the sigma of their gaussian blur in pixels. */
const CELL_BLUR: Array<[cell: number, sigma: number]> = [
  [CELL.puff, 7],
  [CELL.puffB, 7],
  [CELL.scorch, 3],
];

/**
 * Blurs one atlas cell in place: three box passes, which is all but a
 * gaussian, on premultiplied colour so edges do not darken. (Canvas
 * `filter` would do it, but Safari only has it from 18.)
 */
function blurCell(image: ImageData, x0: number, y0: number, sigma: number) {
  const size = ATLAS_CELL;
  const n = size * size;
  const px = image.data;
  const at = (i: number) =>
    ((y0 + Math.floor(i / size)) * image.width + x0 + (i % size)) * 4;
  const planes = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const o = at(i);
    const a = px[o + 3] / 255;
    planes[0][i] = px[o] * a;
    planes[1][i] = px[o + 1] * a;
    planes[2][i] = px[o + 2] * a;
    planes[3][i] = a;
  }
  // Three passes of radius r spread by sqrt(r^2 + r).
  const r = Math.max(1, Math.round((Math.sqrt(1 + 4 * sigma * sigma) - 1) / 2));
  const scratch = new Float32Array(n);
  const pass = (
    src: Float32Array,
    dst: Float32Array,
    along: number,
    across: number,
  ) => {
    const norm = 1 / (2 * r + 1);
    for (let line = 0; line < size; line++) {
      const base = line * across;
      let sum = 0;
      for (let k = 0; k < r; k++) {
        sum += src[base + k * along];
      }
      for (let k = 0; k < size; k++) {
        if (k + r < size) {
          sum += src[base + (k + r) * along];
        }
        dst[base + k * along] = sum * norm;
        if (k - r >= 0) {
          sum -= src[base + (k - r) * along];
        }
      }
    }
  };
  for (const plane of planes) {
    for (let i = 0; i < 3; i++) {
      pass(plane, scratch, 1, size);
      pass(scratch, plane, size, 1);
    }
  }
  for (let i = 0; i < n; i++) {
    const o = at(i);
    const a = planes[3][i];
    const k = a > 0 ? 1 / a : 0;
    px[o] = planes[0][i] * k;
    px[o + 1] = planes[1][i] * k;
    px[o + 2] = planes[2][i] * k;
    px[o + 3] = a * 255;
  }
}

let atlas: THREE.CanvasTexture | null = null;
let atlasUsers = 0;

/** The effects atlas, shared by every effect module and freed with the last one. */
export function acquireFxAtlas(): THREE.CanvasTexture {
  atlasUsers++;
  if (atlas) {
    return atlas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_GRID[0] * ATLAS_CELL;
  canvas.height = ATLAS_GRID[1] * ATLAS_CELL;
  const g = canvas.getContext("2d")!;
  for (let cell = 0; cell < ATLAS_GRID[0] * ATLAS_GRID[1]; cell++) {
    g.save();
    g.translate(
      (cell % ATLAS_GRID[0]) * ATLAS_CELL,
      Math.floor(cell / ATLAS_GRID[0]) * ATLAS_CELL,
    );
    g.beginPath();
    g.rect(0, 0, ATLAS_CELL, ATLAS_CELL);
    g.clip();
    drawCell(g, cell);
    g.restore();
  }
  // One readback for all of them.
  const image = g.getImageData(0, 0, canvas.width, canvas.height);
  for (const [cell, sigma] of CELL_BLUR) {
    blurCell(
      image,
      (cell % ATLAS_GRID[0]) * ATLAS_CELL,
      Math.floor(cell / ATLAS_GRID[0]) * ATLAS_CELL,
      sigma,
    );
  }
  g.putImageData(image, 0, 0);
  atlas = new THREE.CanvasTexture(canvas);
  // Linear values and premultiplied alpha: mipmaps of a white glow on
  // transparent black would otherwise grow dark halos.
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.premultiplyAlpha = true;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.needsUpdate = true;
  return atlas;
}

export function releaseFxAtlas() {
  atlasUsers = Math.max(0, atlasUsers - 1);
  if (atlasUsers === 0 && atlas) {
    atlas.dispose();
    atlas = null;
  }
}

/**
 * Premultiplied blending: rgb is added, alpha darkens what is behind. An
 * instance's `add` (0..1) slides it from normal blending to purely additive,
 * so glows, dust and shards share one draw call, drawn in push order.
 */
export function premultipliedBlending(material: THREE.Material) {
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.OneFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = THREE.OneFactor;
  material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
}

/** Linear colour → sRGB, then premultiply with alpha, scaled by `add`. */
export const GLSL_PREMULTIPLIED_OUT = /* glsl */ `
vec4 fxOut(vec3 linearColor, float alpha, float add) {
  gl_FragColor = vec4(linearColor, 1.0);
  #include <colorspace_fragment>
  return vec4(gl_FragColor.rgb * alpha, alpha * (1.0 - add));
}
`;

const FX_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iColor;
attribute vec4 iMisc;
uniform vec2 uGrid;
uniform float uPxScale;
uniform float uGround;
varying vec2 vUv;
varying vec4 vColor;
varying float vAdd;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iMisc.x);
  float s = sin(iMisc.x);
  vec2 size = iSize;
  float largest = max(size.x, size.y);
  if (iMisc.w > 0.0 && largest > 0.0) {
    size *= max(1.0, iMisc.w * -mv.z * uPxScale / largest);
  }
  vec2 corner = position.xy;
  vec2 r = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * size;
  if (uGround > 0.5) {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + vec3(r.x, 0.0, -r.y), 1.0);
  } else {
    mv.xy += r;
    gl_Position = projectionMatrix * mv;
    // A camera-facing glow is tested by its front, not the flat card through
    // its middle, so a burst near the floor is not cut in half by it.
    float lift = min(0.5 * max(size.x, size.y), 240.0);
    vec4 front = projectionMatrix * vec4(mv.xy, mv.z + lift, 1.0);
    if (front.w > 0.0) {
      gl_Position.z = front.z / front.w * gl_Position.w;
    }
  }
  float col = mod(iMisc.y, uGrid.x);
  float row = floor(iMisc.y / uGrid.x);
  vUv = (vec2(col, uGrid.y - 1.0 - row) + (uv * 0.98 + 0.01)) / uGrid;
  vColor = iColor;
  vAdd = iMisc.z;
}
`;

const FX_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vColor;
varying float vAdd;
${GLSL_PREMULTIPLIED_OUT}
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = fxOut(t.rgb / max(t.a, 0.0001) * vColor.rgb, a, vAdd);
}
`;

export type FxBatch = {
  mesh: THREE.Mesh;
  begin(): void;
  /**
   * `pos` world space; `w`/`h` world units (camera-facing, or flat on the
   * ground for a ground batch); colour linear; `add` 0 normal .. 1 additive;
   * `minPx` keeps it at least that many CSS pixels across when zoomed out.
   */
  push(
    pos: THREE.Vector3,
    w: number,
    h: number,
    color: THREE.Color,
    alpha: number,
    cell: number,
    rotation?: number,
    add?: number,
    minPx?: number,
  ): void;
  end(): void;
  /** Per frame: pixel scale for `minPx`. */
  sync(ctx: StageContext): void;
  dispose(): void;
};

export function createFxBatch(options: {
  texture: THREE.Texture;
  max: number;
  ground?: boolean;
  renderOrder?: number;
}): FxBatch {
  const max = options.max;
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("uv", base.getAttribute("uv"));
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  const color = new THREE.InstancedBufferAttribute(
    new Float32Array(max * 4),
    4,
  );
  const misc = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const attrs = [pos, size, color, misc];
  for (const attr of attrs) {
    attr.setUsage(THREE.DynamicDrawUsage);
  }
  geometry.setAttribute("iPos", pos);
  geometry.setAttribute("iSize", size);
  geometry.setAttribute("iColor", color);
  geometry.setAttribute("iMisc", misc);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    vertexShader: FX_VERT,
    fragmentShader: FX_FRAG,
    uniforms: {
      uMap: { value: options.texture },
      uGrid: { value: new THREE.Vector2(...ATLAS_GRID) },
      uPxScale: { value: 0.001 },
      uGround: { value: options.ground ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
  });
  premultipliedBlending(material);
  if (options.ground) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -8;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = options.renderOrder ?? 0;
  mesh.visible = false;

  let count = 0;
  const p = pos.array as Float32Array;
  const sz = size.array as Float32Array;
  const col = color.array as Float32Array;
  const ms = misc.array as Float32Array;

  return {
    mesh,
    begin() {
      count = 0;
    },
    push(at, w, h, c, alpha, cell, rotation = 0, add = 0, minPx = 0) {
      if (count >= max || alpha <= 0.002 || w <= 0 || h <= 0) {
        return;
      }
      const i = count++;
      p[i * 3] = at.x;
      p[i * 3 + 1] = at.y;
      p[i * 3 + 2] = at.z;
      sz[i * 2] = w;
      sz[i * 2 + 1] = h;
      col[i * 4] = c.r;
      col[i * 4 + 1] = c.g;
      col[i * 4 + 2] = c.b;
      col[i * 4 + 3] = Math.min(1, alpha);
      ms[i * 4] = rotation;
      ms[i * 4 + 1] = cell;
      ms[i * 4 + 2] = add;
      ms[i * 4 + 3] = minPx;
    },
    end() {
      geometry.instanceCount = count;
      for (const attr of attrs) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, count * attr.itemSize);
        attr.needsUpdate = true;
      }
      mesh.visible = count > 0;
    },
    sync(ctx) {
      material.uniforms.uPxScale.value = pxScale(ctx);
    },
    dispose() {
      geometry.dispose();
      base.dispose();
      material.dispose();
    },
  };
}

export type GroundIndex = {
  /** The highest upward-facing surface under (x, y) at or below `z` (+ a step), source units. */
  floorAt(x: number, y: number, z: number): number | null;
};

const groundIndexes = new WeakMap<Float32Array, GroundIndex>();

/** The floor lookup for a map's collision hull, built once and shared by the effect modules. */
export function groundIndexFor(
  tri: Float32Array | null | undefined,
): GroundIndex | null {
  if (!tri) {
    return null;
  }
  let index = groundIndexes.get(tri);
  if (!index) {
    index = createGroundIndex(tri);
    groundIndexes.set(tri, index);
  }
  return index;
}

/** A coarse grid over the collision hull's floors, so effects can find the ground under them every frame. */
function createGroundIndex(tri: Float32Array, cellSize = 96): GroundIndex {
  const count = Math.floor(tri.length / 9);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const floor = new Uint8Array(count);
  for (let t = 0; t < count; t++) {
    const i = t * 9;
    const ux = tri[i + 3] - tri[i];
    const uy = tri[i + 4] - tri[i + 1];
    const uz = tri[i + 5] - tri[i + 2];
    const vx = tri[i + 6] - tri[i];
    const vy = tri[i + 7] - tri[i + 1];
    const vz = tri[i + 8] - tri[i + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0 && Math.abs(nz) / len > 0.5) {
      floor[t] = 1;
      for (let k = 0; k < 9; k += 3) {
        minX = Math.min(minX, tri[i + k]);
        maxX = Math.max(maxX, tri[i + k]);
        minY = Math.min(minY, tri[i + k + 1]);
        maxY = Math.max(maxY, tri[i + k + 1]);
      }
    }
  }
  if (!Number.isFinite(minX)) {
    return { floorAt: () => null };
  }
  const nx = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const ny = Math.max(1, Math.ceil((maxY - minY) / cellSize));
  const cellOf = (v: number, min: number, n: number) =>
    Math.min(n - 1, Math.max(0, Math.floor((v - min) / cellSize)));
  const counts = new Uint32Array(nx * ny + 1);
  const visit = (t: number, fn: (cell: number) => void) => {
    const i = t * 9;
    const x0 = cellOf(Math.min(tri[i], tri[i + 3], tri[i + 6]), minX, nx);
    const x1 = cellOf(Math.max(tri[i], tri[i + 3], tri[i + 6]), minX, nx);
    const y0 = cellOf(Math.min(tri[i + 1], tri[i + 4], tri[i + 7]), minY, ny);
    const y1 = cellOf(Math.max(tri[i + 1], tri[i + 4], tri[i + 7]), minY, ny);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        fn(y * nx + x);
      }
    }
  };
  for (let t = 0; t < count; t++) {
    if (floor[t]) {
      visit(t, (cell) => counts[cell + 1]++);
    }
  }
  for (let c = 0; c < nx * ny; c++) {
    counts[c + 1] += counts[c];
  }
  const items = new Uint32Array(counts[nx * ny]);
  const fill = counts.slice(0, nx * ny);
  for (let t = 0; t < count; t++) {
    if (floor[t]) {
      visit(t, (cell) => (items[fill[cell]++] = t));
    }
  }

  return {
    floorAt(x, y, z) {
      if (x < minX || x > maxX || y < minY || y > maxY) {
        return null;
      }
      const cell = cellOf(y, minY, ny) * nx + cellOf(x, minX, nx);
      let best = -Infinity;
      for (let k = counts[cell]; k < counts[cell + 1]; k++) {
        const i = items[k] * 9;
        const ax = tri[i],
          ay = tri[i + 1],
          az = tri[i + 2];
        const bx = tri[i + 3],
          by = tri[i + 4],
          bz = tri[i + 5];
        const cx = tri[i + 6],
          cy = tri[i + 7],
          cz = tri[i + 8];
        const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(d) < 1e-6) {
          continue;
        }
        const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
        const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
        const w = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || w < -1e-4) {
          continue;
        }
        const h = u * az + v * bz + w * cz;
        if (h <= z + 18 && h > best) {
          best = h;
        }
      }
      return Number.isFinite(best) ? best : null;
    },
  };
}
