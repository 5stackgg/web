import * as THREE from "three";
import { smokeReachedBy } from "./smokeArrival";
import { HE_BLAST_RADIUS } from "./grenadeEffects";
import {
  COMPOSITE_FRAG,
  COMPOSITE_VERT,
  MARCH_FRAG,
  MARCH_VERT,
  SMOKE_MAX_BLASTS,
  SMOKE_MEMBERS,
} from "./smokeShaders";
import type {
  SmokeGridStats,
  SmokeWorkerIn,
  SmokeWorkerOut,
} from "./smokeWorker";
import { teamWhisper } from "./teamColors";
import type {
  StageContext,
  StageFrame,
  StageModule,
  StageSmoke,
} from "./types";

/**
 * CS2 voxel smokes. Each smoke is CS2's own 32^3 grid of 20u voxels centred
 * on the detonation: Valve's arrival grid when the frame carries it, else a
 * flood through our collision hull run in a worker (see smokeWorker.ts), else
 * a dome on a flat floor. Grids are baked into 3D textures and raymarched;
 * smokes that overlap march together so they merge into one cloud.
 *
 * Drawing: a fullscreen composite sits in the scene. Right before it draws,
 * it renders the map's depth and the smoke boxes into half-resolution
 * targets, so the march can stop at walls in front of the cloud (only the
 * static map can hide smoke; pucks sit on the floor, so the cloud in front of
 * them is the cloud above them), then lays the result over the frame.
 */

const GRID = 32;
const VOXEL = 20;
/** Smokes drawn at once, and the marches (clusters) they can need. */
const MAX_SMOKES = 16;
const MAX_GRIDS = 48;
const NOISE_SIZE = 64;
/** The last seconds of a smoke, when it thins out and breaks up. */
const FADE_SECS = 1.75;

type Grid = {
  ready: boolean;
  empty: boolean;
  texture: THREE.Data3DTexture | null;
  ox: number;
  oy: number;
  oz: number;
  size: THREE.Vector3;
  boxMin: THREE.Vector3;
  boxMax: THREE.Vector3;
  /** Source units the texture's distance channel spans. */
  span: number;
  /** Source units from the detonation to the cloud's farthest reach. */
  reach: number;
  used: number;
  stats: SmokeGridStats | null;
};

type Live = {
  smoke: StageSmoke | null;
  grid: Grid | null;
  fade: number;
};

type Uniform<T> = { value: T };

type Slot = {
  mesh: THREE.Mesh;
  grids: Uniform<THREE.Data3DTexture | null>[];
  uniforms: {
    uCount: Uniform<number>;
    uGridMin: Uniform<THREE.Vector3[]>;
    uGridInv: Uniform<THREE.Vector3[]>;
    uTint: Uniform<THREE.Vector3[]>;
    uFront: Uniform<THREE.Vector4>;
    uReach: Uniform<THREE.Vector4>;
    uFade: Uniform<THREE.Vector4>;
    uErode: Uniform<THREE.Vector4>;
    uSpan: Uniform<THREE.Vector4>;
    uBoxMin: Uniform<THREE.Vector3>;
    uBoxMax: Uniform<THREE.Vector3>;
    uBlast: Uniform<THREE.Vector4[]>;
    uBlastK: Uniform<number[]>;
    uBlastCount: Uniform<number>;
    /** Where `wpos` puts this cloud against plain (x, z, -y), source units. */
    uShift: Uniform<THREE.Vector3>;
  };
};

const TINT = {
  t: new THREE.Vector3(...teamWhisper("t", 0.07)),
  ct: new THREE.Vector3(...teamWhisper("ct", 0.12)),
};

/** Position key, 2u steps, exact for anything inside ±65k units. */
function pointKey(x: number, y: number, z: number) {
  const rx = Math.round(x / 2) + 32768;
  const ry = Math.round(y / 2) + 32768;
  const rz = Math.round(z / 2) + 32768;
  return (rx * 65536 + ry) * 65536 + rz;
}

function vectors3(count: number) {
  return Array.from({ length: count }, () => new THREE.Vector3());
}

/** A smoke's baked grid as line of sight reads it (vision.ts); the texels stay on `texture.image.data`. */
export type SmokeGridView = Readonly<
  Pick<
    Grid,
    "ox" | "oy" | "oz" | "size" | "boxMin" | "boxMax" | "span" | "reach"
  > & { texture: THREE.Data3DTexture }
>;

export type SmokeModule = StageModule & {
  /** The grid a smoke of the current frame is drawn from, once it is ready. */
  gridOf(smoke: StageSmoke): SmokeGridView | null;
  /**
   * Where the frame's blasts come from instead of `frame.blasts` (blast.ts
   * swaps the C4's sphere for holes where its wave really went).
   */
  setBlastSource(
    source: ((frame: StageFrame) => StageFrame["blasts"]) | null,
  ): void;
};

export function createSmokeModule(): SmokeModule {
  let ctx: StageContext | null = null;
  let blastSource: ((frame: StageFrame) => StageFrame["blasts"]) | null = null;
  const shiftAt = new THREE.Vector3();
  let worker: Worker | null = null;
  /** The worker's code on this thread, once the worker itself failed. */
  let local: Promise<typeof import("./smokeWorker") | null> | null = null;
  let nextId = 1;
  const requests = new Map<number, (out: SmokeWorkerOut) => void>();
  /** Grid jobs in flight, to run again here if the worker dies. */
  const jobs = new Map<number, SmokeWorkerIn>();
  const pending = new Set<Promise<void>>();
  const grids = new Map<number | Uint8Array, Grid>();
  let frameNo = 0;

  const shared = {
    uNoise: { value: null as THREE.Data3DTexture | null },
    uDepth: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uInvProj: { value: new THREE.Matrix4() },
    uDensity: { value: 0.07 },
    uShadeLo: { value: 0.72 },
    uShadeHi: { value: 1.1 },
    uRimLight: { value: 0.35 },
    uNoiseScale: { value: 1 / 520 },
    uDrift: { value: new THREE.Vector3() },
    uLightDir: { value: new THREE.Vector3(-0.45, -0.3, 0.84).normalize() },
    uLit: { value: new THREE.Color(0xfff3d6) },
    uMid: { value: new THREE.Color(0xebd8ad) },
    uShade: { value: new THREE.Color(0xa08660) },
  };

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const smokeScene = new THREE.Scene();
  // Map materials muted for the depth pass, and see-through meshes hidden
  // from it; both restored right after.
  const muted: THREE.Material[] = [];
  const hidden: THREE.Object3D[] = [];
  const slots: Slot[] = [];
  const live: Live[] = Array.from({ length: MAX_SMOKES }, () => ({
    smoke: null,
    grid: null,
    fade: 1,
  }));
  const root = new Int8Array(MAX_SMOKES);
  let liveCount = 0;

  let depthTarget: THREE.WebGLRenderTarget | null = null;
  let smokeTarget: THREE.WebGLRenderTarget | null = null;

  const compositeUniforms = {
    uSmoke: { value: null as THREE.Texture | null },
    uViewport: { value: new THREE.Vector4(0, 0, 1, 1) },
    uMaxAlpha: { value: 0.96 },
    uFlat: { value: 0 },
    uStroke: { value: 2 },
    uShadowOffset: { value: new THREE.Vector2() },
    uRimColor: { value: new THREE.Color(0x3d2a1a) },
    uShadowColor: { value: new THREE.Color(0x2e1d10) },
  };
  const compositeGeometry = new THREE.BufferGeometry();
  compositeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );
  const composite = new THREE.Mesh(
    compositeGeometry,
    new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: compositeUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  composite.frustumCulled = false;
  // Over the pucks and their x-ray ghosts (inside a smoke they stay hidden),
  // under tracers, hit effects and portraits, which read through it.
  composite.renderOrder = 10;
  composite.visible = false;

  const viewport = new THREE.Vector4();
  const viewProj = new THREE.Matrix4();
  const depthViewProj = new THREE.Matrix4();
  let depthFrame = -Infinity;
  const clearColor = new THREE.Color();
  const lightWorld = new THREE.Vector3();
  const shadowFrom = new THREE.Vector3();
  const shadowTo = new THREE.Vector3();
  let noiseLanded: () => void = () => {};

  function makeSlot(quality: StageContext["quality"]): Slot {
    const grids = Array.from({ length: SMOKE_MEMBERS }, () => ({
      value: null as THREE.Data3DTexture | null,
    }));
    const uniforms: Slot["uniforms"] = {
      uCount: { value: 0 },
      uGridMin: { value: vectors3(SMOKE_MEMBERS) },
      uGridInv: { value: vectors3(SMOKE_MEMBERS) },
      uTint: { value: vectors3(SMOKE_MEMBERS) },
      uFront: { value: new THREE.Vector4() },
      uReach: { value: new THREE.Vector4() },
      uFade: { value: new THREE.Vector4() },
      uErode: { value: new THREE.Vector4() },
      uSpan: { value: new THREE.Vector4() },
      uBoxMin: { value: new THREE.Vector3() },
      uBoxMax: { value: new THREE.Vector3(1, 1, 1) },
      uBlast: {
        value: Array.from(
          { length: SMOKE_MAX_BLASTS },
          () => new THREE.Vector4(),
        ),
      },
      uBlastK: { value: new Array<number>(SMOKE_MAX_BLASTS).fill(0) },
      uBlastCount: { value: 0 },
      uShift: { value: new THREE.Vector3() },
    };
    const high = quality === "high";
    const material = new THREE.ShaderMaterial({
      vertexShader: MARCH_VERT,
      fragmentShader: MARCH_FRAG,
      defines: {
        MAX_STEPS: high ? 44 : 24,
        MIN_STEP: high ? "9.0" : "14.0",
        ...(high ? { LIGHT_SAMPLES: 1 } : {}),
      },
      uniforms: {
        ...shared,
        ...uniforms,
        ...Object.fromEntries(grids.map((grid, i) => [`uGrid${i}`, grid])),
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.visible = false;
    smokeScene.add(mesh);
    return { mesh, grids, uniforms };
  }

  function post(msg: SmokeWorkerIn, transfer: Transferable[] = []) {
    if (!local) {
      worker?.postMessage(msg, transfer);
      return;
    }
    local.then((code) => {
      const out = code
        ? code.handleSmokeMessage(msg)
        : msg.kind === "map"
          ? null
          : ({
              kind: "error",
              id: msg.kind === "grid" ? msg.id : null,
              message: "no smoke worker",
            } as const);
      if (out) {
        receive(out);
      }
    });
  }

  function request(msg: SmokeWorkerIn & { id: number }) {
    const done = new Promise<SmokeWorkerOut>((resolve) => {
      requests.set(msg.id, resolve);
    });
    jobs.set(msg.id, msg);
    post(msg);
    return done;
  }

  function receive(out: SmokeWorkerOut) {
    if (!ctx) {
      return;
    }
    if (out.kind === "noise") {
      const texture = new THREE.Data3DTexture(
        out.data,
        out.size,
        out.size,
        out.size,
      );
      texture.format = THREE.RGFormat;
      texture.type = THREE.UnsignedByteType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;
      shared.uNoise.value = texture;
      noiseLanded();
      return;
    }
    if (out.kind === "error") {
      console.error("[replay-stage] smoke:", out.message);
    }
    if (out.id === null) {
      // The noise failed: no smokes, but nothing should wait on it forever.
      noiseLanded();
      return;
    }
    requests.get(out.id)?.(out);
    requests.delete(out.id);
    jobs.delete(out.id);
  }

  /**
   * The worker would not start (or died): run its code here instead, from
   * the map on, and send it what the worker was still working on.
   */
  function runLocally() {
    worker?.terminate();
    worker = null;
    local ??= import("./smokeWorker").catch((error) => {
      console.error("[replay-stage] smoke worker code failed to load:", error);
      return null;
    });
    post({ kind: "map", tri: ctx?.map?.tri ?? null });
    if (!shared.uNoise.value) {
      post({ kind: "noise", size: NOISE_SIZE });
    }
    for (const job of jobs.values()) {
      post(job);
    }
  }

  // A lost context comes back with the depth target empty.
  function onContextRestored() {
    depthFrame = -Infinity;
  }

  function track(promise: Promise<void>) {
    pending.add(promise);
    promise.then(() => pending.delete(promise));
  }

  function evict() {
    if (grids.size <= MAX_GRIDS) {
      return;
    }
    let oldestKey: number | Uint8Array | null = null;
    let oldest = Infinity;
    for (const [key, grid] of grids) {
      if (grid.ready && grid.used < oldest && grid.used < frameNo) {
        oldest = grid.used;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      grids.get(oldestKey)?.texture?.dispose();
      grids.delete(oldestKey);
    }
  }

  function gridFor(smoke: StageSmoke): Grid | null {
    if (!ctx?.map) {
      return null;
    }
    const voxels = smoke.voxels;
    const key = voxels
      ? voxels.arrival
      : pointKey(smoke.at.x, smoke.at.y, smoke.at.z);
    const hit = grids.get(key);
    if (hit) {
      hit.used = frameNo;
      return hit;
    }
    const ox = voxels ? voxels.ox : smoke.at.x - (GRID / 2) * VOXEL;
    const oy = voxels ? voxels.oy : smoke.at.y - (GRID / 2) * VOXEL;
    const oz = voxels ? voxels.oz : smoke.at.z - (GRID / 2) * VOXEL;
    const vs = voxels ? voxels.vs : VOXEL;
    const dx = voxels ? voxels.dx : GRID;
    const dy = voxels ? voxels.dy : GRID;
    const dz = voxels ? voxels.dz : GRID;
    const grid: Grid = {
      ready: false,
      empty: true,
      texture: null,
      ox,
      oy,
      oz,
      size: new THREE.Vector3(dx * vs, dy * vs, dz * vs),
      boxMin: new THREE.Vector3(),
      boxMax: new THREE.Vector3(),
      span: 0,
      reach: 1,
      used: frameNo,
      stats: null,
    };
    grids.set(key, grid);
    evict();
    track(
      request({
        kind: "grid",
        id: nextId++,
        ox,
        oy,
        oz,
        vs,
        dx,
        dy,
        dz,
        arrival: voxels ? voxels.arrival : null,
      }).then((out) => {
        if (grids.get(key) !== grid) {
          return;
        }
        if (out.kind !== "grid") {
          // Left empty, so it is not asked for again every frame.
          grid.ready = true;
          return;
        }
        const [i0, j0, k0, i1, j1, k1] = out.bounds;
        grid.ready = true;
        grid.stats = out.stats;
        grid.span = out.span;
        grid.reach = out.reach;
        grid.empty = i1 < i0;
        if (grid.empty) {
          return;
        }
        grid.boxMin.set(ox + i0 * vs, oy + j0 * vs, oz + k0 * vs);
        grid.boxMax.set(
          ox + (i1 + 1) * vs,
          oy + (j1 + 1) * vs,
          oz + (k1 + 1) * vs,
        );
        const texture = new THREE.Data3DTexture(out.texels, dx, dy, dz);
        texture.format = THREE.RGBAFormat;
        texture.type = THREE.UnsignedByteType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS =
          texture.wrapT =
          texture.wrapR =
            THREE.ClampToEdgeWrapping;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        grid.texture = texture;
      }),
    );
    return grid;
  }

  function clearGrids() {
    for (const grid of grids.values()) {
      grid.texture?.dispose();
    }
    grids.clear();
  }

  /**
   * The map draws itself into the depth target with colour writes off: its
   * own shaders, so whatever it cuts away (roofs in 2D) is gone here too.
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

  /** Makes the half-resolution targets fit; true when they changed. */
  function ensureTargets(width: number, height: number) {
    let changed = false;
    if (!depthTarget || !smokeTarget) {
      changed = true;
      depthTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true,
        depthTexture: new THREE.DepthTexture(width, height),
      });
      smokeTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
      shared.uDepth.value = depthTarget.depthTexture;
      compositeUniforms.uSmoke.value = smokeTarget.texture;
    }
    if (depthTarget.width !== width || depthTarget.height !== height) {
      changed = true;
      depthTarget.setSize(width, height);
      smokeTarget.setSize(width, height);
    }
    shared.uResolution.value.set(width, height);
    return changed;
  }

  /**
   * Runs inside the scene's render, right before the composite draws, so it
   * sees the final camera and whatever target the scene is going into.
   */
  composite.onBeforeRender = (renderer, _scene, camera) => {
    const stage = ctx;
    if (!stage?.map || !(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    renderer.getCurrentViewport(viewport);
    const scale = (stage.quality === "high" ? 0.5 : 0.35) / stage.pixelRatio;
    const width = Math.max(1, Math.round(viewport.z * scale));
    const height = Math.max(1, Math.round(viewport.w * scale));
    const resized = ensureTargets(width, height);
    compositeUniforms.uViewport.value.copy(viewport);
    shared.uInvProj.value.copy(camera.projectionMatrixInverse);

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
    // This runs mid-frame, so the depth and colour masks are whatever the
    // last draw left (often closed), and a clear does not write through a
    // closed mask. The depth target then kept the nearest depth of every
    // camera since: after a zoom, phantom walls cut the cloud to a sliver.
    renderer.state.buffers.depth.setMask(true);
    renderer.state.buffers.color.setMask(true);

    // The map is static: while the camera holds still (a parked 2D view) its
    // depth is reused, refreshed now and then in case the map changed what it
    // draws (the roof cut).
    viewProj.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    if (
      !viewProj.equals(depthViewProj) ||
      resized ||
      frameNo - depthFrame > 30
    ) {
      depthViewProj.copy(viewProj);
      depthFrame = frameNo;
      renderer.setRenderTarget(depthTarget);
      renderer.clear();
      renderMapDepth(renderer, camera);
    }
    renderer.setRenderTarget(smokeTarget);
    renderer.render(smokeScene, camera);

    renderer.setRenderTarget(target, face, level);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.info.autoReset = autoReset;
  };

  function findLight(scene: THREE.Scene) {
    for (const child of scene.children) {
      if (child instanceof THREE.DirectionalLight) {
        lightWorld.copy(child.position).sub(child.target.position).normalize();
        // world (x, y, z) is source (x, -z, y)
        shared.uLightDir.value.set(lightWorld.x, -lightWorld.z, lightWorld.y);
        return;
      }
    }
  }

  /**
   * Where the sun throws a smoke's shadow on screen: its centre against the
   * point a cloud-height shadow lands, both projected.
   */
  function shadowOffset(context: StageContext, grid: Grid) {
    const light = shared.uLightDir.value;
    const height = (grid.boxMax.z - grid.boxMin.z) * 0.6;
    const cx = (grid.boxMin.x + grid.boxMax.x) / 2;
    const cy = (grid.boxMin.y + grid.boxMax.y) / 2;
    const reach = height / Math.max(0.2, light.z);
    shadowFrom.set(cx, grid.boxMin.z, -cy).project(context.camera);
    shadowTo
      .set(cx - light.x * reach, grid.boxMin.z, -(cy - light.y * reach))
      .project(context.camera);
    compositeUniforms.uShadowOffset.value.set(
      (shadowTo.x - shadowFrom.x) / 2,
      (shadowTo.y - shadowFrom.y) / 2,
    );
  }

  function find(i: number): number {
    while (root[i] !== i) {
      root[i] = root[root[i]];
      i = root[i];
    }
    return i;
  }

  function overlaps(a: Grid, b: Grid) {
    return (
      a.boxMin.x <= b.boxMax.x &&
      b.boxMin.x <= a.boxMax.x &&
      a.boxMin.y <= b.boxMax.y &&
      b.boxMin.y <= a.boxMax.y &&
      a.boxMin.z <= b.boxMax.z &&
      b.boxMin.z <= a.boxMax.z
    );
  }

  function addMember(slot: Slot, entry: Live) {
    const u = slot.uniforms;
    const i = u.uCount.value++;
    const smoke = entry.smoke!;
    const grid = entry.grid!;
    slot.grids[i].value = grid.texture;
    u.uGridMin.value[i].set(grid.ox, grid.oy, grid.oz);
    u.uGridInv.value[i].set(1 / grid.size.x, 1 / grid.size.y, 1 / grid.size.z);
    u.uTint.value[i].copy(TINT[smoke.team]);
    u.uFront.value.setComponent(i, smokeReachedBy(smoke.age));
    u.uReach.value.setComponent(i, grid.reach);
    u.uFade.value.setComponent(i, entry.fade);
    u.uSpan.value.setComponent(i, grid.span);
    // The noise carves deeper as the smoke pops (a puffy burst) and as it
    // expires (it breaks up rather than fading flat).
    const pop = 1 - Math.min(1, smoke.age / 0.6);
    u.uErode.value.setComponent(i, 0.55 + pop * 0.2 + (1 - entry.fade) * 0.45);
    if (i === 0) {
      // A cloud goes with its detonation's storey on a map laid side by side.
      const at = smoke.at;
      const placed = ctx
        ? ctx.wpos(at, shiftAt)
        : shiftAt.set(at.x, at.z, -at.y);
      u.uShift.value.set(placed.x - at.x, -(placed.z + at.y), placed.y - at.z);
      u.uBoxMin.value.copy(grid.boxMin);
      u.uBoxMax.value.copy(grid.boxMax);
    } else {
      u.uBoxMin.value.min(grid.boxMin);
      u.uBoxMax.value.max(grid.boxMax);
    }
  }

  function finishSlot(slot: Slot, frame: StageFrame, youngest: number) {
    const u = slot.uniforms;
    for (let i = u.uCount.value; i < SMOKE_MEMBERS; i++) {
      slot.grids[i].value = null;
      u.uFade.value.setComponent(i, 0);
    }
    const min = u.uBoxMin.value;
    const max = u.uBoxMax.value;
    let count = 0;
    for (const blast of blastSource?.(frame) ?? frame.blasts) {
      if (count >= SMOKE_MAX_BLASTS) {
        break;
      }
      // A blast from before every smoke here popped has nothing to push.
      if (blast.age > youngest) {
        continue;
      }
      const reach = blast.radius || HE_BLAST_RADIUS;
      if (
        blast.x < min.x - reach ||
        blast.x > max.x + reach ||
        blast.y < min.y - reach ||
        blast.y > max.y + reach ||
        blast.z < min.z - reach ||
        blast.z > max.z + reach
      ) {
        continue;
      }
      const t = Math.min(1, Math.max(0, (blast.age - 0.5) / 4.5));
      const strength = (1 - Math.pow(t * t * (3 - 2 * t), 1.8)) * 0.98;
      if (strength <= 0.001) {
        continue;
      }
      u.uBlast.value[count].set(blast.x, blast.y, blast.z, reach);
      u.uBlastK.value[count] = strength;
      count++;
    }
    u.uBlastCount.value = count;

    const mesh = slot.mesh;
    const shift = u.uShift.value;
    mesh.position.set(
      (min.x + max.x) / 2 + shift.x,
      (min.z + max.z) / 2 + shift.z,
      -(min.y + max.y) / 2 - shift.y,
    );
    mesh.scale.set(max.x - min.x, max.z - min.z, max.y - min.y);
    mesh.visible = true;
  }

  /** Groups overlapping smokes so each group marches as one cloud. */
  function buildSlots(frame: StageFrame) {
    for (let i = 0; i < liveCount; i++) {
      root[i] = i;
    }
    for (let i = 0; i < liveCount; i++) {
      for (let j = i + 1; j < liveCount; j++) {
        if (overlaps(live[i].grid!, live[j].grid!)) {
          root[find(j)] = find(i);
        }
      }
    }
    let used = 0;
    for (let r = 0; r < liveCount && used < slots.length; r++) {
      if (find(r) !== r) {
        continue;
      }
      let slot: Slot | null = null;
      let youngest = Infinity;
      for (let i = r; i < liveCount; i++) {
        if (find(i) !== r) {
          continue;
        }
        if (!slot || slot.uniforms.uCount.value >= SMOKE_MEMBERS) {
          if (slot) {
            finishSlot(slot, frame, youngest);
          }
          if (used >= slots.length) {
            slot = null;
            break;
          }
          slot = slots[used++];
          slot.uniforms.uCount.value = 0;
          youngest = Infinity;
        }
        addMember(slot, live[i]);
        youngest = Math.min(youngest, live[i].smoke!.age);
      }
      if (slot) {
        finishSlot(slot, frame, youngest);
      }
    }
    for (let i = used; i < slots.length; i++) {
      slots[i].mesh.visible = false;
    }
    return used;
  }

  return {
    name: "smoke",
    init(context) {
      ctx = context;
      worker = new Worker(new URL("./smokeWorker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<SmokeWorkerOut>) => {
        receive(event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        runLocally();
      };
      context.renderer.domElement.addEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
      track(
        new Promise<void>((resolve) => {
          noiseLanded = resolve;
        }),
      );
      post({ kind: "noise", size: NOISE_SIZE });
      for (let i = 0; i < MAX_SMOKES; i++) {
        slots.push(makeSlot(context.quality));
      }
      context.scene.add(composite);
    },
    onMap(context) {
      clearGrids();
      depthFrame = -Infinity;
      const tri = context.map?.tri;
      // A copy: the stage keeps its own for the other modules.
      const copy = tri ? tri.slice() : null;
      post({ kind: "map", tri: copy }, copy ? [copy.buffer] : []);
    },
    update(frame, context) {
      frameNo++;
      findLight(context.scene);
      const clock = context.clock;
      shared.uDrift.value.set(clock * 0.011, clock * 0.007, -clock * 0.009);
      const flat = context.view === "2d";
      compositeUniforms.uFlat.value = flat ? 1 : 0;
      compositeUniforms.uStroke.value = 1.6 * context.pixelRatio;
      compositeUniforms.uMaxAlpha.value = flat ? 0.94 : 0.96;

      liveCount = 0;
      for (const smoke of frame.smokes) {
        if (liveCount >= live.length) {
          break;
        }
        const remaining = smoke.remaining;
        const k =
          remaining === null
            ? 1
            : Math.min(1, Math.max(0, remaining / FADE_SECS));
        if (k <= 0 || smoke.age < 0) {
          continue;
        }
        const grid = gridFor(smoke);
        if (!grid?.ready || grid.empty || !shared.uNoise.value) {
          continue;
        }
        const entry = live[liveCount++];
        entry.smoke = smoke;
        entry.grid = grid;
        entry.fade = k * k * (3 - 2 * k);
      }
      composite.visible = buildSlots(frame) > 0;
      if (flat && liveCount > 0) {
        shadowOffset(context, live[0].grid!);
      }
      for (let i = 0; i < liveCount; i++) {
        live[i].smoke = null;
      }
    },
    setBlastSource(source) {
      blastSource = source;
    },
    gridOf(smoke) {
      const voxels = smoke.voxels;
      const grid = grids.get(
        voxels ? voxels.arrival : pointKey(smoke.at.x, smoke.at.y, smoke.at.z),
      );
      return grid?.ready && !grid.empty && grid.texture
        ? (grid as SmokeGridView)
        : null;
    },
    settle() {
      return Promise.all([...pending]).then(() => undefined);
    },
    dispose() {
      worker?.terminate();
      worker = null;
      ctx?.renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
      requests.clear();
      jobs.clear();
      clearGrids();
      ctx?.scene.remove(composite);
      composite.geometry.dispose();
      (composite.material as THREE.Material).dispose();
      for (const slot of slots) {
        (slot.mesh.material as THREE.Material).dispose();
      }
      boxGeometry.dispose();
      shared.uNoise.value?.dispose();
      depthTarget?.dispose();
      smokeTarget?.dispose();
      ctx = null;
    },
  };
}
