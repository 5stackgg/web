import * as THREE from "three";
import { createStageCursor } from "./cursor";
import type { CursorMode, StageCursor } from "./cursor";
import { frameShot, nextStory, placeOf, shotAt, versusOf } from "./director";
import type {
  DirectorLabel,
  DirectorReplay,
  PlannedShot,
  RoundPlan,
  ShotKind,
  ShotLook,
} from "./director";
import { pickMapHeight } from "./map";
import { drawnBounds, frameArea } from "./mapFrame";
import { pickPlayer } from "./pick";
import type { PlayerPick } from "./pick";
import type { StageContext, StageFrame, StageModule, Vec3 } from "./types";

/**
 * The camera's keys, for a shortcuts list: `keys` are what to print, `view`
 * where they do anything. V only works once `onViewKey` is wired, B once the
 * owner turns broadcast mode on and off with it (`setDirector`).
 */
export const CAMERA_KEYS = [
  { action: "pan", keys: ["W", "A", "S", "D"], view: "both" },
  { action: "rotate", keys: ["Q", "E"], view: "3d" },
  { action: "tilt", keys: ["R", "F"], view: "3d" },
  { action: "zoom", keys: ["Z", "X", "+", "-"], view: "both" },
  { action: "faster", keys: ["Shift"], view: "both" },
  { action: "frame", keys: ["0", "Home"], view: "both" },
  { action: "follow", keys: ["C"], view: "both" },
  { action: "view", keys: ["V"], view: "both" },
  { action: "broadcast", keys: ["B"], view: "both" },
] as const;

/**
 * The camera rig. It orbits a ground target: `heading` turns it (0 looks
 * north), `pitch` tilts it (90 is straight down, which is the 2D view, north
 * up and east right like the CS radar) and `distance` zooms it.
 *
 * Every move eases with a critically damped spring, so following the action
 * never jitters and plays the same at any framerate. `place` pins it exactly
 * where it is told (the harness), and nothing moves it after that but input.
 * Wheel zooms toward the cursor, drag pans, right-drag (two fingers on touch)
 * orbits and tilts in 3D, pinch zooms, held keys fly it (`CAMERA_KEYS`); any
 * of it pauses follow. A click (or tap) on a player reports them.
 */
export type CameraModule = StageModule & {
  /** Pins the camera: eye and target in source units, no easing. */
  place(eye: Vec3, target: Vec3): void;
  /**
   * Where the camera is, for `place` to put it back (share links); null
   * while it still shows the whole map as framed on load.
   */
  pose(): { eye: Vec3; target: Vec3 } | null;
  /** Frames the whole map. */
  frameMap(animate?: boolean): void;
  /**
   * Centres on `target` (source units). `radius` is how much ground around
   * it stays in view; without it the zoom is kept.
   */
  focus(target: Vec3, radius?: number, animate?: boolean): void;
  /** Track the selected player, or the fight when nobody is selected. */
  setFollow(on: boolean): void;
  readonly following: boolean;
  /** Called whenever follow turns on or off, input included. */
  onFollowChange(listener: (following: boolean) => void): () => void;
  /** Lets input move the camera. On by default. */
  setControls(enabled: boolean): void;
  /** Lets held keys move the camera (with controls on). On by default. */
  setKeyboard(enabled: boolean): void;
  /** Jumps to where the camera is heading. */
  snap(): void;
  /** The player under the pointer, if any. */
  readonly hoveredPlayer: string | null;
  /** Called when the player under the pointer changes. */
  onPlayerHover(listener: (id: string | null) => void): () => void;
  /** Called when a player is clicked or tapped (not dragged). */
  onPlayerClick(listener: (id: string) => void): () => void;
  /**
   * Called when a click or tap lands on no player, with where (canvas CSS
   * px) and how far off a target may be, for overlays to pick their own.
   */
  onClick(listener: (x: number, y: number, slop: number) => void): () => void;
  /** Called on V, for the owner to switch 2D and 3D. */
  onViewKey(listener: () => void): () => void;
  /**
   * Broadcast mode: the camera frames the round's planned shots (see
   * director.ts). Any camera input, or following a player, pauses it.
   */
  setDirector(on: boolean): void;
  /** The round's plan; the frames' ticks look their shot up in it. */
  setDirectorPlan(plan: RoundPlan | null): void;
  readonly directing: boolean;
  /** Called whenever the director starts or stops, input included. */
  onDirectorChange(listener: (directing: boolean) => void): () => void;
  /** What the director shows, when it changes; null once it stops. */
  onDirectorShot(listener: (label: DirectorLabel | null) => void): () => void;
  /**
   * An instant replay the plan offers, as playback passes its offer tick
   * (forward play only, never on a scrub).
   */
  onDirectorReplay(listener: (offer: DirectorReplay) => void): () => void;
  /**
   * Shows an offered replay from a new angle: tighter, from another side,
   * until it is over. The clock's owner rewinds to `offer.fromTick` and
   * plays it.
   */
  replay(offer: DirectorReplay): void;
};

type Rig = {
  /** Look-at point, world space. */
  target: THREE.Vector3;
  distance: number;
  /** Radians; 0 looks north (-z world). */
  heading: number;
  /** Radians above the horizon; PI/2 is straight down. */
  pitch: number;
};

const FOV = 42;
const PITCH_3D = (64 * Math.PI) / 180;
const PITCH_2D = Math.PI / 2;
const PITCH_MIN = (22 * Math.PI) / 180;
const MIN_DISTANCE = 450;
/** Zoom range while following a player. */
const FOLLOW_MIN = 700;
const FOLLOW_MAX = 2800;
const ACTION_MIN_RADIUS = 520;

/** How the director's shots look in 3D: tilt, by kind. */
const SHOT_PITCH: Record<ShotKind, number> = {
  wide: 64,
  standoff: 58,
  duel: 54,
  clutch: 54,
  defuse: 54,
  fight: 58,
  plant: 58,
  bomb: 60,
  execute: 62,
  utility: 62,
  retake: 62,
};
/** A 3D shot orbits this slowly, radians per second, turning each cut the other way. */
const SHOT_DRIFT = 0.026;
/** The most a cut turns the camera, so it never flips to the far side. */
const SHOT_MAX_TURN = (120 * Math.PI) / 180;
/** Crossing the map, the camera rises by this share of the way left. */
const SWOOP = 0.75;
/** An instant replay: this much tighter, turned this far round, this much lower. */
const REPLAY_TIGHT = 0.7;
const REPLAY_TURN = Math.PI * 0.6;
const REPLAY_DIP = (12 * Math.PI) / 180;

/** Seconds each part of the rig takes to settle. */
const EASE = { target: 0.22, distance: 0.18, angle: 0.32 };
const FOLLOW_EASE = { target: 0.45, distance: 0.9, angle: 0.32 };
const DIRECTOR_EASE = { target: 0.5, distance: 0.85, angle: 1.3 };

/** Press-to-release travel under which a press is a click, CSS px. */
const CLICK_SLOP = 4;

type KeyAxis = "x" | "y" | "turn" | "tilt" | "zoom";

/**
 * Held keys, by physical position so WASD sits under the hand on any layout.
 * Q turns like dragging left, R raises the camera toward straight down.
 */
const KEY_AXES: Record<string, [KeyAxis, number]> = {
  KeyW: ["y", 1],
  KeyS: ["y", -1],
  KeyD: ["x", 1],
  KeyA: ["x", -1],
  KeyQ: ["turn", 1],
  KeyE: ["turn", -1],
  KeyR: ["tilt", 1],
  KeyF: ["tilt", -1],
  KeyZ: ["zoom", 1],
  KeyX: ["zoom", -1],
  Equal: ["zoom", 1],
  NumpadAdd: ["zoom", 1],
  Minus: ["zoom", -1],
  NumpadSubtract: ["zoom", -1],
};
/** Layouts that put + and - elsewhere. */
const KEY_CHARS: Record<string, [KeyAxis, number]> = {
  "+": ["zoom", 1],
  "-": ["zoom", -1],
};
/**
 * Full speed, per second: pans a share of the view distance, turns and tilts
 * radians, zooms e-folds. Shift is `KEY_BOOST` times that.
 */
const KEY_RATE = { pan: 0.8, turn: 1.6, tilt: 0.9, zoom: 1.3 };
const KEY_BOOST = 3;
const KEY_AXIS_LIST: KeyAxis[] = ["x", "y", "turn", "tilt", "zoom"];
/** Seconds held keys take to reach speed, and to stop once let go. */
const KEY_RISE = 0.1;
const KEY_FALL = 0.12;

/** Text entry and widgets that read letters (menus, listboxes) keep their keys. */
function typing(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (target.isContentEditable || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (
    tag === "INPUT" &&
    !["range", "checkbox", "radio", "button", "submit", "reset"].includes(
      (target as HTMLInputElement).type,
    )
  ) {
    return true;
  }
  return !!target.closest('[role="menu"],[role="listbox"],[role="combobox"]');
}

/**
 * Critically damped spring toward `to` (Game Programming Gems 4, 1.10):
 * no overshoot, and stable at any dt.
 */
function damp(
  from: number,
  to: number,
  velocity: { v: number },
  smoothTime: number,
  dt: number,
) {
  // A NaN would otherwise ride the spring forever.
  if (!Number.isFinite(from) || !Number.isFinite(velocity.v)) {
    velocity.v = 0;
    return to;
  }
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = from - to;
  const temp = (velocity.v + omega * change) * dt;
  velocity.v = (velocity.v - omega * temp) * decay;
  const next = to + (change + temp) * decay;
  if (Math.abs(next - to) < 1e-4 && Math.abs(velocity.v) < 1e-3) {
    velocity.v = 0;
    return to;
  }
  return next;
}

function wrapAngle(a: number) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

export function createCameraModule(): CameraModule {
  let ctx: StageContext | null = null;
  const current: Rig = {
    target: new THREE.Vector3(),
    distance: 4000,
    heading: 0,
    pitch: PITCH_3D,
  };
  const goal: Rig = {
    target: new THREE.Vector3(),
    distance: 4000,
    heading: 0,
    pitch: PITCH_3D,
  };
  const velocity = {
    x: { v: 0 },
    y: { v: 0 },
    z: { v: 0 },
    distance: { v: 0 },
    heading: { v: 0 },
    pitch: { v: 0 },
  };
  let pinned = false;
  let framed = false;
  /** Still showing the whole map as framed on load, untouched. */
  let overview = false;
  let following = false;
  let controls = true;
  let lastClock: number | null = null;
  let floorZ = 0;
  const listeners = new Set<(following: boolean) => void>();
  const hoverListeners = new Set<(id: string | null) => void>();
  const clickListeners = new Set<(id: string) => void>();
  const blankClickListeners = new Set<
    (x: number, y: number, slop: number) => void
  >();
  const viewKeyListeners = new Set<() => void>();
  let plan: RoundPlan | null = null;
  let directing = false;
  const directorListeners = new Set<(directing: boolean) => void>();
  const shotListeners = new Set<(label: DirectorLabel | null) => void>();
  const replayListeners = new Set<(offer: DirectorReplay) => void>();
  /** The tick of the last frame directed, to see playback pass offers. */
  let directedTick: number | null = null;
  /** Place names, per shot. */
  const places = new WeakMap<PlannedShot, string | null>();
  /** The replay being shown, and whether to cut straight to its angle. */
  let replaying: DirectorReplay | null = null;
  let replayCut = false;
  let shownLabel: DirectorLabel | null = null;
  /** The shot (and view, and replay or not) the 3D angle was picked for. */
  let angleFor: {
    shot: PlannedShot;
    view: string;
    replay: boolean;
  } | null = null;
  let shotHeading = 0;
  let shotPitch = PITCH_3D;
  let shotClock = 0;
  let shotTurn = 1;
  let cursor: StageCursor | null = null;
  /** The frame on screen, for picking players between renders. */
  let shownFrame: StageFrame | null = null;
  const pick: PlayerPick = { id: null, x: 0, y: 0, r: 0 };

  // Scratch, so nothing allocates per frame.
  const probe = new THREE.PerspectiveCamera(FOV, 1, 4, 60000);
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hitA = new THREE.Vector3();
  const hitB = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  function bounds() {
    const map = ctx?.map;
    if (!map || !Number.isFinite(map.min.x) || !Number.isFinite(map.max.x)) {
      return null;
    }
    return map;
  }

  /** The play area and the title band south of it (see mapFrame.ts). */
  function playArea() {
    const map = bounds();
    // The screen's shape picks the side a stacked map's lower storey goes.
    return map ? frameArea(map, ctx?.camera.aspect) : null;
  }

  /** The floor height play mostly happens at: the callout boxes' bottoms, by area. */
  function playFloor() {
    const map = bounds();
    const boxes = map?.callouts.flatMap((c) => c.boxes) ?? [];
    if (!boxes.length) {
      return null;
    }
    const weighted = boxes
      .map((b) => ({
        z: b.min[2],
        w: (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]),
      }))
      .sort((a, b) => a.z - b.z);
    const total = weighted.reduce((sum, b) => sum + b.w, 0);
    let seen = 0;
    for (const b of weighted) {
      seen += b.w;
      if (seen >= total / 2) {
        return b.z;
      }
    }
    return null;
  }

  function mapSpan() {
    const map = bounds();
    return map
      ? Math.max(
          map.max.x - map.min.x,
          map.max.y - map.min.y,
          map.max.z - map.min.z,
        )
      : 20000;
  }

  /** How far back the play area fits on screen at `pitch`. */
  function fitDistance(pitch: number) {
    const map = playArea();
    if (!ctx || !map) {
      return 20000;
    }
    const tanV = Math.tan((ctx.camera.fov * Math.PI) / 360);
    const tanH = tanV * ctx.camera.aspect;
    const spanX = map.max.x - map.min.x;
    const spanY = (map.max.y - map.min.y) * Math.sin(pitch);
    // A tilted view magnifies the near (south) edge: more room there.
    const margin = pitch < PITCH_2D - 0.01 ? 1.14 : 1.04;
    return Math.max(spanX / 2 / tanH, spanY / 2 / tanV) * margin;
  }

  function maxDistance() {
    return Math.max(MIN_DISTANCE * 4, fitDistance(PITCH_2D) * 1.6);
  }

  function pitchFloor() {
    return ctx?.view === "2d" ? PITCH_2D : PITCH_MIN;
  }

  function clampRig(rig: Rig) {
    // Bad frame data must not leave a NaN goal: the camera stays where it is.
    const keep = rig === goal ? current : goal;
    if (!Number.isFinite(rig.distance)) {
      rig.distance = keep.distance;
    }
    if (!Number.isFinite(rig.heading)) {
      rig.heading = keep.heading;
    }
    if (!Number.isFinite(rig.pitch)) {
      rig.pitch = keep.pitch;
    }
    if (!Number.isFinite(rig.target.x + rig.target.y + rig.target.z)) {
      rig.target.copy(keep.target);
    }
    rig.distance = Math.min(
      maxDistance(),
      Math.max(MIN_DISTANCE, rig.distance),
    );
    rig.pitch = Math.min(PITCH_2D, Math.max(pitchFloor(), rig.pitch));
    const loaded = bounds();
    // A lower storey laid beside the map is somewhere to look too.
    const map = loaded && drawnBounds(loaded);
    if (map) {
      // World x = source x, world z = -source y.
      rig.target.x = Math.min(map.max.x, Math.max(map.min.x, rig.target.x));
      rig.target.z = Math.min(-map.min.y, Math.max(-map.max.y, rig.target.z));
      rig.target.y = Math.min(map.max.z, Math.max(map.min.z, rig.target.y));
    }
  }

  /** Puts a camera where a rig says. */
  function apply(rig: Rig, camera: THREE.PerspectiveCamera) {
    euler.set(-rig.pitch, rig.heading, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
    offset.set(0, 0, rig.distance).applyQuaternion(camera.quaternion);
    camera.position.copy(rig.target).add(offset);
    camera.near = Math.max(4, rig.distance * 0.04);
    camera.far = rig.distance + mapSpan() * 4;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  function copyRig(from: Rig, to: Rig) {
    to.target.copy(from.target);
    to.distance = from.distance;
    to.heading = from.heading;
    to.pitch = from.pitch;
  }

  function snap() {
    copyRig(goal, current);
    for (const v of Object.values(velocity)) {
      v.v = 0;
    }
    if (ctx) {
      apply(current, ctx.camera);
    }
  }

  /** Distance that fits a ground circle of `radius` in view. */
  function distanceFor(radius: number) {
    if (!ctx) {
      return radius * 2.6;
    }
    const tanV = Math.tan((ctx.camera.fov * Math.PI) / 360);
    const tanH = tanV * ctx.camera.aspect;
    return radius / Math.min(tanV, tanH);
  }

  function frameMap(animate = false) {
    const map = playArea();
    if (!ctx || !map) {
      return;
    }
    pinned = false;
    framed = true;
    overview = true;
    const pitch = ctx.view === "2d" ? PITCH_2D : PITCH_3D;
    goal.target.set(
      (map.min.x + map.max.x) / 2,
      floorZ,
      -(map.min.y + map.max.y) / 2,
    );
    goal.distance = fitDistance(pitch);
    goal.heading = 0;
    goal.pitch = pitch;
    clampRig(goal);
    if (!animate) {
      snap();
    }
  }

  function place(eye: Vec3, target: Vec3) {
    if (!ctx) {
      return;
    }
    const e = ctx.wpos(eye, tmp.clone());
    const t = ctx.wpos(target, goal.target);
    const d = e.sub(t);
    goal.distance = Math.max(1, d.length());
    goal.pitch = Math.asin(Math.min(1, Math.max(-1, d.y / goal.distance)));
    if (Math.hypot(d.x, d.z) > 1e-3) {
      goal.heading = Math.atan2(d.x, d.z);
    }
    pinned = true;
    framed = true;
    overview = false;
    following = false;
    snap();
  }

  function focus(target: Vec3, radius?: number, animate = true) {
    if (!ctx) {
      return;
    }
    pinned = false;
    framed = true;
    overview = false;
    ctx.wpos(target, goal.target);
    if (radius) {
      goal.distance = distanceFor(radius);
    }
    clampRig(goal);
    if (!animate) {
      snap();
    }
  }

  function setFollowing(on: boolean) {
    if (on) {
      // Picking a player is taking the camera from the director.
      setDirecting(false);
      pinned = false;
      overview = false;
      // Keys still gliding would fight the follow.
      releaseKeys();
      keyVel.x = keyVel.y = keyVel.turn = keyVel.tilt = keyVel.zoom = 0;
    }
    if (following === on) {
      return;
    }
    following = on;
    for (const listener of listeners) {
      listener(on);
    }
  }

  function takeControl() {
    pinned = false;
    overview = false;
    setFollowing(false);
    setDirecting(false);
  }

  // --- broadcast -----------------------------------------------------------

  function setShown(label: DirectorLabel | null) {
    if (
      label === shownLabel ||
      (label &&
        shownLabel &&
        label.kind === shownLabel.kind &&
        label.place === shownLabel.place &&
        label.versus === shownLabel.versus &&
        label.player === shownLabel.player &&
        label.weapon === shownLabel.weapon &&
        label.next?.kind === shownLabel.next?.kind &&
        label.next?.place === shownLabel.next?.place)
    ) {
      return;
    }
    shownLabel = label;
    for (const listener of shotListeners) {
      listener(label);
    }
  }

  function setDirecting(on: boolean) {
    if (on) {
      pinned = false;
      setFollowing(false);
      releaseKeys();
      keyVel.x = keyVel.y = keyVel.turn = keyVel.tilt = keyVel.zoom = 0;
    }
    if (directing === on) {
      return;
    }
    directing = on;
    angleFor = null;
    replaying = null;
    directedTick = null;
    if (!on) {
      setShown(null);
    }
    for (const listener of directorListeners) {
      listener(on);
    }
  }

  /** The heading a cut looks from: `look` if it has one, turned no further than it must. */
  function cutHeading(look: ShotLook | null) {
    const from = current.heading;
    if (!look) {
      return from;
    }
    // Looking along source (x, y) is heading atan2(-x, y).
    let turn = wrapAngle(Math.atan2(-look.x, look.y) - from);
    if (look.either && Math.abs(turn) > Math.PI / 2) {
      turn = wrapAngle(turn + Math.PI);
    }
    return from + Math.max(-SHOT_MAX_TURN, Math.min(SHOT_MAX_TURN, turn));
  }

  /** Whether `frame` is inside the replay being shown; drops it once outside. */
  function inReplay(frame: StageFrame) {
    const r = replaying;
    if (!r) {
      return false;
    }
    const inside =
      frame.tick != null &&
      frame.tick >= r.fromTick - 1 &&
      frame.tick <= r.untilTick;
    if (!inside && !replayCut) {
      replaying = null;
    }
    return inside;
  }

  function placeFor(shot: PlannedShot) {
    if (!places.has(shot)) {
      places.set(
        shot,
        shot.kind === "wide" ? null : placeOf(shot.focus, ctx!.map?.callouts),
      );
    }
    return places.get(shot)!;
  }

  function labelFor(shot: PlannedShot, frame: StageFrame): DirectorLabel {
    const next =
      plan &&
      frame.tick != null &&
      (shot.kind === "wide" || shot.kind === "standoff")
        ? nextStory(plan, frame.tick, 6)
        : null;
    return {
      kind: shot.kind,
      place: placeFor(shot),
      // Once the clutch is decided, it keeps the count it was played at.
      versus:
        shot.kind === "clutch"
          ? (versusOf(frame.players) ?? shownLabel?.versus ?? null)
          : null,
      // Who wins a fight is only named once it is won.
      player:
        shot.protagonist &&
        (shot.keyTick === null ||
          shot.kind === "clutch" ||
          shot.kind === "defuse" ||
          (frame.tick ?? 0) >= shot.keyTick)
          ? (frame.players.find((p) => p.id === shot.protagonist)?.name ?? null)
          : null,
      weapon: shot.weapon,
      next: next ? { kind: next.kind, place: placeFor(next) } : null,
    };
  }

  /** Offers the plan's replays as playback passes them, forward only. */
  function offerReplays(frame: StageFrame) {
    const tick = frame.tick ?? null;
    const last = directedTick;
    directedTick = tick;
    if (
      !plan ||
      tick === null ||
      last === null ||
      tick <= last ||
      tick - last > 0.6 * frame.tickRate
    ) {
      return;
    }
    for (const offer of plan.replays) {
      if (last < offer.offerTick && offer.offerTick <= tick) {
        for (const listener of replayListeners) {
          listener(offer);
        }
      }
    }
  }

  function directorGoal(frame: StageFrame, clock: number) {
    const replay = inReplay(frame);
    if (!replay) {
      offerReplays(frame);
    }
    const shot = replay
      ? replaying!.shot
      : plan && frame.tick != null
        ? shotAt(plan, frame.tick)
        : null;
    if (!shot || !frame.players.length) {
      setShown(null);
      return;
    }
    setShown(labelFor(shot, frame));
    // Framed where things are drawn (ctx.wpos), in source axes.
    const framing = frameShot(shot, frame.players, (p) => {
      const w = ctx!.wpos(p, tmp);
      return { x: w.x, y: -w.z, z: w.y };
    });
    goal.target.set(framing.target.x, framing.target.z, -framing.target.y);
    const radius = framing.radius * (replay ? REPLAY_TIGHT : 1);
    // Crossing the map, rise with the travel so the cut reads as one move.
    const travel = Math.hypot(
      current.target.x - goal.target.x,
      current.target.z - goal.target.z,
    );
    goal.distance = replay
      ? distanceFor(radius)
      : Math.max(distanceFor(radius), travel * SWOOP);
    if (ctx!.view === "2d") {
      goal.heading = 0;
      goal.pitch = PITCH_2D;
    } else {
      if (
        angleFor?.shot !== shot ||
        angleFor.view !== ctx!.view ||
        angleFor.replay !== replay
      ) {
        angleFor = { shot, view: ctx!.view, replay };
        shotHeading = cutHeading(shot.look) + (replay ? REPLAY_TURN : 0);
        shotPitch =
          (SHOT_PITCH[shot.kind] * Math.PI) / 180 - (replay ? REPLAY_DIP : 0);
        shotClock = clock;
        shotTurn = shot.id % 2 ? 1 : -1;
      }
      goal.heading = shotHeading + SHOT_DRIFT * shotTurn * (clock - shotClock);
      goal.pitch = shotPitch;
    }
    // A replay opens on a cut, the way a broadcast does.
    if (replay && replayCut) {
      replayCut = false;
      clampRig(goal);
      snap();
    }
  }

  function stopTargetEase() {
    velocity.x.v = velocity.y.v = velocity.z.v = 0;
  }

  // --- following -----------------------------------------------------------

  function followGoal(frame: StageFrame) {
    const selected = frame.players.find((p) => p.selected && p.alive);
    if (selected) {
      ctx!.wpos(selected, goal.target);
      goal.distance = Math.min(FOLLOW_MAX, Math.max(FOLLOW_MIN, goal.distance));
      return;
    }
    // The fight: where shots, damage, kills and bangs are, freshest first.
    let w = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    const add = (p: Vec3, weight: number) => {
      if (weight <= 0) {
        return;
      }
      w += weight;
      x += p.x * weight;
      y += p.y * weight;
      z += p.z * weight;
    };
    for (const s of frame.shots) {
      const k = 1 - s.age;
      add(s.from, k);
      if (s.hit) {
        add(s.to, k);
      }
    }
    for (const d of frame.damages) {
      add(d.at, 1.5 * (1 - d.age / 2));
    }
    for (const k of frame.kills) {
      add(k.at, 2 * (1 - k.age / 3));
    }
    for (const d of frame.detonations) {
      add(d.at, 1 - d.age / 2);
    }
    if (w <= 0) {
      return;
    }
    x /= w;
    y /= w;
    z /= w;
    let spread = 0;
    let sw = 0;
    const measure = (p: Vec3, weight: number) => {
      if (weight > 0) {
        spread += ((p.x - x) ** 2 + (p.y - y) ** 2) * weight;
        sw += weight;
      }
    };
    for (const s of frame.shots) {
      measure(s.from, 1 - s.age);
      if (s.hit) {
        measure(s.to, 1 - s.age);
      }
    }
    for (const d of frame.damages) {
      measure(d.at, 1.5 * (1 - d.age / 2));
    }
    // Where the fight is drawn: a lower storey laid beside the map is shifted.
    ctx!.wpos({ x, y, z }, goal.target);
    // Kills and bangs alone weigh the centre but have no spread.
    const radius =
      sw > 0
        ? Math.max(ACTION_MIN_RADIUS, Math.sqrt(spread / sw) * 1.8 + 260)
        : ACTION_MIN_RADIUS;
    goal.distance = Math.min(FOLLOW_MAX * 1.4, distanceFor(radius));
  }

  // --- input ---------------------------------------------------------------

  const pointers = new Map<number, { x: number; y: number }>();
  let dragMode: "pan" | "orbit" | null = null;
  /** Where the press began, until it moves far enough to be a drag. */
  let press: { x: number; y: number; button: number } | null = null;
  /** A mouse or pen over the canvas, canvas CSS px; touch never hovers. */
  let hoverX = 0;
  let hoverY = 0;
  let hovering = false;
  let hovered: string | null = null;
  /** The canvas box, measured on entry and when something may have moved it. */
  let rect: DOMRect | null = null;
  let gesture: {
    distance: number;
    angle: number;
    mx: number;
    my: number;
  } | null = null;
  /**
   * World height of what the gesture took hold of, so a roof under the cursor
   * stays under it rather than sliding against the floor below.
   */
  let grabY: number | null = null;
  let wheelGrabUntil = 0;

  function element() {
    return ctx?.renderer.domElement ?? null;
  }

  function canvasRect() {
    rect ??= element()!.getBoundingClientRect();
    return rect;
  }

  function forgetRect() {
    rect = null;
  }

  function toNdc(clientX: number, clientY: number) {
    const box = canvasRect();
    return ndc.set(
      ((clientX - box.left) / box.width) * 2 - 1,
      -((clientY - box.top) / box.height) * 2 + 1,
    );
  }

  /** Writes the canvas CSS px under a client position into hoverX/hoverY. */
  function toCanvas(clientX: number, clientY: number) {
    const box = canvasRect();
    hoverX = ((clientX - box.left) * (ctx?.width ?? box.width)) / box.width;
    hoverY = ((clientY - box.top) * (ctx?.height ?? box.height)) / box.height;
  }

  function playerAt(x: number, y: number, slop: number) {
    return !!ctx &&
      !!shownFrame &&
      pickPlayer(
        ctx,
        shownFrame.players,
        x,
        y,
        slop,
        pick,
        shownFrame.levelBand,
      )
      ? pick.id
      : null;
  }

  function setHovered(id: string | null) {
    if (hovered === id) {
      return;
    }
    hovered = id;
    for (const listener of hoverListeners) {
      listener(id);
    }
  }

  /** Re-picks under a still pointer too: players and the camera move. */
  function updateHover() {
    const dragging = pointers.size > 0 && !press;
    if (!hovering || dragging || !controls) {
      setHovered(null);
      cursor?.untarget();
      return;
    }
    setHovered(playerAt(hoverX, hoverY, 3));
    if (hovered) {
      cursor?.target(pick.x, pick.y, pick.r);
    } else {
      cursor?.untarget();
    }
  }

  function paintCursor() {
    if (!cursor) {
      return;
    }
    let mode: CursorMode = "idle";
    if (pointers.size && !press) {
      mode = dragMode === "orbit" && ctx?.view === "3d" ? "orbit" : "pan";
    } else if (keyKind === "pan" || keyKind === "orbit" || keyKind === "tilt") {
      mode = keyKind;
    } else if (hovered) {
      mode = "player";
    }
    cursor.set(mode);
    cursor.following(following);
  }

  /**
   * Height of what the map draws under the cursor, once per gesture. Only a
   * pan needs it: a zoom toward the cursor moves the eye along the cursor's
   * own ray, whatever height it holds.
   */
  function grab(clientX: number, clientY: number) {
    grabY = null;
    const map = ctx?.map;
    if (!ctx || !map) {
      return;
    }
    raycaster.setFromCamera(toNdc(clientX, clientY), ctx.camera);
    grabY = pickMapHeight(map, raycaster.ray);
  }

  /** Ground point under a client position, seen from `rig`. */
  function groundAt(
    rig: Rig,
    clientX: number,
    clientY: number,
    out: THREE.Vector3,
  ) {
    if (!element() || !ctx) {
      return null;
    }
    probe.fov = ctx.camera.fov;
    probe.aspect = ctx.camera.aspect;
    apply(rig, probe);
    raycaster.setFromCamera(toNdc(clientX, clientY), probe);
    plane.constant = -(grabY ?? rig.target.y);
    return raycaster.ray.intersectPlane(plane, out);
  }

  /** Zooms `rig` by `factor`, keeping the ground under the cursor still. */
  function zoomAt(rig: Rig, factor: number, clientX: number, clientY: number) {
    const before = groundAt(rig, clientX, clientY, hitA);
    rig.distance *= factor;
    clampRig(rig);
    const after = before && groundAt(rig, clientX, clientY, hitB);
    if (before && after) {
      rig.target.add(before.sub(after));
      clampRig(rig);
    }
  }

  function panBy(fromX: number, fromY: number, toX: number, toY: number) {
    const a = groundAt(current, fromX, fromY, hitA);
    const b = a && groundAt(current, toX, toY, hitB);
    if (!a || !b) {
      return;
    }
    a.sub(b);
    a.y = 0;
    goal.target.copy(current.target).add(a);
    clampRig(goal);
    current.target.copy(goal.target);
    stopTargetEase();
  }

  function orbitBy(dx: number, dy: number) {
    goal.heading -= dx * 0.006;
    goal.pitch += dy * 0.005;
    clampRig(goal);
  }

  function onWheel(event: WheelEvent) {
    if (!controls) {
      return;
    }
    event.preventDefault();
    takeControl();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    // Trackpad pinches arrive as ctrl+wheel with small deltas.
    const speed = event.ctrlKey ? 0.01 : 0.0015;
    const delta = Math.max(-300, Math.min(300, event.deltaY * unit));
    const now = performance.now();
    if (now > wheelGrabUntil && !pointers.size) {
      grab(event.clientX, event.clientY);
    }
    wheelGrabUntil = now + 300;
    zoomAt(goal, Math.exp(delta * speed), event.clientX, event.clientY);
    cursor?.zoom(delta < 0);
  }

  function gestureOf() {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
  }

  function onPointerDown(event: PointerEvent) {
    const el = element();
    if (!controls || !el) {
      return;
    }
    el.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (event.pointerType === "touch") {
      hovering = false;
      cursor?.show(false);
    }
    if (pointers.size === 1) {
      forgetRect();
      grab(event.clientX, event.clientY);
    }
    // A click (picking a player) is not taking the camera; a drag is.
    press =
      pointers.size === 1
        ? { x: event.clientX, y: event.clientY, button: event.button }
        : null;
    cursor?.pressed(!!press && !!hovered);
    if (pointers.size === 2) {
      takeControl();
      dragMode = null;
      gesture = gestureOf();
    } else if (pointers.size === 1) {
      const orbit =
        event.button === 2 ||
        event.button === 1 ||
        (event.button === 0 && (event.shiftKey || event.altKey));
      dragMode = orbit ? "orbit" : "pan";
    }
    paintCursor();
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType !== "touch" && controls) {
      // A canvas that mounted under a still pointer never saw it enter.
      if (!hovering) {
        onPointerEnter(event);
      }
      toCanvas(event.clientX, event.clientY);
      cursor?.move(event.clientX, event.clientY);
    }
    const last = pointers.get(event.pointerId);
    if (!last || !controls) {
      return;
    }
    const now = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      if (press) {
        if (Math.hypot(now.x - press.x, now.y - press.y) < CLICK_SLOP) {
          return;
        }
        press = null;
        cursor?.pressed(false);
        takeControl();
        updateHover();
        paintCursor();
      }
      if (dragMode === "pan" || ctx?.view === "2d") {
        panBy(last.x, last.y, now.x, now.y);
      } else if (dragMode === "orbit") {
        orbitBy(now.x - last.x, now.y - last.y);
      }
      pointers.set(event.pointerId, now);
      return;
    }
    pointers.set(event.pointerId, now);
    if (pointers.size !== 2 || !gesture) {
      return;
    }
    const next = gestureOf();
    if (ctx?.view === "3d") {
      // Two fingers: pinch zooms, twist turns, sliding together tilts.
      goal.heading += wrapAngle(next.angle - gesture.angle);
      goal.pitch += (next.my - gesture.my) * 0.005;
      clampRig(goal);
    } else {
      panBy(gesture.mx, gesture.my, next.mx, next.my);
    }
    if (gesture.distance > 0 && next.distance > 0) {
      zoomAt(goal, gesture.distance / next.distance, next.mx, next.my);
      current.distance = goal.distance;
      current.target.copy(goal.target);
      velocity.distance.v = 0;
      stopTargetEase();
    }
    gesture = next;
  }

  function onPointerUp(event: PointerEvent) {
    const el = element();
    const click =
      event.type === "pointerup" &&
      controls &&
      press?.button === 0 &&
      pointers.size === 1 &&
      pointers.has(event.pointerId);
    if (el?.hasPointerCapture?.(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    forget(event.pointerId);
    cursor?.pressed(false);
    if (click) {
      toCanvas(event.clientX, event.clientY);
      const slop = event.pointerType === "touch" ? 12 : 3;
      const id = playerAt(hoverX, hoverY, slop);
      if (id) {
        for (const listener of clickListeners) {
          listener(id);
        }
      } else {
        for (const listener of blankClickListeners) {
          listener(hoverX, hoverY, slop);
        }
      }
    }
    paintCursor();
  }

  /**
   * Capture can go without an up or cancel reaching us (the canvas left the
   * page, the browser took the touch): a pointer left behind would turn the
   * next one-finger drag into a pinch.
   */
  function onLostCapture(event: PointerEvent) {
    forget(event.pointerId);
  }

  function forget(pointerId: number) {
    if (!pointers.delete(pointerId)) {
      return;
    }
    press = null;
    gesture = pointers.size === 2 ? gestureOf() : null;
    if (pointers.size === 1) {
      // Lifting one finger of a pinch carries on as a pan, not a jump.
      dragMode = "pan";
    } else if (pointers.size === 0) {
      dragMode = null;
    }
  }

  function onContextMenu(event: Event) {
    event.preventDefault();
  }

  function onPointerEnter(event: PointerEvent) {
    forgetRect();
    if (event.pointerType === "touch" || !controls) {
      return;
    }
    mountCursor();
    hovering = true;
    toCanvas(event.clientX, event.clientY);
    cursor?.show(true);
    cursor?.move(event.clientX, event.clientY);
    paintCursor();
  }

  function onPointerLeave() {
    hovering = false;
    cursor?.show(false);
    updateHover();
  }

  // --- keys ----------------------------------------------------------------

  /** Held keys by `code`, with what each drives. */
  const held = new Map<string, [KeyAxis, number]>();
  let boost = false;
  let keyboard = true;
  /** Eased key input, -1..1 times the boost. */
  const keyVel = { x: 0, y: 0, turn: 0, tilt: 0, zoom: 0 };
  const keyIn = { x: 0, y: 0, turn: 0, tilt: 0, zoom: 0 };
  let keyKind: "pan" | "orbit" | "tilt" | "zoom" | null = null;

  function addKey(entry: [KeyAxis, number]) {
    keyIn[entry[0]] += entry[1];
  }

  function releaseKeys() {
    held.clear();
    boost = false;
  }

  /** Does `axis` move anything in this view? 2D stays north up and flat. */
  function keyApplies(axis: KeyAxis) {
    return ctx?.view === "3d" || (axis !== "turn" && axis !== "tilt");
  }

  function keysLive() {
    const el = element();
    return (
      keyboard &&
      controls &&
      !!el?.isConnected &&
      el.getClientRects().length > 0
    );
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      // macOS sends no keyup for keys let go while Cmd is down.
      if (event.key === "Meta") {
        releaseKeys();
      }
      return;
    }
    boost = event.shiftKey;
    if (!keysLive() || typing(event.target)) {
      return;
    }
    const axis = KEY_AXES[event.code] ?? KEY_CHARS[event.key];
    if (axis) {
      if (keyApplies(axis[0]) && !held.has(event.code)) {
        held.set(event.code, axis);
        takeControl();
      }
      return;
    }
    if (event.repeat) {
      return;
    }
    if (
      event.code === "Digit0" ||
      event.code === "Numpad0" ||
      event.key === "Home"
    ) {
      event.preventDefault();
      takeControl();
      frameMap(true);
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "c") {
      setFollowing(!following);
    } else if (key === "v") {
      for (const listener of viewKeyListeners) {
        listener();
      }
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    boost = event.shiftKey;
    held.delete(event.code);
  }

  function onVisibility() {
    if (document.hidden) {
      releaseKeys();
    }
  }

  function onFocusIn(event: FocusEvent) {
    if (typing(event.target)) {
      releaseKeys();
    }
  }

  /** Flies the rig on held keys; velocities ease in and out over real time. */
  function driveKeys(dt: number) {
    keyIn.x = keyIn.y = keyIn.turn = keyIn.tilt = keyIn.zoom = 0;
    held.forEach(addKey);
    const pan = Math.hypot(keyIn.x, keyIn.y);
    const gain = boost ? KEY_BOOST : 1;
    // Diagonals are no faster than straight.
    const panGain = pan > 1 ? gain / pan : gain;
    let moving = false;
    let strongest = 0;
    keyKind = null;
    for (const axis of KEY_AXIS_LIST) {
      if (!keyApplies(axis)) {
        keyVel[axis] = 0;
        continue;
      }
      const want =
        Math.max(-1, Math.min(1, keyIn[axis])) *
        (axis === "x" || axis === "y" ? panGain : gain);
      const tau = Math.abs(want) > Math.abs(keyVel[axis]) ? KEY_RISE : KEY_FALL;
      keyVel[axis] += (want - keyVel[axis]) * (1 - Math.exp(-dt / tau));
      if (Math.abs(keyVel[axis]) < 0.01 && want === 0) {
        keyVel[axis] = 0;
        continue;
      }
      moving = true;
      // The cursor lets go of a key's state well before its glide ends.
      const weight = Math.abs(keyVel[axis]);
      if (weight > Math.max(strongest, 0.2)) {
        strongest = weight;
        keyKind =
          axis === "turn"
            ? "orbit"
            : axis === "tilt"
              ? "tilt"
              : axis === "zoom"
                ? "zoom"
                : "pan";
      }
    }
    if (!moving) {
      return;
    }
    // Moves goal and current together, so any ease in flight carries on.
    if (keyVel.x || keyVel.y) {
      const step = current.distance * KEY_RATE.pan * dt;
      const sin = Math.sin(current.heading);
      const cos = Math.cos(current.heading);
      const bx = goal.target.x;
      const bz = goal.target.z;
      goal.target.x += (cos * keyVel.x - sin * keyVel.y) * step;
      goal.target.z += (-sin * keyVel.x - cos * keyVel.y) * step;
      clampRig(goal);
      current.target.x += goal.target.x - bx;
      current.target.z += goal.target.z - bz;
    }
    if (keyVel.turn) {
      const turn = keyVel.turn * KEY_RATE.turn * dt;
      goal.heading += turn;
      current.heading += turn;
    }
    if (keyVel.tilt) {
      const before = goal.pitch;
      goal.pitch += keyVel.tilt * KEY_RATE.tilt * dt;
      clampRig(goal);
      current.pitch += goal.pitch - before;
    }
    if (keyVel.zoom) {
      const before = goal.distance;
      goal.distance *= Math.exp(-keyVel.zoom * KEY_RATE.zoom * dt);
      clampRig(goal);
      current.distance *= goal.distance / before;
    }
    if (cursor) {
      if (keyKind === "zoom") {
        cursor.zoom(keyVel.zoom > 0);
      } else if (keyKind === "orbit") {
        cursor.steer(-keyVel.turn * 6, 0);
      } else if (keyKind === "tilt") {
        cursor.steer(0, -keyVel.tilt * 6);
      }
    }
  }

  function mountCursor() {
    const el = element();
    if (!cursor && el?.parentElement) {
      cursor = createStageCursor(el.parentElement, el);
      cursor.enable(controls);
    }
  }

  function attach(el: HTMLCanvasElement) {
    el.style.touchAction = "none";
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onLostCapture);
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("pointerenter", onPointerEnter);
    el.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseKeys);
    window.addEventListener("scroll", forgetRect, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", forgetRect);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("focusin", onFocusIn);
    mountCursor();
  }

  function detach(el: HTMLCanvasElement) {
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
    el.removeEventListener("lostpointercapture", onLostCapture);
    el.removeEventListener("contextmenu", onContextMenu);
    el.removeEventListener("pointerenter", onPointerEnter);
    el.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", releaseKeys);
    window.removeEventListener("scroll", forgetRect, { capture: true });
    window.removeEventListener("resize", forgetRect);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("focusin", onFocusIn);
    cursor?.destroy();
    cursor = null;
  }

  /** Area-weighted median height of upward faces: where the floor mostly is. */
  function typicalFloor(tri: Float32Array | null, fallback: number) {
    if (!tri || !tri.length) {
      return fallback;
    }
    const bucket = 16;
    const weights = new Map<number, number>();
    let total = 0;
    for (let i = 0; i < tri.length; i += 9) {
      const ux = tri[i + 3] - tri[i];
      const uy = tri[i + 4] - tri[i + 1];
      const uz = tri[i + 5] - tri[i + 2];
      const vx = tri[i + 6] - tri[i];
      const vy = tri[i + 7] - tri[i + 1];
      const vz = tri[i + 8] - tri[i + 2];
      const nz = ux * vy - uy * vx;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const area = Math.hypot(nx, ny, nz);
      if (area <= 0 || Math.abs(nz) / area < 0.8) {
        continue;
      }
      const z = Math.round((tri[i + 2] + tri[i + 5] + tri[i + 8]) / 3 / bucket);
      weights.set(z, (weights.get(z) ?? 0) + area);
      total += area;
    }
    let seen = 0;
    for (const z of [...weights.keys()].sort((a, b) => a - b)) {
      seen += weights.get(z)!;
      if (seen >= total / 2) {
        return z * bucket;
      }
    }
    return fallback;
  }

  return {
    name: "camera",
    init(context) {
      ctx = context;
      ctx.camera.fov = FOV;
      goal.pitch = current.pitch = ctx.view === "2d" ? PITCH_2D : PITCH_3D;
      attach(ctx.renderer.domElement);
      apply(current, ctx.camera);
    },
    onMap(context) {
      const map = context.map;
      floorZ = map
        ? (playFloor() ?? typicalFloor(map.tri, (map.min.z + map.max.z) / 2))
        : 0;
      if (!pinned) {
        frameMap();
      }
    },
    onView(context) {
      // North up in 2D, turning the shortest way round.
      current.heading = wrapAngle(current.heading);
      if (overview) {
        frameMap(true);
        return;
      }
      goal.pitch = context.view === "2d" ? PITCH_2D : PITCH_3D;
      if (context.view === "2d") {
        goal.heading = 0;
      }
      clampRig(goal);
      if (pinned) {
        snap();
      }
    },
    resize() {
      forgetRect();
      // The map can land before the canvas has its size.
      if (overview) {
        frameMap();
      }
    },
    update(frame, context) {
      const dt =
        lastClock === null
          ? 0
          : Math.min(0.1, Math.max(0, context.clock - lastClock));
      lastClock = context.clock;
      shownFrame = frame;
      if (!framed && context.map) {
        frameMap();
      }
      if (following && !pinned) {
        followGoal(frame);
        clampRig(goal);
      } else if (directing && !pinned) {
        directorGoal(frame, context.clock);
        clampRig(goal);
      }
      if (!pinned && dt > 0) {
        driveKeys(dt);
        const ease = following ? FOLLOW_EASE : directing ? DIRECTOR_EASE : EASE;
        current.target.x = damp(
          current.target.x,
          goal.target.x,
          velocity.x,
          ease.target,
          dt,
        );
        current.target.y = damp(
          current.target.y,
          goal.target.y,
          velocity.y,
          ease.target,
          dt,
        );
        current.target.z = damp(
          current.target.z,
          goal.target.z,
          velocity.z,
          ease.target,
          dt,
        );
        // Zoom eases in log space so it feels the same near and far.
        current.distance = Math.exp(
          damp(
            Math.log(current.distance),
            Math.log(goal.distance),
            velocity.distance,
            ease.distance,
            dt,
          ),
        );
        current.heading =
          goal.heading +
          damp(
            wrapAngle(current.heading - goal.heading),
            0,
            velocity.heading,
            ease.angle,
            dt,
          );
        current.pitch = damp(
          current.pitch,
          goal.pitch,
          velocity.pitch,
          ease.angle,
          dt,
        );
      }
      apply(current, context.camera);
      updateHover();
      paintCursor();
    },
    place,
    pose() {
      if (!ctx || overview) {
        return null;
      }
      const eye = ctx.camera.position;
      const target = current.target;
      return {
        eye: { x: eye.x, y: -eye.z, z: eye.y },
        target: { x: target.x, y: -target.z, z: target.y },
      };
    },
    frameMap,
    focus,
    setFollow: setFollowing,
    get following() {
      return following;
    },
    onFollowChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setControls(enabled) {
      controls = enabled;
      cursor?.enable(enabled);
      if (!enabled) {
        pointers.clear();
        dragMode = null;
        gesture = null;
        press = null;
        releaseKeys();
        updateHover();
      }
    },
    setKeyboard(enabled) {
      keyboard = enabled;
      if (!enabled) {
        releaseKeys();
      }
    },
    snap,
    get hoveredPlayer() {
      return hovered;
    },
    onPlayerHover(listener) {
      hoverListeners.add(listener);
      return () => hoverListeners.delete(listener);
    },
    onPlayerClick(listener) {
      clickListeners.add(listener);
      return () => clickListeners.delete(listener);
    },
    onClick(listener) {
      blankClickListeners.add(listener);
      return () => blankClickListeners.delete(listener);
    },
    onViewKey(listener) {
      viewKeyListeners.add(listener);
      return () => viewKeyListeners.delete(listener);
    },
    setDirector: setDirecting,
    setDirectorPlan(next) {
      plan = next;
      directedTick = null;
    },
    get directing() {
      return directing;
    },
    onDirectorChange(listener) {
      directorListeners.add(listener);
      return () => directorListeners.delete(listener);
    },
    onDirectorShot(listener) {
      shotListeners.add(listener);
      return () => shotListeners.delete(listener);
    },
    onDirectorReplay(listener) {
      replayListeners.add(listener);
      return () => replayListeners.delete(listener);
    },
    replay(offer) {
      setDirecting(true);
      replaying = offer;
      replayCut = true;
      angleFor = null;
    },
    dispose() {
      if (ctx) {
        detach(ctx.renderer.domElement);
      }
      listeners.clear();
      hoverListeners.clear();
      clickListeners.clear();
      blankClickListeners.clear();
      viewKeyListeners.clear();
      directorListeners.clear();
      shotListeners.clear();
      replayListeners.clear();
      shownFrame = null;
      ctx = null;
    },
  };
}
