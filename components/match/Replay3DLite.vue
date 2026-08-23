<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { weaponIconPath } from "~/utilities/weaponIcon";
import {
  blastThinning,
  decodeSmokeVolume,
  flameFlicker,
  infernoAlive,
  liveFlames,
  type DecodedSmokeVolume,
  type Inferno,
  type SmokeVolume,
} from "~/utils/smokeVolume";

// "3D-lite" replay. Renders a lightweight collision mesh (awpy .tri triangle
// soup, raw float32 in CS2 source units) as the world — real floors/walls — and
// places players/utility/bomb in the SAME source units (zero calibration).
// Falls back to the flat radar PNG when no mesh is staged.
//
// All playback state lives in the parent ReplayViewer; this is a pure renderer
// fed by props. UI chrome (camera modes, util filters, heat) is local.
type Player = {
  steamId: string;
  team: string | null;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  health?: number | null;
  armor?: number | null;
  helmet?: boolean;
  activeWeapon?: string | null;
  hasBomb?: boolean;
  hasDefuser?: boolean;
};

// One firing tracer: muzzle (e*) → end point (t*) in source coords, the
// end being the victim on a hit or an extended ray on a miss. Colored by
// outcome, faded by recency. Built in ReplayViewer (owns the tick).
type Tracer = {
  ex: number;
  ey: number;
  ez: number;
  tx: number;
  ty: number;
  tz: number;
  team: string | null;
  travel: number; // 0..1 how far the bullet has flown from muzzle to target
  fade: number; // 0..1 brightness (fades out over the tracer's life)
  hit?: boolean; // landed on a player rather than on world geometry
};
type Detonation = {
  rx: number;
  ry: number;
  rz: number;
  type: string;
  life?: number;
  // Deploy progress for smokes, supplied by the parent because it owns the
  // clock and the measured start tick.
  bloom?: number;
  grenade_id?: number | null;
  thrower_team?: string | null;
};
type InFlight = {
  key: string;
  gid?: number | null;
  type: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  x: number;
  y: number;
  z: number;
  progress: number;
};
type HeatPoint = {
  rx: number;
  ry: number;
  rz: number;
  type: string;
  gid?: number | null;
};

const props = defineProps<{
  players: Player[];
  tracers?: Tracer[];
  names?: Record<string, string>;
  grenades?: Detonation[];
  inFlight?: InFlight[];
  heatPoints?: HeatPoint[];
  bomb?: { x: number; y: number; z?: number } | null;
  // death locations up to the cursor (team-coloured X on the floor)
  deaths?: Array<{ x: number; y: number; z: number; team: string | null }>;
  // steam_id of the player ReplayViewer has focused — drives 3D camera follow,
  // so "click a player" follows in BOTH 2D and 3D (one shared behaviour).
  focused?: string | null;
  // Camera mode, heat toggle and util filter are owned by the shared chrome
  // (ReplayChrome via ReplayViewer) so 2D and 3D stay in sync.
  camMode?: "orbit" | "top" | "follow";
  heatOn?: boolean;
  typeFilter?: Record<string, boolean>;
  // Roof cut slider: 0..100. 50 = the auto-detected playable ceiling
  // (autoCeilingZ), 0 = floor, 100 = full map. Drag up to reveal more, down to
  // cut more. Source-z height of the auto ceiling comes from ReplayViewer.
  ceiling?: number;
  autoCeilingZ?: number | null;
  // Per-smoke density fields measured against the map's collision mesh
  // (blob v9+). Absent on older blobs, which fall back to a sphere of puffs.
  smokeVolumes?: SmokeVolume[];
  // steam_id → avatar URL. The same map the scoreboard uses; the pins draw the
  // real player photo rather than a placeholder.
  avatars?: Record<string, string>;
  // Per-molotov flame positions and lifetimes, straight off the demo.
  infernos?: Inferno[];
  // The playback tick, needed to pick which flames are alight. Supplied by the
  // parent, which owns the clock.
  tick?: number;
  tickRate?: number;
  // Explosions currently thinning smoke, already resolved for this tick by the
  // parent — this component is a pure renderer and does not own the clock.
  activeBlasts?: Array<{
    x: number;
    y: number;
    z: number;
    r: number;
    full: number;
  }>;
  // Real per-grenade bounce path (blob v4+); keyed by grenade_id.
  grenadeTrajectories?: Array<{
    gid: number;
    pts: Array<{ t: number; x: number; y: number; z: number }>;
  }>;
  // True while the util-summary overlay is active. Drives token hiding directly
  // (not inferred from overlayActors.length) so the regular player models never
  // flash when the stacked-actor list is momentarily empty (e.g. clock reset).
  overlay?: boolean;
  // Buy-round overlay actors (raw coords) — when present, stacked players from
  // the selected rounds are shown as dots and the normal tokens are hidden.
  overlayActors?: Array<{
    x: number;
    y: number;
    z: number;
    team: string | null;
  }>;
  // Selected utilities (grenade_ids) to highlight + show a thrower "ghost" for.
  selectedGids?: number[];
  // Every utility thrown this round (for ghosts/highlight + heatmap).
  roundUtilities?: Array<{
    gid: number | null;
    type: string;
    team: string | null;
    name: string;
    ox: number;
    oy: number;
    oz: number;
    dx: number | null;
    dy: number | null;
    dz: number | null;
  }>;
  mapMeshUrl?: string | null;
  radarSrc?: string | null;
  resolution?: number;
  project?: (p: { x: number; y: number; z?: number }) => {
    x: number;
    y: number;
  };
}>();
const emit = defineEmits<{ (e: "select-util", gid: number): void }>();
const { t } = useI18n();

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref("");
const loading = ref(false); // mesh fetch in progress → show centered loader
const followSid = ref<string | null>(null);
const camModeOf = () => props.camMode ?? "orbit";
const heatOnOf = () => props.heatOn ?? false;
const typeOn = (ty: string) => props.typeFilter?.[ty] ?? true;

const C = 1024;
const TEAM = (t: string | null) =>
  t === "t" ? 0xf5a623 : t === "ct" ? 0x4799eb : 0x9aa0a8;
// Canvas art is authored in sRGB. Left unmarked, three treats those bytes as
// linear values and converts them to sRGB again on output — which lifts and
// desaturates every canvas-backed element. That double conversion is what made
// the team colours read as pale pastels against the 2D radar's saturated ones.
function canvasTex(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const UTILITY_COL: Record<string, number> = {
  Smoke: 0x32d6e0,
  Molotov: 0xff6a1a,
  HE: 0xff3b3b,
  Flash: 0xffd21a,
  Decoy: 0x66dd55,
};

let cleanup: (() => void) | null = null;
let apply: (() => void) | null = null;
let setCamMode: ((m: "orbit" | "top" | "follow") => void) | null = null;
// set when the user right-drag free-looks, so follow stops fighting the camera
// until the mode/focus changes again.
let followSuppressed = false;

onMounted(() => {
  const el = canvas.value!;
  // Coarse-pointer devices drive the camera with OrbitControls touch gestures
  // (one finger orbit, two finger dolly/pan) instead of the desktop free-look,
  // and run at a lower pixel ratio so mid-range phones keep their frame rate.
  const isTouch =
    typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas: el,
    antialias: !isTouch,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.localClippingEnabled = true;
  // Filmic tone mapping instead of the default clamp. Muzzle flashes, fire and
  // flashbangs are all far brighter than white, and without this they clip to
  // flat sRGB white and lose every bit of shape. ACES rolls the highlights off
  // so a flash reads as intense rather than blown out, and it gives the whole
  // scene contrast the flat clamp cannot.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Filmic tone mapping compresses everything, so the exposure has to be lifted
  // to get back to a readable image — the default left the map nearly black.
  renderer.toneMappingExposure = 1.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Ceiling cut: a horizontal plane that hides map geometry above a height,
  // driven by the chrome's ceiling slider (props.ceiling, 0..100). 100 = off.
  // Only the map material uses it — players/utility are never clipped.
  const ceilingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e9);
  let clipY = 1e9;
  let meshMinY = 0,
    meshMaxY = 0,
    meshLoaded = false; // world-Y span of the mesh
  // Geometry whose lowest point is above (auto ceiling + this) is dropped at load
  // — kills sky buildings / super-tall boundary walls while keeping real rooms.
  const CEIL_CULL_MARGIN = 256;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, 1, 1, 100000);

  const controls = new OrbitControls(camera, el);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.49;
  // Touch: let OrbitControls own the gestures — one finger orbits, two fingers
  // pinch-dolly / pan. Desktop keeps the hand-rolled inertial wheel zoom, so
  // OrbitControls zoom stays off there to avoid double-handling the wheel.
  controls.enableZoom = isTouch;
  if (isTouch) {
    controls.enablePan = true;
    // One finger drags (pans) around the map; two fingers pinch to zoom and
    // twist to rotate together — feels closer to a native map app.
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
  }
  // Left-drag = free-look (handled manually below); right-drag = orbit;
  // middle-drag = pan. Left no longer orbits (felt bad).
  controls.mouseButtons = {
    LEFT: null as any,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  // Near-neutral lighting. An earlier cool sky and blue rim light washed the
  // whole map navy, which fought the app's black surfaces; the fill is now only
  // faintly cool so surfaces facing up still read differently from those facing
  // down, without tinting the scene.
  scene.add(new THREE.HemisphereLight(0xdfe4ea, 0x14161a, 1.25));
  const dl = new THREE.DirectionalLight(0xfff6e8, 0.95);
  dl.position.set(0.5, 1, 0.35);
  scene.add(dl);
  // A second key from the opposite side at low intensity. With no textures to
  // carry detail, a surface lit from only one direction goes completely flat on
  // its shadow side; a weak opposing light keeps that side readable while still
  // leaving a clear light direction.
  const dlFill = new THREE.DirectionalLight(0xe8eef6, 0.22);
  dlFill.position.set(-0.55, 0.5, -0.6);
  scene.add(dlFill);
  const dl2 = new THREE.DirectionalLight(0x9aa4b4, 0.28);
  dl2.position.set(-0.4, 0.6, -0.3);
  scene.add(dl2);

  // Utility that emits light actually lights the map. A molotov pooling round a
  // corner or an HE going off behind cover throws real illumination onto the
  // geometry, which sells the moment far better than a sprite floating in the
  // dark. Pooled and re-pointed each frame; intensity 0 when unused, so an idle
  // light costs nothing.
  const FX_LIGHTS = 6;
  const fxLights = Array.from({ length: FX_LIGHTS }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 0, 2);
    l.visible = false;
    scene.add(l);
    return l;
  });
  let fxLightCursor = 0;
  const resetFxLights = () => {
    fxLightCursor = 0;
  };
  const emitLight = (
    pos: THREE.Vector3,
    hex: number,
    intensity: number,
    distance: number,
  ) => {
    if (fxLightCursor >= FX_LIGHTS || intensity <= 0.001) return;
    const l = fxLights[fxLightCursor++];
    l.position.copy(pos);
    l.color.setHex(hex);
    l.intensity = intensity;
    l.distance = distance;
    l.visible = true;
  };
  const hideUnusedFxLights = () => {
    for (let i = fxLightCursor; i < FX_LIGHTS; i++) fxLights[i].visible = false;
  };

  const meshMode = !!props.mapMeshUrl;
  // Black, to match the app rather than the navy this used to fade to, and set
  // as the scene background too so distance falls away into the same black
  // instead of revealing whatever sits behind the canvas.
  const VOID = 0x000000;
  scene.background = new THREE.Color(VOID);
  scene.fog = new THREE.Fog(VOID, meshMode ? 6000 : 1400, meshMode ? 18000 : 3200);

  // ----- coordinate transform: source coords -> three world -----
  const RES = props.resolution || 1;
  const U = meshMode ? 1 : 1 / RES; // source-unit -> world-unit scale
  let floorRef = 0;
  let floorSet = false;
  const _v = new THREE.Vector3();
  const wpos = (p: { x: number; y: number; z?: number }, out = _v) => {
    if (meshMode) return out.set(p.x, p.z ?? 0, -p.y);
    const g = props.project!(p);
    return out.set(
      g.x - C / 2,
      ((p.z ?? floorRef) - floorRef) / RES,
      g.y - C / 2,
    );
  };
  const PH = meshMode ? 64 : 44;
  const PR = meshMode ? 15 : 9;
  const RING = meshMode ? 30 : 18;

  // ===== free-look (LEFT-drag) + inertial zoom (ported from Replay3D) =====
  // Left-drag turns the camera in place (no orbit — that felt bad). Right-drag
  // orbits via OrbitControls.
  let rl = false,
    rlx = 0,
    rly = 0,
    downX = 0,
    downY = 0;
  const raycaster = new THREE.Raycaster();
  // A left click (no drag) on a utility line selects it.
  function pickUtilLine(e: PointerEvent) {
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    // clickable: in-flight trajectory tubes + heatmap landing discs (both carry gid)
    const cand = [
      ...arcs.filter((a) => a.visible),
      ...heat.filter((h) => h.visible),
    ];
    const hits = raycaster.intersectObjects(cand, false);
    const gid = hits[0]?.object.userData?.gid;
    if (gid != null) emit("select-util", gid);
  }
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.style.cursor = "grab";
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return; // touch is driven by OrbitControls
    el.style.cursor = "none"; // hide cursor while dragging/looking around
    if (e.button === 0) {
      rl = true;
      rlx = e.clientX;
      rly = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
    }
  });
  addEventListener("pointerup", (e) => {
    if ((e as PointerEvent).pointerType === "touch") return; // touch = OrbitControls
    el.style.cursor = "grab";
    if (e.button !== 0) return;
    rl = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 5) pickUtilLine(e); // click, not drag
  });
  addEventListener("pointermove", (e) => {
    if (!rl) return;
    const dx = e.clientX - rlx,
      dy = e.clientY - rly;
    rlx = e.clientX;
    rly = e.clientY;
    const yAxis = new THREE.Vector3(0, 1, 0);
    if (camModeOf() === "follow" || followSid.value) {
      // While following: orbit the camera AROUND the player (target stays
      // locked on them by the loop) so looking around does NOT stop following.
      const off = new THREE.Vector3().subVectors(
        camera.position,
        controls.target,
      );
      if (off.lengthSq() < 1e-6) return;
      off.applyAxisAngle(yAxis, -dx * 0.0045);
      const right = new THREE.Vector3().crossVectors(off, yAxis).normalize();
      const newOff = off.clone().applyAxisAngle(right, dy * 0.0045);
      const pitch = Math.atan2(newOff.y, Math.hypot(newOff.x, newOff.z));
      if (pitch > 0.05 && pitch < 1.45) off.copy(newOff);
      camera.position.copy(controls.target).add(off);
      return;
    }
    // Not following: in-place free-look (turn the camera, move target around it).
    const off = new THREE.Vector3().subVectors(
      controls.target,
      camera.position,
    );
    if (off.lengthSq() < 1e-6) return;
    off.applyAxisAngle(yAxis, -dx * 0.0045);
    const right = new THREE.Vector3().crossVectors(off, yAxis).normalize();
    const newOff = off.clone().applyAxisAngle(right, -dy * 0.0045);
    const pitch = Math.atan2(newOff.y, Math.hypot(newOff.x, newOff.z));
    if (Math.abs(pitch) < 1.45) off.copy(newOff);
    controls.target.copy(camera.position).add(off);
  });
  let dollyAccum = 0;
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dollyAccum += Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0011));
    },
    { passive: false },
  );
  function applyDolly(dt: number) {
    if (Math.abs(dollyAccum) < 1e-4) {
      dollyAccum = 0;
      return;
    }
    const step = dollyAccum * Math.min(1, dt * 14);
    dollyAccum -= step;
    const dir = new THREE.Vector3().subVectors(
      camera.position,
      controls.target,
    );
    const lim = meshMode ? [50, 12000] : [60, 4000];
    const nd = Math.max(lim[0], Math.min(lim[1], dir.length() * (1 + step)));
    camera.position.copy(controls.target).add(dir.setLength(nd));
  }

  // ===== WASD fly + Q/E or Shift/Ctrl for down/up — moves camera AND pivot =====
  const keys: Record<string, boolean> = {};
  const FLY_KEYS = ["w", "a", "s", "d", "q", "e"];
  const isTyping = () => {
    const a = document.activeElement as HTMLElement | null;
    return (
      !!a &&
      (a.tagName === "INPUT" ||
        a.tagName === "SELECT" ||
        a.tagName === "TEXTAREA" ||
        a.isContentEditable)
    );
  };
  // Re-sync modifiers from the event's authoritative flags on EVERY key event, so
  // a missed Shift/Ctrl keyup self-corrects on the next keystroke (fixes "stuck"
  // up/down). A window blur also clears everything (alt-tab mid-keypress).
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping()) return;
    keys.shift = e.shiftKey;
    keys.ctrl = e.ctrlKey;
    if (e.key === "Shift" || e.key === "Control") return;
    const k = e.key.toLowerCase();
    if (FLY_KEYS.includes(k)) keys[k] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.shift = e.shiftKey;
    keys.ctrl = e.ctrlKey;
    if (e.key === "Shift" || e.key === "Control") return;
    keys[e.key.toLowerCase()] = false;
  };
  const clearKeys = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  };
  const onVis = () => {
    if (document.hidden) clearKeys();
  };
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", onVis);
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _move = new THREE.Vector3();
  function applyFly(dt: number) {
    _fwd.subVectors(controls.target, camera.position);
    const dist = _fwd.length();
    if (dist < 1e-3) return;
    _fwd.normalize();
    _right.crossVectors(_fwd, _up).normalize();
    _move.set(0, 0, 0);
    if (keys["w"]) _move.add(_fwd);
    if (keys["s"]) _move.sub(_fwd);
    if (keys["d"]) _move.add(_right);
    if (keys["a"]) _move.sub(_right);
    if (keys["e"] || keys.shift) _move.y += 1;
    if (keys["q"] || keys.ctrl) _move.y -= 1;
    if (_move.lengthSq() === 0) return;
    // speed scales with zoom distance so it feels consistent up close + far out
    const sp = Math.max(dist, meshMode ? 280 : 140) * 0.55 * dt;
    _move.normalize().multiplyScalar(sp);
    camera.position.add(_move);
    controls.target.add(_move);
    followSuppressed = true; // stop follow from yanking the camera back
  }

  // ----- ground -----
  let mapSpan = meshMode ? 6000 : C;
  if (meshMode) {
    status.value = t("match.replay.loading_map");
    loading.value = true;
    fetch(props.mapMeshUrl!)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((buf) => {
        // sanity cap: our decimated meshes are well under this; guards against a
        // malformed/oversized file allocating a huge BufferGeometry and OOMing.
        const MAX_MESH_BYTES = 96 * 1024 * 1024;
        if (buf.byteLength > MAX_MESH_BYTES) throw new Error("mesh too large");
        const raw = new Float32Array(
          buf,
          0,
          Math.floor(buf.byteLength / 4 / 9) * 9,
        );
        // Cull geometry that sits ENTIRELY above the playable ceiling: roofs,
        // ceilings, sky buildings, and the super-tall boundary/exterior walls
        // that shoot up toward the skybox. Players never reach above
        // autoCeilingZ, so anything wholly above it isn't part of play. (z is the
        // 3rd float of each vertex; source-z = height.) A generous margin keeps
        // real in-play structures; the live ROOF slider trims the rest.
        const cullZ =
          props.autoCeilingZ != null
            ? props.autoCeilingZ + CEIL_CULL_MARGIN
            : Infinity;
        let pos = raw;
        if (isFinite(cullZ)) {
          // height cull: drop triangles wholly above the playable ceiling
          // (roofs/ceilings/sky). Standalone boundary walls are removed offline
          // in the .tri itself (glb-to-tri dropStandaloneWalls).
          const out = new Float32Array(raw.length);
          let n = 0;
          for (let t = 0; t < raw.length; t += 9) {
            if (Math.min(raw[t + 2], raw[t + 5], raw[t + 8]) > cullZ) continue;
            out.set(raw.subarray(t, t + 9), n);
            n += 9;
          }
          pos = out.slice(0, n);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        // flatShading keeps the nice faceted shading the user likes; the
        // wireframe overlay (polygon lines) was distracting → removed.
        const mat = new THREE.MeshStandardMaterial({
          // Neutral grey, not the blue-grey this used to be — against a black
          // background the blue read as a tint over the whole scene.
          color: 0x3c3e42,
          roughness: 0.95,
          metalness: 0,
          side: THREE.DoubleSide,
          flatShading: true,
          clippingPlanes: [ceilingPlane],
        });
        // Separate floors from walls by surface orientation. Without textures,
        // lighting alone leaves a floor and the wall beside it nearly the same
        // value from a top-down camera; lifting up-facing surfaces and dropping
        // vertical ones makes the map's layout legible at a glance. Patched
        // into the standard material so it still takes real lighting.
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader
            .replace(
              "#include <common>",
              "#include <common>\nvarying float vUpness;",
            )
            .replace(
              "#include <beginnormal_vertex>",
              "#include <beginnormal_vertex>\nvUpness = abs(normalize(mat3(modelMatrix) * objectNormal).y);",
            );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              "#include <common>\nvarying float vUpness;",
            )
            .replace(
              "#include <dithering_fragment>",
              [
                "#include <dithering_fragment>",
                "float floorLift = smoothstep(0.55, 0.98, vUpness);",
                "float wallDrop = 1.0 - smoothstep(0.0, 0.32, vUpness);",
                "gl_FragColor.rgb *= mix(1.0, 1.34, floorLift);",
                "gl_FragColor.rgb *= mix(1.0, 0.72, wallDrop);",
              ].join("\n"),
            );
        };
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
        const bb = geo.boundingBox!;
        const cx = (bb.min.x + bb.max.x) / 2,
          cy = (bb.min.y + bb.max.y) / 2,
          cz = (bb.min.z + bb.max.z) / 2;
        mapSpan = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
        // world Y = source z (mesh is rotated -π/2 about X); used by the ceiling slider
        meshMinY = bb.min.z;
        meshMaxY = bb.max.z;
        meshLoaded = true;
        controls.target.set(cx, cz, -cy);
        camera.position.set(cx, cz + mapSpan * 0.85, -cy + mapSpan * 0.85);
        status.value = "";
        loading.value = false;
      })
      .catch((e) => {
        status.value = `mesh unavailable (${e.message}) — radar fallback`;
        loading.value = false;
        buildRadar();
      });
  } else buildRadar();

  function buildRadar() {
    if (!props.radarSrc) return;
    const tex = new THREE.TextureLoader().load(props.radarSrc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(C, C),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.96,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    controls.target.set(0, 0, 0);
    camera.position.set(0, 900, 950);
  }

  // ===== player tokens (figure + nameplate + hp/armor + weapon) =====
  // Weapon icons as raw images, for compositing into the nameplate canvas.
  const weaponImgs = new Map<string, HTMLImageElement>();
  function weaponImg(weapon: string): HTMLImageElement | null {
    const path = weaponIconPath(weapon);
    if (!path) return null;
    let img = weaponImgs.get(path);
    if (!img) {
      img = new Image();
      (img as any).__ready = false;
      img.onload = () => {
        (img as any).__ready = true;
        apply?.();
      };
      img.src = path;
      weaponImgs.set(path, img);
    }
    return (img as any).__ready ? img : null;
  }

  // A player reads as a map pin, not a 3D object: a flat team-coloured disc
  // with a pointer beneath it, always facing the camera. A lathed 3D pin
  // changes silhouette as the camera orbits, which makes players harder to
  // track; a billboard looks identical from every angle and stays legible when
  // the camera is low or far away.
  // Avatar images, loaded once and shared by every pin that needs them.
  const avatarImgs = new Map<string, HTMLImageElement>();
  function avatarImage(url: string): HTMLImageElement | null {
    let img = avatarImgs.get(url);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      (img as any).__ready = false;
      img.onload = () => {
        (img as any).__ready = true;
        // Repaint now the photo exists. Pins only redraw when their key
        // changes, and that key is only consulted from apply() — so without
        // this the placeholder stayed up until the next tick moved something.
        apply?.();
      };
      img.src = url;
      avatarImgs.set(url, img);
    }
    return (img as any).__ready ? img : null;
  }

  function makeAvatarPin() {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const tex = canvasTex(cv);
    tex.anisotropy = 4;
    const sp: any = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true,
        // ACES tone mapping exists to make the world's lighting filmic; run
        // through it, flat UI art comes out lifted and desaturated. These are
        // interface elements, so they bypass it and render as authored.
        toneMapped: false,
      }),
    );
    sp.renderOrder = 1000;
    sp.userData.key = "";
    sp.userData.paint = (
      hex: number,
      alive: boolean,
      dim: number,
      url: string | null,
      health: number,
      armor: number,
      helmet: boolean,
    ) => {
      const img = url ? avatarImage(url) : null;
      // The image is part of the key so the pin repaints once it finishes
      // loading rather than staying on the placeholder.
      const key = `${hex}|${alive}|${dim.toFixed(2)}|${img ? url : ""}|${Math.round(health)}|${Math.round(armor)}|${helmet}`;
      if (sp.userData.key === key) return;
      sp.userData.key = key;

      const x = cv.getContext("2d")!;
      x.clearRect(0, 0, 128, 128);
      // The team colours are tuned to sit under text on the 2D radar, which
      // makes them too pale to carry a pin on their own. Push them toward full
      // saturation here so the disc reads as a team at a glance.
      const col = "#" + saturated(hex).getHexString();
      const cx = 64;
      const cy = 54;
      const r = 30;

      // Pointer tail, so the disc reads as anchored to a spot on the ground
      // rather than floating above it.
      x.globalAlpha = dim;
      x.beginPath();
      x.moveTo(cx - 11, cy + r - 5);
      x.lineTo(cx + 11, cy + r - 5);
      x.lineTo(cx, cy + r + 20);
      x.closePath();
      x.fillStyle = col;
      x.fill();

      // Photo, clipped to the disc.
      x.save();
      x.beginPath();
      x.arc(cx, cy, r - 3, 0, Math.PI * 2);
      x.clip();
      x.fillStyle = "#14161a";
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (img) {
        x.globalAlpha = dim * (alive ? 1 : 0.45);
        x.drawImage(img, cx - r + 3, cy - r + 3, (r - 3) * 2, (r - 3) * 2);
      } else {
        // Placeholder bust until the photo arrives.
        x.globalAlpha = dim * (alive ? 0.75 : 0.35);
        x.fillStyle = col;
        x.beginPath();
        x.arc(cx, cy - 7, 11, 0, Math.PI * 2);
        x.fill();
        x.beginPath();
        x.ellipse(cx, cy + 19, 18, 14, 0, Math.PI, 0, true);
        x.fill();
      }
      x.restore();

      // Team ring last, over the photo's edge. A dark rim underneath it keeps
      // the colour saturated against pale map geometry — without it the ring
      // blends into whatever it happens to be standing on.
      x.globalAlpha = dim;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.lineWidth = 10;
      x.strokeStyle = "rgba(8,10,14,0.85)";
      x.stroke();
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.lineWidth = 6;
      x.strokeStyle = col;
      x.stroke();

      // Health and armour ride the bottom of this same disc, the way they do on
      // the 2D radar — one marker rather than a disc with a separate bar stack
      // beside it, so the two views read as the same object.
      if (alive) {
        const from = Math.PI * 0.17;
        const to = Math.PI * 0.83;
        const hpR = r + 8;
        x.lineCap = "round";
        x.beginPath();
        x.arc(cx, cy, hpR, from, to);
        x.lineWidth = 6;
        x.strokeStyle = "rgba(8,10,14,0.8)";
        x.stroke();
        const hpFrac = Math.max(0, Math.min(1, health / 100));
        if (hpFrac > 0) {
          x.beginPath();
          x.arc(cx, cy, hpR, to - (to - from) * hpFrac, to);
          x.lineWidth = 4;
          x.strokeStyle = `hsl(${hpFrac * 130}, 85%, 50%)`;
          x.stroke();
        }
        const arFrac = Math.max(0, Math.min(1, armor / 100));
        if (arFrac > 0) {
          x.beginPath();
          x.arc(cx, cy, hpR + 7, to - (to - from) * arFrac, to);
          x.lineWidth = 3;
          x.strokeStyle = helmet ? "hsl(195,100%,70%)" : "hsl(200,70%,55%)";
          x.stroke();
        }
      }
      x.globalAlpha = 1;
      tex.needsUpdate = true;
    };
    // Bloom triggers above 1.0 in linear space, and a sprite drawn at full
    // brightness lands right on that line. Holding the pin slightly under keeps
    // the photo crisp instead of smearing into a glowing blob.
    sp.material.color.setScalar(1);
    return sp;
  }

  // Team colours pushed to near-full saturation, for the 3D pins only.
  const _sat = new THREE.Color();
  function saturated(hex: number) {
    _sat.setHex(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    _sat.getHSL(hsl);
    _sat.setHSL(hsl.h, Math.min(1, hsl.s * 1.75 + 0.2), Math.min(hsl.l, 0.56));
    return _sat;
  }

  function makeNameplate() {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 64;
    const tex = canvasTex(cv);
    tex.anisotropy = 4;
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true,
        toneMapped: false,
      }),
    );
    sp.scale.set(PH * 1.85, PH * 0.46, 1);
    // Clear of the disc above it, which now carries the health arcs and so
    // reaches further down than it used to.
    sp.position.y = PH * 0.98;
    sp.renderOrder = 1002;
    let last = "";
    return {
      sprite: sp,
      // The weapon rides inside the plate rather than as its own sprite. As a
      // separate billboard it collided with whatever was stacked next to it —
      // the pin's pointer tail above, the ground ring below — because the
      // camera can look at the token from any angle.
      redraw(text: string, weapon?: string | null) {
        const icon = weapon ? weaponImg(weapon) : null;
        const key = `${text}|${weapon ?? ""}|${icon ? 1 : 0}`;
        if (key === last) return;
        last = key;
        const x = cv.getContext("2d")!;
        x.clearRect(0, 0, 256, 64);
        x.fillStyle = "rgba(10,13,18,0.82)";
        (x as any).roundRect(10, 16, 236, 34, 9);
        x.fill();
        let textCx = 128;
        if (icon) {
          const h = 24;
          const w = Math.min(78, h * (icon.width / icon.height || 2));
          x.drawImage(icon, 18, 33 - h / 2, w, h);
          textCx = (18 + w + 10 + 246) / 2;
        }
        x.font = "600 25px Oxanium, system-ui, sans-serif";
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillStyle = "#f4f8fc";
        x.fillText(text, textCx, 34);
        tex.needsUpdate = true;
      },
    };
  }
  const WHITE = new THREE.Color(0xffffff);
  // shared eye icon (white), shown above a blinded player
  const flashIconTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 64;
    const x = cv.getContext("2d")!;
    x.strokeStyle = "#fff";
    x.fillStyle = "#fff";
    x.lineWidth = 5;
    x.lineCap = "round";
    x.lineJoin = "round";
    // almond eye outline
    x.beginPath();
    x.moveTo(8, 32);
    x.quadraticCurveTo(32, 12, 56, 32);
    x.quadraticCurveTo(32, 52, 8, 32);
    x.closePath();
    x.stroke();
    // pupil
    x.beginPath();
    x.arc(32, 32, 8, 0, Math.PI * 2);
    x.fill();
    const tex = canvasTex(cv);
    tex.anisotropy = 4;
    return tex;
  })();
  // shared low-poly figure + rifle geometries (reused across all tokens). The
  // Sleek directional "pin": a glossy team-tinted teardrop marker (rounded top,
  // pointed bottom) standing on the position ring; aim direction is read from the
  // sharp floor wedge in front. No body parts. Built via a lathed teardrop
  // profile so it stays smooth + light.
  const pinProfile = [
    new THREE.Vector2(0.02, PH * 1.12),
    new THREE.Vector2(PR * 0.5, PH * 1.0),
    new THREE.Vector2(PR * 0.82, PH * 0.86),
    new THREE.Vector2(PR * 0.92, PH * 0.66),
    new THREE.Vector2(PR * 0.82, PH * 0.46),
    new THREE.Vector2(PR * 0.58, PH * 0.27),
    new THREE.Vector2(PR * 0.3, PH * 0.12),
    new THREE.Vector2(0.02, PH * 0.02),
  ];
  const geoPin = new THREE.LatheGeometry(pinProfile, 22);
  // Broken into arcs so it reads as a targeting reticle rather than a plain
  // circle, and so the rotation is visible.
  const geoSelRing = new THREE.RingGeometry(RING * 1.55, RING * 1.95, 32, 1, 0, Math.PI * 1.55);
  // sharp forward-pointing aim wedge on the floor (the direction cue; shares ringMat)
  // Ground ring: where the player actually stands. The camera-facing disc
  // above cannot express that — it floats at a fixed screen size regardless of
  // the terrain under it — so the two carry different information and both earn
  // their place. Slimmer than the disc's ring so they don't read as duplicates.
  const geoRing = new THREE.RingGeometry(RING * 0.92, RING * 1.06, 32);
  const geoAim = new THREE.BufferGeometry();
  geoAim.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        -RING * 0.5,
        0,
        RING * 1.0,
        RING * 0.5,
        0,
        RING * 1.0,
        0,
        0,
        RING * 2.7,
      ]),
      3,
    ),
  );
  geoAim.computeVertexNormals();
  function buildToken() {
    const grp = new THREE.Group();
    // glossy team-tinted body; depthTest:false so it's visible through geometry.
    // A little self-illumination on the token. Filmic tone mapping compresses
    // highlights, which is right for fire and flashes but would leave a flat
    // team colour looking muddy against a dark map; emitting some of its own
    // colour keeps a player legible at a glance, which is the whole job of the
    // token.
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0.25,
      depthTest: false,
    });
    // Rim light. A token lit only from above loses its outline against a dark
    // map; brightening the grazing edges gives it a defined silhouette from any
    // camera angle, which is what makes a figure read instantly.
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimHit = { value: 0 };
      (mat as any).userData.shader = shader;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vRimN;\nvarying vec3 vRimV;",
        )
        .replace(
          "#include <project_vertex>",
          [
            "#include <project_vertex>",
            "vRimN = normalize(mat3(modelMatrix) * objectNormal);",
            "vRimV = normalize(cameraPosition - (modelMatrix * vec4(transformed, 1.0)).xyz);",
          ].join("\n"),
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vRimN;\nvarying vec3 vRimV;\nuniform float uRimHit;",
        )
        .replace(
          "#include <dithering_fragment>",
          [
            "#include <dithering_fragment>",
            "float rim = pow(1.0 - clamp(dot(normalize(vRimN), normalize(vRimV)), 0.0, 1.0), 2.4);",
            "gl_FragColor.rgb += rim * 0.85 * gl_FragColor.rgb;",
            // Taking damage flares the whole token red for a moment, so a hit
            // is visible even when the health bar is off screen.
            "gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.16, 0.12), uRimHit);",
          ].join("\n"),
        );
    };
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    // The lathed 3D pin is kept for nothing now — the billboard reads better
    // from every angle — but the floor ring and aim wedge below still carry
    // position and facing, which a camera-facing disc cannot.
    const avatar = makeAvatarPin();
    // The disc carries the avatar, the team ring and the health/armour arcs, so
    // it is the whole marker — the floor ring that used to sit beneath it was a
    // second circle competing with this one for the same reading.
    avatar.scale.set(PH * 1.35, PH * 1.35, 1);
    avatar.position.y = PH * 1.95;
    grp.add(avatar);
    // Floor aim wedge: which way they are looking. Kept because a camera-facing
    // disc cannot express facing, and a wedge is not another circle.
    const aim = new THREE.Mesh(geoAim, ringMat);
    aim.position.y = 1.5;
    aim.renderOrder = 989;
    grp.add(aim);
    const ring = new THREE.Mesh(geoRing, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2;
    ring.renderOrder = 989;
    grp.add(ring);

    // Selection ring. Sits under the focused player only, larger than the
    // position ring, slowly rotating and breathing so the eye is drawn to it —
    // picking a player previously changed the camera and nothing else, which
    // left no way to tell who was selected once the camera settled.
    const selRing = new THREE.Mesh(
      geoSelRing,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    selRing.rotation.x = -Math.PI / 2;
    selRing.position.y = 2.5;
    selRing.renderOrder = 988;
    selRing.visible = false;
    grp.add(selRing);
    const np = makeNameplate();
    grp.add(np.sprite);
    // flashbang icon shown above the head while blinded
    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashIconTex,
        depthTest: false,
        transparent: true,
      }),
    );
    flash.scale.set(PR * 1.5, PR * 1.5, 1);
    flash.position.set(PR * 0.9, PH * 1.12, 0);
    flash.renderOrder = 1003;
    flash.visible = false;
    grp.add(flash);
    grp.visible = false;
    scene.add(grp);
    return { grp, mat, ringMat, np, flash, avatar, selRing };
  }
  const tokens = Array.from({ length: 12 }, buildToken);
  // Per-player health, so a drop between samples can be read as a hit.
  const lastHealth = new Map<string, number>();
  const hurtUntil = new Map<string, number>();

  // ===== thrower "ghosts" + highlighted utility paths =====
  function makeGhost() {
    const grp = new THREE.Group();
    // ghost = a smaller, translucent version of the player pin at the throw origin
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthTest: false,
    });
    const body = new THREE.Mesh(geoPin, mat);
    body.scale.setScalar(0.65);
    body.renderOrder = 991;
    grp.add(body);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(RING * 0.7, RING * 0.88, 24),
      ringMat,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 2;
    ring.renderOrder = 991;
    grp.add(ring);
    const np = makeNameplate();
    np.sprite.position.y = PH * 1.15;
    np.sprite.scale.multiplyScalar(0.8);
    grp.add(np.sprite);
    grp.visible = false;
    scene.add(grp);
    return { grp, mat, ringMat, np };
  }
  const ghosts = Array.from({ length: 32 }, makeGhost);
  // buy-overlay player dots (stacked rounds)
  const overlayDots = Array.from({ length: 80 }, () => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(PR * 0.85, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    m.visible = false;
    m.renderOrder = 988;
    scene.add(m);
    return m;
  });

  // followed-player highlight: a bright pulsing halo ring under the chased player
  const followHalo = new THREE.Mesh(
    new THREE.RingGeometry(RING * 1.35, RING * 1.72, 36),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  followHalo.rotation.x = -Math.PI / 2;
  followHalo.renderOrder = 989;
  followHalo.visible = false;
  scene.add(followHalo);

  // death markers: team-coloured X on the floor (sprite, always camera-facing)
  function makeXTex() {
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 64;
    const c = cv.getContext("2d")!;
    c.strokeStyle = "#fff";
    c.lineWidth = 9;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(16, 16);
    c.lineTo(48, 48);
    c.moveTo(48, 16);
    c.lineTo(16, 48);
    c.stroke();
    const t = canvasTex(cv);
    t.anisotropy = 4;
    return t;
  }
  const xTex = makeXTex();
  const deathMarks = Array.from({ length: 48 }, () => {
    const m = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: xTex,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    m.scale.set(PR * 1.5, PR * 1.5, 1);
    m.visible = false;
    m.renderOrder = 987;
    scene.add(m);
    return m;
  });
  // Firing tracers: a pool of 2-point lines reused each frame. Drawn over
  // geometry (depthTest off) so a shot through a wall still reads.
  const tracerLines = Array.from({ length: 48 }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    // Per-vertex alpha, so the streak can fade out along its tail instead of
    // being a uniformly lit segment — a hard-edged line of even brightness is
    // what reads as a laser rather than a round in flight. itemSize 4 is what
    // switches three's colour path to include alpha.
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(8), 4));
    const ln = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 1,
        depthTest: false,
        vertexColors: true,
        // Additive so overlapping fire reads as hotter rather than muddier.
        blending: THREE.AdditiveBlending,
      }),
    );
    ln.visible = false;
    ln.frustumCulled = false;
    ln.renderOrder = 990;
    scene.add(ln);
    return ln;
  });
  // A shot should read as a shot. The line alone is a hairline with no sense of
  // energy, so each tracer also gets a muzzle flash at the shooter's eye and a
  // spark where the round lands. Both are additive, so under filmic tone mapping
  // they bloom into the surrounding dark instead of clipping.
  const SPARKTEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,238,190,0.85)");
    g.addColorStop(0.6, "rgba(255,170,60,0.28)");
    g.addColorStop(1, "rgba(255,120,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return canvasTex(c);
  })();
  const makeSpark = (order: number) => {
    const sp: any = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: SPARKTEX,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    sp.visible = false;
    sp.renderOrder = order;
    scene.add(sp);
    return sp;
  };
  const muzzleFlashes = Array.from({ length: 48 }, () => makeSpark(991));
  const impactSparks = Array.from({ length: 48 }, () => makeSpark(991));

  const selArcs = Array.from({ length: 32 }, () => {
    const m = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.7,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    m.frustumCulled = false;
    m.visible = false;
    m.renderOrder = 999;
    scene.add(m);
    return m;
  });

  // ===== utility effects (volumetric — ported from Replay3D) =====
  const SMOKE_R = 150 * U,
    FIRE_R = 150 * U,
    POP_R = 120 * U;
  const SMOKETEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,0.82)");
    g.addColorStop(0.85, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return canvasTex(c);
  })();
  const FIRETEX = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 80, 2, 64, 70, 60);
    g.addColorStop(0, "rgba(255,248,200,1)");
    g.addColorStop(0.35, "rgba(255,170,40,0.9)");
    g.addColorStop(0.7, "rgba(220,70,20,0.5)");
    g.addColorStop(1, "rgba(120,20,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return canvasTex(c);
  })();
  // Decoded smoke grids by grenade id. A cloud's shape is fixed once it pops,
  // so this is built per blob rather than per frame.
  const smokeVolCache = new Map<number, DecodedSmokeVolume | null>();
  // The blob usually arrives after the scene is built, so the cache is keyed to
  // the array it was filled from. Without this a lookup made before the volumes
  // land would cache a null and that smoke would never draw.
  let smokeVolSrc: SmokeVolume[] | undefined;
  const smokeVolFor = (gid: number | null | undefined) => {
    if (props.smokeVolumes !== smokeVolSrc) {
      smokeVolSrc = props.smokeVolumes;
      smokeVolCache.clear();
      for (const slot of smokeVolumeMeshes) slot.gid = null;
    }
    if (gid == null) return null;
    const key = Number(gid);
    if (smokeVolCache.has(key)) return smokeVolCache.get(key)!;
    const src = (props.smokeVolumes ?? []).find(
      (v) => v.gid != null && Number(v.gid) === key,
    );
    const dec = src ? decodeSmokeVolume(src) : null;
    smokeVolCache.set(key, dec);
    return dec;
  };

  // ===== volumetric smoke =====
  //
  // Drawing one sprite per occupied cell reads as a heap of beads, not gas: the
  // lattice shows through however much the sprites are blurred. Since the
  // parser hands us an actual density field, the honest way to draw it is to
  // march a ray through it — the silhouette then comes from the data, the
  // interior has real depth, and the edge softens because the density does.
  //
  // Only in mesh mode: there the source→world transform is a plain axis
  // permutation (x, z, -y), so the volume is an axis-aligned box and the march
  // can run in source space. The flat-radar fallback projects non-linearly, so
  // that path keeps the point cloud.
  const SMOKE_MAX_BLASTS = 4;

  const smokeVolVert = /* glsl */ `
    out vec3 vWorld;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const smokeVolFrag = /* glsl */ `
    precision highp float;
    precision highp sampler3D;

    in vec3 vWorld;
    layout(location = 0) out vec4 fragColor;

    uniform sampler3D uTex;
    uniform vec3 uTint;
    uniform vec3 uSrcMin;
    uniform vec3 uSrcSize;
    uniform float uOpacity;
    uniform float uBloom;
    uniform float uAbsorb;
    uniform int uSteps;
    uniform int uBlastCount;
    uniform vec4 uBlast[${SMOKE_MAX_BLASTS}];      // xyz = centre, w = outer radius
    uniform float uBlastFull[${SMOKE_MAX_BLASTS}]; // full-strength radius
    uniform float uResidual;
    uniform vec3 uLightDir;   // toward the key light, source space
    uniform vec3 uLightCol;
    uniform vec3 uShadowCol;
    uniform float uDrift;     // playback-derived, so billows move but never jitter

    // World is (x, z, -y) of source, so the inverse is a straight swizzle.
    vec3 toSource(vec3 w) { return vec3(w.x, -w.z, w.y); }

    vec2 hitBox(vec3 orig, vec3 dir, vec3 lo, vec3 hi) {
      vec3 inv = 1.0 / dir;
      vec3 a = (lo - orig) * inv;
      vec3 b = (hi - orig) * inv;
      vec3 t1 = min(a, b), t2 = max(a, b);
      return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z));
    }

    float hash13(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    // Value noise, trilinear between lattice points.
    float vnoise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
      float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
      return mix(
        mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
        mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
        f.z);
    }

    // Two octaves is enough to break the shape up without turning it to soup.
    float billow(vec3 p) {
      return 0.62 * vnoise(p) + 0.38 * vnoise(p * 2.17 + vec3(11.3, 5.1, 7.7));
    }

    // Same thinning curve the parser applies, so the hole drawn here is the
    // hole the sightline stats believe in.
    float thinning(vec3 p) {
      float survive = 1.0;
      for (int i = 0; i < ${SMOKE_MAX_BLASTS}; i++) {
        if (i >= uBlastCount) break;
        float d = distance(p, uBlast[i].xyz);
        float outer = uBlast[i].w;
        if (d >= outer) continue;
        float full = uBlastFull[i];
        float strength = 1.0;
        if (d > full) {
          float f = (d - full) / max(outer - full, 1e-3);
          strength = 1.0 - smoothstep(0.0, 1.0, f);
        }
        survive *= 1.0 - strength * (1.0 - uResidual);
      }
      return survive;
    }

    // Density at a point: the measured field, roughened by noise and thinned by
    // any explosion. The noise is what stops a smooth spheroid from reading as
    // a solid dome — real smoke is lumpy, and the field we store is far too
    // coarse to carry that detail itself.
    float sampleDensity(vec3 p, vec3 centre) {
      vec3 sp = centre + (p - centre) / max(uBloom, 0.05);
      vec3 uvw = (sp - uSrcMin) / uSrcSize;
      if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) return 0.0;
      float d = texture(uTex, uvw).r;
      if (d <= 0.004) return 0.0;
      float n = billow(sp * 0.021 + vec3(0.0, 0.0, uDrift * 0.35) + uDrift * 0.08);
      // Bias so the core stays solid while the rim gets chewed away — that
      // asymmetry is what gives a cloud its ragged silhouette.
      d *= mix(0.45, 1.35, n);
      return clamp(d, 0.0, 1.0) * thinning(p);
    }

    void main() {
      vec3 camSrc = toSource(cameraPosition);
      vec3 frag = toSource(vWorld);
      vec3 dir = normalize(frag - camSrc);
      vec3 lo = uSrcMin;
      vec3 hi = uSrcMin + uSrcSize;
      vec2 t = hitBox(camSrc, dir, lo, hi);
      t.x = max(t.x, 0.0);
      if (t.y <= t.x) discard;

      vec3 centre = uSrcMin + uSrcSize * 0.5;
      float span = t.y - t.x;
      float stepLen = span / float(uSteps);
      // Dither the entry point by screen position to break up the banding a
      // fixed step count would otherwise leave across the cloud.
      float jitter = hash13(vec3(gl_FragCoord.xy, 1.0));
      vec3 p = camSrc + dir * (t.x + stepLen * jitter);

      // Light marching: at each sample, look a short way toward the key light
      // and see how much cloud is in the way. That self-shadowing is what turns
      // a flat silhouette into something with a lit crown and a dark underside.
      float lightStep = max(uSrcSize.x, uSrcSize.z) * 0.13;

      vec3 col = vec3(0.0);
      float alpha = 0.0;
      for (int i = 0; i < 256; i++) {
        if (i >= uSteps || alpha > 0.99) break;
        float d = sampleDensity(p, centre);
        if (d > 0.004) {
          // Light-march only where there is enough smoke for the shading to
          // show. Thin rim samples get the lit colour directly, which saves the
          // majority of the secondary fetches for no visible difference.
          float lit = 1.0;
          if (d > 0.12) {
            float shadow = 0.0;
            for (int j = 1; j <= 2; j++) {
              shadow += sampleDensity(p + uLightDir * (float(j) * lightStep), centre);
            }
            lit = exp(-shadow * 1.7);
          }
          vec3 shade = mix(uShadowCol, uLightCol, lit);
          float a = 1.0 - exp(-d * uAbsorb * stepLen);
          col += (1.0 - alpha) * a * shade;
          alpha += (1.0 - alpha) * a;
        }
        p += dir * stepLen;
      }
      if (alpha <= 0.004) discard;
      fragColor = vec4(col / max(alpha, 1e-4) * uTint, alpha * uOpacity);
    }
  `;

  function makeSmokeVolumeMesh() {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      // Matches the rest of the utility layer: readable through map geometry,
      // which is the point of a tactical view.
      depthTest: false,
      side: THREE.BackSide,
      uniforms: {
        uTex: { value: null as THREE.Data3DTexture | null },
        uTint: { value: new THREE.Color(0xc4cdd8) },
        uSrcMin: { value: new THREE.Vector3() },
        uSrcSize: { value: new THREE.Vector3(1, 1, 1) },
        uOpacity: { value: 1 },
        uBloom: { value: 1 },
        // Tuned so a sightline through the core comes out solid while the rim
        // stays translucent, matching how the parser weighs the same field.
        uAbsorb: { value: 0.055 },
        // Every step also light-marches, so the real cost is steps × (1 + light
        // samples) texture fetches per fragment — and a cloud can fill the
        // screen. This is the first knob to turn if the 3D view gets heavy.
        uSteps: { value: isTouch ? 20 : 34 },
        uBlastCount: { value: 0 },
        uBlast: {
          value: Array.from(
            { length: SMOKE_MAX_BLASTS },
            () => new THREE.Vector4(),
          ),
        },
        uBlastFull: {
          value: new Array(SMOKE_MAX_BLASTS).fill(0) as number[],
        },
        uResidual: { value: 0.15 },
        // Key light comes from above and slightly to the side, matching the
        // scene's directional light once swizzled into source space.
        uLightDir: {
          value: new THREE.Vector3(0.35, -0.3, 1.0).normalize(),
        },
        uLightCol: { value: new THREE.Color(0xf7f8fa) },
        uShadowCol: { value: new THREE.Color(0x3e4147) },
        uDrift: { value: 0 },
      },
      vertexShader: smokeVolVert,
      fragmentShader: smokeVolFrag,
    });
    const mesh: any = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 996;
    scene.add(mesh);
    return { mesh, mat, gid: null as number | null, tex: null as any };
  }
  const smokeVolumeMeshes = meshMode
    ? Array.from({ length: 10 }, makeSmokeVolumeMesh)
    : [];

  // Uploads a decoded density grid as a 3D texture, and positions the box that
  // bounds it.
  function fitSmokeVolume(slot: any, dec: DecodedSmokeVolume) {
    const { dx, dy, dz, vs, ox, oy, oz } = dec;
    const data = new Uint8Array(dx * dy * dz);
    for (let k = 0; k < dz; k++)
      for (let j = 0; j < dy; j++)
        for (let i = 0; i < dx; i++)
          data[(k * dy + j) * dx + i] = Math.round(dec.at(i, j, k) * 255);

    slot.tex?.dispose();
    const tex = new THREE.Data3DTexture(data, dx, dy, dz);
    tex.format = THREE.RedFormat;
    tex.type = THREE.UnsignedByteType;
    // Trilinear, so the cloud is smooth between cells rather than blocky.
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    slot.tex = tex;
    slot.mat.uniforms.uTex.value = tex;

    const sx = dx * vs;
    const sy = dy * vs;
    const sz = dz * vs;
    slot.mat.uniforms.uSrcMin.value.set(ox, oy, oz);
    slot.mat.uniforms.uSrcSize.value.set(sx, sy, sz);
    // Source (x, y, z) → world (x, z, -y): the box spans sx by sz by sy.
    slot.mesh.scale.set(sx, sz, sy);
    slot.mesh.position.set(ox + sx / 2, oz + sz / 2, -(oy + sy / 2));
  }

  // drifting smoke clouds: a solid translucent CORE (always visible) + puff
  // sprites for texture. Used for blobs with no measured volume.
  const smokeClouds = Array.from({ length: 10 }, () => {
    const grp = new THREE.Group();
    const puffs: any[] = [];
    const N = 24;
    const core: any = new THREE.Mesh(
      new THREE.SphereGeometry(SMOKE_R * 0.92, 18, 14),
      new THREE.MeshBasicMaterial({
        color: 0xc4cdd8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    );
    core.scale.set(1, 0.85, 1);
    grp.add(core);
    for (let j = 0; j < N; j++) {
      const sp: any = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: SMOKETEX,
          color: 0xdfe6ee,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0,
        }),
      );
      const t = (j + 0.5) / N,
        inc = Math.acos(1 - 2 * t),
        az = j * 2.39996,
        rr = 0.55 + 0.45 * ((j * 0.37) % 1);
      sp.userData = {
        ox: Math.sin(inc) * Math.cos(az) * rr,
        oy: Math.cos(inc) * rr * 0.8,
        oz: Math.sin(inc) * Math.sin(az) * rr,
        base: 0.55 + 0.35 * ((j * 0.53) % 1),
        ph: (j * 0.61) % 1,
      };
      grp.add(sp);
      puffs.push(sp);
    }
    grp.visible = false;
    grp.renderOrder = 996;
    scene.add(grp);
    return { grp, puffs, core };
  });
  // flickering fire groups (additive flame sprites)
  const fireGroups = Array.from({ length: 6 }, () => {
    const grp = new THREE.Group();
    const flames: any[] = [];
    for (let j = 0; j < 14; j++) {
      const sp: any = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: FIRETEX,
          color: 0xffffff,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          opacity: 0,
        }),
      );
      const a = j * 1.7,
        r = 0.2 + 0.8 * ((j * 0.37) % 1);
      sp.userData = {
        ox: Math.cos(a) * r,
        oz: Math.sin(a) * r,
        ph: (j * 0.61) % 1,
        sz: 0.5 + 0.5 * ((j * 0.29) % 1),
      };
      grp.add(sp);
      flames.push(sp);
    }
    grp.visible = false;
    grp.renderOrder = 996;
    scene.add(grp);
    return { grp, flames };
  });
  // Real fire: one billboard per networked flame, so the burn occupies exactly
  // the ground the engine says it did. The invented ring of flames it replaces
  // was the same size for every molotov regardless of how the fire actually
  // spread, or of a smoke cutting it short.
  // Fire seen from above is mostly the ground it lights, not the tongues —
  // vertical billboards nearly vanish when the camera looks straight down,
  // which is the default view. Each flame therefore gets a flat glow lying on
  // the deck as well as a tongue standing up from it.
  const flameGlowGeo = new THREE.CircleGeometry(1, 20);
  const flameGlows = Array.from({ length: 120 }, () => {
    const m: any = new THREE.Mesh(
      flameGlowGeo,
      new THREE.MeshBasicMaterial({
        map: FIRETEX,
        color: 0xff7b2a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 995;
    scene.add(m);
    return m;
  });

  const FLAME_POOL = 260;
  // Tongues drawn per networked flame, and how far they scatter around it. The
  // engine's flames sit ~65 units apart, so filling that gap is what turns a
  // set of anchor points into a continuous body of fire.
  const FLAME_SUBS = 4;
  const FLAME_FILL = 62;
  const realFlames = Array.from({ length: FLAME_POOL }, () => {
    const sp: any = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: FIRETEX,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    sp.visible = false;
    sp.renderOrder = 997;
    scene.add(sp);
    return sp;
  });

  // pops (HE/flash/decoy): a flat expanding shockwave RING + a brief additive
  // flash GLOW — no dome sphere.
  const popRingGeo = new THREE.RingGeometry(POP_R * 0.86, POP_R, 40);
  const pops = Array.from({ length: 12 }, () => {
    const grp = new THREE.Group();
    const ring: any = new THREE.Mesh(
      popRingGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    const glow: any = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: SMOKETEX,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    grp.add(ring);
    grp.add(glow);
    grp.visible = false;
    grp.renderOrder = 998;
    scene.add(grp);
    return { grp, ring, glow };
  });
  // depleting ground time ring (radial sweep shader)
  const RING_VERT =
    "varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  const RING_FRAG =
    "varying vec2 vP; uniform float uRemain; uniform vec3 uColor; uniform float uOp; void main(){ float a=atan(vP.x,vP.y)/6.2831853; if(a<0.0)a+=1.0; if(a>uRemain) discard; gl_FragColor=vec4(uColor,uOp); }";
  const ringGeo = new THREE.RingGeometry(SMOKE_R * 0.92, SMOKE_R, 48);
  const trings = Array.from({ length: 16 }, () => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: {
        uRemain: { value: 1 },
        uColor: { value: new THREE.Color(0xffffff) },
        uOp: { value: 0.6 },
      },
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const m: any = new THREE.Mesh(ringGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 998;
    m.visible = false;
    scene.add(m);
    return m;
  });
  // billboarded grenade-type icon textures (white SVG silhouette), cached
  // ===== in-flight grenade: real 3D primitive models that tumble (ported from
  // the old 3D player). Shape reads the type; depthTest off = visible through
  // walls like the lines. =====
  const G = 11 * U; // base grenade dimension
  const utilityMatU = (hex: number) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.15,
      depthTest: false,
    });
  function makeCanister(hex: number) {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(G * 0.55, G * 0.55, G * 1.7, 14),
        utilityMatU(hex),
      ),
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(G * 0.46, G * 0.46, G * 0.45, 14),
      utilityMatU(0x2a2e34),
    );
    cap.position.y = G * 0.95;
    g.add(cap);
    const lip = new THREE.Mesh(
      new THREE.CylinderGeometry(G * 0.6, G * 0.6, G * 0.2, 14),
      utilityMatU(0x20242a),
    );
    lip.position.y = G * 0.72;
    g.add(lip);
    return g;
  }
  function makeFrag(hex: number) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(G * 0.8, 14, 12),
      utilityMatU(hex),
    );
    b.scale.set(1, 1.3, 1);
    g.add(b);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(G * 0.85, G * 0.85, G * 0.3, 14),
      utilityMatU(0x33373d),
    );
    g.add(band);
    return g;
  }
  function makeBottle(hex: number) {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(G * 0.55, G * 0.62, G * 1.6, 14),
        utilityMatU(hex),
      ),
    );
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(G * 0.24, G * 0.46, G * 0.7, 10),
      utilityMatU(hex),
    );
    neck.position.y = G;
    g.add(neck);
    const rag = new THREE.Mesh(
      new THREE.SphereGeometry(G * 0.3, 8, 6),
      utilityMatU(0xe8d8b0),
    );
    rag.position.y = G * 1.45;
    g.add(rag);
    return g;
  }
  function makeUtilityModels() {
    const grp = new THREE.Group();
    const models: Record<string, THREE.Object3D> = {
      Smoke: makeCanister(UTILITY_COL.Smoke),
      Flash: makeCanister(UTILITY_COL.Flash),
      Decoy: makeCanister(UTILITY_COL.Decoy),
      HE: makeFrag(UTILITY_COL.HE),
      Molotov: makeBottle(UTILITY_COL.Molotov),
    };
    for (const k in models) {
      models[k].visible = false;
      grp.add(models[k]);
    }
    grp.visible = false;
    grp.renderOrder = 1000;
    grp.traverse((o) => {
      o.renderOrder = 1000;
    });
    scene.add(grp);
    return { grp, models };
  }
  const projs = Array.from({ length: 12 }, makeUtilityModels);
  const arcMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      roughness: 0.45,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      depthTest: false,
      side: THREE.DoubleSide,
    });
  // Tube tessellation, shared with the draw-range slicing that reveals the
  // trail as the grenade flies.
  // More segments than before: the trail is revealed a whole segment at a time,
  // so segment count *is* the smoothness of the reveal. 32 was coarse enough to
  // see the line jump forward in steps.
  const ARC_SEGMENTS = 96;
  const ARC_RADIAL = 6;
  // Thin. A grenade leaves a trail, not a pipe.
  const ARC_RADIUS_MUL = 0.42;

  const arcs = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), arcMat());
    m.frustumCulled = false;
    m.visible = false;
    m.renderOrder = 997;
    scene.add(m);
    return m;
  });

  // A soft glow that rides the grenade itself.
  const arcHeads = Array.from({ length: 12 }, () => {
    const sp: any = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: SPARKTEX,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      }),
    );
    sp.visible = false;
    sp.renderOrder = 998;
    scene.add(sp);
    return sp;
  });
  // heat discs
  const heat = Array.from({ length: 64 }, () => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(60 * U, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 995;
    scene.add(m);
    return m;
  });

  // gid -> real bounce path (blob v4+). When present we draw the true
  // bouncing flight line; otherwise fall back to a smooth synthetic arc.
  const trajByGid = new Map<
    number,
    Array<{ x: number; y: number; z: number }>
  >();
  let lastTraj: unknown = null;
  function refreshTraj() {
    // only rebuild when the trajectory array actually changes (it's set once on
    // load) — rebuilding every frame in overlay mode was a real cost.
    if (props.grenadeTrajectories === lastTraj) return;
    lastTraj = props.grenadeTrajectories;
    trajByGid.clear();
    for (const t of props.grenadeTrajectories || []) {
      if (t?.gid != null && t.pts?.length) trajByGid.set(t.gid, t.pts);
    }
  }
  refreshTraj();
  // Fraction of the curve's total length reached at curve parameter `t`. Three
  // caches its own length table, so this is a lookup after the first call.
  function arcU(curve: THREE.Curve<THREE.Vector3>, t: number) {
    const lengths = curve.getLengths(ARC_SEGMENTS * 2);
    const total = lengths[lengths.length - 1];
    if (!(total > 0)) {
      return t;
    }
    const f = Math.max(0, Math.min(1, t)) * (lengths.length - 1);
    const i = Math.min(Math.floor(f), lengths.length - 2);
    return (lengths[i] + (lengths[i + 1] - lengths[i]) * (f - i)) / total;
  }

  function arcCurve(a: InFlight) {
    const pts = a.gid != null ? trajByGid.get(a.gid) : undefined;
    if (pts && pts.length >= 2) {
      // draw the FULL real bounce path (smooth) — slicing per-frame made it
      // jitter as points appeared; the projectile head shows the live spot.
      return new THREE.CatmullRomCurve3(
        pts.map((p) => wpos(p).clone()),
        false,
        "centripetal",
      );
    }
    const p0 = wpos({ x: a.fromX, y: a.fromY, z: 0 }).clone();
    const p2 = wpos({ x: a.toX, y: a.toY, z: 0 }).clone();
    const lift = p0.distanceTo(p2) * 0.28 + 40 * U;
    const p1 = p0.clone().lerp(p2, 0.5);
    p1.y += lift;
    return new THREE.QuadraticBezierCurve3(p0, p1, p2);
  }

  // ===== per-frame data push =====
  let camToken: { grp: THREE.Group } | null = null;
  apply = () => {
    refreshTraj();
    // Effect lights are re-pointed from scratch each frame.
    resetFxLights();
    const ps = props.players || [];
    const names = props.names || {};
    if (!meshMode && !floorSet) {
      let m = Infinity;
      for (const p of ps) if (p.alive && p.z < m) m = p.z;
      if (m !== Infinity) {
        floorRef = m;
        floorSet = true;
      }
    }
    let followTok: { grp: THREE.Group } | null = null;
    const ov = props.overlayActors || [];
    const inOverlay = !!props.overlay; // real overlay mode — never infer from ov.length
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      const p = ps[i];
      if (inOverlay || !p || !p.alive) {
        tk.grp.visible = false;
        continue;
      }
      tk.grp.visible = true;
      wpos(p, _v);
      tk.grp.position.copy(_v);
      const a = (p.yaw * Math.PI) / 180;
      tk.grp.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a));
      const col = TEAM(p.team);
      tk.mat.color.setHex(col);
      tk.mat.emissive.setHex(col);

      // Damage flare. Health is sampled a few times a second, so any drop
      // between samples is a hit; the flare decays over the following moments so
      // it is visible without a health bar. Keyed on the player, not the token
      // slot, since slots get reassigned.
      const hpNow = p.health ?? 0;
      const prevHp = lastHealth.get(p.steamId);
      if (prevHp != null && hpNow < prevHp && hpNow > 0) {
        hurtUntil.set(p.steamId, performance.now() + 380);
      }
      lastHealth.set(p.steamId, hpNow);
      const hurtEnds = hurtUntil.get(p.steamId) ?? 0;
      const hurt = Math.max(0, Math.min(1, (hurtEnds - performance.now()) / 380));
      const rimShader = (tk.mat as any).userData?.shader;
      if (rimShader) rimShader.uniforms.uRimHit.value = hurt * 0.75;

      // The pin flashes red on a hit for the same reason the token does — it is
      // the part a viewer is actually looking at.
      tk.avatar.userData.paint(
        hurt > 0.05 ? 0xff2a20 : col,
        p.alive,
        p.alive ? 1 : 0.45,
        props.avatars?.[p.steamId] ?? null,
        p.health ?? 100,
        p.armor ?? 0,
        p.helmet === true,
      );
      tk.ringMat.color.setHex(col);

      // Selection state: rotate and breathe, so the focused player is obvious
      // at a glance without washing out everything around them.
      const isFocused = !!props.focused && p.steamId === props.focused;
      tk.selRing.visible = isFocused && p.alive;
      if (tk.selRing.visible) {
        const sm = tk.selRing.material as THREE.MeshBasicMaterial;
        sm.color.setHex(col);
        const beat = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
        sm.opacity = 0.45 + 0.35 * beat;
        tk.selRing.rotation.z = performance.now() * 0.0012;
        const sc = 1 + 0.06 * beat;
        tk.selRing.scale.set(sc, sc, 1);
      }
      // blinded: wash the body toward white + raise the flash icon over the head
      const bl = (p as any).blinded ?? 0;
      if (bl > 0.05) tk.mat.color.lerp(WHITE, Math.min(0.85, bl * 0.9));
      tk.flash.visible = bl > 0.12;
      if (tk.flash.visible)
        (tk.flash.material as THREE.SpriteMaterial).opacity = Math.min(
          1,
          0.35 + bl,
        );
      const nm = names[p.steamId] || "";
      tk.np.redraw(nm, p.activeWeapon ?? null);
      if (followSid.value && p.steamId === followSid.value) followTok = tk;
    }
    camToken = followTok;

    // buy-overlay player dots (stacked rounds)
    let di = 0;
    if (inOverlay) {
      for (const a of ov) {
        if (di >= overlayDots.length) break;
        const d = overlayDots[di++];
        wpos(a, _v);
        d.visible = true;
        d.position.copy(_v).setY(_v.y + PR);
        (d.material as THREE.MeshBasicMaterial).color.setHex(TEAM(a.team));
      }
    }
    for (let k = di; k < overlayDots.length; k++)
      overlayDots[k].visible = false;

    // death markers (team-coloured X on the floor)
    let dmi = 0;
    if (!inOverlay) {
      for (const d of props.deaths || []) {
        if (dmi >= deathMarks.length) break;
        const m = deathMarks[dmi++];
        wpos(d, _v);
        m.visible = true;
        m.position.copy(_v).setY(_v.y + 6);
        (m.material as THREE.SpriteMaterial).color.setHex(TEAM(d.team));
      }
    }
    for (let k = dmi; k < deathMarks.length; k++) deathMarks[k].visible = false;

    // firing tracers — a short bright streak travelling muzzle → target,
    // colored by the shooter's team (live gunfire, not static lines).
    const STREAK_LEN = 120; // source units of visible streak behind the bullet
    let tri = 0;
    if (!inOverlay) {
      for (const tr of props.tracers || []) {
        if (tri >= tracerLines.length) break;
        const ln = tracerLines[tri++];
        const arr = ln.geometry.attributes.position.array as Float32Array;
        const pdx = tr.tx - tr.ex;
        const pdy = tr.ty - tr.ey;
        const pdz = tr.tz - tr.ez;
        const pathLen = Math.hypot(pdx, pdy, pdz) || 1;
        const headT = tr.travel;
        const tailT = Math.max(0, headT - STREAK_LEN / pathLen);
        // tail point (source coords) → scene
        wpos(
          {
            x: tr.ex + pdx * tailT,
            y: tr.ey + pdy * tailT,
            z: tr.ez + pdz * tailT,
          },
          _v,
        );
        arr[0] = _v.x;
        arr[1] = _v.y;
        arr[2] = _v.z;
        // head (bullet) point → scene
        wpos(
          {
            x: tr.ex + pdx * headT,
            y: tr.ey + pdy * headT,
            z: tr.ez + pdz * headT,
          },
          _v,
        );
        arr[3] = _v.x;
        arr[4] = _v.y;
        arr[5] = _v.z;
        ln.geometry.attributes.position.needsUpdate = true;
        ln.geometry.computeBoundingSphere();
        const mat = ln.material as THREE.LineBasicMaterial;
        // Hot core rather than flat team colour: a bullet is incandescent, and
        // the team read comes from the muzzle flash and the player it left.
        mat.color.setHex(TEAM(tr.team)).lerp(new THREE.Color(0xfff0cc), 0.42);
        // Once the round has landed the streak has to leave quickly — a line
        // that lingers at the same brightness after impact is the other half of
        // the laser read. In flight it stays bright; after, it drops away fast
        // and hands off to the impact spark.
        const arrived = headT >= 0.999;
        mat.opacity = arrived
          ? Math.pow(tr.fade, 2.4)
          : Math.min(1, tr.fade * 1.2);
        const col = ln.geometry.attributes.color.array as Float32Array;
        const hot = mat.color;
        // tail: transparent, and cooler than the head
        col[0] = hot.r * 0.55;
        col[1] = hot.g * 0.55;
        col[2] = hot.b * 0.55;
        col[3] = 0;
        // head: full brightness
        col[4] = hot.r;
        col[5] = hot.g;
        col[6] = hot.b;
        col[7] = 1;
        ln.geometry.attributes.color.needsUpdate = true;
        ln.visible = true;

        // Muzzle flash: brightest at the instant of firing, gone almost at once.
        const mf: any = muzzleFlashes[tri - 1];
        const flashAmt = Math.max(0, (tr.fade - 0.72) / 0.28);
        if (flashAmt > 0.02) {
          wpos({ x: tr.ex, y: tr.ey, z: tr.ez }, _v);
          mf.position.copy(_v);
          const sz = (34 + 30 * flashAmt) * U;
          mf.scale.set(sz, sz, 1);
          mf.material.opacity = flashAmt;
          mf.visible = true;
          emitLight(_v, 0xffd9a0, 2.6 * flashAmt, 520 * U);
        } else {
          mf.visible = false;
        }

        // Impact spark, once the round has actually arrived somewhere.
        const isp: any = impactSparks[tri - 1];
        if (headT >= 0.999 && tr.fade > 0.05) {
          wpos({ x: tr.tx, y: tr.ty, z: tr.tz }, _v);
          isp.position.copy(_v);
          // A round landing on a player has to read differently from one
          // landing on a wall — same geometry, but bigger, hotter and lit, so
          // the eye registers that the shot connected.
          const punch = tr.hit ? 1 : 0;
          const sz = (26 + 22 * tr.fade + 30 * punch * tr.fade) * U;
          isp.scale.set(sz, sz, 1);
          isp.material.opacity = tr.fade * (0.85 + 0.15 * punch);
          isp.visible = true;
          if (punch && tr.fade > 0.45) {
            emitLight(_v, 0xffe2c0, 2.2 * tr.fade, 340 * U);
          }
        } else {
          isp.visible = false;
        }
      }
    }
    for (let k = tri; k < tracerLines.length; k++) {
      tracerLines[k].visible = false;
      muzzleFlashes[k].visible = false;
      impactSparks[k].visible = false;
    }

    // detonations (volumetric smoke / fire / pops + depleting rings).
    // When utilities are selected, ONLY show the selected ones' effects.
    const selSet = new Set(props.selectedGids || []);
    const selActive = selSet.size > 0;
    const dets = (props.grenades || []).filter(
      (g) =>
        typeOn(g.type) && (!selActive || selSet.has(g.grenade_id as number)),
    );
    let si = 0,
      sv = 0,
      fi = 0,
      pi = 0,
      ti = 0;
    for (const g of dets) {
      const life = g.life ?? 1;
      wpos({ x: g.rx, y: g.ry, z: g.rz }, _v);
      const smokeVol =
        g.type === "Smoke" ? smokeVolFor((g as any).grenade_id) : null;
      if (smokeVol && meshMode && sv < smokeVolumeMeshes.length) {
        // Measured shape, raymarched: the cloud on screen is the same density
        // field the sightline stats were computed from.
        const slot: any = smokeVolumeMeshes[sv++];
        const gid = Number((g as any).grenade_id);
        if (slot.gid !== gid) {
          slot.gid = gid;
          fitSmokeVolume(slot, smokeVol);
        }
        const u = slot.mat.uniforms;
        u.uTint.value.setHex(
          g.thrower_team === "ct"
            ? 0xb8c6da
            : g.thrower_team === "t"
              ? 0xdac8b2
              : 0xc4cdd8,
        );
        // A cloud billows out over about a second; deriving that from
        // remaining-lifetime would stretch it across the smoke's whole 18.
        u.uBloom.value = 0.4 + 0.6 * (g.bloom ?? 1);
        u.uOpacity.value = Math.min(1, life * 3);
        // Billows drift as the cloud ages. Derived from playback, so a paused
        // frame holds still and scrubbing back lands on the same shape.
        u.uDrift.value = (1 - life) * 26 + (g.grenade_id ?? 0) * 3.1;

        const blasts = props.activeBlasts ?? [];
        const n = Math.min(blasts.length, SMOKE_MAX_BLASTS);
        u.uBlastCount.value = n;
        for (let bi = 0; bi < n; bi++) {
          const b = blasts[bi];
          u.uBlast.value[bi].set(b.x, b.y, b.z, b.r);
          u.uBlastFull.value[bi] = b.full;
        }
        slot.mesh.visible = true;
      } else if (g.type === "Smoke" && si < smokeClouds.length) {
        const cl: any = smokeClouds[si++];
        cl.grp.visible = true;
        cl.grp.position.copy(_v).setY(_v.y + SMOKE_R * 0.55);
        // grow smoothly to full over ~0.6s after pop (less "silly")
        const grow = 0.4 + 0.6 * Math.min(1, (1 - life) * 4);
        cl.core.visible = false; // no solid dome — the puff cloud carries it
        // tint the smoke by throwing team (cool grey CT / warm grey T)
        const tint =
          g.thrower_team === "ct"
            ? 0xb8c6da
            : g.thrower_team === "t"
              ? 0xdac8b2
              : 0xc4cdd8;
        const pop = 0.5 * Math.min(1, life * 3);
        for (const sp of cl.puffs) {
          (sp.material as THREE.SpriteMaterial).color.setHex(tint);
          sp.position.set(
            sp.userData.ox * SMOKE_R * grow,
            sp.userData.oy * SMOKE_R * grow,
            sp.userData.oz * SMOKE_R * grow,
          );
          sp.material.opacity = pop;
        }
      } else if (g.type === "Molotov" && fi < fireGroups.length) {
        const fg = fireGroups[fi++];
        fg.grp.visible = true;
        fg.grp.position.copy(_v).setY(_v.y + 2);
        // Fourteen additive sprites at near-full opacity blow out to white
        // under filmic tone mapping; the overlap is what should carry the
        // brightness, not each sprite.
        const op = 0.22 * Math.min(1, life * 2);
        // Flames rise and gutter rather than sitting still. The phase advances
        // with how far the burn has run and is offset per grenade, so the fire
        // is alive while playing, frozen when paused, and identical on a second
        // pass over the same tick.
        const burn = (1 - life) * 52 + (g.grenade_id ?? 0) * 0.7;
        for (const sp of fg.flames) {
          const ph = sp.userData.ph * 6.283 + burn;
          const lick = 0.5 + 0.5 * Math.sin(ph * 3.1);
          sp.position.set(
            sp.userData.ox * FIRE_R,
            FIRE_R * 0.12 * lick,
            sp.userData.oz * FIRE_R,
          );
          const sz = sp.userData.sz * (0.75 + 0.45 * lick);
          sp.scale.set(FIRE_R * sz, FIRE_R * sz * 1.35, 1);
          sp.material.opacity = op * (0.55 + 0.45 * lick);
        }
        // Burning ground throws real light on whatever is around it.
        emitLight(
          _v,
          0xff7a26,
          3.4 * Math.min(1, life * 2) * (0.85 + 0.15 * Math.sin(burn * 5)),
          FIRE_R * 5,
        );
      } else if (
        g.type !== "Smoke" &&
        g.type !== "Molotov" &&
        pi < pops.length
      ) {
        const isFlash = g.type === "Flash";
        // Flash detonates UP IN THE AIR (vertical white ring + airborne glow);
        // HE is a GROUND fireball (orange burst + glow on the deck). Decoy small.
        const p: any = pops[pi++];
        p.grp.visible = true;
        const baseY = isFlash ? _v.y + POP_R * 1.6 : _v.y + 3;
        p.grp.position.copy(_v).setY(baseY);
        const hex = isFlash
          ? 0xfff4d6
          : g.type === "HE"
            ? 0xff5a2a
            : (UTILITY_COL[g.type] ?? 0xffffff);
        // The pressure front expands at the engine's own ~1250 u/s, so the ring
        // crosses a 250-unit influence radius in 0.2s. Previously it was a
        // taste-tuned curve stretched over the whole lifetime, which made an
        // instantaneous blast look like a slow bloom.
        const ageSec = (1 - life) * (isFlash ? 0.5 : g.type === "HE" ? 0.7 : 1);
        const frontU = Math.min(250, ageSec * 1250);
        // popRingGeo is built at POP_R (120 source units), so scaling by
        // frontU/120 puts the ring exactly where the front has reached.
        const ring = Math.max(0.05, frontU / 120);
        const frontFrac = frontU / 250;
        p.ring.scale.set(ring, ring, ring);
        (p.ring.material as THREE.MeshBasicMaterial).color.setHex(hex);
        (p.ring.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, 1 - frontFrac) ** 0.7 * (isFlash ? 1 : 0.85);
        // both get a glow; flash glow is white + airborne, HE is orange on the ground
        p.glow.visible = true;
        const gl = (isFlash ? 1.8 : 1.5) * POP_R;
        p.glow.scale.set(gl, gl, 1);
        p.glow.position.set(0, isFlash ? 0 : POP_R * 0.3, 0);
        (p.glow.material as THREE.SpriteMaterial).color.setHex(hex);
        const fade = isFlash ? life * life * life : life * life;
        (p.glow.material as THREE.SpriteMaterial).opacity =
          Math.max(0, fade) * (isFlash ? 0.9 : 0.8);
        // A detonation lights the room for an instant. Flashbangs are far
        // brighter and whiter than an HE, which is the whole point of them.
        emitLight(
          p.grp.position,
          isFlash ? 0xfff8e8 : 0xff8a3c,
          (isFlash ? 26 : 12) * Math.max(0, fade),
          (isFlash ? 22 : 14) * POP_R,
        );
      }
      if ((g.type === "Smoke" || g.type === "Molotov") && ti < trings.length) {
        const m: any = trings[ti++];
        m.visible = true;
        m.position.copy(_v).setY(_v.y + 1);
        const r = (g.type === "Smoke" ? SMOKE_R : FIRE_R) / SMOKE_R;
        m.scale.set(r, r, r);
        m.material.uniforms.uColor.value.setHex(UTILITY_COL[g.type]);
        m.material.uniforms.uRemain.value = life;
      }
    }
    for (let k = si; k < smokeClouds.length; k++)
      smokeClouds[k].grp.visible = false;
    for (let k = sv; k < smokeVolumeMeshes.length; k++)
      smokeVolumeMeshes[k].mesh.visible = false;
    for (let k = fi; k < fireGroups.length; k++)
      fireGroups[k].grp.visible = false;
    for (let k = pi; k < pops.length; k++) pops[k].grp.visible = false;
    for (let k = ti; k < trings.length; k++) trings[k].visible = false;
    // Anything the frame did not claim goes dark.
    hideUnusedFxLights();

    // Real flames, from the demo's own per-flame positions.
    let fli = 0;
    let glowI = 0;
    const tickNow = props.tick ?? 0;
    const rateNow = props.tickRate ?? 64;
    if (!inOverlay && props.infernos?.length && tickNow) {
      for (const inf of props.infernos) {
        if (!infernoAlive(inf, tickNow)) continue;
        if (selActive && !selSet.has(inf.id as number)) continue;
        const flames = liveFlames(inf, tickNow, rateNow);
        if (!flames.length) continue;

        // One light for the whole burn rather than one per flame — a molotov is
        // a single pool of light, and the pool is small.
        let cx = 0;
        let cy = 0;
        let cz = 0;
        let hot = 0;
        for (const f of flames) {
          cx += f.x;
          cy += f.y;
          cz += f.z;
          hot += f.intensity;
        }
        const n = flames.length;
        wpos({ x: cx / n, y: cy / n, z: cz / n }, _v);
        emitLight(_v, 0xff7a26, 2.2 + 2.4 * (hot / n), 620 * U);

        // The engine gives about sixteen flames spread over ~250 units, so one
        // sprite each would read as a scatter of blobs rather than fire. Each
        // networked flame is an anchor; a few jittered tongues around it fill
        // the gap between anchors. The jitter is derived from the anchor's own
        // position, so the fire is dense but never moves off the ground the
        // demo says burned.
        // Ground glow first: this is what actually reads from overhead.
        for (const f of flames) {
          if (glowI >= flameGlows.length) break;
          const gm: any = flameGlows[glowI++];
          wpos({ x: f.x, y: f.y, z: f.z }, _v);
          gm.position.copy(_v).setY(_v.y + 2 * U);
          const gr = 74 * U * (0.55 + 0.45 * f.intensity);
          gm.scale.set(gr, gr, 1);
          gm.material.opacity = 0.3 * f.intensity;
          gm.visible = true;
        }
        for (const f of flames) {
          for (let sub = 0; sub < FLAME_SUBS; sub++) {
            if (fli >= realFlames.length) break;
            const sp: any = realFlames[fli++];
            const j1 = flameFlicker(f.x + sub * 7.3, f.y, 0);
            const j2 = flameFlicker(f.y + sub * 3.1, f.x, 1);
            const off = sub === 0 ? 0 : FLAME_FILL;
            wpos(
              {
                x: f.x + (j1 - 0.5) * off,
                y: f.y + (j2 - 0.5) * off,
                z: f.z,
              },
              _v,
            );
            // Tongues lick upward on a tick-keyed phase, so fire is alive while
            // playing and frozen when paused.
            const lick = flameFlicker(f.x + sub, f.y, Math.floor(tickNow / 3));
            const h = (22 + 26 * lick) * f.intensity;
            sp.position.copy(_v).setY(_v.y + h * 0.45 * U);
            const w = (30 + 12 * lick) * f.intensity * U;
            sp.scale.set(w, h * 1.5 * U, 1);
            // Additive light sums, so overlapping tongues have to be
            // individually faint or the middle clips to flat white — which is
            // exactly what the old invented flame ring did.
            sp.material.opacity =
              (0.16 + 0.2 * f.intensity * (0.7 + 0.3 * lick)) *
              (sub === 0 ? 1 : 0.7);
            sp.visible = true;
          }
        }
      }
    }
    for (let k = fli; k < realFlames.length; k++) realFlames[k].visible = false;
    for (let k = glowI; k < flameGlows.length; k++)
      flameGlows[k].visible = false;
    // The invented flame ring only runs when there is no recorded fire.
    if (fli > 0) {
      for (const fg of fireGroups) fg.grp.visible = false;
    }

    // in-flight: tumbling 3D grenade model + 3D arc tube (selection-filtered)
    const fl = (props.inFlight || []).filter(
      (g) => typeOn(g.type) && (!selActive || selSet.has(g.gid as number)),
    );
    for (let i = 0; i < projs.length; i++) {
      const g = fl[i];
      if (!g) {
        projs[i].grp.visible = false;
        arcs[i].visible = false;
        arcHeads[i].visible = false;
        continue;
      }
      const hex = UTILITY_COL[g.type] ?? 0xffffff;
      const arc: any = arcs[i];
      // Rebuild the tube only when the slot changes grenade. This used to run
      // every frame — disposing and re-tessellating a 32-segment tube per
      // grenade per frame — which is pure waste, since the flight path is fixed
      // the moment the utility is thrown.
      const arcKey = `${g.key}`;
      if (arc.userData.arcKey !== arcKey) {
        arc.userData.arcKey = arcKey;
        arc.userData.curve = arcCurve(g);
        arc.geometry.dispose();
        arc.geometry = new THREE.TubeGeometry(
          arc.userData.curve,
          ARC_SEGMENTS,
          (6 * U + 1.5) * ARC_RADIUS_MUL,
          ARC_RADIAL,
          false,
        );
      }
      const curve = arc.userData.curve as THREE.Curve<THREE.Vector3>;
      arc.visible = true;
      arc.userData.gid = g.gid ?? null;

      // Reveal the trail only as far as the grenade has actually flown. A
      // TubeGeometry emits its triangles in order along the curve, so a prefix
      // of the index buffer is exactly the flown portion — which turns a static
      // line into the utility drawing its own arc as it travels.
      const prog = Math.max(0, Math.min(1, g.progress));
      // Quantise to whole tube segments and drive BOTH the trail and the
      // grenade from that same value. Revealing the trail by a rounded segment
      // count while positioning the head at the exact fraction let the grenade
      // run ahead of its own trail, which read as the utility arriving before the
      // line caught up.
      // TubeGeometry lays its rings out by getPointAt — arc length — while
      // `progress` is a fraction of flight time, which getPoint consumes. On a
      // bounce path those two parameterisations pull far apart (the throw
      // covers a lot of ground early and little late), which is why the
      // grenade ran out ahead of its own trail. Convert time → arc length once
      // and drive both from it.
      const flownSegs = Math.max(1, Math.round(arcU(curve, prog) * ARC_SEGMENTS));
      const flownT = flownSegs / ARC_SEGMENTS;
      arc.geometry.setDrawRange(0, flownSegs * ARC_RADIAL * 6);

      const m = arc.material as THREE.MeshStandardMaterial;
      m.color.setHex(hex);
      m.emissive.setHex(hex);
      // the grenade model rides the SAME curve as the line (so it never drifts
      // off onto its own path).
      const nm = projs[i];
      curve.getPointAt(flownT, _v);
      nm.grp.visible = true;
      nm.grp.position.copy(_v);
      for (const k in nm.models) nm.models[k].visible = k === g.type;

      // A glow riding the head, so the eye tracks the grenade rather than the
      // line it leaves behind.
      const gl: any = arcHeads[i];
      gl.visible = true;
      gl.position.copy(_v);
      const gs = (26 + 10 * Math.sin(flownT * 22)) * U;
      gl.scale.set(gs, gs, 1);
      gl.material.color.setHex(hex);
      gl.material.opacity = 0.55;
    }

    // heat discs
    let hi = 0;
    if (heatOnOf()) {
      for (const g of props.heatPoints || []) {
        if (!typeOn(g.type) || hi >= heat.length) continue;
        const m = heat[hi++];
        wpos({ x: g.rx, y: g.ry, z: g.rz }, _v);
        m.visible = true;
        m.position.copy(_v).setY(_v.y + 3);
        (m.material as THREE.MeshBasicMaterial).color.setHex(
          UTILITY_COL[g.type] ?? 0xffffff,
        );
        (m.material as THREE.MeshBasicMaterial).opacity = 0.5;
        m.userData.gid = g.gid ?? null;
      }
    }
    for (let k = hi; k < heat.length; k++) heat[k].visible = false;

    // bomb
    if (props.bomb) {
      bombMesh.visible = true;
      wpos(props.bomb, _v);
      bombMesh.position.copy(_v).setY(_v.y + 6 * U);
    } else bombMesh.visible = false;

    // ghosts (thrower at origin + name) + highlighted utility paths.
    // heatmap: a ghost for EVERY round utility (filtered). otherwise: only for
    // selected utilities, plus their full bounce path.
    const sel = new Set(props.selectedGids || []);
    const utils = (props.roundUtilities || []).filter(
      (u) =>
        u.gid != null &&
        typeOn(u.type) &&
        (heatOnOf() || sel.has(u.gid as number)),
    );
    let gi2 = 0;
    for (const u of utils) {
      if (gi2 >= ghosts.length) break;
      const gh = ghosts[gi2];
      const col = TEAM(u.team);
      wpos({ x: u.ox, y: u.oy, z: u.oz }, _v);
      gh.grp.visible = true;
      gh.grp.position.copy(_v);
      gh.mat.color.setHex(col);
      gh.ringMat.color.setHex(col);
      gh.np.redraw(u.name || "");
      // full bounce path — only for explicitly selected utilities (keeps the
      // heatmap from drawing a spaghetti of every line).
      const sa = selArcs[gi2];
      const showPath = sel.has(u.gid as number);
      const pts = showPath && u.gid != null ? trajByGid.get(u.gid) : undefined;
      let curve: THREE.Curve<THREE.Vector3> | null = null;
      if (pts && pts.length >= 2) {
        curve = new THREE.CatmullRomCurve3(
          pts.map((p) => wpos(p).clone()),
          false,
          "centripetal",
        );
      } else if (showPath && u.dx != null) {
        const p0 = wpos({ x: u.ox, y: u.oy, z: u.oz }).clone();
        const p2 = wpos({
          x: u.dx,
          y: u.dy as number,
          z: u.dz as number,
        }).clone();
        const p1 = p0.clone().lerp(p2, 0.5);
        p1.y += p0.distanceTo(p2) * 0.28 + 40 * U;
        curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      }
      if (curve) {
        sa.geometry.dispose();
        sa.geometry = new THREE.TubeGeometry(curve, 48, 9 * U + 2, 8, false);
        sa.visible = true;
        const hex = UTILITY_COL[u.type] ?? 0xffffff;
        const m = sa.material as THREE.MeshStandardMaterial;
        m.color.setHex(hex);
        m.emissive.setHex(hex);
      } else sa.visible = false;
      gi2++;
    }
    for (let k = gi2; k < ghosts.length; k++) ghosts[k].grp.visible = false;
    for (let k = gi2; k < selArcs.length; k++) selArcs[k].visible = false;
  };

  const bombMesh = new THREE.Mesh(
    new THREE.BoxGeometry(22 * U + 4, 12 * U + 3, 30 * U + 4),
    new THREE.MeshStandardMaterial({ color: 0xb9a06a }),
  );
  bombMesh.visible = false;
  scene.add(bombMesh);

  // parent owns camMode; reposition to top-down when it switches to "top",
  // and clear free-look suppression whenever the mode changes.
  setCamMode = (m) => {
    const t = controls.target;
    const d = camera.position.distanceTo(t) || mapSpan * 0.85;
    if (m === "top") {
      camera.position.set(t.x, t.y + d, t.z + 0.01);
    } else if (m === "orbit") {
      // tilt back to a 3/4 perspective so leaving TOP doesn't stay flat
      camera.position.set(t.x, t.y + d * 0.72, t.z + d * 0.72);
    }
  };

  // ===== post-processing =====
  //
  // One bloom pass over the whole scene, with a high threshold so only
  // genuinely hot things (muzzle flashes, fire, flashbangs, tracers) cross it
  // and UI stays crisp.
  //
  // Proper selective bloom — a second scene render with non-glowing objects
  // blacked out — was implemented and measured here, and it was unusable: over
  // four seconds per frame, because it means rendering this map twice and
  // swapping materials across the whole graph every frame. Threshold control is
  // far cheaper and gets most of the way, provided UI colours stay below it.
  //
  // Ambient occlusion was also tried and removed: GTAO at device pixel ratio on
  // a canvas this size ran to seconds per frame, and at the distance this camera
  // sits its radius was too small to see. The map's structure comes from the
  // normal-based tint on its material instead, which costs nothing.
  const FX_PIXEL_RATIO = Math.min(devicePixelRatio, 1);
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(FX_PIXEL_RATIO);
    composer.addPass(new RenderPass(scene, camera));
    // strength, radius, threshold.
    //
    // The threshold has to sit ABOVE 1.0. Bloom runs on the linear HDR target
    // before tone mapping, where a plain white UI sprite — a nameplate, a
    // weapon icon, a health bar — is already 1.0. A threshold below that blooms
    // the entire HUD, which is exactly what happened at 0.94. Only genuinely
    // over-bright things get past this: additive fire and muzzle flashes stack
    // well beyond 1.0, ordinary white does not.
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.65, 1.15);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  } catch (err) {
    console.warn("[replay3d] post-processing unavailable, rendering direct", err);
    composer = null;
  }

  function resize() {
    const w = el.clientWidth || 1,
      h = el.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setSize(w, h);
      composer.setPixelRatio(FX_PIXEL_RATIO);
      bloom?.setSize(w * FX_PIXEL_RATIO, h * FX_PIXEL_RATIO);
    }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  let raf = 0,
    prev = 0;
  const tgt = new THREE.Vector3();
  const loop = (ts: number) => {
    const dt = prev ? Math.min(0.05, (ts - prev) / 1000) : 0.016;
    prev = ts;
    const tsec = ts / 1000;
    applyDolly(dt);
    applyFly(dt);
    const following =
      (camModeOf() === "follow" || !!followSid.value) && !followSuppressed;
    if (following && camToken) {
      camToken.grp.getWorldPosition(tgt);
      tgt.y += PH * 0.5;
      const delta = tgt.clone().sub(controls.target).multiplyScalar(0.18);
      controls.target.add(delta);
      camera.position.add(delta);
    }
    // followed-player highlight: a bright pulsing halo under the chased player
    if (camToken) {
      camToken.grp.getWorldPosition(_v);
      followHalo.visible = true;
      followHalo.position.set(_v.x, _v.y + 2.5, _v.z);
      const s = 1 + 0.1 * Math.sin(tsec * 4.5);
      followHalo.scale.set(s, s, 1);
      (followHalo.material as THREE.MeshBasicMaterial).opacity =
        0.45 + 0.35 * (0.5 + 0.5 * Math.sin(tsec * 4.5));
    } else followHalo.visible = false;
    // roof cut: slider midpoint (50) sits at the auto-detected playable ceiling,
    // so it just works by default; 0 = floor, 100 = full map.
    if (meshMode && meshLoaded) {
      const v = props.ceiling ?? 50;
      // auto ceiling in world-Y (= source z), clamped into the mesh span; fall
      // back to ~25% up the map when player heights weren't available.
      const autoY = Math.min(
        meshMaxY,
        Math.max(
          meshMinY,
          props.autoCeilingZ ?? meshMinY + (meshMaxY - meshMinY) * 0.25,
        ),
      );
      let targetClip;
      if (v >= 100)
        targetClip = 1e9; // full map, no cut
      else if (v >= 50)
        targetClip = autoY + ((meshMaxY - autoY) * (v - 50)) / 50;
      else targetClip = meshMinY + ((autoY - meshMinY) * v) / 50;
      clipY +=
        (targetClip - clipY) * (Math.abs(targetClip - clipY) > 1e6 ? 1 : 0.2);
      ceilingPlane.constant = clipY;
    }
    // grenade tumble (in-flight 3D models)
    for (const nm of projs) {
      if (nm.grp.visible) {
        nm.grp.rotation.x += dt * 7;
        nm.grp.rotation.z += dt * 4.5;
      }
    }
    // smoke drift + fire flicker
    for (const cl of smokeClouds) {
      if (!cl.grp.visible) continue;
      for (const sp of cl.puffs)
        sp.scale.setScalar(
          sp.userData.base *
            SMOKE_R *
            (0.9 + 0.12 * Math.sin(tsec * 1.4 + sp.userData.ph * 6.283)),
        );
    }
    for (const fg of fireGroups) {
      if (!fg.grp.visible) continue;
      for (const sp of fg.flames) {
        const f = 0.8 + 0.3 * Math.sin(tsec * 6 + sp.userData.ph * 6.283);
        sp.scale.setScalar((0.35 + sp.userData.sz) * FIRE_R * 0.6 * f);
        sp.position.y =
          FIRE_R *
          (0.1 + 0.22 * sp.userData.sz) *
          (1 + 0.25 * Math.sin(tsec * 5 + sp.userData.ph * 6.283));
      }
    }
    controls.update();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  apply();

  cleanup = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    for (const slot of smokeVolumeMeshes) slot.tex?.dispose();
    flameGlowGeo.dispose();
    composer?.dispose();
    renderer.dispose();
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    removeEventListener("blur", clearKeys);
    document.removeEventListener("visibilitychange", onVis);
  };
});

// Shallow watch — the source computeds return fresh array refs on change, so
// identity comparison is enough. Deep-watching these (large in overlay mode)
// was a major perf drain.
watch(
  () => [
    props.players,
    props.tracers,
    props.grenades,
    props.inFlight,
    props.bomb,
    props.heatPoints,
    props.grenadeTrajectories,
    props.selectedGids,
    props.roundUtilities,
    props.overlay,
    props.overlayActors,
    props.deaths,
  ],
  () => apply?.(),
);
watch(
  () => [props.heatOn, props.typeFilter],
  () => apply?.(),
  { deep: true },
);

// Follow + camera mode are driven by the shared chrome (props).
watch(
  () => props.focused,
  (sid) => {
    followSid.value = sid ?? null;
    followSuppressed = false;
  },
);
watch(
  () => props.camMode,
  (m) => {
    followSuppressed = false;
    setCamMode?.(m ?? "orbit");
  },
);

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <!-- Pure 3D scene. All chrome (HUD, scoreboard, PBP, transport, filters,
       camera dock) lives in the shared ReplayChrome overlay. -->
  <div class="absolute inset-0">
    <canvas
      ref="canvas"
      class="absolute inset-0 w-full h-full block touch-none"
    />
    <!-- Centered loader while the map mesh downloads (multi-MB .tri) so it's
         obviously working, not broken. -->
    <Transition name="meshload">
      <div
        v-if="loading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[hsl(var(--background)/0.55)] backdrop-blur-[2px] pointer-events-none"
      >
        <div
          class="h-8 w-8 rounded-full border-2 border-white/15 border-t-[hsl(var(--tac-amber))] animate-spin"
        />
        <span
          class="text-[0.65rem] font-mono uppercase tracking-[0.2em] text-white/75"
          >{{ $t("match.replay.loading_map") }}</span
        >
      </div>
    </Transition>
    <div
      v-if="status && !loading"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 text-[0.6rem] font-mono uppercase tracking-wider bg-black/60 text-white/80 pointer-events-none"
    >
      {{ status }}
    </div>
  </div>
</template>

<style scoped>
.meshload-enter-active,
.meshload-leave-active {
  transition: opacity 0.25s ease;
}
.meshload-enter-from,
.meshload-leave-to {
  opacity: 0;
}
</style>
