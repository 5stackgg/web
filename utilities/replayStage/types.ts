import type * as THREE from "three";
import type { ViewMesh } from "~/utilities/mapAssets";

/**
 * The replay stage: one three.js renderer for both the 2D (straight down) and
 * the 3D playback. Everything it draws is a pure function of a `StageFrame`,
 * so pausing, scrubbing and stepping backwards are free: a module never
 * accumulates state from one frame to the next except caches it can rebuild.
 *
 * Coordinates in a frame are CS2 source units (x east, y north, z up). The
 * scene is Y-up: world = (x, z, -y), see `wpos`.
 */

export type Vec3 = { x: number; y: number; z: number };

export type StageTeam = "ct" | "t";

export type StagePlayer = {
  id: string;
  name: string;
  team: StageTeam;
  avatarUrl: string | null;
  alive: boolean;
  /** Feet. */
  x: number;
  y: number;
  z: number;
  /** Degrees, source convention: 0 = +x, 90 = +y. */
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  helmet: boolean;
  weapon: string | null;
  hasBomb: boolean;
  hasKit: boolean;
  ducked: boolean;
  /** 0..1, how blind they are right now. */
  blind: number;
  /** Seconds since they last took damage, or null when not recently. */
  hurtAge: number | null;
  /** Seconds since they died, or null while alive. */
  diedAge: number | null;
  selected: boolean;
  /**
   * Their 1-5 slot on the team, when the viewer shows numbers instead of
   * portraits (`avatarUrl` is then null).
   */
  slot?: number | null;
  /** Ground speed, source units per second. */
  speed?: number;
  /** Seconds since the held weapon changed, while under a second. */
  weaponAge?: number | null;
  /** A plant or defuse they are in the middle of. */
  bombAction?: StageBombAction | null;
};

export type StageBombAction = {
  kind: "plant" | "defuse";
  /** Seconds since they started. */
  age: number;
  /** Seconds it takes: 3.2 to plant, 10 to defuse, 5 with a kit. */
  duration: number;
  kit: boolean;
};

export type StageShot = {
  key: string;
  team: StageTeam;
  shooterId: string;
  weapon: string;
  /** Eye position the bullet left from. */
  from: Vec3;
  /** Where it stopped: a body for a hit, a wall (or a max range) for a miss. */
  to: Vec3;
  hit: boolean;
  headshot: boolean;
  victimId: string | null;
  damage: number | null;
  /** Seconds since it was fired. */
  age: number;
};

export type StageDamage = {
  key: string;
  attackerId: string | null;
  victimId: string;
  amount: number;
  /** Victim health left after it. */
  healthAfter: number;
  headshot: boolean;
  weapon: string | null;
  /** Where the victim was standing. */
  at: Vec3;
  age: number;
};

export type StageKill = {
  key: string;
  killerId: string | null;
  victimId: string;
  /** The victim's team. */
  team: StageTeam;
  headshot: boolean;
  weapon: string | null;
  at: Vec3;
  age: number;
};

export type StageGrenadeType =
  "smoke" | "flash" | "he" | "molotov" | "incendiary" | "decoy";

export type StageProjectile = {
  key: string;
  gid: number;
  type: StageGrenadeType;
  team: StageTeam;
  /** The whole flight, release to rest. */
  path: Vec3[];
  /** 0 at release, 1 at detonation. */
  progress: number;
  age: number;
};

/** A flash, HE or decoy going off. Smokes and fires have their own lists. */
export type StageDetonation = {
  key: string;
  gid: number;
  type: "flash" | "he" | "decoy";
  team: StageTeam;
  at: Vec3;
  age: number;
  /** Seconds a decoy has left, for its timer. */
  remaining?: number | null;
};

/**
 * CS2's own smoke grid, decoded from the demo (parser schema 11+): a 32^3
 * box of 20u voxels centred on the detonation. `solid` is Valve's world
 * geometry inside the box, `arrival` is when the smoke reached each voxel
 * (seconds after detonation, 255 = never).
 */
export type StageSmokeVoxels = {
  /** Minimum corner, source units. */
  ox: number;
  oy: number;
  oz: number;
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  /** dx*dy*dz, x-major then y then z. 0..254 = arrival in 1/40 s, 255 = never. */
  arrival: Uint8Array;
};

export type StageSmoke = {
  key: string;
  gid: number | null;
  team: StageTeam;
  /** Detonation point. */
  at: Vec3;
  age: number;
  /** Seconds until it expires, when known. */
  remaining: number | null;
  /** Valve's grid, when the demo carried it. */
  voxels: StageSmokeVoxels | null;
};

export type StageFlame = {
  x: number;
  y: number;
  z: number;
  /** 0 at ignition, 1 at burnout. */
  life: number;
  /** 0..1, ramps in as it catches and out as it dies. */
  intensity: number;
  /** Seconds since this flame caught. */
  age: number;
  seed: number;
};

export type StageInferno = {
  key: string;
  team: StageTeam;
  type: "molotov" | "incendiary";
  flames: StageFlame[];
  age: number;
  /** Seconds until it burns out, when known. */
  remaining: number | null;
};

/** An explosion that pushes smoke aside (HE now, C4 at the end). */
export type StageBlast = Vec3 & { age: number; radius: number };

export type StageBomb = {
  state:
    "carried" | "dropped" | "planted" | "defusing" | "defused" | "exploded";
  at: Vec3;
  /** Seconds in the current state. */
  age: number;
  /** Seconds left on the C4 when planted. */
  timer: number | null;
};

export type StageFrame = {
  /** Seconds into the round; effects key off ages, this is for idle motion. */
  time: number;
  /** The demo tick on screen, for asking the clock's owner for slow motion. */
  tick?: number;
  tickRate: number;
  players: StagePlayer[];
  shots: StageShot[];
  damages: StageDamage[];
  kills: StageKill[];
  projectiles: StageProjectile[];
  detonations: StageDetonation[];
  smokes: StageSmoke[];
  infernos: StageInferno[];
  blasts: StageBlast[];
  bomb: StageBomb | null;
  /** Every detonation of the round, whatever the time: the utility heatmap. */
  heat?: StageHeatPoint[];
  /** Grenades picked in the viewer, drawn with their whole flight. */
  throws?: StageThrowPath[];
  /** Where everyone walked this round, drawn up to `time`. */
  trails?: StageTrails | null;
  /** A loose or planted bomb and dropped kits. */
  ground?: StageGroundItem[];
  /** The map's callout names on the floor. */
  callouts?: boolean;
  /** The storey in view on a stacked map (source-unit z); others dim. */
  levelBand?: { min: number; max: number } | null;
  /** Rounds stacked on one clock instead of one round's players. */
  overlay?: StageOverlay | null;
  /** Fog of war and who sees whom (vision.ts); absent while it is off. */
  vision?: StageVisionPast | null;
  /** Whose sight the fog shows; "both" dims only what neither side sees. */
  visionSide?: StageTeam | "both";
  /** The C4's damage zones on the ground (blast.ts): "Blast radius" is on. */
  blastZones?: boolean;
};

/**
 * Where everyone stood a moment ago, sampled on a fixed grid of the frame's
 * clock, so vision can say when an enemy first came into sight.
 */
export type StageVisionPast = {
  /** Seconds on the frame's `time` clock, newest first. */
  times: Float32Array;
  /** Player ids, in the order of each time's poses. */
  ids: string[];
  /** Per time, per player: x, y, z, yaw, flags (1 alive, 2 ducked). */
  poses: Float32Array;
};

/** One detonation on the utility heatmap. */
export type StageHeatPoint = {
  key: string;
  gid: number;
  type: StageGrenadeType;
  team: StageTeam;
  at: Vec3;
  selected: boolean;
};

/** A grenade picked in the viewer: where it was thrown from, its flight, where it went off. */
export type StageThrowPath = {
  key: string;
  gid: number;
  type: StageGrenadeType;
  team: StageTeam;
  /** Release to rest, evenly spaced in time; empty when the throw was not recorded. */
  path: Vec3[];
  at: Vec3;
};

/**
 * Every player's walk this round, built once per round and shared by every
 * frame of it. `points` is x, y, z, t per point, t in seconds on the frame's
 * `time` clock; each strip is one unbroken stretch of one player's walk.
 */
export type StageTrails = {
  points: Float32Array;
  strips: Array<{ id: string; team: StageTeam; start: number; count: number }>;
  /** Seconds of walk shown behind each player; all of it when unset. */
  tail?: number;
};

export type StageGroundItem = {
  key: string;
  kind: "bomb" | "planted" | "kit";
  at: Vec3;
  /** Seconds since it landed (planted: since the plant). */
  age: number;
  /** Planted: seconds left on the fuse. */
  timer?: number | null;
};

/** One player of one stacked round in the buy-round overlay. */
export type StageOverlayActor = {
  key: string;
  round: number;
  team: StageTeam;
  x: number;
  y: number;
  z: number;
  /** Degrees, source convention. */
  yaw: number;
};

/**
 * The buy-round overlay: several rounds stacked on one clock (seconds after
 * freeze time), every round's living players where they stood at it.
 */
export type StageOverlay = {
  /** The rounds stacked, in order; an actor's index here varies its tint. */
  rounds: number[];
  actors: StageOverlayActor[];
};

export const EMPTY_FRAME: StageFrame = {
  time: 0,
  tickRate: 64,
  players: [],
  shots: [],
  damages: [],
  kills: [],
  projectiles: [],
  detonations: [],
  smokes: [],
  infernos: [],
  blasts: [],
  bomb: null,
};

export type StageView = "2d" | "3d";

export type StageQuality = "high" | "low";

/** Everything a map module loaded, shared with the others. */
export type StageMap = {
  /** The map as played: `de_dust2_night` loads de_dust2's meshes. */
  name: string;
  /** Collision hull: float32 x9 per triangle, source units. */
  tri: Float32Array | null;
  view: ViewMesh | null;
  /** Source-unit bounds of what is drawn. */
  min: Vec3;
  max: Vec3;
  /** Named areas, e.g. BombsiteA, from `<map>.callouts.json`. */
  callouts: Array<{
    name: string;
    boxes: Array<{ min: number[]; max: number[] }>;
  }>;
  /** World-space meshes other modules may raycast against. */
  colliders: THREE.Object3D[];
};

export type StageContext = {
  THREE: typeof THREE;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** One camera for both views: 2D is the same camera looking straight down. */
  camera: THREE.PerspectiveCamera;
  view: StageView;
  quality: StageQuality;
  /** The loaded map, or null before it lands. */
  map: StageMap | null;
  /** Source units → world. Writes into `out` when given. */
  wpos(p: Vec3, out?: THREE.Vector3): THREE.Vector3;
  /** CSS pixels. */
  width: number;
  height: number;
  pixelRatio: number;
  /**
   * Seconds of wall clock, for motion that is not playback (flicker, idle
   * shimmer). The harness pins it so screenshots are reproducible.
   */
  clock: number;
  /** Where the asset CDN is, for modules that load their own files. */
  assetBase: string | null;
  /**
   * A stacked map laid out side by side (map module): points under `below`
   * (source z) are drawn shifted by `offset` (source units). `wpos` applies
   * it, so anything placed through `wpos` lands on its storey's copy.
   */
  levelShift?: { below: number; offset: Vec3 } | null;
};

export interface StageModule {
  readonly name: string;
  init(ctx: StageContext): void | Promise<void>;
  /** The map finished loading (or changed). `ctx.map` is set. */
  onMap?(ctx: StageContext): void | Promise<void>;
  /** The view switched between 2D and 3D. */
  onView?(ctx: StageContext): void;
  /** Called before every render with the latest frame. */
  update(frame: StageFrame, ctx: StageContext): void;
  /**
   * Takes over drawing the frame (post-processing). The last module that
   * returns true wins; without one the stage renders the scene directly.
   */
  render?(ctx: StageContext): boolean;
  resize?(ctx: StageContext): void;
  /**
   * Resolves once work started by the last update (a worker flood fill, a
   * texture load) has landed. Only the harness waits on it, so screenshots
   * show the finished frame; the live stage just draws what it has.
   */
  settle?(): Promise<void>;
  dispose(): void;
}
