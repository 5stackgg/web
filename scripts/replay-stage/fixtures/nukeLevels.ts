import { EMPTY_FRAME } from "../../../utilities/replayStage/types";
import type {
  StagePlayer,
  StageTeam,
} from "../../../utilities/replayStage/types";
import type { Scenario } from "./index";

/**
 * Nuke with players on both storeys, for the level view: A site and hut up
 * at -416, B site and decon down at -768, one on heaven above it all.
 * `nuke-levels-lower` puts the lower storey in view, `-upper` the upper;
 * `nuke-levels` and `vertigo-levels` (no band) are for the side-by-side layout.
 */
type Actor = [string, StageTeam, number, number, number, number];

const ACTORS: Actor[] = [
  ["Upper A", "ct", 700, -900, -416, 200],
  ["Hut", "t", 360, -960, -392, 340],
  ["Heaven", "ct", 1120, -400, -128, 250],
  ["B site", "ct", 640, -700, -768, 90],
  ["B door", "t", 820, -320, -768, 160],
  ["Decon", "t", 200, -1400, -776, 20],
];

// Vertigo: A, B, mid and CT up at 11776; T spawn, tunnels and bridge below.
const VERTIGO: Actor[] = [
  ["A site", "ct", -160, -1100, 11776, 200],
  ["B site", "ct", -2100, 800, 11776, 300],
  ["Mid", "t", -1850, 0, 11776, 30],
  ["T spawn", "t", -2100, -1100, 11488, 60],
  ["Tunnels", "t", -1920, -200, 11488, 90],
  ["Ladder", "ct", -1330, -680, 11488, 180],
];

function player([name, team, x, y, z, yaw]: Actor, i: number): StagePlayer {
  return {
    id: `p${i}`,
    name,
    team,
    avatarUrl: null,
    alive: true,
    x,
    y,
    z,
    yaw,
    pitch: 0,
    health: 100,
    armor: 100,
    helmet: true,
    weapon: team === "t" ? "ak47" : "m4a1_silencer",
    hasBomb: false,
    hasKit: false,
    ducked: false,
    blind: 0,
    hurtAge: null,
    diedAge: null,
    selected: i === 3,
  };
}

function nukeLevels(
  name: string,
  band: { min: number; max: number } | null,
  map = "de_nuke",
  actors = ACTORS,
  floor = -416,
) {
  const scenario: Scenario = {
    name,
    map,
    floor,
    duration: 1,
    frameAt: () => ({
      ...EMPTY_FRAME,
      players: actors.map(player),
      levelBand: band,
      callouts: true,
    }),
  };
  return scenario;
}

export const nukeLevelsSide = nukeLevels("nuke-levels", null);
export const vertigoLevelsSide = nukeLevels(
  "vertigo-levels",
  null,
  "de_vertigo",
  VERTIGO,
  11776,
);

export const nukeLevelsLower = nukeLevels("nuke-levels-lower", {
  min: -100000,
  max: -500,
});
export const nukeLevelsUpper = nukeLevels("nuke-levels-upper", {
  min: -560,
  max: -200,
});
