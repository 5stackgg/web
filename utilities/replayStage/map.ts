import * as THREE from "three";
import { createMapBake, type MapBake } from "./mapBake";
import { paletteFor, type MapPalette } from "./mapPalette";
import { levelAt, levelsFor, type MapLevel } from "./mapLevels";
import { createMapPicker, type MapPicker } from "./mapPick";
import {
  isSideBySide,
  levelSplit,
  levelSplits,
  playArea,
  setSideBySide,
  titlePlace,
  type LevelSplit,
} from "./mapFrame";
import { createMapTitle, type MapTitle, type TitleSpot } from "./mapTitle";
import cleanMapName from "~/utilities/cleanMapName";
import { GHOST_HEIGHT, type PrepMesh, type PrepResult } from "./mapPrep";
import { loadCachedPrep, storeCachedPrep } from "./mapPrepCache";
import {
  prepFingerprint,
  runPrep,
  type PrepReply,
  type PrepRequest,
} from "./mapPrepPack";
import { fetchMeshBuffer, resolveMapAssets } from "~/utilities/mapAssets";
import { MAP_FRAG, MAP_VERT } from "./mapShaders";
import {
  createDunes,
  createGroundFill,
  createSky,
  createVignette,
} from "./mapWorld";
import type { StageContext, StageMap, StageModule, StageView } from "./types";

/**
 * The map as a stylised diorama: flat warm colours in a strict value order
 * (tops, floors, wall faces), a baked sun shadow and corner occlusion, thin
 * outlines on creases, red bomb-site decals, set in sand dunes under a warm
 * sky. In 2D the roofs over walkable floors are cut away so the action under
 * them shows; `setRoof` moves that cut.
 */
export type MapModule = StageModule & {
  /**
   * Height above each floor where the current view cuts (2D removes, 3D
   * ghosts), or null for none.
   */
  setRoof(height: number | null): void;
  /** The cut each view starts with. */
  defaultRoof(view: StageView): number | null;
  stats: {
    prepMs: number;
    bakeMs: number;
    triangles: number;
    /**
     * Where prep came from; `prepMs` is from the map landing to prep in hand
     * (cache or CDN lookup included), `loadMs` to the map built and baked.
     */
    prepSource: PrepSource;
    loadMs: number;
  } | null;
  /** The map's storeys, top first; empty when it is played on one. */
  levels(): MapLevel[];
  /**
   * Shows one storey: a lower one takes away what is above its ceiling
   * (leaving a faint ghost), fading in unless `animate` is false; null (or
   * the top one) shows all.
   */
  setLevel(id: string | null, animate?: boolean): void;
  /** The storey someone at height `z` (source units) is on, or null. */
  levelAt(z: number): string | null;
  /**
   * The name laid on the table south of the map; null goes back to the
   * map's own (e.g. "de_dust2_night" reads "Dust2 Night").
   */
  setTitle(text: string | null): void;
  /**
   * How a stacked map shows its storeys: "side" lays the lower one out
   * beside the rest (the default), "single" shows one at a time (setLevel).
   */
  setLevelLayout(layout: "side" | "single"): void;
  levelLayout(): "side" | "single";
  /** The table titles of the two storeys side by side (translated). */
  setLevelLabels(labels: { upper: string; lower: string }): void;
  /**
   * Make `stats.bakeMs` the real GPU time. Reading a pixel back to get it
   * stalls the frame, so only the harness turns it on.
   */
  measure: boolean;
};

// 2D clears a standing player's head under the usual 128u+ ceilings. 3D
// turns what is above a storey and a half into a translucent ghost, so
// doorways and arches stay solid, buildings keep their shape, and the
// unfinished insides Valve never modelled (and players under roofs) show
// through instead of reading as holes.
const ROOF_2D = 104;
const ROOF_3D = GHOST_HEIGHT;
const GHOST_ALPHA = 0.25;
/** Seconds a chosen storey takes to fade in or out. */
const LEVEL_FADE = 0.25;
const NO_CUT = 1e9;
// The camera's pitch in 3D and straight down (camera.ts): the map's look
// follows the actual tilt between them, so a view switch fades, never pops.
const PITCH_3D = (64 * Math.PI) / 180;
const PITCH_2D = (88 * Math.PI) / 180;

/**
 * Toward the sun, source units, normalised: high in the north-west so
 * shadows fall down-right in the default north-up view. Shared with anything
 * that lights itself to match the map; never mutate it.
 */
export const SUN = new THREE.Vector3(-0.5, 0.55, 1.35).normalize();
/** `SUN` in the Y-up world. */
export const SUN_WORLD = new THREE.Vector3(SUN.x, SUN.z, -SUN.y);

function color(hex: string) {
  return new THREE.Color(hex);
}

const pickers = new WeakMap<StageMap, MapPicker>();

/**
 * World height of the first thing the map draws along a world-space ray
 * (roof cut included), or null: what camera input takes hold of. Null until
 * the map is built.
 */
export function pickMapHeight(map: StageMap, ray: THREE.Ray): number | null {
  const picker = pickers.get(map);
  if (!picker) {
    return null;
  }
  const { origin: o, direction: d } = ray;
  // World (x, y, z) is source (x, -z, y).
  const t = picker.pick(o.x, -o.z, o.y, d.x, -d.z, d.y);
  let best = t === null ? null : t;
  // Side by side, the lower storey's copy: the ray taken back by its shift,
  // against that storey alone.
  const split = isSideBySide(map) ? levelSplit(map) : null;
  if (split) {
    const s = split.offset;
    const tc = picker.pick(
      o.x - s.x,
      -o.z - s.y,
      o.y - s.z,
      d.x,
      -d.z,
      d.y,
      split,
    );
    if (tc !== null && (best === null || tc < best)) {
      best = tc;
    }
  }
  return best === null ? null : o.y + d.y * best;
}

/** Preps in a worker; `cancel` stops it and resolves with null. */
function prepInWorker(request: PrepRequest) {
  let worker: Worker | null = null;
  let settle: (reply: PrepReply | null) => void = () => {};
  const result = new Promise<PrepReply | null>((resolve, reject) => {
    settle = resolve;
    const local = () => {
      try {
        resolve(runPrep(request));
      } catch (error) {
        reject(error);
      }
    };
    worker = new Worker(new URL("./mapPrep.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<PrepReply>) => {
      worker?.terminate();
      worker = null;
      resolve(event.data);
    };
    // Module workers are missing on old browsers: do it here instead.
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      local();
    };
    worker.postMessage({
      ...request,
      chunks: request.chunks.map(({ positions, floorZ, flags, indices }) => ({
        positions,
        floorZ,
        flags,
        indices,
      })),
    });
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

export type PrepSource = "published" | "cache" | "worker";

/**
 * A packed prep core for this mesh, if one is at hand: published next to
 * the map's meshes (a CDN build that lists `prep`), else from this
 * browser's cache. Null means prep from scratch.
 */
async function storedPrep(
  name: string,
  assetBase: string | null,
  fingerprint: string,
): Promise<{ core: ArrayBuffer; source: PrepSource } | null> {
  try {
    const urls = await resolveMapAssets(name, assetBase ?? "");
    if (urls?.prep) {
      const core = await fetchMeshBuffer(urls.prep).catch(() => null);
      if (core) {
        return { core, source: "published" };
      }
    }
  } catch {
    // No manifest, no file: the cache, then the worker.
  }
  const cached = await loadCachedPrep(fingerprint);
  return cached ? { core: cached, source: "cache" } : null;
}

/**
 * The bomb-site letters, A and B side by side, in the app's font. Drawn at
 * once in whatever font is ready and again once Oxanium has loaded;
 * `ready` settles after that redraw.
 */
function letterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const font =
    "800 228px 'Oxanium Stage', Oxanium, 'Arial Black', Arial, sans-serif";
  const draw = () => {
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = font;
    g.fillText("A", 128, 136);
    g.fillText("B", 384, 136);
    texture.needsUpdate = true;
  };
  draw();
  const ready =
    typeof document !== "undefined" && document.fonts
      ? document.fonts.load("800 228px 'Oxanium Stage'").then(draw, () => {})
      : Promise.resolve();
  return { texture, ready };
}

function meshGeometry(mesh: PrepMesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(mesh.positions, 3),
  );
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(mesh.height, 1));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(mesh.info, 1));
  geometry.setAttribute("aCut", new THREE.BufferAttribute(mesh.cut, 3));
  geometry.setAttribute(
    "aRemote",
    new THREE.BufferAttribute(mesh.remote, 1, true),
  );
  geometry.setAttribute(
    "aCanopy",
    new THREE.BufferAttribute(mesh.canopy, 4, true),
  );
  geometry.computeBoundingSphere();
  return geometry;
}

function siteRects(map: StageMap, palette: MapPalette) {
  const rects = [new THREE.Vector4(), new THREE.Vector4()];
  const z = new THREE.Vector4(1, 0, 1, 0);
  (["A", "B"] as const).forEach((letter, i) => {
    const callout = map.callouts.find((c) => c.name === `Bombsite${letter}`);
    const box = callout?.boxes[0];
    const fixed = palette.sites?.[letter];
    if (fixed) {
      rects[i].set(fixed[0], fixed[1], fixed[2], fixed[3]);
    } else if (box) {
      const w = (box.max[0] - box.min[0]) * 0.22;
      const h = (box.max[1] - box.min[1]) * 0.22;
      rects[i].set(
        box.min[0] + w,
        box.min[1] + h,
        box.max[0] - w,
        box.max[1] - h,
      );
    } else {
      return;
    }
    const lo = box ? box.min[2] - 64 : -1e6;
    const hi = box ? box.max[2] + 32 : 1e6;
    if (i === 0) {
      z.x = lo;
      z.y = hi;
    } else {
      z.z = lo;
      z.w = hi;
    }
  });
  return { rects, z };
}

/**
 * The title at its place (mapFrame.ts), just over the sand there, which
 * may still be sloping off the map.
 */
function titleSpot(map: StageMap, prep: PrepResult): TitleSpot {
  const { x, y, height } = titlePlace(map);
  const g = prep.ground;
  const area = playArea(map);
  let z = g.level;
  for (let sy = y - height; sy <= y + height; sy += g.cell) {
    for (let sx = area.min.x; sx <= area.max.x; sx += g.cell) {
      const gx = Math.round((sx - g.minX) / g.cell);
      const gy = Math.round((sy - g.minY) / g.cell);
      if (gx >= 0 && gy >= 0 && gx < g.width && gy < g.height) {
        z = Math.max(z, g.z[gy * g.width + gx]);
      }
    }
  }
  return { x, y, z: z + 2, height };
}

export function createMapModule(): MapModule {
  let ctx: StageContext | null = null;
  let group: THREE.Group | null = null;
  let sky: THREE.Mesh | null = null;
  let vignette: THREE.Mesh | null = null;
  let bake: MapBake | null = null;
  let pending: Promise<void> = Promise.resolve();
  let cancelPrep: (() => void) | null = null;
  let token = 0;
  // Cut heights per view; a slider (`setRoof`) overrides the view it is in.
  const roofs: Record<StageView, number | null> = {
    "2d": ROOF_2D,
    "3d": ROOF_3D,
  };
  let ghosts: THREE.Group | null = null;
  let ghostRanges: THREE.BufferGeometry[] = [];
  let cuttableFrom = 0;
  let ghostFrom = 0;
  let level: MapLevel | null = null;
  let title: MapTitle | null = null;
  let lowerGroup: THREE.Group | null = null;
  let lowerTitle: MapTitle | null = null;
  let levelLabels = { upper: "Upper", lower: "Lower" };
  // The viewer's choice, kept across map loads.
  let wantedLayout: "side" | "single" = "side";
  // Where the copy is drawn now: it moves when the screen's shape does.
  let copyShift: THREE.Vector3 | null = null;
  let placedSplit: LevelSplit | null = null;
  // The title's spot (it redraws from it) and the ground height it was put at.
  let titleAt: TitleSpot | null = null;
  let titleGround = 0;
  let titleText: string | null = null;
  let lastClock: number | null = null;
  const forward = new THREE.Vector3();
  const materials: THREE.Material[] = [];
  const letters = letterTexture();
  const ambient = new THREE.HemisphereLight(0xfff0d8, 0x9a7650, 1.1);
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.5);
  sunLight.position.copy(SUN_WORLD);

  const cutUniforms = {
    uCut2D: { value: NO_CUT },
    uCut3D: { value: NO_CUT },
    uView: { value: 0 },
    uGhost: { value: GHOST_ALPHA },
    uLevelCut: { value: NO_CUT },
    uLevelMix: { value: 0 },
  };
  const uniforms: Record<string, THREE.IUniform> = {
    ...cutUniforms,
    uSun: { value: SUN },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowTexel: { value: 1 / 2048 },
    uHasShadow: { value: 0 },
    uHeightMap: { value: null },
    uAoMap: { value: null },
    uTopGrid: { value: new THREE.Vector4() },
    uZRange: { value: new THREE.Vector2() },
    uTop: { value: new THREE.Color() },
    uFloor: { value: new THREE.Color() },
    uFloorOutdoor: { value: new THREE.Color() },
    uSkyMap: { value: null },
    uWall: { value: new THREE.Color() },
    uFoliage: { value: new THREE.Color() },
    uProps: {
      value: [new THREE.Color(), new THREE.Color(), new THREE.Color()],
    },
    uSeeThrough: { value: new THREE.Color() },
    uSand: { value: new THREE.Color() },
    uSandShade: { value: new THREE.Color() },
    uShadow: { value: new THREE.Color() },
    uOcclusion: { value: new THREE.Color() },
    uOutline: { value: new THREE.Color() },
    uSite: { value: new THREE.Color() },
    uSiteLetter: { value: new THREE.Color() },
    uSites: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uSiteZ: { value: new THREE.Vector4(1, 0, 1, 0) },
    uLetters: { value: letters.texture },
    uLetterSize: { value: 220 },
    uLineWidth: { value: 1 },
    uAlpha: { value: 1 },
    uCopyLanding: { value: new THREE.Vector4(1, 1, 0, 0) },
    uCopyRect: { value: new THREE.Vector4() },
    uCopyZ: { value: new THREE.Vector2() },
    uHaze: { value: new THREE.Color() },
    uMapCentre: { value: new THREE.Vector3() },
    uHazeRange: { value: new THREE.Vector2(1e9, 2e9) },
    uNoAccess: { value: 0 },
    uEdgeMap: { value: null },
  };

  function applyPalette(palette: MapPalette) {
    const set = (name: string, hex: string) =>
      (uniforms[name].value as THREE.Color).copy(color(hex));
    set("uTop", palette.top);
    set("uFloor", palette.floor);
    set("uFloorOutdoor", palette.floorOutdoor ?? palette.floor);
    set("uWall", palette.wall);
    set("uFoliage", palette.foliage);
    palette.props.forEach((hex, i) => uniforms.uProps.value[i].set(hex));
    set("uSeeThrough", palette.seeThrough);
    set("uSand", palette.sand);
    set("uSandShade", palette.sandShade);
    set("uShadow", palette.shadow);
    set("uOcclusion", palette.occlusion);
    set("uOutline", palette.outline);
    set("uSite", palette.site);
    set("uSiteLetter", palette.siteLetter);
    set("uHaze", palette.skyHorizon);
    uniforms.uNoAccess.value = palette.noAccess ? 1 : 0;
    if (ctx) {
      ctx.scene.background = color(palette.skyHorizon);
    }
  }

  function clear() {
    token++;
    cancelPrep?.();
    cancelPrep = null;
    if (group && ctx) {
      ctx.scene.remove(group);
    }
    for (const object of [sky, vignette]) {
      if (object && ctx) {
        ctx.scene.remove(object);
      }
    }
    for (const object of [group, sky, vignette]) {
      object?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }
    for (const material of materials) {
      material.dispose();
    }
    materials.length = 0;
    bake?.dispose();
    if (ghosts && ctx) {
      ctx.scene.remove(ghosts);
    }
    ghosts?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    title?.dispose();
    lowerTitle?.dispose();
    if (lowerGroup && ctx) {
      ctx.scene.remove(lowerGroup);
    }
    group =
      sky =
      vignette =
      bake =
      ghosts =
      title =
      lowerGroup =
      lowerTitle =
        null;
    copyShift = placedSplit = titleAt = null;
    if (ctx) {
      ctx.levelShift = null;
    }
    ghostRanges = [];
    level = null;
    cutUniforms.uLevelMix.value = 0;
    cutUniforms.uLevelCut.value = NO_CUT;
    uniforms.uHasShadow.value = 0;
  }

  /**
   * The lighting is baked with the 2D cut (rooms open to the sun, as the
   * radar shows them), so only a change to it re-bakes; 3D's ghosts do not
   * cast shadows into the rooms players are seen in.
   */
  function applyRoof() {
    cutUniforms.uCut3D.value = roofs["3d"] ?? NO_CUT;
    const cut2D = roofs["2d"] ?? NO_CUT;
    if (cutUniforms.uCut2D.value === cut2D && module.stats?.bakeMs) {
      return;
    }
    cutUniforms.uCut2D.value = cut2D;
    const bakeMs = bake?.run(module.measure) ?? 0;
    if (module.stats) {
      module.stats.bakeMs = bakeMs;
    }
  }

  /**
   * What was cut away in 3D, drawn once more as a single translucent layer:
   * a depth pass of the cuttable triangles keeps the nearest ghost surface,
   * then a colour pass blends only that one. Both run after the effects, in
   * a group of their own so the smoke's depth pass (which draws
   * `map.colliders`) never sees them.
   */
  function buildGhosts(
    geometry: THREE.BufferGeometry,
    start: number,
    defines: Record<string, string>,
  ) {
    const count = geometry.getAttribute("position").count - start * 3;
    if (count <= 0) {
      return null;
    }
    const range = new THREE.BufferGeometry();
    for (const name of Object.keys(geometry.attributes)) {
      range.setAttribute(name, geometry.getAttribute(name));
    }
    range.setDrawRange(start * 3, count);
    ghostRanges = [range];
    cuttableFrom = start * 3;
    range.boundingSphere = geometry.boundingSphere;
    const depth = new THREE.ShaderMaterial({
      vertexShader: MAP_VERT,
      fragmentShader: MAP_FRAG,
      uniforms,
      defines: { ...defines, GHOST_DEPTH: "" },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.NoBlending,
      colorWrite: false,
      depthWrite: true,
    });
    const colour = new THREE.ShaderMaterial({
      vertexShader: MAP_VERT,
      fragmentShader: MAP_FRAG,
      uniforms,
      defines: { ...defines, GHOST: "" },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    materials.push(depth, colour);
    const out = new THREE.Group();
    out.name = "map-ghosts";
    out.rotation.x = -Math.PI / 2;
    const depthMesh = new THREE.Mesh(range, depth);
    depthMesh.renderOrder = 900;
    const colourMesh = new THREE.Mesh(range, colour);
    colourMesh.renderOrder = 901;
    out.add(depthMesh, colourMesh);
    return out;
  }

  // A lost context comes back with every render target empty: the bake is
  // the only one that is not redrawn each frame.
  function onContextRestored() {
    bake?.run();
  }

  /**
   * The lower storey's copy for side by side: the same mesh again, shifted
   * by the split's offset and clipped to the storey (LEVEL_COPY in the map
   * shader), with no leaves and no ghost layer.
   */
  function buildLowerCopy(
    geometry: THREE.BufferGeometry,
    split: LevelSplit,
    defines: Record<string, string>,
  ) {
    const shift = new THREE.Vector3(
      split.offset.x,
      split.offset.z,
      -split.offset.y,
    );
    const material = new THREE.ShaderMaterial({
      vertexShader: MAP_VERT,
      fragmentShader: MAP_FRAG,
      uniforms: {
        ...uniforms,
        uWorldShift: { value: shift },
        uCopyRect: { value: new THREE.Vector4(...split.rect) },
        uCopyZ: { value: new THREE.Vector2(split.bottom, split.cut) },
      },
      defines: { ...defines, LEVEL_COPY: "" },
      side: THREE.DoubleSide,
    });
    materials.push(material);
    copyShift = shift;
    const copy = new THREE.Group();
    copy.name = "map-lower";
    copy.rotation.x = -Math.PI / 2;
    copy.position.copy(shift);
    copy.add(new THREE.Mesh(geometry, material));
    return copy;
  }

  /** Where the lower storey and its title are laid: clear of the play area. */
  function landingRect(
    map: StageMap,
    split: LevelSplit,
  ): [number, number, number, number] {
    const pad = titlePlace(map).height * 2.5;
    const area = playArea(map);
    const rect: [number, number, number, number] = [
      split.min.x - pad,
      split.min.y - pad * 1.5,
      split.max.x + pad,
      split.max.y + pad,
    ];
    if (split.min.x > area.max.x) {
      rect[0] = Math.max(rect[0], area.max.x);
    } else {
      rect[3] = Math.min(rect[3], area.min.y);
    }
    return rect;
  }

  /** Side by side or one storey at a time: the copy, the shift, the titles. */
  function applyLayout() {
    const map = ctx?.map;
    const split = map ? levelSplit(map) : null;
    const side = !!map && !!split && isSideBySide(map);
    placedSplit = split;
    if (lowerGroup) {
      lowerGroup.visible = side;
      if (split && copyShift) {
        copyShift.set(split.offset.x, split.offset.z, -split.offset.y);
        lowerGroup.position.copy(copyShift);
      }
    }
    if (ctx) {
      ctx.levelShift =
        side && split ? { below: split.below, offset: split.offset } : null;
    }
    const landing = uniforms.uCopyLanding.value as THREE.Vector4;
    if (side && split) {
      landing.set(...landingRect(map!, split));
    } else {
      landing.set(1, 1, 0, 0);
    }
    if (titleAt) {
      // Up level with the storey laid beside it, where the ground is far
      // under the play (Vertigo's street), so the copy never hides it.
      titleAt.z =
        side && split
          ? Math.max(titleGround, split.floor + split.offset.z + 2)
          : titleGround;
    }
    if (title && map) {
      const name = titleText ?? cleanMapName(map.name);
      title.setText(side ? `${name} · ${levelLabels.upper}` : name);
    }
  }

  function build(context: StageContext, map: StageMap, prep: PrepResult) {
    group = new THREE.Group();
    group.name = "map";
    group.rotation.x = -Math.PI / 2;
    // Phones skip the soft shadow taps and the paving/stone/grime detail.
    const defines: Record<string, string> =
      context.quality === "high" ? { SOFT_SHADOWS: "", DETAIL: "" } : {};
    const solidGeometry = meshGeometry(prep.solid);
    const solid = new THREE.ShaderMaterial({
      vertexShader: MAP_VERT,
      fragmentShader: MAP_FRAG,
      uniforms,
      defines,
      side: THREE.DoubleSide,
    });
    materials.push(solid);
    group.add(new THREE.Mesh(solidGeometry, solid));
    ghosts = buildGhosts(solidGeometry, prep.solid.cuttableStart, defines);
    ghostFrom = prep.solid.ghostStart * 3;
    let seeThroughGeometry: THREE.BufferGeometry | null = null;
    if (prep.seeThrough.positions.length) {
      const seeThrough = new THREE.ShaderMaterial({
        vertexShader: MAP_VERT,
        fragmentShader: MAP_FRAG,
        uniforms: { ...uniforms, uAlpha: { value: 0.55 } },
        defines: { ...defines, SEE_THROUGH: "" },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });
      materials.push(seeThrough);
      seeThroughGeometry = meshGeometry(prep.seeThrough);
      group.add(new THREE.Mesh(seeThroughGeometry, seeThrough));
    }

    const bounds = {
      min: new THREE.Vector3(map.min.x, map.min.y, map.min.z),
      max: new THREE.Vector3(map.max.x, map.max.y, map.max.z),
    };
    const span = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
    );
    uniforms.uMapCentre.value.set(
      (bounds.min.x + bounds.max.x) / 2,
      (bounds.min.y + bounds.max.y) / 2,
      bounds.min.z,
    );
    uniforms.uHazeRange.value.set(span * 0.95, span * 3.6);

    const split = levelSplit(map);
    // The dunes stay flat, and under the lower storey's floor, wherever it may be laid.
    const dunes = createDunes(
      bounds,
      uniforms,
      prep.ground,
      split
        ? {
            rects: levelSplits(map).map((s) => landingRect(map, s)),
            top: split.floor + split.offset.z - 24,
          }
        : null,
    );
    materials.push(dunes.material as THREE.Material);
    group.add(dunes);
    const fill = createGroundFill(prep.ground, uniforms);
    if (fill) {
      materials.push(fill.material as THREE.Material);
      group.add(fill);
    }

    const palette = paletteFor(map.name);
    titleAt = titleSpot(map, prep);
    titleGround = titleAt.z;
    title = createMapTitle(
      titleAt,
      titleText ?? cleanMapName(map.name),
      uniforms,
      color(palette.sand).lerp(new THREE.Color(0xffffff), 0.16),
    );
    group.add(title.mesh);
    setSideBySide(map, wantedLayout === "side");
    if (split) {
      lowerGroup = buildLowerCopy(solidGeometry, split, defines);
      // In the copy's own (unshifted) frame, under it on its floor.
      const height = titlePlace(map).height;
      lowerTitle = createMapTitle(
        {
          x: (split.min.x + split.max.x) / 2 - split.offset.x,
          y: split.min.y - split.offset.y - height * 1.1,
          z: split.floor + 2,
          height,
        },
        levelLabels.lower,
        uniforms,
        color(palette.sand).lerp(new THREE.Color(0xffffff), 0.16),
      );
      lowerGroup.add(lowerTitle.mesh);
    }
    applyLayout();
    sky = createSky(
      color(palette.skyTop),
      color(palette.skyHorizon),
      SUN_WORLD,
    );
    materials.push(sky.material as THREE.Material);

    const sites = siteRects(map, palette);
    uniforms.uSites.value = sites.rects;
    uniforms.uSiteZ.value = sites.z;
    uniforms.uLetterSize.value = Math.min(
      240,
      ...sites.rects
        .filter((r) => r.z > r.x)
        .map((r) => Math.min(r.z - r.x, r.w - r.y) * 0.85),
    );

    bake = createMapBake(
      context.renderer,
      solidGeometry,
      cutUniforms,
      bounds,
      SUN_WORLD,
      context.quality,
      seeThroughGeometry,
    );
    uniforms.uShadowMap.value = bake.shadow;
    uniforms.uShadowMatrix.value = bake.shadowMatrix;
    uniforms.uShadowTexel.value = bake.shadowTexel;
    uniforms.uHasShadow.value = 1;
    uniforms.uHeightMap.value = bake.height;
    uniforms.uSkyMap.value = bake.sky;
    uniforms.uAoMap.value = bake.ao;
    uniforms.uTopGrid.value = bake.topGrid;
    uniforms.uEdgeMap.value = bake.edge;
    uniforms.uZRange.value = bake.zRange;

    module.stats = {
      prepMs: prep.ms,
      bakeMs: 0,
      triangles:
        (prep.solid.positions.length + prep.seeThrough.positions.length) / 9,
      prepSource: "worker",
      loadMs: 0,
    };
    applyRoof();

    pickers.set(
      map,
      createMapPicker(prep.solid, prep.pick, () => {
        // Picks pass through whatever is not solid in the look that dominates.
        const flat = cutUniforms.uView.value > 0.5;
        const cut = flat ? cutUniforms.uCut2D.value : cutUniforms.uCut3D.value;
        const above =
          cutUniforms.uLevelMix.value > 0.5
            ? cutUniforms.uLevelCut.value
            : NO_CUT;
        return {
          cut: cut < NO_CUT ? cut : null,
          above: above < NO_CUT ? above : null,
          screenCanopies: flat,
        };
      }),
    );
    map.colliders = lowerGroup ? [group, lowerGroup] : [group];
    context.scene.add(sky);
    context.scene.add(group);
    if (lowerGroup) {
      context.scene.add(lowerGroup);
    }
    if (ghosts) {
      context.scene.add(ghosts);
    }
    if (context.quality === "high") {
      vignette = createVignette(color(palette.vignette));
      materials.push(vignette.material as THREE.Material);
      context.scene.add(vignette);
    }
  }

  const module: MapModule = {
    name: "map",
    stats: null,
    measure: false,
    init(context) {
      ctx = context;
      context.scene.background = color(paletteFor("").skyHorizon);
      context.scene.add(ambient, sunLight);
      uniforms.uLineWidth.value = 1.1 * context.pixelRatio;
      context.renderer.domElement.addEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
    },
    onMap(context) {
      clear();
      const map = context.map;
      if (!map?.view) {
        return;
      }
      const palette = paletteFor(map.name);
      applyPalette(palette);
      const mine = token;
      const started = performance.now();
      const chunks = map.view.chunks;
      const areas = map.callouts.flatMap((callout) => callout.boxes);
      const fingerprint = prepFingerprint(chunks, areas);
      pending = storedPrep(map.name, context.assetBase, fingerprint).then(
        async (stored) => {
          if (mine !== token) {
            return;
          }
          const prep = prepInWorker({
            chunks,
            areas,
            fingerprint,
            core: stored?.core ?? null,
          });
          cancelPrep = prep.cancel;
          const reply = await prep.result;
          if (!reply || mine !== token || ctx?.map !== map) {
            return;
          }
          cancelPrep = null;
          const prepped = performance.now() - started;
          build(context, map, reply.result);
          if (module.stats) {
            module.stats.prepMs = prepped;
            module.stats.prepSource = reply.packed
              ? "worker"
              : (stored?.source ?? "worker");
            module.stats.loadMs = performance.now() - started;
            // For load profiling from outside (devtools, the harness, a probe).
            performance.mark("replay-stage:map-ready", {
              detail: { ...module.stats },
            });
          }
          if (reply.packed) {
            // After the map is up: the cache is for next time.
            void storeCachedPrep(fingerprint, reply.packed);
          }
        },
      );
      // Only the harness waits on `pending`; the live stage must still hear of it.
      pending.catch((error) =>
        console.error("[replay-stage] map prep failed:", error),
      );
    },
    update(_frame, context) {
      // The camera moved the lower storey to suit a new screen shape.
      if (
        lowerGroup &&
        context.map &&
        levelSplit(context.map) !== placedSplit
      ) {
        applyLayout();
      }
      context.camera.getWorldDirection(forward);
      const pitch = Math.asin(Math.min(1, Math.max(-1, -forward.y)));
      const t = Math.min(
        1,
        Math.max(0, (pitch - PITCH_3D) / (PITCH_2D - PITCH_3D)),
      );
      cutUniforms.uView.value = t * t * (3 - 2 * t);

      // A chosen storey fades in over a quarter second, on the wall clock:
      // it is the viewer's choice, not part of the replay.
      const dt =
        lastClock === null ? 0 : Math.max(0, context.clock - lastClock);
      lastClock = context.clock;
      const goal = level?.below != null ? 1 : 0;
      const mix = cutUniforms.uLevelMix;
      mix.value =
        goal > mix.value
          ? Math.min(goal, mix.value + dt / LEVEL_FADE)
          : Math.max(goal, mix.value - dt / LEVEL_FADE);
      if (mix.value === 0) {
        cutUniforms.uLevelCut.value = level?.below ?? NO_CUT;
      }
      // The ghost passes draw only what can be part-way gone right now:
      // all of the map while a storey is taken away, what any cut takes
      // mid-tilt, what the 3D cut takes in 3D, and nothing straight down.
      const lowered = (roofs["3d"] ?? NO_CUT) < GHOST_HEIGHT;
      const flat = cutUniforms.uView.value > 0.999;
      const tilting = cutUniforms.uView.value > 0.001 && !flat;
      const from =
        mix.value > 0 ? 0 : tilting || lowered ? cuttableFrom : ghostFrom;
      if (ghosts) {
        ghosts.visible = mix.value > 0 || !flat;
      }
      for (const range of ghostRanges) {
        if (range.drawRange.start !== from) {
          range.setDrawRange(from, range.getAttribute("position").count - from);
        }
      }
    },
    resize(context) {
      uniforms.uLineWidth.value = 1.1 * context.pixelRatio;
    },
    settle() {
      return Promise.all([pending, letters.ready])
        .then(() => title?.ready)
        .then(() => {});
    },
    setTitle(text) {
      titleText = text;
      applyLayout();
    },
    setLevelLayout(layout) {
      wantedLayout = layout;
      if (ctx?.map) {
        setSideBySide(ctx.map, layout === "side");
        applyLayout();
      }
    },
    levelLayout() {
      return ctx?.map && isSideBySide(ctx.map) ? "side" : "single";
    },
    setLevelLabels(labels) {
      levelLabels = labels;
      lowerTitle?.setText(labels.lower);
      applyLayout();
    },
    levels() {
      return ctx?.map ? levelsFor(ctx.map.name) : [];
    },
    setLevel(id, animate = true) {
      const name = ctx?.map?.name;
      level = (name && levelsFor(name).find((l) => l.id === id)) || null;
      if (level?.below != null && cutUniforms.uLevelMix.value === 0) {
        cutUniforms.uLevelCut.value = level.below;
      }
      if (!animate) {
        cutUniforms.uLevelMix.value = level?.below != null ? 1 : 0;
        cutUniforms.uLevelCut.value = level?.below ?? NO_CUT;
      }
    },
    levelAt(z) {
      return ctx?.map ? levelAt(ctx.map.name, z) : null;
    },
    setRoof(height) {
      roofs[ctx?.view ?? "3d"] = height;
      applyRoof();
    },
    defaultRoof(view) {
      return view === "2d" ? ROOF_2D : ROOF_3D;
    },
    dispose() {
      clear();
      letters.texture.dispose();
      ctx?.scene.remove(ambient, sunLight);
      ctx?.renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onContextRestored,
      );
      ctx = null;
    },
  };
  return module;
}
