<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { weaponIconPath } from "~/utilities/weaponIcon";

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
  health?: number | null;
  armor?: number | null;
  helmet?: boolean;
  activeWeapon?: string | null;
  hasBomb?: boolean;
  hasDefuser?: boolean;
};
type Detonation = { rx: number; ry: number; rz: number; type: string; life?: number; grenade_id?: number | null; thrower_team?: string | null };
type InFlight = { key: string; gid?: number | null; type: string; fromX: number; fromY: number; toX: number; toY: number; x: number; y: number; z: number; progress: number };
type HeatPoint = { rx: number; ry: number; rz: number; type: string };

const props = defineProps<{
  players: Player[];
  names?: Record<string, string>;
  grenades?: Detonation[];
  inFlight?: InFlight[];
  heatPoints?: HeatPoint[];
  bomb?: { x: number; y: number; z?: number } | null;
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
  // Real per-grenade bounce path (blob v4+); keyed by grenade_id.
  grenadeTrajectories?: Array<{ gid: number; pts: Array<{ t: number; x: number; y: number; z: number }> }>;
  // Buy-round overlay actors (raw coords) — when present, stacked players from
  // the selected rounds are shown as dots and the normal tokens are hidden.
  overlayActors?: Array<{ x: number; y: number; z: number; team: string | null }>;
  // Selected utilities (grenade_ids) to highlight + show a thrower "ghost" for.
  selectedGids?: number[];
  // Every utility thrown this round (for ghosts/highlight + heatmap).
  roundUtilities?: Array<{
    gid: number | null;
    type: string;
    team: string | null;
    name: string;
    ox: number; oy: number; oz: number;
    dx: number | null; dy: number | null; dz: number | null;
  }>;
  mapMeshUrl?: string | null;
  radarSrc?: string | null;
  resolution?: number;
  project?: (p: { x: number; y: number; z?: number }) => { x: number; y: number };
}>();
const emit = defineEmits<{ (e: "select-util", gid: number): void }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const status = ref("");
const loading = ref(false); // mesh fetch in progress → show centered loader
const followSid = ref<string | null>(null);
const camModeOf = () => props.camMode ?? "orbit";
const heatOnOf = () => props.heatOn ?? false;
const typeOn = (ty: string) => props.typeFilter?.[ty] ?? true;

const C = 1024;
const TEAM = (t: string | null) => (t === "t" ? 0xf5a623 : t === "ct" ? 0x4799eb : 0x9aa0a8);
const NADE_COL: Record<string, number> = { Smoke: 0x32d6e0, Molotov: 0xff6a1a, HE: 0xff3b3b, Flash: 0xffd21a, Decoy: 0x66dd55 };

let cleanup: (() => void) | null = null;
let apply: (() => void) | null = null;
let setCamMode: ((m: "orbit" | "top" | "follow") => void) | null = null;
// set when the user right-drag free-looks, so follow stops fighting the camera
// until the mode/focus changes again.
let followSuppressed = false;

onMounted(() => {
  const el = canvas.value!;
  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.localClippingEnabled = true;

  // Ceiling cut: a horizontal plane that hides map geometry above a height,
  // driven by the chrome's ceiling slider (props.ceiling, 0..100). 100 = off.
  // Only the map material uses it — players/utility are never clipped.
  const ceilingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e9);
  let clipY = 1e9;
  let meshMinY = 0, meshMaxY = 0, meshLoaded = false; // world-Y span of the mesh
  // Geometry whose lowest point is above (auto ceiling + this) is dropped at load
  // — kills sky buildings / super-tall boundary walls while keeping real rooms.
  const CEIL_CULL_MARGIN = 256;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 100000);

  const controls = new OrbitControls(camera, el);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enableZoom = false; // we do inertial zoom by hand (below)
  // Left-drag = free-look (handled manually below); right-drag = orbit;
  // middle-drag = pan. Left no longer orbits (felt bad).
  controls.mouseButtons = {
    LEFT: null as any,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  scene.add(new THREE.HemisphereLight(0xcdd7e5, 0x141820, 1.05));
  const dl = new THREE.DirectionalLight(0xffffff, 0.7);
  dl.position.set(0.5, 1, 0.35);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0x6f86c9, 0.25);
  dl2.position.set(-0.4, 0.6, -0.3);
  scene.add(dl2);

  const meshMode = !!props.mapMeshUrl;
  scene.fog = new THREE.Fog(0x0b0f17, meshMode ? 6000 : 1400, meshMode ? 18000 : 3200);

  // ----- coordinate transform: source coords -> three world -----
  const RES = props.resolution || 1;
  const U = meshMode ? 1 : 1 / RES; // source-unit -> world-unit scale
  let floorRef = 0;
  let floorSet = false;
  const _v = new THREE.Vector3();
  const wpos = (p: { x: number; y: number; z?: number }, out = _v) => {
    if (meshMode) return out.set(p.x, p.z ?? 0, -p.y);
    const g = props.project!(p);
    return out.set(g.x - C / 2, ((p.z ?? floorRef) - floorRef) / RES, g.y - C / 2);
  };
  const PH = meshMode ? 64 : 44;
  const PR = meshMode ? 15 : 9;
  const RING = meshMode ? 30 : 18;

  // ===== free-look (LEFT-drag) + inertial zoom (ported from Replay3D) =====
  // Left-drag turns the camera in place (no orbit — that felt bad). Right-drag
  // orbits via OrbitControls.
  let rl = false, rlx = 0, rly = 0, downX = 0, downY = 0;
  const raycaster = new THREE.Raycaster();
  // A left click (no drag) on a utility line selects it.
  function pickUtilLine(e: PointerEvent) {
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const cand = arcs.filter((a) => a.visible);
    const hits = raycaster.intersectObjects(cand, false);
    const gid = hits[0]?.object.userData?.gid;
    if (gid != null) emit("select-util", gid);
  }
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("pointerdown", (e) => { if (e.button === 0) { rl = true; rlx = e.clientX; rly = e.clientY; downX = e.clientX; downY = e.clientY; } });
  addEventListener("pointerup", (e) => {
    if (e.button !== 0) return;
    rl = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 5) pickUtilLine(e); // click, not drag
  });
  addEventListener("pointermove", (e) => {
    if (!rl) return;
    const dx = e.clientX - rlx, dy = e.clientY - rly; rlx = e.clientX; rly = e.clientY;
    const yAxis = new THREE.Vector3(0, 1, 0);
    if (camModeOf() === "follow" || followSid.value) {
      // While following: orbit the camera AROUND the player (target stays
      // locked on them by the loop) so looking around does NOT stop following.
      const off = new THREE.Vector3().subVectors(camera.position, controls.target);
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
    const off = new THREE.Vector3().subVectors(controls.target, camera.position);
    if (off.lengthSq() < 1e-6) return;
    off.applyAxisAngle(yAxis, -dx * 0.0045);
    const right = new THREE.Vector3().crossVectors(off, yAxis).normalize();
    const newOff = off.clone().applyAxisAngle(right, -dy * 0.0045);
    const pitch = Math.atan2(newOff.y, Math.hypot(newOff.x, newOff.z));
    if (Math.abs(pitch) < 1.45) off.copy(newOff);
    controls.target.copy(camera.position).add(off);
  });
  let dollyAccum = 0;
  el.addEventListener("wheel", (e) => { e.preventDefault(); dollyAccum += Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0011)); }, { passive: false });
  function applyDolly(dt: number) {
    if (Math.abs(dollyAccum) < 1e-4) { dollyAccum = 0; return; }
    const step = dollyAccum * Math.min(1, dt * 14); dollyAccum -= step;
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
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
      (a.tagName === "INPUT" || a.tagName === "SELECT" || a.tagName === "TEXTAREA" || a.isContentEditable)
    );
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping()) return;
    if (e.key === "Shift") { keys.shift = true; return; }
    if (e.key === "Control") { keys.ctrl = true; return; }
    const k = e.key.toLowerCase();
    if (FLY_KEYS.includes(k)) keys[k] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Shift") { keys.shift = false; return; }
    if (e.key === "Control") { keys.ctrl = false; return; }
    keys[e.key.toLowerCase()] = false;
  };
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
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
    status.value = "loading map…";
    loading.value = true;
    fetch(props.mapMeshUrl!)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((buf) => {
        // sanity cap: our decimated meshes are well under this; guards against a
        // malformed/oversized file allocating a huge BufferGeometry and OOMing.
        const MAX_MESH_BYTES = 96 * 1024 * 1024;
        if (buf.byteLength > MAX_MESH_BYTES) throw new Error("mesh too large");
        const raw = new Float32Array(buf, 0, Math.floor(buf.byteLength / 4 / 9) * 9);
        // Cull geometry that sits ENTIRELY above the playable ceiling: roofs,
        // ceilings, sky buildings, and the super-tall boundary/exterior walls
        // that shoot up toward the skybox. Players never reach above
        // autoCeilingZ, so anything wholly above it isn't part of play. (z is the
        // 3rd float of each vertex; source-z = height.) A generous margin keeps
        // real in-play structures; the live ROOF slider trims the rest.
        const cullZ = props.autoCeilingZ != null ? props.autoCeilingZ + CEIL_CULL_MARGIN : Infinity;
        let pos = raw;
        if (isFinite(cullZ)) {
          // height cull: drop triangles wholly above the playable ceiling
          // (roofs/ceilings/sky). Standalone boundary walls are removed offline
          // in the .tri itself (glb-to-tri dropStandaloneWalls).
          const out = new Float32Array(raw.length);
          let n = 0;
          for (let t = 0; t < raw.length; t += 9) {
            if (Math.min(raw[t + 2], raw[t + 5], raw[t + 8]) > cullZ) continue;
            out.set(raw.subarray(t, t + 9), n); n += 9;
          }
          pos = out.slice(0, n);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        // flatShading keeps the nice faceted shading the user likes; the
        // wireframe overlay (polygon lines) was distracting → removed.
        const mat = new THREE.MeshStandardMaterial({ color: 0x2c333f, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, flatShading: true, clippingPlanes: [ceilingPlane] });
        const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2; scene.add(mesh);
        const bb = geo.boundingBox!;
        const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2;
        mapSpan = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
        // world Y = source z (mesh is rotated -π/2 about X); used by the ceiling slider
        meshMinY = bb.min.z; meshMaxY = bb.max.z; meshLoaded = true;
        controls.target.set(cx, cz, -cy);
        camera.position.set(cx, cz + mapSpan * 0.85, -cy + mapSpan * 0.85);
        status.value = ""; loading.value = false;
      })
      .catch((e) => { status.value = `mesh unavailable (${e.message}) — radar fallback`; loading.value = false; buildRadar(); });
  } else buildRadar();

  function buildRadar() {
    if (!props.radarSrc) return;
    const tex = new THREE.TextureLoader().load(props.radarSrc); tex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(C, C), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.96 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    controls.target.set(0, 0, 0); camera.position.set(0, 900, 950);
  }

  // ===== player tokens (figure + nameplate + hp/armor + weapon) =====
  const weaponTexCache: Record<string, THREE.CanvasTexture> = {};
  function weaponTex(weapon: string) {
    const path = weaponIconPath(weapon); if (!path) return null;
    if (weaponTexCache[path]) return weaponTexCache[path];
    const cv = document.createElement("canvas"); cv.width = 96; cv.height = 48;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; weaponTexCache[path] = tex;
    const img = new Image();
    img.onload = () => { const x = cv.getContext("2d")!; x.clearRect(0, 0, 96, 48); const ar = img.width / img.height || 2; let w = 90, h = w / ar; if (h > 46) { h = 46; w = h * ar; } x.drawImage(img, (96 - w) / 2, (48 - h) / 2, w, h); x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, 0, 96, 48); tex.needsUpdate = true; };
    img.src = path; return tex;
  }
  function makeNameplate() {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(PH * 1.9, PH * 0.48, 1); sp.position.y = PH * 1.55; sp.renderOrder = 1002;
    let last = "";
    return { sprite: sp, redraw(text: string) {
      if (text === last) return; last = text; const x = cv.getContext("2d")!; x.clearRect(0, 0, 256, 64);
      x.fillStyle = "rgba(10,13,18,0.82)"; (x as any).roundRect(10, 16, 236, 34, 9); x.fill();
      x.font = "600 25px Oxanium, system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#f4f8fc"; x.fillText(text, 128, 34); tex.needsUpdate = true;
    } };
  }
  function makeHp() {
    const cv = document.createElement("canvas"); cv.width = 220; cv.height = 40; const ctx = cv.getContext("2d")!;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(PH * 1.6, PH * 0.29, 1); sp.position.y = PH * 1.32; sp.renderOrder = 1001;
    let lh = -2, la = -2;
    return { sprite: sp, redraw(hp: number, armor = 0, helmet = false) {
      if (lh >= 0 && Math.abs(hp - lh) < 1.2 && Math.abs(armor - la) < 1.2) return; lh = hp; la = armor;
      ctx.clearRect(0, 0, 220, 40);
      ctx.fillStyle = "rgba(4,6,9,0.72)"; (ctx as any).roundRect(2, 4, 216, 12, 6); ctx.fill();
      const w = Math.max(0, Math.min(1, hp / 100)) * 210; ctx.fillStyle = hp > 60 ? "#48d96e" : hp > 30 ? "#e8c545" : "#e85046"; (ctx as any).roundRect(5, 7, Math.max(2, w), 6, 3); ctx.fill();
      if (armor > 0) { ctx.fillStyle = "rgba(4,6,9,0.72)"; (ctx as any).roundRect(2, 22, 216, 9, 4); ctx.fill(); const aw = Math.max(0, Math.min(1, armor / 100)) * 210; ctx.fillStyle = helmet ? "#7cd4ff" : "#4a90d6"; (ctx as any).roundRect(5, 24, Math.max(2, aw), 5, 2); ctx.fill(); }
      tex.needsUpdate = true;
    } };
  }
  // shared dark material for legs/visor (constant colour)
  const tokenDark = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.7, metalness: 0.05, depthTest: false });
  function buildToken() {
    const grp = new THREE.Group();
    // Low-poly operator figure (legs + tapered torso + head + facing visor).
    // depthTest:false so players are ALWAYS visible through walls/geometry.
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.08, depthTest: false });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(PR * 0.5, PR * 0.42, PH * 0.42, 10), tokenDark); legs.position.y = PH * 0.21; legs.renderOrder = 990; grp.add(legs);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(PR * 0.92, PR * 0.62, PH * 0.42, 14), mat); torso.position.y = PH * 0.6; torso.renderOrder = 990; grp.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(PR * 0.5, 16, 12), mat); head.position.y = PH * 0.9; head.renderOrder = 990; grp.add(head);
    // facing visor — a small wedge at the front of the head
    const visor = new THREE.Mesh(new THREE.ConeGeometry(PR * 0.26, PR * 0.6, 8), tokenDark); visor.rotation.x = Math.PI / 2; visor.position.set(0, PH * 0.9, PR * 0.5); visor.renderOrder = 990; grp.add(visor);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RING, RING * 1.22, 24), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 2; ring.renderOrder = 989; grp.add(ring);
    const np = makeNameplate(); grp.add(np.sprite);
    const hp = makeHp(); grp.add(hp.sprite);
    const wpn = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); wpn.scale.set(PH * 0.95, PH * 0.47, 1); wpn.position.y = PH * 1.78; wpn.renderOrder = 1002; wpn.visible = false; grp.add(wpn);
    grp.visible = false; scene.add(grp);
    return { grp, mat, ringMat, np, hp, wpn };
  }
  const tokens = Array.from({ length: 12 }, buildToken);

  // ===== thrower "ghosts" + highlighted utility paths =====
  function makeGhost() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthTest: false });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(PR, PH * 0.55, 4, 10), mat); body.position.y = PH * 0.5; body.renderOrder = 991; grp.add(body);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RING, RING * 1.3, 24), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 2; ring.renderOrder = 991; grp.add(ring);
    const np = makeNameplate(); grp.add(np.sprite);
    grp.visible = false; scene.add(grp);
    return { grp, mat, ringMat, np };
  }
  const ghosts = Array.from({ length: 32 }, makeGhost);
  // buy-overlay player dots (stacked rounds)
  const overlayDots = Array.from({ length: 80 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(PR * 0.85, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false })); m.visible = false; m.renderOrder = 988; scene.add(m); return m; });
  const selArcs = Array.from({ length: 32 }, () => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.visible = false; m.renderOrder = 999; scene.add(m); return m; });

  // ===== utility effects (volumetric — ported from Replay3D) =====
  const SMOKE_R = 150 * U, FIRE_R = 150 * U, POP_R = 120 * U;
  const SMOKETEX = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!; const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.82)"); g.addColorStop(0.85, "rgba(255,255,255,0.28)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const FIRETEX = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!; const g = x.createRadialGradient(64, 80, 2, 64, 70, 60); g.addColorStop(0, "rgba(255,248,200,1)"); g.addColorStop(0.35, "rgba(255,170,40,0.9)"); g.addColorStop(0.7, "rgba(220,70,20,0.5)"); g.addColorStop(1, "rgba(120,20,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  // drifting smoke clouds: a solid translucent CORE (always visible) + puff
  // sprites for texture.
  const smokeClouds = Array.from({ length: 10 }, () => {
    const grp = new THREE.Group(); const puffs: any[] = []; const N = 24;
    const core: any = new THREE.Mesh(new THREE.SphereGeometry(SMOKE_R * 0.92, 18, 14), new THREE.MeshBasicMaterial({ color: 0xc4cdd8, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
    core.scale.set(1, 0.85, 1); grp.add(core);
    for (let j = 0; j < N; j++) {
      const sp: any = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKETEX, color: 0xdfe6ee, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
      const t = (j + 0.5) / N, inc = Math.acos(1 - 2 * t), az = j * 2.39996, rr = 0.55 + 0.45 * ((j * 0.37) % 1);
      sp.userData = { ox: Math.sin(inc) * Math.cos(az) * rr, oy: Math.cos(inc) * rr * 0.8, oz: Math.sin(inc) * Math.sin(az) * rr, base: 0.55 + 0.35 * ((j * 0.53) % 1), ph: (j * 0.61) % 1 };
      grp.add(sp); puffs.push(sp);
    }
    grp.visible = false; grp.renderOrder = 996; scene.add(grp); return { grp, puffs, core };
  });
  // flickering fire groups (additive flame sprites)
  const fireGroups = Array.from({ length: 6 }, () => {
    const grp = new THREE.Group(); const flames: any[] = [];
    for (let j = 0; j < 14; j++) { const sp: any = new THREE.Sprite(new THREE.SpriteMaterial({ map: FIRETEX, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 })); const a = j * 1.7, r = 0.2 + 0.8 * ((j * 0.37) % 1); sp.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, ph: (j * 0.61) % 1, sz: 0.5 + 0.5 * ((j * 0.29) % 1) }; grp.add(sp); flames.push(sp); }
    grp.visible = false; grp.renderOrder = 996; scene.add(grp); return { grp, flames };
  });
  // pops (HE/flash/decoy): a flat expanding shockwave RING + a brief additive
  // flash GLOW — no dome sphere.
  const popRingGeo = new THREE.RingGeometry(POP_R * 0.86, POP_R, 40);
  const pops = Array.from({ length: 12 }, () => {
    const grp = new THREE.Group();
    const ring: any = new THREE.Mesh(popRingGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const glow: any = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKETEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    grp.add(ring); grp.add(glow); grp.visible = false; grp.renderOrder = 998; scene.add(grp);
    return { grp, ring, glow };
  });
  // depleting ground time ring (radial sweep shader)
  const RING_VERT = "varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
  const RING_FRAG = "varying vec2 vP; uniform float uRemain; uniform vec3 uColor; uniform float uOp; void main(){ float a=atan(vP.x,vP.y)/6.2831853; if(a<0.0)a+=1.0; if(a>uRemain) discard; gl_FragColor=vec4(uColor,uOp); }";
  const ringGeo = new THREE.RingGeometry(SMOKE_R * 0.92, SMOKE_R, 48);
  const trings = Array.from({ length: 16 }, () => { const mat = new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uRemain: { value: 1 }, uColor: { value: new THREE.Color(0xffffff) }, uOp: { value: 0.6 } }, transparent: true, depthTest: false, side: THREE.DoubleSide }); const m: any = new THREE.Mesh(ringGeo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 998; m.visible = false; scene.add(m); return m; });
  // billboarded grenade-type icon textures (white SVG silhouette), cached
  // ===== in-flight grenade: real 3D primitive models that tumble (ported from
  // the old 3D player). Shape reads the type; depthTest off = visible through
  // walls like the lines. =====
  const G = 11 * U; // base grenade dimension
  const nadeMatU = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.15, depthTest: false });
  function makeCanister(hex: number) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(G * 0.55, G * 0.55, G * 1.7, 14), nadeMatU(hex)));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(G * 0.46, G * 0.46, G * 0.45, 14), nadeMatU(0x2a2e34)); cap.position.y = G * 0.95; g.add(cap);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(G * 0.6, G * 0.6, G * 0.2, 14), nadeMatU(0x20242a)); lip.position.y = G * 0.72; g.add(lip);
    return g;
  }
  function makeFrag(hex: number) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(G * 0.8, 14, 12), nadeMatU(hex)); b.scale.set(1, 1.3, 1); g.add(b);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(G * 0.85, G * 0.85, G * 0.3, 14), nadeMatU(0x33373d)); g.add(band);
    return g;
  }
  function makeBottle(hex: number) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(G * 0.55, G * 0.62, G * 1.6, 14), nadeMatU(hex)));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(G * 0.24, G * 0.46, G * 0.7, 10), nadeMatU(hex)); neck.position.y = G; g.add(neck);
    const rag = new THREE.Mesh(new THREE.SphereGeometry(G * 0.3, 8, 6), nadeMatU(0xe8d8b0)); rag.position.y = G * 1.45; g.add(rag);
    return g;
  }
  function makeNadeModels() {
    const grp = new THREE.Group();
    const models: Record<string, THREE.Object3D> = {
      Smoke: makeCanister(NADE_COL.Smoke),
      Flash: makeCanister(NADE_COL.Flash),
      Decoy: makeCanister(NADE_COL.Decoy),
      HE: makeFrag(NADE_COL.HE),
      Molotov: makeBottle(NADE_COL.Molotov),
    };
    for (const k in models) { models[k].visible = false; grp.add(models[k]); }
    grp.visible = false; grp.renderOrder = 1000;
    grp.traverse((o) => { o.renderOrder = 1000; });
    scene.add(grp);
    return { grp, models };
  }
  const projs = Array.from({ length: 12 }, makeNadeModels);
  const arcMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.45, metalness: 0.1, transparent: true, opacity: 0.32, depthTest: false, side: THREE.DoubleSide });
  const arcs = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.BufferGeometry(), arcMat()); m.frustumCulled = false; m.visible = false; m.renderOrder = 997; scene.add(m); return m; });
  // heat discs
  const heat = Array.from({ length: 64 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(60 * U, 18), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 995; scene.add(m); return m; });

  // gid -> real bounce path (blob v4+). When present we draw the true
  // bouncing flight line; otherwise fall back to a smooth synthetic arc.
  const trajByGid = new Map<number, Array<{ x: number; y: number; z: number }>>();
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
  function arcCurve(a: InFlight) {
    const pts = a.gid != null ? trajByGid.get(a.gid) : undefined;
    if (pts && pts.length >= 2) {
      // draw the FULL real bounce path (smooth) — slicing per-frame made it
      // jitter as points appeared; the projectile head shows the live spot.
      return new THREE.CatmullRomCurve3(pts.map((p) => wpos(p).clone()), false, "centripetal");
    }
    const p0 = wpos({ x: a.fromX, y: a.fromY, z: 0 }).clone();
    const p2 = wpos({ x: a.toX, y: a.toY, z: 0 }).clone();
    const lift = p0.distanceTo(p2) * 0.28 + 40 * U;
    const p1 = p0.clone().lerp(p2, 0.5); p1.y += lift;
    return new THREE.QuadraticBezierCurve3(p0, p1, p2);
  }

  // ===== per-frame data push =====
  let camToken: { grp: THREE.Group } | null = null;
  apply = () => {
    refreshTraj();
    const ps = props.players || [];
    const names = props.names || {};
    if (!meshMode && !floorSet) { let m = Infinity; for (const p of ps) if (p.alive && p.z < m) m = p.z; if (m !== Infinity) { floorRef = m; floorSet = true; } }
    let followTok: { grp: THREE.Group } | null = null;
    const ov = props.overlayActors || [];
    const inOverlay = ov.length > 0;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i]; const p = ps[i];
      if (inOverlay || !p || !p.alive) { tk.grp.visible = false; continue; }
      tk.grp.visible = true; wpos(p, _v); tk.grp.position.copy(_v);
      const a = (p.yaw * Math.PI) / 180; tk.grp.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a));
      const col = TEAM(p.team); tk.mat.color.setHex(col); tk.ringMat.color.setHex(col);
      const nm = names[p.steamId] || ""; tk.np.redraw(nm);
      tk.hp.redraw(p.health ?? 100, p.armor ?? 0, p.helmet === true);
      const wt = p.activeWeapon ? weaponTex(p.activeWeapon) : null;
      if (wt) { (tk.wpn.material as THREE.SpriteMaterial).map = wt; tk.wpn.visible = true; } else tk.wpn.visible = false;
      if (followSid.value && p.steamId === followSid.value) followTok = tk;
    }
    camToken = followTok;

    // buy-overlay player dots (stacked rounds)
    let di = 0;
    if (inOverlay) {
      for (const a of ov) {
        if (di >= overlayDots.length) break;
        const d = overlayDots[di++]; wpos(a, _v); d.visible = true; d.position.copy(_v).setY(_v.y + PR);
        (d.material as THREE.MeshBasicMaterial).color.setHex(TEAM(a.team));
      }
    }
    for (let k = di; k < overlayDots.length; k++) overlayDots[k].visible = false;

    // detonations (volumetric smoke / fire / pops + depleting rings).
    // When utilities are selected, ONLY show the selected ones' effects.
    const selSet = new Set(props.selectedGids || []);
    const selActive = selSet.size > 0;
    const dets = (props.grenades || []).filter((g) => typeOn(g.type) && (!selActive || selSet.has(g.grenade_id as number)));
    let si = 0, fi = 0, pi = 0, ti = 0;
    for (const g of dets) {
      const life = g.life ?? 1; wpos({ x: g.rx, y: g.ry, z: g.rz }, _v);
      if (g.type === "Smoke" && si < smokeClouds.length) {
        const cl: any = smokeClouds[si++]; cl.grp.visible = true; cl.grp.position.copy(_v).setY(_v.y + SMOKE_R * 0.55);
        // grow smoothly to full over ~0.6s after pop (less "silly")
        const grow = 0.4 + 0.6 * Math.min(1, (1 - life) * 4);
        cl.core.visible = false; // no solid dome — the puff cloud carries it
        // tint the smoke by throwing team (cool grey CT / warm grey T)
        const tint = g.thrower_team === "ct" ? 0xb8c6da : g.thrower_team === "t" ? 0xdac8b2 : 0xc4cdd8;
        const pop = 0.5 * Math.min(1, life * 3);
        for (const sp of cl.puffs) { (sp.material as THREE.SpriteMaterial).color.setHex(tint); sp.position.set(sp.userData.ox * SMOKE_R * grow, sp.userData.oy * SMOKE_R * grow, sp.userData.oz * SMOKE_R * grow); sp.material.opacity = pop; }
      } else if (g.type === "Molotov" && fi < fireGroups.length) {
        const fg = fireGroups[fi++]; fg.grp.visible = true; fg.grp.position.copy(_v).setY(_v.y + 2);
        const op = 0.95 * Math.min(1, life * 2);
        for (const sp of fg.flames) { sp.position.set(sp.userData.ox * FIRE_R, 0, sp.userData.oz * FIRE_R); sp.material.opacity = op; }
      } else if (g.type !== "Smoke" && g.type !== "Molotov" && pi < pops.length) {
        const isFlash = g.type === "Flash";
        // Flash detonates UP IN THE AIR (vertical white ring + airborne glow);
        // HE is a GROUND fireball (orange burst + glow on the deck). Decoy small.
        const p: any = pops[pi++]; p.grp.visible = true;
        const baseY = isFlash ? _v.y + POP_R * 1.6 : _v.y + 3;
        p.grp.position.copy(_v).setY(baseY);
        const hex = isFlash ? 0xfff4d6 : g.type === "HE" ? 0xff5a2a : NADE_COL[g.type] ?? 0xffffff;
        const wide = isFlash ? 2.2 : g.type === "HE" ? 1.8 : 1.1;
        const ring = 0.25 + (1 - life) * wide;
        p.ring.scale.set(ring, ring, ring);
        (p.ring.material as THREE.MeshBasicMaterial).color.setHex(hex);
        (p.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, life * life) * (isFlash ? 1 : 0.85);
        // both get a glow; flash glow is white + airborne, HE is orange on the ground
        p.glow.visible = true;
        const gl = (isFlash ? 1.8 : 1.5) * POP_R;
        p.glow.scale.set(gl, gl, 1); p.glow.position.set(0, isFlash ? 0 : POP_R * 0.3, 0);
        (p.glow.material as THREE.SpriteMaterial).color.setHex(hex);
        const fade = isFlash ? life * life * life : life * life;
        (p.glow.material as THREE.SpriteMaterial).opacity = Math.max(0, fade) * (isFlash ? 0.9 : 0.8);
      }
      if ((g.type === "Smoke" || g.type === "Molotov") && ti < trings.length) { const m: any = trings[ti++]; m.visible = true; m.position.copy(_v).setY(_v.y + 1); const r = (g.type === "Smoke" ? SMOKE_R : FIRE_R) / SMOKE_R; m.scale.set(r, r, r); m.material.uniforms.uColor.value.setHex(NADE_COL[g.type]); m.material.uniforms.uRemain.value = life; }
    }
    for (let k = si; k < smokeClouds.length; k++) smokeClouds[k].grp.visible = false;
    for (let k = fi; k < fireGroups.length; k++) fireGroups[k].grp.visible = false;
    for (let k = pi; k < pops.length; k++) pops[k].grp.visible = false;
    for (let k = ti; k < trings.length; k++) trings[k].visible = false;

    // in-flight: tumbling 3D grenade model + 3D arc tube (selection-filtered)
    const fl = (props.inFlight || []).filter((g) => typeOn(g.type) && (!selActive || selSet.has(g.gid as number)));
    for (let i = 0; i < projs.length; i++) {
      const g = fl[i];
      if (!g) { projs[i].grp.visible = false; arcs[i].visible = false; continue; }
      const hex = NADE_COL[g.type] ?? 0xffffff;
      const curve = arcCurve(g); const tube = new THREE.TubeGeometry(curve, 32, 6 * U + 1.5, 6, false);
      arcs[i].geometry.dispose(); arcs[i].geometry = tube; arcs[i].visible = true; arcs[i].userData.gid = g.gid ?? null;
      const m = arcs[i].material as THREE.MeshStandardMaterial; m.color.setHex(hex); m.emissive.setHex(hex);
      // the grenade model rides the SAME curve as the line (so it never drifts
      // off onto its own path).
      const nm = projs[i];
      curve.getPoint(Math.max(0, Math.min(1, g.progress)), _v);
      nm.grp.visible = true; nm.grp.position.copy(_v);
      for (const k in nm.models) nm.models[k].visible = k === g.type;
    }

    // heat discs
    let hi = 0;
    if (heatOnOf()) { for (const g of props.heatPoints || []) { if (!typeOn(g.type) || hi >= heat.length) continue; const m = heat[hi++]; wpos({ x: g.rx, y: g.ry, z: g.rz }, _v); m.visible = true; m.position.copy(_v).setY(_v.y + 3); (m.material as THREE.MeshBasicMaterial).color.setHex(NADE_COL[g.type] ?? 0xffffff); (m.material as THREE.MeshBasicMaterial).opacity = 0.5; } }
    for (let k = hi; k < heat.length; k++) heat[k].visible = false;

    // bomb
    if (props.bomb) { bombMesh.visible = true; wpos(props.bomb, _v); bombMesh.position.copy(_v).setY(_v.y + 6 * U); } else bombMesh.visible = false;

    // ghosts (thrower at origin + name) + highlighted utility paths.
    // heatmap: a ghost for EVERY round utility (filtered). otherwise: only for
    // selected utilities, plus their full bounce path.
    const sel = new Set(props.selectedGids || []);
    const utils = (props.roundUtilities || []).filter(
      (u) => u.gid != null && typeOn(u.type) && (heatOnOf() || sel.has(u.gid as number)),
    );
    let gi2 = 0;
    for (const u of utils) {
      if (gi2 >= ghosts.length) break;
      const gh = ghosts[gi2];
      const col = TEAM(u.team);
      wpos({ x: u.ox, y: u.oy, z: u.oz }, _v);
      gh.grp.visible = true; gh.grp.position.copy(_v);
      gh.mat.color.setHex(col); gh.ringMat.color.setHex(col);
      gh.np.redraw(u.name || "");
      // full bounce path — only for explicitly selected utilities (keeps the
      // heatmap from drawing a spaghetti of every line).
      const sa = selArcs[gi2];
      const showPath = sel.has(u.gid as number);
      const pts = showPath && u.gid != null ? trajByGid.get(u.gid) : undefined;
      let curve: THREE.Curve<THREE.Vector3> | null = null;
      if (pts && pts.length >= 2) {
        curve = new THREE.CatmullRomCurve3(pts.map((p) => wpos(p).clone()), false, "centripetal");
      } else if (showPath && u.dx != null) {
        const p0 = wpos({ x: u.ox, y: u.oy, z: u.oz }).clone();
        const p2 = wpos({ x: u.dx, y: u.dy as number, z: u.dz as number }).clone();
        const p1 = p0.clone().lerp(p2, 0.5); p1.y += p0.distanceTo(p2) * 0.28 + 40 * U;
        curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      }
      if (curve) {
        sa.geometry.dispose();
        sa.geometry = new THREE.TubeGeometry(curve, 48, 9 * U + 2, 8, false);
        sa.visible = true;
        const hex = NADE_COL[u.type] ?? 0xffffff;
        const m = sa.material as THREE.MeshStandardMaterial; m.color.setHex(hex); m.emissive.setHex(hex);
      } else sa.visible = false;
      gi2++;
    }
    for (let k = gi2; k < ghosts.length; k++) ghosts[k].grp.visible = false;
    for (let k = gi2; k < selArcs.length; k++) selArcs[k].visible = false;
  };

  const bombMesh = new THREE.Mesh(new THREE.BoxGeometry(22 * U + 4, 12 * U + 3, 30 * U + 4), new THREE.MeshStandardMaterial({ color: 0xb9a06a }));
  bombMesh.visible = false; scene.add(bombMesh);

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

  function resize() { const w = el.clientWidth || 1, h = el.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); }
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  let raf = 0, prev = 0;
  const tgt = new THREE.Vector3();
  const loop = (ts: number) => {
    const dt = prev ? Math.min(0.05, (ts - prev) / 1000) : 0.016; prev = ts;
    const tsec = ts / 1000;
    applyDolly(dt);
    applyFly(dt);
    const following = (camModeOf() === "follow" || !!followSid.value) && !followSuppressed;
    if (following && camToken) { camToken.grp.getWorldPosition(tgt); tgt.y += PH * 0.5; const delta = tgt.clone().sub(controls.target).multiplyScalar(0.18); controls.target.add(delta); camera.position.add(delta); }
    // roof cut: slider midpoint (50) sits at the auto-detected playable ceiling,
    // so it just works by default; 0 = floor, 100 = full map.
    if (meshMode && meshLoaded) {
      const v = props.ceiling ?? 50;
      // auto ceiling in world-Y (= source z), clamped into the mesh span; fall
      // back to ~25% up the map when player heights weren't available.
      const autoY = Math.min(
        meshMaxY,
        Math.max(meshMinY, props.autoCeilingZ ?? meshMinY + (meshMaxY - meshMinY) * 0.25),
      );
      let targetClip;
      if (v >= 100) targetClip = 1e9; // full map, no cut
      else if (v >= 50) targetClip = autoY + ((meshMaxY - autoY) * (v - 50)) / 50;
      else targetClip = meshMinY + ((autoY - meshMinY) * v) / 50;
      clipY += (targetClip - clipY) * (Math.abs(targetClip - clipY) > 1e6 ? 1 : 0.2);
      ceilingPlane.constant = clipY;
    }
    // grenade tumble (in-flight 3D models)
    for (const nm of projs) { if (nm.grp.visible) { nm.grp.rotation.x += dt * 7; nm.grp.rotation.z += dt * 4.5; } }
    // smoke drift + fire flicker
    for (const cl of smokeClouds) { if (!cl.grp.visible) continue; for (const sp of cl.puffs) sp.scale.setScalar(sp.userData.base * SMOKE_R * (0.9 + 0.12 * Math.sin(tsec * 1.4 + sp.userData.ph * 6.283))); }
    for (const fg of fireGroups) { if (!fg.grp.visible) continue; for (const sp of fg.flames) { const f = 0.8 + 0.3 * Math.sin(tsec * 6 + sp.userData.ph * 6.283); sp.scale.setScalar((0.35 + sp.userData.sz) * FIRE_R * 0.6 * f); sp.position.y = FIRE_R * (0.1 + 0.22 * sp.userData.sz) * (1 + 0.25 * Math.sin(tsec * 5 + sp.userData.ph * 6.283)); } }
    controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop); apply();

  cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); removeEventListener("keydown", onKeyDown); removeEventListener("keyup", onKeyUp); };
});

// Shallow watch — the source computeds return fresh array refs on change, so
// identity comparison is enough. Deep-watching these (large in overlay mode)
// was a major perf drain.
watch(() => [props.players, props.grenades, props.inFlight, props.bomb, props.heatPoints, props.grenadeTrajectories, props.selectedGids, props.roundUtilities, props.overlayActors], () => apply?.());
watch(() => [props.heatOn, props.typeFilter], () => apply?.(), { deep: true });

// Follow + camera mode are driven by the shared chrome (props).
watch(
  () => props.focused,
  (sid) => { followSid.value = sid ?? null; followSuppressed = false; },
);
watch(
  () => props.camMode,
  (m) => { followSuppressed = false; setCamMode?.(m ?? "orbit"); },
);

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <!-- Pure 3D scene. All chrome (HUD, scoreboard, PBP, transport, filters,
       camera dock) lives in the shared ReplayChrome overlay. -->
  <div class="absolute inset-0">
    <canvas ref="canvas" class="absolute inset-0 w-full h-full block" />
    <!-- Centered loader while the map mesh downloads (multi-MB .tri) so it's
         obviously working, not broken. -->
    <Transition name="meshload">
      <div
        v-if="loading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[hsl(var(--background)/0.55)] backdrop-blur-[2px] pointer-events-none"
      >
        <div class="h-8 w-8 rounded-full border-2 border-white/15 border-t-[hsl(var(--tac-amber))] animate-spin" />
        <span class="text-[0.65rem] font-mono uppercase tracking-[0.2em] text-white/75">loading map…</span>
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
.meshload-leave-active { transition: opacity 0.25s ease; }
.meshload-enter-from,
.meshload-leave-to { opacity: 0; }
</style>

