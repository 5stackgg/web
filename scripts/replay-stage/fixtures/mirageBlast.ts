import type { StageFrame } from "../../../utilities/replayStage/types";
import type { Ground, Scenario } from "./index";
import { mirageASite } from "./mirageASite";

/** When the bomb goes off, seconds into the scenario. */
const EXPLODES = 1;
/** Where on the A-site take the smokes are up. */
const BASE = 5;
/** The frame builder's C4 sphere (frameIndex.ts). */
const C4_SPHERE = 600;

/**
 * The C4 going off on Mirage A with the take's three smokes up round it
 * (stairs, jungle, CT): checks the shockwave, the blast zones (shown
 * before `t=1`) and which smokes it blows away. No demo in the fixtures
 * has a smoke up when its bomb explodes.
 */
export const mirageBlast: Scenario = {
  name: "mirage-a-blast",
  map: "de_mirage",
  floor: -200,
  duration: 7,
  frameAt(t: number, ground: Ground): StageFrame {
    const frame = mirageASite.frameAt(BASE + t, ground);
    const at = { x: -446, y: -2180, z: ground(-446, -2180) };
    const since = t - EXPLODES;
    frame.players = frame.players.filter((p) => p.alive);
    frame.blasts = frame.blasts.filter((b) => b.radius < C4_SPHERE);
    if (since < 0) {
      frame.bomb = { state: "planted", at, age: 39 + t, timer: -since };
      frame.ground = [
        { key: "bomb", kind: "planted", at, age: 39 + t, timer: -since },
      ];
      frame.blastZones = true;
      return frame;
    }
    frame.bomb = { state: "exploded", at, age: since, timer: null };
    if (since < 2) {
      frame.blasts.push({ ...at, age: since, radius: C4_SPHERE });
    }
    return frame;
  },
};
