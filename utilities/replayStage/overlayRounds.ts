import * as THREE from "three";
import {
  CELL,
  acquireFxAtlas,
  createFxBatch,
  pxScale,
  releaseFxAtlas,
  smoothstep,
} from "./fx";
import type { FxBatch } from "./fx";
import { STAGE_FONT, fontReady } from "./playersShared";
import { canvasTexture, createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import { TEAM_BASE } from "./teamColors";
import type { StageModule, StageTeam } from "./types";

/**
 * The buy-round overlay's players: every stacked round's living players as
 * ghost pucks on the floor, in team colours a shade lighter or darker per
 * round, each with a facing tick and a small tag with its round number. They
 * read through walls, like the portraits. One draw for the pucks, one for
 * the tags; their walks are the trails module's tails.
 */

const RADIUS = 26;
/** Smallest a puck is drawn across, CSS px. */
const MIN_PX = 13;
const TICK_LEN = 34;
const TAG_W = 26;
const TAG_H = 13;
const MAX_ACTORS = 256;
/** Rounds a tag can name; later ones go untagged. */
const TAGS = 128;
const TAG_CELL_W = 64;
const TAG_CELL_H = 32;
const TAG_COLS = 8;
const TAG_FONT = `700 22px ${STAGE_FONT}`;

const SHADOW = new THREE.Color(0x000000);
const WHITE = new THREE.Color(0xffffff);

function drawTags(g: CanvasRenderingContext2D) {
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.font = TAG_FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < TAGS; i++) {
    const x = (i % TAG_COLS) * TAG_CELL_W;
    const y = Math.floor(i / TAG_COLS) * TAG_CELL_H;
    g.fillStyle = "rgba(14, 12, 10, 0.86)";
    g.beginPath();
    g.roundRect(x + 3, y + 3, TAG_CELL_W - 6, TAG_CELL_H - 6, 9);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(String(i + 1), x + TAG_CELL_W / 2, y + TAG_CELL_H / 2 + 1);
  }
}

export function createOverlayRoundsModule(): StageModule {
  let pucks: FxBatch | null = null;
  let tags: SpriteBatch | null = null;
  let tagTexture: THREE.CanvasTexture | null = null;
  let ready: Promise<void> = Promise.resolve();
  let roundsKey = "";
  /** Per round (by index in the stack), the two teams' shades. */
  let shades: Array<Record<StageTeam, THREE.Color>> = [];
  const roundSlot = new Map<number, number>();

  const at = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  function shade(rounds: number[]) {
    const key = rounds.join(",");
    if (key === roundsKey) {
      return;
    }
    roundsKey = key;
    roundSlot.clear();
    shades = rounds.map((round, i) => {
      roundSlot.set(round, i);
      // Spread across the stack, so neighbouring rounds tell apart.
      const k = rounds.length > 1 ? i / (rounds.length - 1) - 0.5 : 0;
      return {
        ct: new THREE.Color(TEAM_BASE.ct).offsetHSL(k * 0.05, 0, k * 0.22),
        t: new THREE.Color(TEAM_BASE.t).offsetHSL(k * 0.03, 0, k * 0.22),
      };
    });
  }

  return {
    name: "overlay-rounds",
    init(ctx) {
      pucks = createFxBatch({
        texture: acquireFxAtlas(),
        max: MAX_ACTORS * 4,
        ground: true,
        renderOrder: 20,
      });
      // Setups are read whole: nobody hides behind a wall.
      (pucks.mesh.material as THREE.ShaderMaterial).depthTest = false;
      const canvas = canvasTexture(
        TAG_COLS * TAG_CELL_W,
        Math.ceil(TAGS / TAG_COLS) * TAG_CELL_H,
        drawTags,
      );
      tagTexture = canvas;
      ready = fontReady(TAG_FONT).then(() => {
        drawTags((canvas.image as HTMLCanvasElement).getContext("2d")!);
        canvas.needsUpdate = true;
      });
      tags = createSpriteBatch({
        texture: canvas,
        grid: [TAG_COLS, Math.ceil(TAGS / TAG_COLS)],
        max: MAX_ACTORS,
        screenSpace: true,
        depthTest: false,
        renderOrder: 21,
      });
      tags.setViewport(ctx.width, ctx.height);
      ctx.scene.add(pucks.mesh, tags.mesh);
    },
    update(frame, ctx) {
      const p = pucks!;
      const s = tags!;
      p.begin();
      s.begin();
      const overlay = frame.overlay;
      if (overlay?.actors.length) {
        shade(overlay.rounds);
        const camera = ctx.camera;
        camera.updateMatrixWorld();
        eye.setFromMatrixPosition(camera.matrixWorld);
        camera.getWorldDirection(forward);
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        const scale = pxScale(ctx);
        const band = frame.levelBand;
        let n = 0;
        for (const actor of overlay.actors) {
          if (n++ >= MAX_ACTORS) {
            break;
          }
          const slot = roundSlot.get(actor.round) ?? 0;
          const color = shades[slot]?.[actor.team] ?? WHITE;
          const off =
            band && (actor.z < band.min || actor.z > band.max) ? 0.35 : 1;
          ctx.wpos(actor, at);
          at.y += 2;
          const depth =
            (at.x - eye.x) * forward.x +
            (at.y - eye.y) * forward.y +
            (at.z - eye.z) * forward.z;
          const perPx = Math.max(1e-6, depth * scale);
          const radius = Math.max(RADIUS, (MIN_PX / 2) * perPx);
          p.push(at, radius * 2.7, radius * 2.7, SHADOW, 0.35 * off, CELL.disc);
          p.push(at, radius * 2, radius * 2, color, off, CELL.ball);
          p.push(at, radius * 2.2, radius * 2.2, WHITE, 0.55 * off, CELL.ring);
          // The facing tick, poking out past the puck's rim.
          const yaw = (actor.yaw * Math.PI) / 180;
          const len = Math.max(TICK_LEN, 8 * perPx);
          dir.set(Math.cos(yaw), 0, -Math.sin(yaw));
          tip.copy(at).addScaledVector(dir, radius + len * 0.45);
          p.push(
            tip,
            len * 0.5,
            len,
            color,
            0.95 * off,
            CELL.streak,
            yaw - Math.PI / 2,
          );
          if (actor.round <= TAGS) {
            const rpx = radius / perPx;
            tip
              .copy(at)
              .addScaledVector(right, (rpx + TAG_W * 0.45) * perPx)
              .addScaledVector(up, (rpx * 0.7 + TAG_H * 0.3) * perPx);
            // Quieter zoomed out, where a hundred tags would bury the map.
            const loud = 0.45 + 0.47 * smoothstep(6.5, 10, rpx);
            s.push(tip, TAG_W, TAG_H, color, loud * off, 0, actor.round - 1);
          }
        }
      }
      p.sync(ctx);
      p.end();
      s.end();
    },
    resize(ctx) {
      tags?.setViewport(ctx.width, ctx.height);
    },
    settle() {
      return ready;
    },
    dispose() {
      pucks?.mesh.removeFromParent();
      tags?.mesh.removeFromParent();
      pucks?.dispose();
      tags?.dispose();
      tagTexture?.dispose();
      if (pucks) {
        releaseFxAtlas();
      }
      pucks = null;
      tags = null;
      tagTexture = null;
      roundsKey = "";
      shades = [];
    },
  };
}
