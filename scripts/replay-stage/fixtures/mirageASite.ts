import type {
  StageFlame,
  StageFrame,
  StagePlayer,
  StageTeam,
  Vec3,
} from "../../../utilities/replayStage/types";
import type { Ground, Scenario } from "./index";

/**
 * A scripted A-site take on Mirage, twelve seconds long, so every module has
 * something to draw: three smokes from T ramp (CT, jungle, stairs), a molotov
 * on site, a flash over site, an HE at the foot of stairs, and a fight from
 * palace onto site.
 */

type Actor = {
  id: string;
  name: string;
  team: StageTeam;
  from: [number, number];
  to: [number, number];
  /** Seconds the walk takes; they stand still after. */
  walk: number;
  yaw: number;
};

const ACTORS: Actor[] = [
  {
    id: "t1",
    name: "Zyphon",
    team: "t",
    from: [372, -1576],
    to: [-60, -1700],
    walk: 9,
    yaw: 200,
  },
  {
    id: "t2",
    name: "jackasmo",
    team: "t",
    from: [460, -1500],
    to: [120, -1640],
    walk: 8,
    yaw: 190,
  },
  {
    id: "t3",
    name: "KRIMZ",
    team: "t",
    from: [560, -1960],
    to: [260, -1980],
    walk: 6,
    yaw: 180,
  },
  {
    id: "t4",
    name: "jambo",
    team: "t",
    from: [420, -1950],
    to: [300, -1900],
    walk: 7,
    yaw: 185,
  },
  {
    id: "t5",
    name: "Buzz",
    team: "t",
    from: [262, -560],
    to: [-300, -760],
    walk: 10,
    yaw: 220,
  },
  {
    id: "c1",
    name: "Ankle",
    team: "ct",
    from: [-420, -2080],
    to: [-460, -2050],
    walk: 4,
    yaw: 20,
  },
  {
    id: "c2",
    name: "hypex",
    team: "ct",
    from: [-1040, -1395],
    to: [-980, -1420],
    walk: 3,
    yaw: 330,
  },
  {
    id: "c3",
    name: "Regali",
    team: "ct",
    from: [-672, -1052],
    to: [-620, -1120],
    walk: 3,
    yaw: 300,
  },
  {
    id: "c4",
    name: "Lake",
    team: "ct",
    from: [-1544, -1300],
    to: [-1300, -1650],
    walk: 6,
    yaw: 10,
  },
  {
    id: "c5",
    name: "s1n",
    team: "ct",
    from: [-1965, 184],
    to: [-1900, 120],
    walk: 3,
    yaw: 280,
  },
];

type Throw = {
  gid: number;
  type: "smoke" | "flash" | "he" | "molotov" | "decoy";
  team: StageTeam;
  from: [number, number];
  to: [number, number];
  thrown: number;
  flight: number;
  /** Extra height for a flash that pops in the air. */
  pop?: number;
};

const THROWS: Throw[] = [
  {
    gid: 1,
    type: "smoke",
    team: "t",
    from: [372, -1576],
    to: [-1120, -1450],
    thrown: 0,
    flight: 1.6,
  },
  {
    gid: 2,
    type: "smoke",
    team: "t",
    from: [460, -1500],
    to: [-1010, -1380],
    thrown: 0.3,
    flight: 1.5,
  },
  {
    gid: 3,
    type: "smoke",
    team: "t",
    from: [560, -1960],
    to: [-560, -1350],
    thrown: 0.6,
    flight: 1.4,
  },
  {
    gid: 4,
    type: "molotov",
    team: "t",
    from: [420, -1950],
    to: [-250, -2150],
    thrown: 2,
    flight: 1.2,
  },
  {
    gid: 5,
    type: "flash",
    team: "t",
    from: [372, -1576],
    to: [-300, -1900],
    thrown: 4,
    flight: 1.1,
    pop: 180,
  },
  {
    gid: 6,
    type: "he",
    team: "t",
    from: [460, -1500],
    to: [-520, -1300],
    thrown: 5,
    flight: 1.3,
  },
  {
    gid: 7,
    type: "decoy",
    team: "ct",
    from: [-1300, -1650],
    to: [-760, -1880],
    thrown: 0.5,
    flight: 1.1,
  },
];

const SMOKE_LIFE = 20;
const DECOY_LIFE = 15;
const FLAME_LIFE = 7;
const FLAME_REACH = 150;

/** CS2 lays flames ~42u apart: the 16 lattice cells nearest the landing. */
const FLAME_CELLS: Array<[number, number]> = (() => {
  const cells: Array<[number, number]> = [];
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = (col + (row % 2) * 0.5) * 42;
      const y = row * 42 * 0.866;
      if (Math.hypot(x, y) <= FLAME_REACH) {
        cells.push([x, y]);
      }
    }
  }
  return cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).slice(0, 16);
})();

/** Shots fired by t3 at c1, ending in a kill. */
const SHOTS = [
  { at: 6.5, hit: true, damage: 27 },
  { at: 6.62, hit: false, damage: 0 },
  { at: 6.74, hit: true, damage: 27 },
  { at: 6.86, hit: false, damage: 0 },
  { at: 6.98, hit: true, damage: 46, headshot: true },
];

/** c2 answers from jungle at t5 and misses everything. */
const COUNTER = [7.4, 7.52, 7.64, 7.76];

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const mirageASite: Scenario = {
  name: "mirage-a-site",
  map: "de_mirage",
  floor: -200,
  duration: 12,
  frameAt(t: number, ground: Ground): StageFrame {
    const at = (x: number, y: number, lift = 0): Vec3 => ({
      x,
      y,
      z: ground(x, y) + lift,
    });

    const victimDiesAt = SHOTS[SHOTS.length - 1].at;
    let c1Health = 100;
    let c1HurtAt: number | null = null;
    for (const shot of SHOTS) {
      if (shot.at <= t && shot.hit) {
        c1Health = Math.max(0, c1Health - shot.damage);
        c1HurtAt = shot.at;
      }
    }

    const players: StagePlayer[] = ACTORS.map((actor) => {
      const k = Math.min(1, Math.max(0, t / actor.walk));
      const x = lerp(actor.from[0], actor.to[0], k);
      const y = lerp(actor.from[1], actor.to[1], k);
      const dead = actor.id === "c1" && t >= victimDiesAt;
      const hurtAge =
        actor.id === "c1" && c1HurtAt !== null ? t - c1HurtAt : null;
      return {
        id: actor.id,
        name: actor.name,
        team: actor.team,
        avatarUrl: null,
        // As the viewer sends it with avatars off: their place on the team.
        slot: Number(actor.id.slice(1)),
        alive: !dead,
        x,
        y,
        z: ground(x, y),
        yaw: actor.yaw + Math.sin(t * 0.7 + x) * 12,
        pitch: 0,
        health: actor.id === "c1" ? c1Health : 100,
        armor: 100,
        helmet: true,
        weapon:
          actor.id === "t1" && t < 3
            ? "knife"
            : actor.team === "t"
              ? "ak47"
              : "m4a1_silencer",
        weaponAge: actor.id === "t1" && t >= 3 && t < 4 ? t - 3 : null,
        speed:
          t < actor.walk
            ? Math.hypot(
                actor.to[0] - actor.from[0],
                actor.to[1] - actor.from[1],
              ) / actor.walk
            : 0,
        // jackasmo plants late; s1n defuses without a kit, Lake with one.
        bombAction:
          actor.id === "t2" && t >= 8.5 && t < 11.7
            ? { kind: "plant", age: t - 8.5, duration: 3.2, kit: false }
            : actor.id === "c5" && t >= 9
              ? { kind: "defuse", age: t - 9, duration: 10, kit: false }
              : actor.id === "c4" && t >= 9 && t < 14
                ? { kind: "defuse", age: t - 9, duration: 5, kit: true }
                : null,
        hasBomb: actor.id === "t2",
        hasKit: actor.id === "c4",
        // KRIMZ crouches to spray.
        ducked: actor.id === "t3" && t >= 6.4 && t < 7.4,
        blind:
          actor.team === "ct" && t > 5.1 && t < 7.5 && actor.id !== "c5"
            ? Math.max(0, 1 - (t - 5.1) / 2.4)
            : 0,
        hurtAge: hurtAge !== null && hurtAge < 1.5 ? hurtAge : null,
        diedAge: dead ? t - victimDiesAt : null,
        selected: actor.id === "t3",
      };
    });

    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    const eye = (p: StagePlayer) => ({ x: p.x, y: p.y, z: p.z + 64 });

    const frame: StageFrame = {
      time: t,
      tickRate: 64,
      players,
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

    SHOTS.forEach((shot, i) => {
      const age = t - shot.at;
      if (age < 0 || age > 1.2) {
        return;
      }
      const shooter = byId.t3;
      const victim = byId.c1;
      const to = shot.hit
        ? { x: victim.x, y: victim.y, z: victim.z + (shot.headshot ? 62 : 44) }
        : { x: victim.x - 40 + i * 25, y: victim.y - 90, z: victim.z + 70 };
      frame.shots.push({
        key: `s${i}`,
        team: "t",
        shooterId: "t3",
        weapon: "ak47",
        from: eye(shooter),
        to,
        hit: shot.hit,
        headshot: !!shot.headshot,
        victimId: shot.hit ? "c1" : null,
        damage: shot.hit ? shot.damage : null,
        age,
      });
      if (shot.hit) {
        frame.damages.push({
          key: `d${i}`,
          attackerId: "t3",
          victimId: "c1",
          amount: shot.damage,
          healthAfter: Math.max(
            0,
            100 -
              SHOTS.slice(0, i + 1)
                .filter((s) => s.hit)
                .reduce((sum, s) => sum + s.damage, 0),
          ),
          headshot: !!shot.headshot,
          weapon: "ak47",
          at: { x: victim.x, y: victim.y, z: victim.z },
          age,
        });
      }
    });

    COUNTER.forEach((fired, i) => {
      const age = t - fired;
      if (age < 0 || age > 1.2) {
        return;
      }
      const shooter = byId.c2;
      const target = byId.t1;
      frame.shots.push({
        key: `c${i}`,
        team: "ct",
        shooterId: "c2",
        weapon: "m4a1_silencer",
        from: eye(shooter),
        to: {
          x: target.x + 30 * (i - 1.5),
          y: target.y + 60,
          z: target.z + 50,
        },
        hit: false,
        headshot: false,
        victimId: null,
        damage: null,
        age,
      });
    });

    if (t >= victimDiesAt) {
      const victim = byId.c1;
      frame.kills.push({
        key: "k1",
        killerId: "t3",
        victimId: "c1",
        team: "ct",
        headshot: true,
        weapon: "ak47",
        at: { x: victim.x, y: victim.y, z: victim.z },
        age: t - victimDiesAt,
      });
    }

    for (const g of THROWS) {
      const age = t - g.thrown;
      if (age < 0) {
        continue;
      }
      const lands = g.thrown + g.flight;
      const start = at(g.from[0], g.from[1], 64);
      const end = at(g.to[0], g.to[1], g.pop ?? 0);
      if (t < lands) {
        const span = Math.hypot(end.x - start.x, end.y - start.y);
        const apex = Math.max(start.z, end.z) + span * 0.22 + 80;
        const path: Vec3[] = [];
        for (let i = 0; i <= 32; i++) {
          const k = i / 32;
          path.push({
            x: lerp(start.x, end.x, k),
            y: lerp(start.y, end.y, k),
            z:
              lerp(start.z, end.z, k) +
              (apex - Math.max(start.z, end.z)) * 4 * k * (1 - k),
          });
        }
        frame.projectiles.push({
          key: `p${g.gid}`,
          gid: g.gid,
          type: g.type,
          team: g.team,
          path,
          progress: age / g.flight,
          age,
        });
        continue;
      }
      const since = t - lands;
      if (g.type === "smoke" && since < SMOKE_LIFE) {
        frame.smokes.push({
          key: `smoke${g.gid}`,
          gid: g.gid,
          team: g.team,
          at: end,
          age: since,
          remaining: SMOKE_LIFE - since,
          voxels: null,
        });
      } else if (g.type === "molotov" && since < FLAME_LIFE) {
        const flames: StageFlame[] = [];
        FLAME_CELLS.forEach(([dx, dy], i) => {
          // Spreads outward over ~1.8s, the way CS2's fire creeps.
          const caught = (Math.hypot(dx, dy) / FLAME_REACH) * 1.8;
          const flameAge = since - caught;
          if (flameAge < 0 || flameAge > FLAME_LIFE - caught) {
            return;
          }
          const fx = end.x + dx;
          const fy = end.y + dy;
          const life = flameAge / (FLAME_LIFE - caught);
          flames.push({
            x: fx,
            y: fy,
            z: ground(fx, fy),
            life,
            intensity: Math.min(1, flameAge / 0.35, (1 - life) / 0.1),
            age: flameAge,
            seed: hash(i + 31),
          });
        });
        frame.infernos.push({
          key: `inf${g.gid}`,
          team: g.team,
          type: "molotov",
          flames,
          age: since,
          remaining: FLAME_LIFE - since,
        });
      } else if ((g.type === "flash" || g.type === "he") && since < 3) {
        frame.detonations.push({
          key: `det${g.gid}`,
          gid: g.gid,
          type: g.type,
          team: g.team,
          at: end,
          age: since,
        });
        if (g.type === "he") {
          frame.blasts.push({ ...end, age: since, radius: 250 });
        }
      } else if (g.type === "decoy" && since < DECOY_LIFE) {
        frame.detonations.push({
          key: `det${g.gid}`,
          gid: g.gid,
          type: "decoy",
          team: g.team,
          at: end,
          age: since,
          remaining: DECOY_LIFE - since,
        });
      }
    }

    frame.bomb = {
      state: "carried",
      at: { x: byId.t2.x, y: byId.t2.y, z: byId.t2.z },
      age: t,
      timer: null,
    };

    return frame;
  },
};
