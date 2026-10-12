import * as THREE from "three";
import { fetchMeshBuffer, resolveMapAssets } from "~/utilities/mapAssets";
import type { BlastWorkerIn, BlastWorkerOut } from "./blast.worker";
import {
  BLAST_SPEED,
  BLAST_UNIT,
  C4_RADIUS,
  blastSpotKey,
  fieldDistance,
  fieldZones,
  siteCentre,
  unpackBlastFile,
  valveSiteAt,
  type BlastField,
  type BlastSite,
} from "./blastField";
import {
  CELL,
  acquireFxAtlas,
  clamp01,
  createFxBatch,
  easeOutCubic,
  groundIndexFor,
  hashKey,
  rand,
  releaseFxAtlas,
  smoothstep,
  type FxBatch,
} from "./fx";
import { paletteFor } from "./mapPalette";
import { CUT_GLSL } from "./mapShaders";
import type {
  StageBlast,
  StageContext,
  StageFrame,
  StageModule,
  Vec3,
} from "./types";

/**
 * The C4 going off, and where it would hurt.
 *
 * When the bomb explodes a shockwave front runs out from it along the
 * blast field (blastField.ts): the distance the wave travels through open
 * space, so it pours down corridors, bends round corners and stops at
 * walls. It is painted onto the map's own surfaces, hugging the ground, hot
 * where it would kill and paler where it only hurts, with a fireball,
 * debris and a dust plume at the bomb.
 *
 * With the "Blast radius" view on, the same field draws as quiet ground
 * contours while the bomb is planted: who dies with armour, who dies
 * without, how far it reaches at all. With no bomb planted it shows the
 * generic zones of both sites (published per map, else measured here).
 *
 * The field for a plant spot is measured in a worker as soon as the bomb is
 * planted, so it is ready by the explosion 40 seconds later.
 */
export type BlastModule = StageModule & {
  /**
   * The frame's smoke-pushing blasts with the C4's sphere replaced: a hole
   * through each smoke the front reached inside the lethal zone, opening as
   * it arrives. The frame's own list until the field is ready.
   */
  smokeBlasts(frame: StageFrame): StageBlast[];
  stats: { fieldMs: number | null; source: "worker" | "published" | null };
};

/** A hole this "radius" (smoke.ts scales it) takes a whole smoke. */
const SMOKE_HOLE = 720;
/** Seconds the front and its afterglow play for; the scorch stays longer. */
const WAVE_SECS = 3.2;
const SCORCH_SECS = 7;
/** Seconds the zones take to come and go. */
const ZONE_FADE = 0.35;

const rgb = (hex: number) =>
  new THREE.Vector3(
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  );

// Display colours (sRGB), as they should land on screen.
const COLORS = {
  core: rgb(0xff3b30),
  heavy: rgb(0xff8a1f),
  light: rgb(0xffd166),
  hot: rgb(0xfff4d6),
  front: rgb(0xffb347),
  scorch: rgb(0x1d1210),
};

const FIREBALL = new THREE.Color().setRGB(1, 0.55, 0.16, THREE.SRGBColorSpace);
const FIRE_CORE = new THREE.Color().setRGB(1, 0.85, 0.5, THREE.SRGBColorSpace);
const WHITE = new THREE.Color(1, 1, 1);
const DUST = new THREE.Color().setRGB(0.36, 0.27, 0.2, THREE.SRGBColorSpace);
const DUST_LIT = new THREE.Color().setRGB(
  0.95,
  0.55,
  0.25,
  THREE.SRGBColorSpace,
);
const SHARD_HOT = new THREE.Color().setRGB(1, 0.75, 0.35, THREE.SRGBColorSpace);
const SHARD_COLD = new THREE.Color().setRGB(
  0.22,
  0.18,
  0.16,
  THREE.SRGBColorSpace,
);
const SCORCH = new THREE.Color().setRGB(
  0.05,
  0.04,
  0.035,
  THREE.SRGBColorSpace,
);

const VERT = /* glsl */ `
attribute float aInfo;
attribute vec3 aCut;
#ifdef SHIFT
attribute float aShift;
uniform vec3 uShift[4];
#endif
flat varying vec3 vCut;
flat varying float vInfo;
varying vec3 vSrc;
varying vec3 vWorld;
void main() {
  vSrc = position;
  vInfo = aInfo;
  vCut = aCut;
  vec4 world = modelMatrix * vec4(position, 1.0);
#ifdef SHIFT
  world.xyz += uShift[int(aShift + 0.5)];
#endif
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
${CUT_GLSL}
uniform sampler3D uField;
uniform vec3 uFieldMin;
uniform vec3 uFieldSize;
uniform float uVoxel;
uniform vec3 uReach;
uniform float uUnit;
uniform float uBombZ;
uniform float uRadius;
uniform float uSpeed;
uniform float uWave;
uniform float uZones;
uniform vec3 uCore;
uniform vec3 uHeavy;
uniform vec3 uLight;
uniform vec3 uHot;
uniform vec3 uFront;
uniform vec3 uScorch;
flat varying float vInfo;
varying vec3 vSrc;
varying vec3 vWorld;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// The wave's path length to p, source units; 1e5 where it never gets.
float pathAt(vec3 p) {
  vec3 uvw = (p - uFieldMin) / uFieldSize;
  if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return 1e5;
  float q = texture(uField, uvw).r * 255.0;
  return q > 250.0 ? 1e5 : q * uUnit;
}

// A crisp line of about 'w' pixels at distance r.
float ring(float d, float r, float w) {
  float px = abs(d - r) / max(fwidth(d), 1e-3);
  return 1.0 - smoothstep(w - 0.6, w + 0.6, px);
}

void main() {
  int info = int(vInfo + 0.5);
  if (cutOpacity(info, vSrc.z) < 0.999) discard;
  // Read the field a little in front of the surface, on the side the
  // camera sees: the air there is where the wave ran.
  vec3 nw = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (dot(nw, cameraPosition - vWorld) < 0.0) nw = -nw;
  vec3 n = vec3(nw.x, -nw.z, nw.y);
  float d = pathAt(vSrc + n * uVoxel * 0.9);
  if (d > 1e4) discard;
  float flat_ = smoothstep(0.45, 0.8, n.z);
  // Height over the floor the surface stands on: walls light at the foot.
  // Foliage and loose pieces have no floor of their own; the bomb's stands in.
  bool leaf = (info & 3) == 1;
  float above = vCut.x < 32000.0 ? vSrc.z - vCut.x : vSrc.z - uBombZ;
  float foot = mix(1.0 - smoothstep(16.0, 130.0, above), 1.0, flat_ * (1.0 - smoothstep(60.0, 200.0, above)));
  if (leaf) foot *= 0.25;
  float sigma = uRadius / 3.0;
  float dmg = exp(-(d * d) / (2.0 * sigma * sigma));
  float inside = 1.0 - smoothstep(uReach.z - 40.0, uReach.z + 10.0, d);

  vec3 add = vec3(0.0);
  vec3 over = vec3(0.0);
  float alpha = 0.0;

  // Zones: quiet tints and thin contours, on the ground.
  if (uZones > 0.001) {
    vec3 tint = d < uReach.x ? uCore : d < uReach.y ? uHeavy : uLight;
    // Hatched where it kills, so it never reads as a site decal; a flat
    // wash where it only hurts.
    float stripe = (vSrc.x + vSrc.y) / 56.0;
    float sw = fwidth(stripe) * 2.0;
    float hatch = smoothstep(0.7 - sw, 0.7 + sw, abs(fract(stripe) - 0.5) * 2.0);
    float fill = d < uReach.x ? 0.05 + 0.22 * hatch : d < uReach.y ? 0.04 + 0.12 * hatch : 0.03 * inside;
    // The deeper into a zone, the stronger: the falloff reads at a glance.
    fill *= 0.75 + 0.25 * dmg;
    float lines = max(max(ring(d, uReach.x, 1.1) * 0.95, ring(d, uReach.y, 1.0) * 0.85), ring(d, uReach.z, 0.8) * 0.6);
    vec3 lineTint = ring(d, uReach.x, 1.6) > 0.0 ? uCore : ring(d, uReach.y, 1.6) > 0.0 ? uHeavy : uLight;
    float a = (fill * mix(0.35, 1.0, flat_) + lines * mix(0.3, 1.0, flat_)) * uZones;
    vec3 c = mix(tint, mix(lineTint, vec3(1.0), 0.25), clamp(lines, 0.0, 1.0));
    over += c * a;
    alpha += a;
  }

  // The shockwave: a bright front at the distance the wave has run,
  // ragged by heat shimmer, and the heat it leaves behind.
  if (uWave >= 0.0) {
    float t = uWave;
    float front = uSpeed * t;
    vec2 q = vSrc.xy;
    float shimmer = noise(q * 0.018 + vec2(t * 3.1, -t * 2.3)) * 0.65 + noise(q * 0.05 - vec2(t * 7.0, t * 5.0)) * 0.35;
    float dd = d + (shimmer - 0.5) * 46.0;
    float behind = front - dd;
    float width = mix(70.0, 170.0, smoothstep(0.0, uReach.z, front));
    float lead = smoothstep(-26.0, 4.0, behind);
    float tail = exp(-max(behind, 0.0) / width);
    // A white-hot lip on the leading edge, an orange body behind it.
    float lip = lead * exp(-max(behind, 0.0) / 34.0);
    // It weakens as it spreads and dies at the edge.
    float strength = mix(0.45, 1.0, dmg) * inside * (1.0 - 0.5 * smoothstep(0.8, 1.0, front / max(uReach.z, 1.0)));
    float rag = 0.7 + 0.6 * shimmer;
    vec3 body = mix(uHeavy, uFront, tail);
    add += (body * lead * tail * 1.1 + uHot * lip * 1.5) * strength * rag * foot;
    // Pressure ripples trailing the front: the air still shaking.
    float trail = max(behind, 0.0);
    float ripple = pow(0.5 + 0.5 * cos(trail * 0.045 - 0.6), 6.0) * exp(-trail / 520.0) * lead * smoothstep(40.0, 160.0, trail);
    add += uFront * ripple * 0.35 * strength * foot * (0.6 + 0.8 * shimmer);
    // Afterglow: where the front has been, glowing by how much it hurt.
    float passed = behind / uSpeed;
    if (passed > 0.0) {
      vec3 heat = d < uReach.x ? uCore : d < uReach.y ? uHeavy : uLight;
      float glow = exp(-passed * 2.6) * mix(0.06, 0.4, dmg) * inside * foot;
      add += heat * glow * (0.8 + 0.4 * shimmer);
      // Scorched ground where it killed, cooling for a few seconds.
      float burn = smoothstep(0.0, 0.25, passed) * (1.0 - smoothstep(${(SCORCH_SECS - 2).toFixed(1)}, ${SCORCH_SECS.toFixed(1)}, t));
      // Soot: patchy, heaviest by the bomb.
      float soot = noise(q * 0.012) * 0.6 + noise(q * 0.05) * 0.4;
      float s = (d < uReach.y ? 0.26 : 0.06 * inside) * dmg * flat_ * burn;
      s *= smoothstep(0.25, 0.75, soot + 0.35 * dmg);
      over = mix(over, uScorch * s, step(alpha, s));
      alpha = max(alpha, s);
    }
    add *= 1.0 - smoothstep(${(WAVE_SECS - 1).toFixed(1)}, ${WAVE_SECS.toFixed(1)}, t);
  }

  if (alpha < 0.002 && dot(add, vec3(1.0)) < 0.002) discard;
  // Premultiplied: 'over' blends normally, 'add' adds light.
  gl_FragColor = vec4(over + add, clamp(alpha, 0.0, 1.0));
}
`;

type Overlay = {
  key: string;
  field: BlastField;
  texture: THREE.Data3DTexture;
  mesh: THREE.Mesh | null;
  material: THREE.ShaderMaterial;
  /** The map geometry the overlay was cut from. */
  source: THREE.BufferGeometry | null;
  /** Triangles of the map inside the field. */
  tris: Uint32Array | null;
  shifts: THREE.Vector3[];
  probes: Int32Array;
};

type FieldEntry = {
  field: BlastField | null;
  promise: Promise<BlastField | null>;
};

export function createBlastModule(): BlastModule {
  let ctx: StageContext | null = null;
  let group: THREE.Group | null = null;
  let sprites: FxBatch | null = null;
  let decals: FxBatch | null = null;
  let worker: Worker | null = null;
  /** The worker's code on this thread, once the worker itself failed. */
  let local: Promise<typeof import("./blast.worker") | null> | null = null;
  let mapTri: Float32Array | null = null;
  let mapSent = false;
  let localMap = false;
  let nextId = 1;
  let low = false;
  const requests = new Map<number, (out: BlastWorkerOut | null) => void>();
  const jobs = new Map<number, BlastWorkerIn>();
  const pending = new Set<Promise<unknown>>();
  const fields = new Map<string, FieldEntry>();
  const overlays = new Map<string, Overlay>();
  let sites: Promise<Array<{ site: string; field: BlastField }>> | null = null;
  let siteFields: Array<{ site: string; field: BlastField }> | null = null;
  /** The published file's sites, once fetched (`publishedSites`). */
  let publishedList: Promise<BlastSite[] | null> | null = null;
  /** Its Valve-baked sites: a bomb planted in one uses it, as the game does. */
  let valveSites: BlastSite[] = [];
  let mapToken = 0;
  let memo: { frame: StageFrame; out: StageBlast[] } | null = null;
  const tmp = new THREE.Vector3();
  const at = new THREE.Vector3();
  const at2 = new THREE.Vector3();
  const src: Vec3 = { x: 0, y: 0, z: 0 };

  const module: BlastModule = {
    name: "blast",
    stats: { fieldMs: null, source: null },
    init(context) {
      ctx = context;
      low = context.quality === "low";
      group = new THREE.Group();
      group.name = "blast";
      group.rotation.x = -Math.PI / 2;
      context.scene.add(group);
      const texture = acquireFxAtlas();
      decals = createFxBatch({
        texture,
        max: 32,
        ground: true,
        renderOrder: 2,
      });
      sprites = createFxBatch({
        texture,
        max: low ? 120 : 260,
        renderOrder: 6,
      });
      context.scene.add(decals.mesh, sprites.mesh);
    },
    onMap(context) {
      ctx = context;
      mapToken++;
      for (const overlay of overlays.values()) {
        disposeOverlay(overlay);
      }
      overlays.clear();
      fields.clear();
      sites = null;
      siteFields = null;
      publishedList = null;
      valveSites = [];
      mapTri = context.map?.tri ?? null;
      mapSent = false;
      localMap = false;
      memo = null;
      module.stats = { fieldMs: null, source: null };
    },
    update(frame, context) {
      ctx = context;
      const bomb = frame.bomb;
      const planted =
        bomb &&
        (bomb.state === "planted" ||
          bomb.state === "defusing" ||
          bomb.state === "defused" ||
          bomb.state === "exploded")
          ? bomb
          : null;
      const shown = new Map<string, { zones: number; wave: number }>();
      if (planted && context.map?.tri) {
        void publishedSites();
        const valve = valveSiteAt(valveSites, planted.at);
        const entry = valve ? { field: valve } : fieldFor(planted.at);
        if (entry.field) {
          let zones = 0;
          if (frame.blastZones) {
            zones =
              planted.state === "exploded"
                ? 0
                : planted.state === "defused"
                  ? 1 - smoothstep(0, ZONE_FADE * 2, planted.age)
                  : 1;
          }
          const wave =
            planted.state === "exploded" && planted.age < SCORCH_SECS
              ? planted.age
              : -1;
          if (zones > 0 || wave >= 0) {
            shown.set(fieldKey(entry.field), { zones, wave });
            ensureOverlay(entry.field);
          }
        }
      } else if (frame.blastZones && context.map?.tri) {
        for (const site of siteViews()) {
          shown.set(fieldKey(site.field), { zones: 0.85, wave: -1 });
          ensureOverlay(site.field);
        }
      }
      for (const [key, overlay] of overlays) {
        const show = shown.get(key);
        if (!show) {
          if (overlay.mesh) overlay.mesh.visible = false;
          continue;
        }
        drawOverlay(overlay, show.zones, show.wave);
      }
      // The fireball and its debris do not wait for the field.
      sprites!.begin();
      decals!.begin();
      if (planted?.state === "exploded") {
        explosion(planted.at, planted.age, hashKey(blastSpotKey(planted.at)));
      }
      sprites!.sync(context);
      decals!.sync(context);
      sprites!.end();
      decals!.end();
    },
    smokeBlasts(frame) {
      if (memo?.frame === frame) {
        return memo.out;
      }
      const out = smokeBlastsFor(frame);
      memo = { frame, out };
      return out;
    },
    settle() {
      return Promise.all([...pending]).then(() => undefined);
    },
    dispose() {
      for (const overlay of overlays.values()) {
        disposeOverlay(overlay);
      }
      overlays.clear();
      worker?.terminate();
      worker = null;
      for (const resolve of requests.values()) {
        resolve(null);
      }
      requests.clear();
      jobs.clear();
      if (ctx) {
        if (group) ctx.scene.remove(group);
        if (sprites) ctx.scene.remove(sprites.mesh);
        if (decals) ctx.scene.remove(decals.mesh);
      }
      sprites?.dispose();
      decals?.dispose();
      if (sprites || decals) {
        releaseFxAtlas();
      }
      sprites = null;
      decals = null;
      group = null;
      ctx = null;
    },
  };

  function fieldKey(field: BlastField) {
    return blastSpotKey(field.at);
  }

  // ------------------------------------------------------------ fields

  function track<T>(promise: Promise<T>) {
    pending.add(promise);
    void promise.finally(() => pending.delete(promise));
    return promise;
  }

  function startWorker() {
    if (worker || local) {
      return;
    }
    try {
      worker = new Worker(new URL("./blast.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<BlastWorkerOut>) => {
        const resolve = requests.get(event.data.id);
        requests.delete(event.data.id);
        jobs.delete(event.data.id);
        resolve?.(event.data);
      };
      // Module workers are missing on old browsers: measure here instead.
      worker.onerror = () => fallBack();
    } catch {
      fallBack();
    }
  }

  function fallBack() {
    worker?.terminate();
    worker = null;
    for (const [id, resolve] of requests) {
      const job = jobs.get(id);
      void (job ? runHere(job) : Promise.resolve(null)).then(resolve);
    }
    requests.clear();
    jobs.clear();
  }

  function runHere(job: BlastWorkerIn) {
    local ??= import("./blast.worker").catch(() => null);
    return local.then((mod) => {
      if (!mod) {
        return null;
      }
      if (!localMap) {
        mod.handleBlastMessage({ kind: "map", tri: mapTri });
        localMap = true;
      }
      return mod.handleBlastMessage(job);
    });
  }

  function measure(point: Vec3): Promise<BlastField | null> {
    const token = mapToken;
    startWorker();
    const id = nextId++;
    const job: BlastWorkerIn = {
      kind: "field",
      id,
      at: { x: point.x, y: point.y, z: point.z },
    };
    const reply = new Promise<BlastWorkerOut | null>((resolve) => {
      if (!worker) {
        void runHere(job).then(resolve);
        return;
      }
      if (!mapSent) {
        // A copy: the map keeps its hull.
        worker.postMessage({
          kind: "map",
          tri: mapTri,
        } satisfies BlastWorkerIn);
        mapSent = true;
      }
      requests.set(id, resolve);
      jobs.set(id, job);
      worker.postMessage(job);
    });
    return reply.then((out) => {
      if (token !== mapToken || !out || out.kind !== "field") {
        return null;
      }
      module.stats = { fieldMs: Math.round(out.ms), source: "worker" };
      return out.field;
    });
  }

  function fieldFor(point: Vec3): FieldEntry {
    const key = blastSpotKey(point);
    let entry = fields.get(key);
    if (!entry) {
      const fresh: FieldEntry = { field: null, promise: Promise.resolve(null) };
      fresh.promise = track(
        measure(point).then((field) => {
          fresh.field = field;
          return field;
        }),
      );
      entry = fresh;
      fields.set(key, entry);
      // Only the latest few plant spots are kept.
      while (fields.size > 4) {
        const oldest = fields.keys().next().value!;
        fields.delete(oldest);
        const overlay = overlays.get(oldest);
        if (overlay) {
          disposeOverlay(overlay);
          overlays.delete(oldest);
        }
      }
    }
    return entry;
  }

  /** Both sites' generic fields: the published file's, else measured here. */
  function siteViews() {
    if (!sites && ctx?.map) {
      const map = ctx.map;
      const token = mapToken;
      sites = track(
        publishedSites().then(async (list) => {
          if (list?.length) {
            module.stats = { fieldMs: null, source: "published" };
            return list;
          }
          const floors = groundIndexFor(map.tri);
          const rects = paletteFor(map.name).sites ?? {};
          const out: Array<{ site: string; field: BlastField }> = [];
          for (const letter of ["A", "B"] as const) {
            const centre = siteCentre(
              letter,
              map.callouts,
              rects[letter] ?? null,
              (x, y, top) => floors?.floorAt(x, y, top) ?? null,
            );
            const field = centre ? await measure(centre) : null;
            if (field) {
              out.push({ site: letter, field });
            }
          }
          return out;
        }),
      ).then((list) => {
        if (token === mapToken) {
          siteFields = list;
        }
        return list;
      });
    }
    return siteFields ?? [];
  }

  function publishedSites() {
    if (!publishedList && ctx?.map) {
      const token = mapToken;
      publishedList = track(published(ctx.map.name, ctx.map.tri)).then(
        (list) => {
          if (token === mapToken && list) {
            valveSites = list.filter((s) => s.field.model === 1);
          }
          return list;
        },
      );
    }
    return publishedList ?? Promise.resolve(null);
  }

  async function published(name: string, tri: Float32Array | null) {
    try {
      const urls = await resolveMapAssets(name, ctx?.assetBase ?? "");
      if (!urls?.blast || !tri) {
        return null;
      }
      const buffer = await fetchMeshBuffer(urls.blast).catch(() => null);
      const file = buffer ? unpackBlastFile(buffer) : null;
      // Made from another hull: measure for ourselves.
      if (!file || file.triangles !== Math.floor(tri.length / 9)) {
        return null;
      }
      return file.sites;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------- overlays

  /** The map's solid surfaces and their cut uniforms (map.ts), when built. */
  function mapSurface(): THREE.Mesh | null {
    const queue: THREE.Object3D[] = [...(ctx?.map?.colliders ?? [])];
    for (let i = 0; i < queue.length; i++) {
      const object = queue[i];
      queue.push(...object.children);
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) {
        continue;
      }
      const material = mesh.material as THREE.ShaderMaterial;
      const defines = material?.defines ?? {};
      if (
        material?.isShaderMaterial &&
        material.uniforms?.uCut2D &&
        mesh.geometry.getAttribute("aCut") &&
        mesh.geometry.getAttribute("aInfo") &&
        !("GHOST" in defines) &&
        !("GHOST_DEPTH" in defines) &&
        !("SEE_THROUGH" in defines)
      ) {
        return mesh;
      }
    }
    return null;
  }

  function ensureOverlay(field: BlastField) {
    const key = fieldKey(field);
    if (overlays.has(key)) {
      return;
    }
    const zones = fieldZones(field);
    const texture = new THREE.Data3DTexture(
      field.dist,
      field.dx,
      field.dy,
      field.dz,
    );
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    const NO_CUT = { value: 1e9 };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCut2D: NO_CUT,
        uCut3D: NO_CUT,
        uView: { value: 0 },
        uGhost: { value: 1 },
        uLevelCut: NO_CUT,
        uLevelMix: { value: 0 },
        uShift: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        uField: { value: texture },
        uFieldMin: { value: new THREE.Vector3(field.ox, field.oy, field.oz) },
        uFieldSize: {
          value: new THREE.Vector3(
            field.dx * field.vs,
            field.dy * field.vs,
            field.dz * field.vs,
          ),
        },
        uVoxel: { value: field.vs },
        uReach: {
          value: new THREE.Vector3(zones.core, zones.heavy, zones.edge),
        },
        uUnit: { value: field.unit ?? BLAST_UNIT },
        uBombZ: { value: field.at.z },
        uRadius: { value: C4_RADIUS },
        uSpeed: { value: BLAST_SPEED },
        uWave: { value: -1 },
        uZones: { value: 0 },
        uCore: { value: COLORS.core },
        uHeavy: { value: COLORS.heavy },
        uLight: { value: COLORS.light },
        uHot: { value: COLORS.hot },
        uFront: { value: COLORS.front },
        uScorch: { value: COLORS.scorch },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    overlays.set(key, {
      key,
      field,
      texture,
      mesh: null,
      material,
      source: null,
      tris: null,
      shifts: [new THREE.Vector3()],
      probes: new Int32Array(0),
    });
  }

  /** The map's triangles that reach into the field's box, nearest first. */
  function trianglesIn(field: BlastField, positions: ArrayLike<number>) {
    const x0 = field.ox;
    const y0 = field.oy;
    const z0 = field.oz;
    const x1 = x0 + field.dx * field.vs;
    const y1 = y0 + field.dy * field.vs;
    const z1 = z0 + field.dz * field.vs;
    const reach2 = (field.dx * field.vs * 0.5) ** 2;
    const count = Math.floor(positions.length / 9);
    const out = new Uint32Array(count);
    let n = 0;
    for (let t = 0; t < count; t++) {
      const o = t * 9;
      const cx = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
      const cy = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
      const cz = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
      if (cx < x0 || cx > x1 || cy < y0 || cy > y1 || cz < z0 || cz > z1) {
        continue;
      }
      if ((cx - field.at.x) ** 2 + (cy - field.at.y) ** 2 > reach2) {
        continue;
      }
      out[n++] = t;
    }
    return out.slice(0, n);
  }

  /**
   * Where `ctx.wpos` puts each triangle: the stage may lay a lower storey
   * beside the map (Nuke, Vertigo), and the overlay must land on that copy.
   * Up to four distinct shifts; a triangle's is its centre's.
   */
  function classify(
    overlay: Overlay,
    positions: ArrayLike<number>,
    source: THREE.BufferGeometry,
  ) {
    const tris = overlay.tris!;
    const shifts: THREE.Vector3[] = [];
    const classOf = new Uint8Array(tris.length);
    for (let n = 0; n < tris.length; n++) {
      shiftOf(tris[n], positions, tmp);
      let k = shifts.findIndex((s) => s.distanceToSquared(tmp) < 0.25);
      if (k < 0) {
        k = shifts.length < 4 ? shifts.push(tmp.clone()) - 1 : 0;
      }
      classOf[n] = k;
    }
    if (!shifts.length) {
      shifts.push(new THREE.Vector3());
    }
    overlay.shifts = shifts;
    // Probes: spread through the triangles, plus the lowest, so a layout
    // that moves only the bottom storey is noticed.
    const probes: number[] = [];
    const step = Math.max(1, Math.floor(tris.length / 24));
    for (let n = 0; n < tris.length; n += step) probes.push(n);
    const byZ = Array.from({ length: Math.min(tris.length, 4096) }, (_, i) =>
      Math.floor((i * tris.length) / Math.min(tris.length, 4096)),
    );
    byZ.sort((a, b) => positions[tris[a] * 9 + 2] - positions[tris[b] * 9 + 2]);
    probes.push(...byZ.slice(0, 8));
    overlay.probes = Int32Array.from(probes);
    const material = overlay.material;
    const multi = shifts.length > 1;
    if (multi !== "SHIFT" in material.defines) {
      if (multi) material.defines.SHIFT = "";
      else delete material.defines.SHIFT;
      material.needsUpdate = true;
    }
    const geometry = overlay.mesh!.geometry;
    if (multi) {
      const count = source.getAttribute("position").count;
      const shift = new Uint8Array(count);
      for (let n = 0; n < tris.length; n++) {
        const v = tris[n] * 3;
        shift[v] = shift[v + 1] = shift[v + 2] = classOf[n];
      }
      geometry.setAttribute("aShift", new THREE.BufferAttribute(shift, 1));
      shifts.forEach((s, i) =>
        (material.uniforms.uShift.value[i] as THREE.Vector3).copy(s),
      );
      overlay.mesh!.position.set(0, 0, 0);
    } else {
      geometry.deleteAttribute("aShift");
      // One shift for all of it: move the mesh (its parent is rotated into
      // the Y-up world, so undo that for a world offset).
      overlay.mesh!.position.set(shifts[0].x, -shifts[0].z, shifts[0].y);
    }
  }

  /** World offset `ctx.wpos` gives triangle t's centre, into `out`. */
  function shiftOf(
    t: number,
    positions: ArrayLike<number>,
    out: THREE.Vector3,
  ) {
    const o = t * 9;
    src.x = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
    src.y = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
    src.z = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
    ctx!.wpos(src, out);
    return out.set(out.x - src.x, out.y - src.z, out.z + src.y);
  }

  function shiftsMoved(overlay: Overlay, positions: ArrayLike<number>) {
    const tris = overlay.tris!;
    const shifts = overlay.shifts;
    for (const n of overlay.probes) {
      shiftOf(tris[n], positions, tmp);
      if (!shifts.some((s) => s.distanceToSquared(tmp) < 0.25)) {
        return true;
      }
    }
    return false;
  }

  function drawOverlay(overlay: Overlay, zones: number, wave: number) {
    const surface = mapSurface();
    if (!surface) {
      return;
    }
    const source = surface.geometry;
    const positions = source.getAttribute("position")
      .array as ArrayLike<number>;
    if (overlay.source !== source || !overlay.mesh) {
      overlay.mesh?.geometry.dispose();
      if (overlay.mesh) group!.remove(overlay.mesh);
      const geometry = new THREE.BufferGeometry();
      for (const name of ["position", "aInfo", "aCut"]) {
        geometry.setAttribute(name, source.getAttribute(name));
      }
      overlay.tris = trianglesIn(overlay.field, positions);
      const index = new Uint32Array(overlay.tris.length * 3);
      for (let n = 0; n < overlay.tris.length; n++) {
        const v = overlay.tris[n] * 3;
        index[n * 3] = v;
        index[n * 3 + 1] = v + 1;
        index[n * 3 + 2] = v + 2;
      }
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      const mesh = new THREE.Mesh(geometry, overlay.material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      overlay.mesh = mesh;
      overlay.source = source;
      group!.add(mesh);
      // Draw through the map's own cut: what it hides, this hides.
      const mapUniforms = (surface.material as THREE.ShaderMaterial).uniforms;
      for (const name of [
        "uCut2D",
        "uCut3D",
        "uView",
        "uGhost",
        "uLevelCut",
        "uLevelMix",
      ]) {
        if (mapUniforms[name])
          overlay.material.uniforms[name] = mapUniforms[name];
      }
      overlay.material.needsUpdate = true;
      classify(overlay, positions, source);
    } else if (shiftsMoved(overlay, positions)) {
      classify(overlay, positions, source);
    }
    const u = overlay.material.uniforms;
    u.uZones.value = zones;
    u.uWave.value = wave;
    overlay.mesh.visible = zones > 0.001 || wave >= 0;
  }

  function disposeOverlay(overlay: Overlay) {
    if (overlay.mesh) {
      group?.remove(overlay.mesh);
      overlay.mesh.geometry.dispose();
    }
    overlay.material.dispose();
    overlay.texture.dispose();
  }

  // ------------------------------------------------------------- smokes

  function smokeBlastsFor(frame: StageFrame): StageBlast[] {
    const bomb = frame.bomb;
    if (!bomb || bomb.state !== "exploded") {
      return frame.blasts;
    }
    const field =
      valveSiteAt(valveSites, bomb.at) ??
      fields.get(blastSpotKey(bomb.at))?.field;
    if (!field) {
      return frame.blasts;
    }
    // Smokes inside this path length are blown away.
    const smokeClear = fieldZones(field).heavy;
    // The frame's C4 blast is a sphere through walls; the field says where
    // the wave really went.
    const out = frame.blasts.filter(
      (b) =>
        !(b.radius >= 500 && Math.hypot(b.x - bomb.at.x, b.y - bomb.at.y) < 96),
    );
    for (const smoke of frame.smokes) {
      // A smoke that popped after the blast was not there to blow away.
      if (smoke.age < bomb.age) {
        continue;
      }
      const d = fieldDistance(field, smoke.at.x, smoke.at.y, smoke.at.z + 40);
      if (d === null || d > smokeClear) {
        continue;
      }
      const since = bomb.age - d / BLAST_SPEED;
      if (since <= 0) {
        continue;
      }
      out.push({
        x: smoke.at.x,
        y: smoke.at.y,
        z: smoke.at.z,
        // Held young: the smoke does not grow back before the round ends.
        age: Math.min(since, 0.45),
        radius: SMOKE_HOLE * easeOutCubic(clamp01(since / 0.4)),
      });
    }
    return out;
  }

  // ----------------------------------------------------------- sprites

  function explosion(bombAt: Vec3, a: number, seed: number) {
    const c = ctx!;
    const s = sprites!;
    const d = decals!;
    if (a > SCORCH_SECS) {
      return;
    }
    const floor = bombAt.z;
    // Scorch where it stood.
    src.x = bombAt.x;
    src.y = bombAt.y;
    src.z = floor + 1.5;
    c.wpos(src, at2);
    const scorch =
      0.75 *
      smoothstep(0, 0.1, a) *
      (1 - smoothstep(SCORCH_SECS - 2, SCORCH_SECS, a));
    d.push(
      at2,
      420,
      420,
      SCORCH,
      scorch,
      CELL.scorch,
      rand(seed, 1) * 6,
      0,
      24,
    );
    if (a < 1.2) {
      d.push(
        at2,
        1300,
        1300,
        FIREBALL,
        0.9 * Math.exp(-a * 3.2),
        CELL.disc,
        0,
        1,
        80,
      );
    }
    if (a < 0.5) {
      const ring = 2 * (60 + BLAST_SPEED * 0.5 * easeOutCubic(a / 0.5) * 0.35);
      d.push(
        at2,
        ring,
        ring,
        FIRE_CORE,
        0.7 * (1 - a / 0.5) ** 2,
        CELL.ring,
        0,
        0.8,
        40,
      );
    }

    // The flash: everything goes white for an instant.
    src.z = floor + 60;
    c.wpos(src, at);
    if (a < 0.45) {
      const f = 1 - smoothstep(0, 0.45, a);
      s.push(at, 2600, 2600, WHITE, 0.5 * f * f * f, CELL.glow, 0, 1, 260);
      s.push(at, 800, 800, WHITE, f * f, CELL.glow, 0, 1, 110);
    }
    // Fireball: swells fast, burns orange, rises and goes dark.
    if (a < 1.6) {
      const grow = 0.45 + 0.55 * easeOutCubic(Math.min(1, a / 0.25));
      const fade = 1 - smoothstep(0.35, 1.6, a);
      src.z = floor + 70 + 120 * a;
      c.wpos(src, at);
      const hot = 1 - smoothstep(0.1, 0.9, a);
      s.push(
        at,
        640 * grow,
        640 * grow,
        FIREBALL,
        0.7 * fade,
        CELL.glow,
        0,
        1,
        70,
      );
      s.push(
        at,
        340 * grow,
        340 * grow,
        FIRE_CORE,
        0.85 * hot,
        CELL.glow,
        0,
        1,
        44,
      );
      s.push(
        at,
        150 * grow,
        150 * grow,
        WHITE,
        0.8 * hot * hot,
        CELL.glow,
        0,
        1,
        22,
      );
    }
    // The starburst pop.
    if (a < 0.3) {
      const pop =
        a < 0.06 ? 0.4 + 0.6 * easeOutCubic(a / 0.06) : 1 + (a - 0.06) * 0.9;
      const fade = 1 - smoothstep(0.14, 0.3, a);
      const white = 1 - smoothstep(0.02, 0.12, a);
      const spin = rand(seed, 3) * Math.PI * 2 + a;
      src.z = floor + 50;
      c.wpos(src, at);
      const size = 560 * pop;
      s.push(
        at,
        size,
        size,
        WHITE,
        fade,
        rand(seed, 4) < 0.5 ? CELL.burstColor : CELL.burstColorB,
        spin,
        0.1,
        96,
      );
      s.push(
        at,
        size,
        size,
        WHITE,
        fade * white,
        rand(seed, 4) < 0.5 ? CELL.burstWhite : CELL.burstWhiteB,
        spin,
        0.3,
        96,
      );
    }
    // Dust and smoke rolling out low, then rising in a plume.
    const puffs = low ? 10 : 22;
    for (let i = 0; i < puffs; i++) {
      const born = 0.03 + rand(seed, i * 7 + 10) * 0.12;
      const t = a - born;
      if (t <= 0 || t > 4.2) {
        continue;
      }
      const theta = (i / puffs) * Math.PI * 2 + rand(seed, i * 7 + 11) * 0.6;
      const ring = i % 3 !== 0;
      const reach = ring
        ? 120 + rand(seed, i * 7 + 12) * 200
        : 20 + rand(seed, i * 7 + 12) * 60;
      const spread = reach * (1 - Math.exp(-t * 3.2));
      const size =
        (120 + 90 * rand(seed, i * 7 + 13)) *
        (0.45 + 1.1 * (1 - Math.exp(-t * 1.6)));
      src.x = bombAt.x + Math.cos(theta) * spread;
      src.y = bombAt.y + Math.sin(theta) * spread;
      src.z =
        floor +
        size * 0.25 +
        (ring ? 40 : 160) * t * (0.5 + rand(seed, i * 7 + 14));
      c.wpos(src, at);
      // Lit by the fireball at first, then plain smoke.
      const lit = 1 - smoothstep(0.08, 0.7, t);
      const tint = tmpColor.copy(DUST).lerp(DUST_LIT, lit);
      const alpha =
        0.85 * smoothstep(0, 0.1, t) * (1 - smoothstep(1.6, 4.2, t));
      const spin = theta + t * (rand(seed, i * 7 + 15) - 0.5);
      s.push(
        at,
        size,
        size,
        tint,
        alpha,
        i % 2 ? CELL.puffB : CELL.puff,
        spin,
        0.3 * lit,
        22,
      );
    }
    // Debris flung out on arcs.
    const shards = low ? 8 : 18;
    for (let i = 0; i < shards && a < 1.4; i++) {
      const theta = rand(seed, i * 11 + 100) * Math.PI * 2;
      const speed = 420 + 520 * rand(seed, i * 11 + 101);
      const lift = 260 + 380 * rand(seed, i * 11 + 102);
      const out = (speed * (1 - Math.exp(-2 * a))) / 2;
      src.x = bombAt.x + Math.cos(theta) * out;
      src.y = bombAt.y + Math.sin(theta) * out;
      src.z = Math.max(floor + 3, floor + 20 + lift * a - 600 * a * a);
      c.wpos(src, at);
      const tint = tmpColor
        .copy(SHARD_HOT)
        .lerp(SHARD_COLD, smoothstep(0.1, 0.7, a));
      const size = 12 + 12 * rand(seed, i * 11 + 103);
      const spin =
        rand(seed, i * 11 + 104) * 6 +
        a * (rand(seed, i * 11 + 105) - 0.5) * 20;
      s.push(
        at,
        size,
        size * 0.8,
        tint,
        1 - smoothstep(0.9, 1.4, a),
        CELL.shard,
        spin,
        0.4 * (1 - smoothstep(0, 0.4, a)),
        4,
      );
    }
  }

  const tmpColor = new THREE.Color();

  return module;
}
