import { EMPTY_FRAME } from "../../../utilities/replayStage/types";
import type {
  StagePlayer,
  StageTeam,
} from "../../../utilities/replayStage/types";
import type { Scenario } from "./index";

/**
 * Nuke with players on both storeys, for the level view: A site and hut up
 * at -416, B site and decon down at -768, one on heaven above it all.
 * `nuke-levels-lower` puts the lower storey in view, `-upper` the upper.
 */
const ACTORS: Array<[string, StageTeam, number, number, number, number]> = [
  ["Upper A", "ct", 700, -900, -416, 200],
  ["Hut", "t", 360, -960, -392, 340],
  ["Heaven", "ct", 1120, -400, -128, 250],
  ["B site", "ct", 640, -700, -768, 90],
  ["B door", "t", 820, -320, -768, 160],
  ["Decon", "t", 200, -1400, -776, 20],
];

function player(
  [name, team, x, y, z, yaw]: (typeof ACTORS)[number],
  i: number,
): StagePlayer {
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

function nukeLevels(name: string, band: { min: number; max: number }) {
  const scenario: Scenario = {
    name,
    map: "de_nuke",
    floor: -416,
    duration: 1,
    frameAt: () => ({
      ...EMPTY_FRAME,
      players: ACTORS.map(player),
      levelBand: band,
    }),
  };
  return scenario;
}

export const nukeLevelsLower = nukeLevels("nuke-levels-lower", {
  min: -100000,
  max: -500,
});
export const nukeLevelsUpper = nukeLevels("nuke-levels-upper", {
  min: -560,
  max: -200,
});
