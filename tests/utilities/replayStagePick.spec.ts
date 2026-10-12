// @vitest-environment node
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { pickPlayer } from "~/utilities/replayStage/pick";
import type { PlayerPick } from "~/utilities/replayStage/pick";
import type {
  StageContext,
  StagePlayer,
  Vec3,
} from "~/utilities/replayStage/types";

function context(): StageContext {
  const camera = new THREE.PerspectiveCamera(42, 1000 / 800, 4, 60000);
  camera.position.set(0, 3000, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return {
    camera,
    width: 1000,
    height: 800,
    quality: "high",
    wpos: (p: Vec3, out = new THREE.Vector3()) => out.set(p.x, p.z, -p.y),
  } as unknown as StageContext;
}

function player(id: string, z: number): StagePlayer {
  return {
    id,
    name: id,
    team: "ct",
    avatarUrl: null,
    alive: false,
    x: 0,
    y: 0,
    z,
    yaw: 0,
    pitch: 0,
    health: 0,
    armor: 0,
    helmet: false,
    weapon: null,
    hasBomb: false,
    hasKit: false,
    ducked: false,
    blind: 0,
    hurtAge: null,
    // Past the portrait: only the puck is a target.
    diedAge: 0.5,
    selected: false,
  };
}

describe("pickPlayer", () => {
  it("gives a click to the player on the storey in view", () => {
    const ctx = context();
    const upper = player("upper", -416);
    const lower = player("lower", -700);
    const out: PlayerPick = { id: null, x: 0, y: 0, r: 0 };
    const at = new THREE.Vector3(0, -700, 0).project(ctx.camera);
    const x = (at.x * 0.5 + 0.5) * ctx.width;
    const y = (0.5 - at.y * 0.5) * ctx.height;
    expect(pickPlayer(ctx, [upper, lower], x, y, 3, out)).toBe(true);
    expect(out.id).toBe("upper");
    pickPlayer(ctx, [upper, lower], x, y, 3, out, {
      min: -Infinity,
      max: -500,
    });
    expect(out.id).toBe("lower");
    pickPlayer(ctx, [lower, upper], x, y, 3, out, { min: -560, max: Infinity });
    expect(out.id).toBe("upper");
  });
});
