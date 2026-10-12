import * as THREE from "three";
import type { SmokeModule } from "./smoke";
import { smokeReachedBy } from "./smokeArrival";
import { canvasTexture, createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import { TEAM_BASE, TEAM_HUE, hsl } from "./teamColors";
import {
  angleBetween,
  buildVisionGrid,
  castRay,
  castSmoke,
  eyeHeight,
  floorBelow,
  inView,
  sightClear,
} from "./visionCast";
import type { VisionBounds, VisionGrid, VisionSmoke } from "./visionCast";
import { VISION_POSE } from "./visionFrame";
import type {
  StageContext,
  StageFrame,
  StageMap,
  StageModule,
  StagePlayer,
  StageTeam,
  Vec3,
} from "./types";

/**
 * Vision as fog of war: what a side cannot see is dimmed, what it can is
 * left exactly as the map looks. A side sees the union of its living
 * players' fields of view, cut where walls and smokes block them, so there
 * is nothing to stack: the union is drawn into a top-down mask, and one pass
 * over the map dims what the mask leaves out. On top, the followed player's
 * own view as a thin outline, and a thin line between enemies who can see
 * each other, with a pulse on the one spotted when it has just happened.
 *
 * The map's collision hull is baked into a voxel grid once per map, in a
 * worker (visionCast.ts); a field of view is a fan of horizontal rays walked
 * through it from eye height. Everything is a function of the frame: "just
 * spotted" comes from where everyone stood a moment ago (frame.vision), not
 * from earlier frames.
 */

/** Horizontal field of view, degrees: CS2's 4:3 view. */
export const VISION_FOV = 90;
/** How far a player is taken to see, source units. */
const RANGE = 4000;
const RAYS = 121;
/** Rings along the followed player's rays, so their cone follows stairs. */
const RINGS = 24;
/** Where the followed cone starts: just outside the puck. */
const START = 26;
const MAX_FANS = 12;
const EYE = 64;
const EYE_DUCKED = 46;
const CHEST = 46;
const CHEST_DUCKED = 32;
const HEAD = 62;
const HEAD_DUCKED = 44;
/** How far under the eye the floor below the cone is looked for. */
const DRAPE_DROP = 420;
/** The cone floats this far over the floor it is draped on. */
const LIFT = 1.5;
/** Blind past this, a player sees nobody, and reveals nothing. */
const BLIND = 0.6;
const PULSE_SECS = 0.6;
const MAX_LINES = 32;
const MAX_SMOKES = 16;
const MAX_HOLES = 5;
/**
 * Fans recast per frame beyond the ones that must be (new player, a jump, a
 * new map): the rest wait their turn.
 */
const RECAST_BUDGET = 4;
/** Moved this far, a fan is recast before the mask is drawn again. */
const JUMP = 160;
/** Seconds between redraws of the mask while the frame moves on. */
const FOG_INTERVAL = 0.05;
/** Around every player a little is always known: they hear and feel it. */
const NEAR_SEEN = 72;
const NEAR_SEGMENTS = 16;
const FOG_SIZE = 1024;
/** How far the unseen is dimmed, toward a neutral grey. */
const FOG_DIM = 0.58;
const FOG_GREY = 0x0e0f11;
/** Source units the mask's edge is feathered over. */
const FOG_FEATHER = 28;

const RAD = Math.PI / 180;
const CONE_VERTS = RAYS * (RINGS + 1);
const CONE_INDICES = (RAYS - 1) * RINGS * 6;
const FOG_VERTS = 1 + RAYS + NEAR_SEGMENTS;
const FOG_INDICES = (RAYS - 1 + NEAR_SEGMENTS) * 3;
/** Outline: in from the player, along the edge of what they see, back. */
const OUTLINE_SEGMENTS = RAYS + 1;

const CONE_VERT = /* glsl */ `
attribute float aRadial;
attribute float aSide;
varying vec2 vFan;
void main() {
  vFan = vec2(aRadial, aSide);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vFan;
void main() {
  float r = clamp(vFan.x, 0.0, 1.0);
  // Faint, brightest by the player, gone well before the range.
  float radial = pow(1.0 - smoothstep(0.0, 0.6, r), 1.6);
  float near = smoothstep(${(START / RANGE).toFixed(4)}, ${((START + 60) / RANGE).toFixed(4)}, r);
  float edge = 1.0 - smoothstep(0.85, 1.0, abs(vFan.y));
  float alpha = uStrength * near * radial * edge;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`;

const LINE_VERT = /* glsl */ `
attribute vec3 aOther;
attribute float aSide;
attribute vec4 aColor;
uniform vec2 uViewport;
uniform float uWidth;
varying vec4 vColor;
varying float vSide;
void main() {
  vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 b = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
  vec2 sa = a.xy / max(a.w, 1e-4) * uViewport;
  vec2 sb = b.xy / max(b.w, 1e-4) * uViewport;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  a.xy += normal * aSide * uWidth / uViewport * a.w;
  gl_Position = a;
  vColor = aColor;
  vSide = aSide;
}
`;

/** A coloured core with a dark rim, so a thin line reads on sand and shadow. */
const LINE_FRAG = /* glsl */ `
uniform float uRim;
varying vec4 vColor;
varying float vSide;
void main() {
  float side = abs(vSide);
  float alpha = vColor.a * (1.0 - smoothstep(0.75, 1.0, side));
  if (alpha < 0.003) discard;
  vec3 col = mix(vColor.rgb, vColor.rgb * 0.18, smoothstep(0.35, 0.6, side) * uRim);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

const FOG_VERT = /* glsl */ `
attribute float aTeam;
varying float vTeam;
void main() {
  vTeam = aTeam;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FOG_FRAG = /* glsl */ `
varying float vTeam;
void main() {
  // CT in red, T in green; the mask blends by max, so it is a union.
  gl_FragColor = vec4(1.0 - vTeam, vTeam, 0.0, 1.0);
}
`;

const DIM_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Per pixel: the map's depth (its own pre-pass, so only the map is dimmed,
 * never a player in front of it), back to a world point, then that point in
 * the top-down mask. The pass writes the map's depth, pulled a hair toward
 * the camera, so anything drawn in front of the map keeps its colour.
 */
const DIM_FRAG = /* glsl */ `
precision highp float;
uniform highp sampler2D uDepth;
uniform sampler2D uFog;
uniform mat4 uInvProj;
uniform mat4 uProj;
uniform mat4 uCamWorld;
uniform mat4 uFogVP;
uniform vec4 uViewport;
uniform vec2 uTexel;
uniform vec2 uFogStep;
uniform vec3 uSide;
uniform float uDim;
uniform vec3 uGrey;

float seenAt(vec2 uv) {
  vec2 f = texture2D(uFog, uv).rg;
  return uSide.z > 0.5 ? max(f.r, f.g) : dot(f, uSide.xy);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
  // The nearest of the texels around: an edge never lets the floor behind
  // it decide (the depth is coarser than the screen).
  float d = min(
    min(texture2D(uDepth, uv).x, texture2D(uDepth, uv + vec2(uTexel.x, 0.0)).x),
    min(texture2D(uDepth, uv + vec2(0.0, uTexel.y)).x, texture2D(uDepth, uv + uTexel).x)
  );
  if (d >= 1.0) discard;
  vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  view /= view.w;
  vec4 world = uCamWorld * view;
  vec4 f = uFogVP * vec4(world.xyz, 1.0);
  vec2 fuv = f.xy * 0.5 + 0.5;
  float seen = seenAt(fuv) * 0.28;
  seen += (seenAt(fuv + vec2(uFogStep.x, 0.0)) + seenAt(fuv - vec2(uFogStep.x, 0.0))
    + seenAt(fuv + vec2(0.0, uFogStep.y)) + seenAt(fuv - vec2(0.0, uFogStep.y))) * 0.12;
  seen += (seenAt(fuv + uFogStep) + seenAt(fuv - uFogStep)
    + seenAt(fuv + vec2(uFogStep.x, -uFogStep.y)) + seenAt(fuv + vec2(-uFogStep.x, uFogStep.y))) * 0.06;
  float dim = (1.0 - smoothstep(0.05, 0.95, seen)) * uDim;
  if (dim < 0.004) discard;
  vec4 clip = uProj * vec4(view.xyz * 0.998, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(uGrey, dim);
  #include <colorspace_fragment>
}
`;

type Fan = {
  id: string | null;
  team: StageTeam;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ducked: boolean;
  smokeSig: number;
  gridEpoch: number;
  /** How out of date it is this frame; < 0 when it is not. */
  stale: number;
  /** The update it was last cast on. */
  castAt: number;
  /** Where `ctx.wpos` put the player then, against plain (x, z, -y). */
  shiftX: number;
  shiftY: number;
  shiftZ: number;
  /** Source units each ray reaches. */
  reach: Float32Array;
};

function makeFan(): Fan {
  return {
    id: null,
    team: "ct",
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    ducked: false,
    smokeSig: NaN,
    gridEpoch: -1,
    stale: -1,
    castAt: 0,
    shiftX: 0,
    shiftY: 0,
    shiftZ: 0,
    reach: new Float32Array(RAYS),
  };
}

function makeSmoke(): VisionSmoke {
  return {
    ox: 0,
    oy: 0,
    oz: 0,
    vs: 20,
    dx: 0,
    dy: 0,
    dz: 0,
    texels: new Uint8Array(0),
    span: 0,
    reach: 0,
    front: 0,
    x0: 0,
    y0: 0,
    z0: 0,
    x1: 0,
    y1: 0,
    z1: 0,
    holes: new Float32Array(MAX_HOLES * 4),
    holeCount: 0,
  };
}

/** Builds the grid in a worker; on this thread if workers fail. */
function gridInWorker(tri: Float32Array, bounds: VisionBounds | null) {
  let worker: Worker | null = null;
  let settle: (grid: VisionGrid | null) => void = () => {};
  const result = new Promise<VisionGrid | null>((resolve) => {
    settle = resolve;
    const local = () => {
      try {
        resolve(buildVisionGrid(tri, bounds));
      } catch {
        resolve(null);
      }
    };
    try {
      worker = new Worker(new URL("./visionGrid.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      local();
      return;
    }
    worker.onmessage = (event: MessageEvent<VisionGrid>) => {
      worker?.terminate();
      worker = null;
      resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      worker?.terminate();
      worker = null;
      local();
    };
    // The stage keeps the hull for the other modules; the worker gets a copy.
    const copy = tri.slice();
    worker.postMessage({ tri: copy, bounds }, [copy.buffer]);
  });
  return {
    result,
    cancel() {
      worker?.terminate();
      worker = null;
      settle(null);
    },
  };
}

/** Lines drawn as screen-width ribbons, four vertices a segment, one draw. */
function ribbon(max: number, width: number, rim: number) {
  const positions = new Float32Array(max * 4 * 3);
  const other = new Float32Array(max * 4 * 3);
  const side = new Float32Array(max * 4);
  const color = new Float32Array(max * 4 * 4);
  const index = new Uint16Array(max * 6);
  for (let l = 0; l < max; l++) {
    const v = l * 4;
    side.set([-1, 1, -1, 1], v);
    index.set([v, v + 1, v + 3, v, v + 3, v + 2], l * 6);
  }
  const position = new THREE.BufferAttribute(positions, 3);
  const otherAttr = new THREE.BufferAttribute(other, 3);
  const colorAttr = new THREE.BufferAttribute(color, 4);
  for (const attr of [position, otherAttr, colorAttr]) {
    attr.setUsage(THREE.DynamicDrawUsage);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", position);
  geometry.setAttribute("aOther", otherAttr);
  geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geometry.setAttribute("aColor", colorAttr);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: {
      uViewport: { value: new THREE.Vector2(1, 1) },
      uWidth: { value: width },
      uRim: { value: rim },
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  let count = 0;
  return {
    mesh,
    material,
    begin() {
      count = 0;
    },
    /** One segment, world space, each end its own colour and alpha. */
    push(
      a: THREE.Vector3,
      b: THREE.Vector3,
      aColor: THREE.Color,
      aAlpha: number,
      bColor: THREE.Color,
      bAlpha: number,
    ) {
      if (count >= max) {
        return;
      }
      const l = count++;
      for (let c = 0; c < 4; c++) {
        const v = l * 4 + c;
        const atA = c < 2;
        const from = atA ? a : b;
        const to = atA ? b : a;
        const col = atA ? aColor : bColor;
        positions[v * 3] = from.x;
        positions[v * 3 + 1] = from.y;
        positions[v * 3 + 2] = from.z;
        other[v * 3] = to.x;
        other[v * 3 + 1] = to.y;
        other[v * 3 + 2] = to.z;
        color[v * 4] = col.r;
        color[v * 4 + 1] = col.g;
        color[v * 4 + 2] = col.b;
        color[v * 4 + 3] = atA ? aAlpha : bAlpha;
      }
    },
    end(ctx: StageContext) {
      geometry.setDrawRange(0, count * 6);
      if (count) {
        position.needsUpdate = true;
        otherAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
      }
      material.uniforms.uViewport.value.set(ctx.width / 2, ctx.height / 2);
      mesh.visible = count > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

export type VisionModule = StageModule & {
  /** The baked grid once it is ready (tests, the harness). */
  readonly grid: VisionGrid | null;
  /** Milliseconds the last update spent on rays and the mask, for tuning. */
  readonly cost: number;
};

/**
 * `smoke` is the smoke module, read for the grids it baked so a cloud blocks
 * sight exactly where it is drawn.
 */
export function createVisionModule(smoke: SmokeModule | null): VisionModule {
  let ctx: StageContext | null = null;
  let grid: VisionGrid | null = null;
  /** The hull the grid was built from (its triangle ids index it). */
  let tri: Float32Array | null = null;
  let gridMap: StageMap | null = null;
  let gridEpoch = 0;
  let build: ReturnType<typeof gridInWorker> | null = null;
  let building: Promise<void> | null = null;
  let cost = 0;
  let updates = 0;

  const smokes: VisionSmoke[] = Array.from({ length: MAX_SMOKES }, makeSmoke);
  let smokeCount = 0;
  const fans: Fan[] = Array.from({ length: MAX_FANS }, makeFan);

  // ------------------------------------------------------------- the mask

  const fogTarget = new THREE.WebGLRenderTarget(FOG_SIZE, FOG_SIZE, {
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const fogCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4e5);
  fogCamera.up.set(0, 0, -1);
  const fogViewProj = new THREE.Matrix4();
  const fogScene = new THREE.Scene();
  const fogPositions = new Float32Array(MAX_FANS * FOG_VERTS * 3);
  const fogTeams = new Float32Array(MAX_FANS * FOG_VERTS);
  const fogIndex = new Uint16Array(MAX_FANS * FOG_INDICES);
  for (let f = 0; f < MAX_FANS; f++) {
    const base = f * FOG_VERTS;
    let n = f * FOG_INDICES;
    for (let r = 0; r < RAYS - 1; r++) {
      fogIndex[n++] = base;
      fogIndex[n++] = base + 1 + r;
      fogIndex[n++] = base + 2 + r;
    }
    const ring = base + 1 + RAYS;
    for (let s = 0; s < NEAR_SEGMENTS; s++) {
      fogIndex[n++] = base;
      fogIndex[n++] = ring + s;
      fogIndex[n++] = ring + ((s + 1) % NEAR_SEGMENTS);
    }
  }
  const fogPosition = new THREE.BufferAttribute(fogPositions, 3);
  const fogTeam = new THREE.BufferAttribute(fogTeams, 1);
  fogPosition.setUsage(THREE.DynamicDrawUsage);
  fogTeam.setUsage(THREE.DynamicDrawUsage);
  const fogGeometry = new THREE.BufferGeometry();
  fogGeometry.setAttribute("position", fogPosition);
  fogGeometry.setAttribute("aTeam", fogTeam);
  fogGeometry.setIndex(new THREE.BufferAttribute(fogIndex, 1));
  const fogMaterial = new THREE.ShaderMaterial({
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendEquationAlpha: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
  fogMesh.frustumCulled = false;
  fogScene.add(fogMesh);
  let fogDirty = true;
  let fogAt = -Infinity;
  let fogFrameTime = NaN;
  let fogBounds = false;
  let lastBlindKey = -1;

  // ------------------------------------------------------------ the dim

  let depthTarget: THREE.WebGLRenderTarget | null = null;
  let depthFrame = -Infinity;
  const depthViewProj = new THREE.Matrix4();
  const viewProj = new THREE.Matrix4();
  const viewport = new THREE.Vector4();
  const clearColor = new THREE.Color();
  const muted: THREE.Material[] = [];
  const hidden: THREE.Object3D[] = [];
  const dimUniforms = {
    uDepth: { value: null as THREE.Texture | null },
    uFog: { value: fogTarget.texture as THREE.Texture },
    uInvProj: { value: new THREE.Matrix4() },
    uProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uFogVP: { value: fogViewProj },
    uViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uFogStep: { value: new THREE.Vector2() },
    uSide: { value: new THREE.Vector3(0, 0, 1) },
    uDim: { value: FOG_DIM },
    uGrey: { value: new THREE.Color(FOG_GREY) },
  };
  const dimGeometry = new THREE.BufferGeometry();
  dimGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );
  const dimMaterial = new THREE.ShaderMaterial({
    vertexShader: DIM_VERT,
    fragmentShader: DIM_FRAG,
    uniforms: dimUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const dim = new THREE.Mesh(dimGeometry, dimMaterial);
  dim.frustumCulled = false;
  // First among the see-through passes: over the map, under the puck decals,
  // callouts, walks, smokes, effects and portraits.
  dim.renderOrder = -50;
  dim.visible = false;

  // ----------------------------------------------- the followed player

  const coneFan = makeFan();
  const conePositions = new Float32Array(CONE_VERTS * 3);
  const coneRadial = new Float32Array(CONE_VERTS);
  const coneSide = new Float32Array(CONE_VERTS);
  const coneIndex = new Uint16Array(CONE_INDICES);
  /** The cone's edge, draped: where each ray stops. */
  const coneEdge = new Float32Array(RAYS * 3);
  for (let r = 0; r < RAYS; r++) {
    for (let k = 0; k <= RINGS; k++) {
      coneSide[r * (RINGS + 1) + k] = (2 * r) / (RAYS - 1) - 1;
    }
  }
  for (let r = 0, n = 0; r < RAYS - 1; r++) {
    for (let k = 0; k < RINGS; k++, n += 6) {
      const a = r * (RINGS + 1) + k;
      const b = a + RINGS + 1;
      coneIndex.set([a, b, b + 1, a, b + 1, a + 1], n);
    }
  }
  const conePosition = new THREE.BufferAttribute(conePositions, 3);
  const coneRadialAttr = new THREE.BufferAttribute(coneRadial, 1);
  conePosition.setUsage(THREE.DynamicDrawUsage);
  coneRadialAttr.setUsage(THREE.DynamicDrawUsage);
  const coneGeometry = new THREE.BufferGeometry();
  coneGeometry.setAttribute("position", conePosition);
  coneGeometry.setAttribute("aRadial", coneRadialAttr);
  coneGeometry.setAttribute("aSide", new THREE.BufferAttribute(coneSide, 1));
  coneGeometry.setIndex(new THREE.BufferAttribute(coneIndex, 1));
  const coneUniforms = {
    uColor: { value: new THREE.Color() },
    uStrength: { value: 0 },
  };
  const coneMaterial = new THREE.ShaderMaterial({
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    uniforms: coneUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.frustumCulled = false;
  cone.renderOrder = 0.3;
  cone.visible = false;
  const outline = ribbon(OUTLINE_SEGMENTS, 0.75, 0);
  outline.mesh.renderOrder = 0.35;

  // ------------------------------------------------------- engagements

  const lines = ribbon(MAX_LINES, 1.6, 1);
  // Over the smoke composite: a clear line never runs through a cloud.
  lines.mesh.renderOrder = 11;
  let pulses: SpriteBatch | null = null;

  const teamColor: Record<StageTeam, THREE.Color> = {
    ct: new THREE.Color(TEAM_BASE.ct),
    t: new THREE.Color(TEAM_BASE.t),
  };
  const coneColor: Record<StageTeam, THREE.Color> = {
    ct: new THREE.Color(hsl(TEAM_HUE.ct, 90, 60)),
    t: new THREE.Color(hsl(TEAM_HUE.t, 100, 56)),
  };
  const edgeColor: Record<StageTeam, THREE.Color> = {
    ct: new THREE.Color(hsl(TEAM_HUE.ct - 6, 100, 74)),
    t: new THREE.Color(hsl(TEAM_HUE.t + 4, 100, 68)),
  };
  const scratch = new THREE.Vector3();
  const lineA = new THREE.Vector3();
  const lineB = new THREE.Vector3();
  const point: Vec3 = { x: 0, y: 0, z: 0 };
  const alive: StagePlayer[] = [];
  /** Directed "sees" between alive players, row = spotter. */
  const sees = new Uint8Array(MAX_FANS * MAX_FANS);
  let pastIds: string[] | null = null;
  const pastIndex = new Map<string, number>();

  function resetGrid() {
    build?.cancel();
    build = null;
    building = null;
    grid = null;
    tri = null;
    gridMap = null;
    gridEpoch++;
    fogBounds = false;
    fogDirty = true;
  }

  function ensureGrid(map: StageMap) {
    if (gridMap === map || !map.tri) {
      return;
    }
    resetGrid();
    gridMap = map;
    const bounds: VisionBounds | null = Number.isFinite(map.min.x)
      ? { min: map.min, max: map.max }
      : null;
    const job = gridInWorker(map.tri, bounds);
    build = job;
    building = job.result.then((built) => {
      if (build !== job) {
        return;
      }
      build = null;
      building = null;
      grid = built;
      tri = built ? map.tri : null;
      gridEpoch++;
    });
  }

  /**
   * The mask covers the map as the stage lays it out: its box at a few
   * heights through `ctx.wpos`, so a storey laid beside the rest is in it.
   */
  function frameFog(context: StageContext, map: StageMap) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let s = 0; s <= 8; s++) {
      point.z = map.min.z + ((map.max.z - map.min.z) * s) / 8;
      for (let c = 0; c < 4; c++) {
        point.x = c & 1 ? map.max.x : map.min.x;
        point.y = c & 2 ? map.max.y : map.min.y;
        context.wpos(point, scratch);
        minX = Math.min(minX, scratch.x);
        maxX = Math.max(maxX, scratch.x);
        minZ = Math.min(minZ, scratch.z);
        maxZ = Math.max(maxZ, scratch.z);
      }
    }
    const half = Math.max(maxX - minX, maxZ - minZ) / 2 + 256;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    fogCamera.left = -half;
    fogCamera.right = half;
    fogCamera.top = half;
    fogCamera.bottom = -half;
    fogCamera.position.set(cx, 2e5, cz);
    fogCamera.lookAt(cx, 0, cz);
    fogCamera.updateProjectionMatrix();
    fogCamera.updateMatrixWorld();
    fogViewProj.multiplyMatrices(
      fogCamera.projectionMatrix,
      fogCamera.matrixWorldInverse,
    );
    const step = FOG_FEATHER / (2 * half);
    dimUniforms.uFogStep.value.set(step, step);
    fogBounds = true;
  }

  /** The frame's smokes as the cast reads them; returns their signature. */
  function gatherSmokes(frame: StageFrame) {
    smokeCount = 0;
    let sig = 0;
    if (!smoke) {
      return sig;
    }
    for (const s of frame.smokes) {
      if (smokeCount >= MAX_SMOKES) {
        break;
      }
      // A smoke in its last second has thinned out to see through.
      if (s.age < 0 || (s.remaining !== null && s.remaining < 1)) {
        continue;
      }
      const view = smoke.gridOf(s);
      const image = view?.texture.image as
        | { data: Uint8Array; width: number; height: number; depth: number }
        | undefined;
      if (!view || !image?.data) {
        continue;
      }
      const out = smokes[smokeCount++];
      out.ox = view.ox;
      out.oy = view.oy;
      out.oz = view.oz;
      out.dx = image.width;
      out.dy = image.height;
      out.dz = image.depth;
      out.vs = view.size.x / image.width;
      out.texels = image.data;
      out.span = view.span;
      out.reach = view.reach;
      out.front = smokeReachedBy(s.age);
      out.x0 = view.boxMin.x;
      out.y0 = view.boxMin.y;
      out.z0 = view.boxMin.z;
      out.x1 = view.boxMax.x;
      out.y1 = view.boxMax.y;
      out.z1 = view.boxMax.z;
      out.holeCount = 0;
      let holeSig = 0;
      for (const blast of frame.blasts) {
        if (out.holeCount >= MAX_HOLES || blast.age > s.age) {
          continue;
        }
        // CS2's HE hole, as the smoke draws it.
        const t = Math.min(1, Math.max(0, (blast.age - 0.5) / 4.5));
        const strength = (1 - Math.pow(t * t * (3 - 2 * t), 1.8)) * 0.98;
        const r = 190 * ((blast.radius || 250) / 250) * strength;
        if (r < 4) {
          continue;
        }
        const h = out.holeCount++ * 4;
        out.holes[h] = blast.x;
        out.holes[h + 1] = blast.y;
        out.holes[h + 2] = blast.z;
        out.holes[h + 3] = r;
        holeSig += Math.round(r);
      }
      sig +=
        (smokeCount * 7919 + Math.round(out.front * 256) + holeSig) *
          smokeCount +
        out.x0 * 1e-3 +
        out.y1 * 1e-4;
    }
    return sig;
  }

  function eyeOf(
    g: VisionGrid,
    x: number,
    y: number,
    z: number,
    ducked: boolean,
  ) {
    return eyeHeight(g, tri!, x, y, z, ducked ? EYE_DUCKED : EYE);
  }

  /**
   * Where the stage draws a player, as a shift from plain (x, z, -y): a
   * stacked map can lay a lower storey out beside the rest. A whole fan
   * moves with its player's storey, so it stays in one piece.
   */
  function shiftOf(context: StageContext, p: Vec3) {
    context.wpos(p, scratch);
    scratch.x -= p.x;
    scratch.y -= p.z;
    scratch.z += p.y;
    return scratch;
  }

  /** Casts a fan's rays from where the player stands now; returns the eye height. */
  function castFan(
    context: StageContext,
    g: VisionGrid,
    fan: Fan,
    p: StagePlayer,
  ) {
    const shift = shiftOf(context, p);
    fan.shiftX = shift.x;
    fan.shiftY = shift.y;
    fan.shiftZ = shift.z;
    fan.id = p.id;
    fan.team = p.team;
    fan.x = p.x;
    fan.y = p.y;
    fan.z = p.z;
    fan.yaw = p.yaw;
    fan.ducked = p.ducked;
    fan.gridEpoch = gridEpoch;
    fan.castAt = updates;
    const eyeZ = eyeOf(g, p.x, p.y, p.z, p.ducked);
    for (let r = 0; r < RAYS; r++) {
      const angle =
        (p.yaw - VISION_FOV / 2 + (VISION_FOV * r) / (RAYS - 1)) * RAD;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let reach = castRay(g, tri!, p.x, p.y, eyeZ, dx, dy, 0, RANGE);
      if (smokeCount) {
        reach = castSmoke(smokes, smokeCount, p.x, p.y, eyeZ, dx, dy, 0, reach);
      }
      fan.reach[r] = reach;
    }
    return eyeZ;
  }

  /** Writes a fan into the mask, flat, in world space; collapsed when not shown. */
  function writeFog(slot: number, fan: Fan, shown: boolean) {
    const base = slot * FOG_VERTS;
    fogTeams.fill(fan.team === "t" ? 1 : 0, base, base + FOG_VERTS);
    const cx = fan.x + fan.shiftX;
    const cz = -fan.y + fan.shiftZ;
    let o = base * 3;
    fogPositions[o++] = cx;
    fogPositions[o++] = 0;
    fogPositions[o++] = cz;
    for (let r = 0; r < RAYS; r++) {
      const angle =
        (fan.yaw - VISION_FOV / 2 + (VISION_FOV * r) / (RAYS - 1)) * RAD;
      const reach = shown ? fan.reach[r] : 0;
      fogPositions[o++] = cx + Math.cos(angle) * reach;
      fogPositions[o++] = 0;
      fogPositions[o++] = cz - Math.sin(angle) * reach;
    }
    const near = shown ? NEAR_SEEN : 0;
    for (let s = 0; s < NEAR_SEGMENTS; s++) {
      const angle = (s / NEAR_SEGMENTS) * Math.PI * 2;
      fogPositions[o++] = cx + Math.cos(angle) * near;
      fogPositions[o++] = 0;
      fogPositions[o++] = cz - Math.sin(angle) * near;
    }
  }

  function drawFog(renderer: THREE.WebGLRenderer, count: number) {
    fogGeometry.setDrawRange(0, count * FOG_INDICES);
    fogPosition.needsUpdate = true;
    fogTeam.needsUpdate = true;
    const target = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(fogTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.state.buffers.color.setMask(true);
    renderer.clear(true, false, false);
    renderer.autoClear = false;
    renderer.render(fogScene, fogCamera);
    renderer.autoClear = autoClear;
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.setRenderTarget(target);
  }

  /** Drapes the followed player's fan on the floor. */
  function drapeCone(g: VisionGrid, p: StagePlayer, eyeZ: number) {
    const fan = coneFan;
    for (let r = 0; r < RAYS; r++) {
      const angle =
        (fan.yaw - VISION_FOV / 2 + (VISION_FOV * r) / (RAYS - 1)) * RAD;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const reach = Math.max(START, fan.reach[r]);
      let floor = p.z;
      for (let k = 0; k <= RINGS; k++) {
        const ring = START + ((RANGE - START) * k) / RINGS;
        const d = Math.min(ring, reach);
        // The floor a voxel short of a wall: at the wall it would be the wall.
        const back = Math.max(START, d - g.vs);
        const found = floorBelow(
          g,
          p.x + dx * back,
          p.y + dy * back,
          eyeZ,
          DRAPE_DROP,
        );
        if (found === found) {
          floor = found;
        }
        const v = r * (RINGS + 1) + k;
        conePositions[v * 3] = p.x + dx * d + fan.shiftX;
        conePositions[v * 3 + 1] = floor + LIFT + fan.shiftY;
        conePositions[v * 3 + 2] = -(p.y + dy * d) + fan.shiftZ;
        coneRadial[v] = d / RANGE;
      }
      const last = (r * (RINGS + 1) + RINGS) * 3;
      coneEdge[r * 3] = conePositions[last];
      coneEdge[r * 3 + 1] = conePositions[last + 1];
      coneEdge[r * 3 + 2] = conePositions[last + 2];
    }
    conePosition.needsUpdate = true;
    coneRadialAttr.needsUpdate = true;
  }

  /** Where an outline vertex fades: out where a ray simply ran out of range. */
  function edgeAlpha(r: number) {
    const far = (coneFan.reach[r] - RANGE * 0.5) / (RANGE * 0.5);
    return 0.9 * (1 - Math.min(1, Math.max(0, far)));
  }

  /** The followed player's outline: out along one side, round the edge, back. */
  function outlineCone(p: StagePlayer) {
    const fan = coneFan;
    const color = edgeColor[p.team];
    outline.begin();
    lineA.set(p.x + fan.shiftX, p.z + LIFT + fan.shiftY, -p.y + fan.shiftZ);
    lineB.fromArray(coneEdge, 0);
    outline.push(lineA, lineB, color, 0.9, color, edgeAlpha(0));
    for (let r = 1; r < RAYS; r++) {
      lineA.fromArray(coneEdge, (r - 1) * 3);
      lineB.fromArray(coneEdge, r * 3);
      outline.push(lineA, lineB, color, edgeAlpha(r - 1), color, edgeAlpha(r));
    }
    lineA.fromArray(coneEdge, (RAYS - 1) * 3);
    lineB.set(p.x + fan.shiftX, p.z + LIFT + fan.shiftY, -p.y + fan.shiftZ);
    outline.push(lineA, lineB, color, edgeAlpha(RAYS - 1), color, 0.9);
  }

  /** Whether `a` sees `b` right now: in their view, and wall and smoke clear. */
  function seesNow(
    g: VisionGrid,
    ax: number,
    ay: number,
    az: number,
    yaw: number,
    aDucked: boolean,
    bx: number,
    by: number,
    bz: number,
    bDucked: boolean,
  ) {
    if (!inView(yaw, VISION_FOV, ax, ay, bx, by)) {
      return false;
    }
    const eye = eyeOf(g, ax, ay, az, aDucked);
    return (
      sightClear(
        g,
        tri!,
        smokes,
        smokeCount,
        ax,
        ay,
        eye,
        bx,
        by,
        bz + (bDucked ? CHEST_DUCKED : CHEST),
        8,
      ) ||
      sightClear(
        g,
        tri!,
        smokes,
        smokeCount,
        ax,
        ay,
        eye,
        bx,
        by,
        bz + (bDucked ? HEAD_DUCKED : HEAD),
        8,
      )
    );
  }

  /**
   * Seconds since `spotter` first saw `target`, from the poses a moment ago;
   * null when they have seen them longer than a pulse lasts.
   */
  function spottedAge(
    g: VisionGrid,
    frame: StageFrame,
    spotter: string,
    target: string,
  ) {
    const past = frame.vision;
    if (!past) {
      return null;
    }
    if (pastIds !== past.ids) {
      pastIds = past.ids;
      pastIndex.clear();
      past.ids.forEach((id, i) => pastIndex.set(id, i));
    }
    const a = pastIndex.get(spotter);
    const b = pastIndex.get(target);
    if (a === undefined || b === undefined) {
      return null;
    }
    const players = past.ids.length;
    const pose = past.poses;
    for (let m = 0; m < past.times.length; m++) {
      const time = past.times[m];
      if (frame.time - time > PULSE_SECS) {
        return null;
      }
      const oa = (m * players + a) * VISION_POSE;
      const ob = (m * players + b) * VISION_POSE;
      const seen =
        (pose[oa + 4] & 1) === 1 &&
        (pose[ob + 4] & 1) === 1 &&
        seesNow(
          g,
          pose[oa],
          pose[oa + 1],
          pose[oa + 2],
          pose[oa + 3],
          (pose[oa + 4] & 2) === 2,
          pose[ob],
          pose[ob + 1],
          pose[ob + 2],
          (pose[ob + 4] & 2) === 2,
        );
      if (!seen) {
        return Math.max(0, frame.time - time);
      }
    }
    return null;
  }

  /** A ring on whoever was just spotted, in the spotter's colour. */
  function pulse(
    g: VisionGrid,
    frame: StageFrame,
    context: StageContext,
    spotter: StagePlayer,
    target: StagePlayer,
    fade: number,
  ) {
    const age = spottedAge(g, frame, spotter.id, target.id);
    if (age === null || age > PULSE_SECS) {
      return;
    }
    const k = age / PULSE_SECS;
    context.wpos(target, scratch);
    scratch.y += target.ducked ? CHEST_DUCKED : CHEST;
    const size = 26 + 46 * (1 - Math.pow(1 - k, 2.2));
    pulses!.push(
      scratch,
      size,
      size,
      teamColor[spotter.team],
      Math.pow(1 - k, 1.4) * 0.95 * fade,
    );
  }

  /** The sight line between two enemies, eye to eye. */
  function sightLine(
    context: StageContext,
    g: VisionGrid,
    a: StagePlayer,
    b: StagePlayer,
    aSees: boolean,
    bSees: boolean,
    fade: number,
  ) {
    point.x = a.x;
    point.y = a.y;
    point.z = eyeOf(g, a.x, a.y, a.z, a.ducked);
    context.wpos(point, lineA);
    point.x = b.x;
    point.y = b.y;
    point.z = eyeOf(g, b.x, b.y, b.z, b.ducked);
    context.wpos(point, lineB);
    // Each end in its own team's colour; one who only is seen fades out.
    lines.push(
      lineA,
      lineB,
      teamColor[a.team],
      (aSees ? 0.95 : 0.2) * fade,
      teamColor[b.team],
      (bSees ? 0.95 : 0.2) * fade,
    );
  }

  /**
   * The map's depth, drawn by the map's own shaders with colour writes off
   * (so whatever they cut away is gone here too).
   */
  function muteForDepth(object: THREE.Object3D) {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) {
      return;
    }
    const material = object.material as THREE.Material;
    if (material.transparent || !material.depthWrite) {
      object.visible = false;
      hidden.push(object);
    } else if (material.colorWrite) {
      material.colorWrite = false;
      muted.push(material);
    }
  }

  function renderMapDepth(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const map = ctx?.map;
    if (!map) {
      return;
    }
    for (const collider of map.colliders) {
      collider.traverseVisible(muteForDepth);
    }
    // One target for all of them: clearing before each (a storey laid
    // beside the map is a second collider) would keep only the last.
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    for (const collider of map.colliders) {
      if (collider.visible) {
        renderer.render(collider, camera);
      }
    }
    renderer.autoClear = autoClear;
    for (const material of muted) {
      material.colorWrite = true;
    }
    for (const object of hidden) {
      object.visible = true;
    }
    muted.length = 0;
    hidden.length = 0;
  }

  /**
   * Right before the dim draws (so it sees the final camera and target):
   * the map's depth, when the camera moved, and now and then regardless.
   */
  dim.onBeforeRender = (renderer, _scene, camera) => {
    const stage = ctx;
    if (!stage?.map || !(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    renderer.getCurrentViewport(viewport);
    const scale = (stage.quality === "high" ? 0.5 : 0.35) / stage.pixelRatio;
    const width = Math.max(1, Math.round(viewport.z * scale));
    const height = Math.max(1, Math.round(viewport.w * scale));
    let resized = false;
    if (!depthTarget) {
      resized = true;
      depthTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true,
        depthTexture: new THREE.DepthTexture(width, height),
      });
      dimUniforms.uDepth.value = depthTarget.depthTexture;
    } else if (depthTarget.width !== width || depthTarget.height !== height) {
      resized = true;
      depthTarget.setSize(width, height);
    }
    dimUniforms.uViewport.value.copy(viewport);
    dimUniforms.uTexel.value.set(1 / width, 1 / height);
    dimUniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    dimUniforms.uProj.value.copy(camera.projectionMatrix);
    dimUniforms.uCamWorld.value.copy(camera.matrixWorld);
    viewProj.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    if (
      !resized &&
      viewProj.equals(depthViewProj) &&
      updates - depthFrame <= 30
    ) {
      return;
    }
    depthViewProj.copy(viewProj);
    depthFrame = updates;
    const target = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace();
    const level = renderer.getActiveMipmapLevel();
    const autoClear = renderer.autoClear;
    // Nested renders would otherwise reset the frame's draw-call counts.
    const autoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    // Mid-frame the masks are whatever the last draw left, and a clear does
    // not write through a closed one.
    renderer.state.buffers.depth.setMask(true);
    renderer.state.buffers.color.setMask(true);
    renderer.setRenderTarget(depthTarget);
    renderer.clear();
    renderMapDepth(renderer, camera);
    renderer.setRenderTarget(target, face, level);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.info.autoReset = autoReset;
  };

  // A lost context comes back with every target empty.
  function onContextRestored() {
    depthFrame = -Infinity;
    fogDirty = true;
  }

  function hide() {
    dim.visible = false;
    cone.visible = false;
    outline.mesh.visible = false;
    lines.mesh.visible = false;
    if (pulses) {
      pulses.begin();
      pulses.end();
    }
  }

  return {
    name: "vision",
    get grid() {
      return grid;
    },
    get cost() {
      return cost;
    },
    init(context) {
      ctx = context;
      pulses = createSpriteBatch({
        texture: canvasTexture(128, 128, (g, w, h) => {
          g.strokeStyle = "#ffffff";
          g.lineWidth = 7;
          g.beginPath();
          g.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
          g.stroke();
        }),
        max: MAX_LINES,
        screenSpace: true,
        depthTest: false,
        renderOrder: 990,
      });
      context.scene.add(dim, cone, outline.mesh, lines.mesh, pulses.mesh);
      context.renderer.domElement.addEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
    },
    onMap() {
      resetGrid();
      depthFrame = -Infinity;
      for (const fan of fans) {
        fan.id = null;
      }
      coneFan.id = null;
    },
    update(frame, context) {
      const map = context.map;
      if (!frame.vision || !map?.tri || frame.overlay) {
        hide();
        return;
      }
      ensureGrid(map);
      const g = grid;
      if (!g) {
        hide();
        return;
      }
      const started = performance.now();
      updates++;
      if (!fogBounds) {
        frameFog(context, map);
      }
      const sig = gatherSmokes(frame);

      alive.length = 0;
      let focus: StagePlayer | null = null;
      for (const p of frame.players) {
        if (p.alive && alive.length < MAX_FANS) {
          alive.push(p);
          if (p.selected) {
            focus = p;
          }
        }
      }

      // Fans for the mask: everything that must be recast, and the most out
      // of date of the rest, within the budget.
      let optional = 0;
      for (let slot = 0; slot < alive.length; slot++) {
        const p = alive[slot];
        const fan = fans[slot];
        const moved =
          Math.abs(fan.x - p.x) + Math.abs(fan.y - p.y) + Math.abs(fan.z - p.z);
        const turned = Math.abs(angleBetween(fan.yaw, p.yaw));
        const shift = shiftOf(context, p);
        fan.stale = -1;
        if (
          fan.id !== p.id ||
          fan.gridEpoch !== gridEpoch ||
          fan.ducked !== p.ducked ||
          moved > JUMP ||
          // Onto another storey's layout.
          Math.abs(shift.x - fan.shiftX) +
            Math.abs(shift.y - fan.shiftY) +
            Math.abs(shift.z - fan.shiftZ) >
            1
        ) {
          fan.stale = Infinity;
        } else if (fan.smokeSig !== sig || moved > 2 || turned > 0.5) {
          // Waiting counts too, so a fan still behind a growing smoke gets
          // its turn among players on the move.
          fan.stale =
            moved +
            turned * 6 +
            (fan.smokeSig !== sig ? 20 : 0) +
            (updates - fan.castAt) * 8;
          optional++;
        }
      }
      let budget = RECAST_BUDGET;
      while (budget > 0 && optional > 0) {
        let pick = -1;
        for (let slot = 0; slot < alive.length; slot++) {
          const stale = fans[slot].stale;
          if (
            stale >= 0 &&
            stale !== Infinity &&
            (pick < 0 || stale > fans[pick].stale)
          ) {
            pick = slot;
          }
        }
        if (pick < 0) {
          break;
        }
        fans[pick].stale = Infinity;
        budget--;
        optional--;
      }
      for (let slot = 0; slot < alive.length; slot++) {
        const fan = fans[slot];
        if (fan.stale === Infinity) {
          castFan(context, g, fan, alive[slot]);
          fan.smokeSig = sig;
          fogDirty = true;
        }
      }
      for (let slot = alive.length; slot < MAX_FANS; slot++) {
        if (fans[slot].id !== null) {
          fans[slot].id = null;
          fogDirty = true;
        }
      }
      // Blind players reveal nothing, which can change without a recast.
      let blindKey = 0;
      for (let slot = 0; slot < alive.length; slot++) {
        blindKey = blindKey * 2 + (alive[slot].blind > BLIND ? 1 : 0);
      }
      if (blindKey !== lastBlindKey) {
        lastBlindKey = blindKey;
        fogDirty = true;
      }
      // Redrawn a few times a second while the frame moves on, at once
      // when it holds still (paused, scrubbed, the harness).
      const now = performance.now() / 1000;
      if (
        fogDirty &&
        (now - fogAt >= FOG_INTERVAL || frame.time === fogFrameTime)
      ) {
        for (let slot = 0; slot < alive.length; slot++) {
          writeFog(slot, fans[slot], alive[slot].blind <= BLIND);
        }
        drawFog(context.renderer, alive.length);
        fogDirty = false;
        fogAt = now;
      }
      fogFrameTime = frame.time;

      const side = frame.visionSide ?? "both";
      dimUniforms.uSide.value.set(
        side === "ct" ? 1 : 0,
        side === "t" ? 1 : 0,
        side === "both" ? 1 : 0,
      );
      dim.visible = true;

      // The followed player's own view.
      if (focus) {
        const fan = coneFan;
        const moved =
          Math.abs(fan.x - focus.x) +
          Math.abs(fan.y - focus.y) +
          Math.abs(fan.z - focus.z);
        if (
          fan.id !== focus.id ||
          fan.gridEpoch !== gridEpoch ||
          fan.smokeSig !== sig ||
          fan.ducked !== focus.ducked ||
          moved > 0.5 ||
          Math.abs(angleBetween(fan.yaw, focus.yaw)) > 0.2
        ) {
          const eyeZ = castFan(context, g, fan, focus);
          fan.smokeSig = sig;
          drapeCone(g, focus, eyeZ);
          outlineCone(focus);
          coneUniforms.uColor.value.copy(coneColor[focus.team]);
        }
        coneUniforms.uStrength.value =
          (context.view === "2d" ? 0.16 : 0.2) * (1 - 0.85 * focus.blind);
        cone.visible = true;
        outline.end(context);
      } else {
        cone.visible = false;
        outline.mesh.visible = false;
      }
      // From straight above it reads as a radar: a cone under an overhang
      // still shows, as the walks do.
      coneMaterial.depthTest = context.view === "3d";
      outline.material.depthTest = context.view === "3d";

      // Who sees whom.
      const n = alive.length;
      sees.fill(0, 0, n * MAX_FANS);
      for (let i = 0; i < n; i++) {
        const a = alive[i];
        if (a.blind > BLIND) {
          continue;
        }
        for (let j = 0; j < n; j++) {
          const b = alive[j];
          if (b.team === a.team) {
            continue;
          }
          if (
            seesNow(g, a.x, a.y, a.z, a.yaw, a.ducked, b.x, b.y, b.z, b.ducked)
          ) {
            sees[i * MAX_FANS + j] = 1;
          }
        }
      }
      lines.begin();
      pulses!.begin();
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ab = sees[i * MAX_FANS + j] === 1;
          const ba = sees[j * MAX_FANS + i] === 1;
          if (!ab && !ba) {
            continue;
          }
          const a = alive[i];
          const b = alive[j];
          const fade = focus && focus !== a && focus !== b ? 0.4 : 1;
          sightLine(context, g, a, b, ab, ba, fade);
          if (ab) {
            pulse(g, frame, context, a, b, fade);
          }
          if (ba) {
            pulse(g, frame, context, b, a, fade);
          }
        }
      }
      lines.end(context);
      // Like the portraits they join, the lines read through walls.
      lines.material.depthTest = false;
      pulses!.setViewport(context.width, context.height);
      pulses!.end();
      cost = performance.now() - started;
    },
    settle() {
      return building ?? Promise.resolve();
    },
    dispose() {
      resetGrid();
      ctx?.renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
      for (const mesh of [dim, cone, outline.mesh, lines.mesh]) {
        mesh.removeFromParent();
      }
      dimGeometry.dispose();
      dimMaterial.dispose();
      coneGeometry.dispose();
      coneMaterial.dispose();
      outline.dispose();
      lines.dispose();
      fogGeometry.dispose();
      fogMaterial.dispose();
      fogTarget.dispose();
      depthTarget?.dispose();
      depthTarget = null;
      if (pulses) {
        pulses.mesh.removeFromParent();
        pulses.dispose();
        pulses = null;
      }
      ctx = null;
    },
  };
}
