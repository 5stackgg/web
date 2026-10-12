import * as THREE from "three";
import { C4_SECS } from "./frame";
import { createTimerBatch } from "./combatTimers";
import type { TimerBatch } from "./combatTimers";
import { badgeZoom, overlayScale, puckAnchor } from "./playersShared";
import type { ScreenAnchor } from "./playersShared";
import { createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import { ICON, ICON_GRID, createIconAtlas } from "./stageIcons";
import type { IconAtlas } from "./stageIcons";
import { hsl } from "./teamColors";
import type { StageContext, StageModule } from "./types";

/**
 * What lies on the floor: the bomb dropped or planted, and the kits dead CTs
 * left behind. Each is a small chip (a dark disc, a coloured ring, the icon)
 * that keeps its size on screen and reads through walls like the portraits;
 * a planted bomb pulses once a second and stands under a countdown badge,
 * the smoke and fire timers' badge, that turns red for the last ten seconds.
 */
export type GroundItemsModule = StageModule & {
  /** Where the equipment SVGs are served, "/img/equipment/" in the app. */
  setIconBase(base: string): void;
};

const CHIP_PX = 27;
const ICON_PX = 21;
/** The chip sits this far over the spot, so it stands on the floor in 3D. */
const LIFT = 12;
/** CS2's C4 fuse. */
const FUSE_SECS = C4_SECS;
/** Under this, the countdown shows hundredths. */
const HUNDREDTHS_SECS = 10;
const FUSE_WARN_SECS = 10;
/**
 * Where the timer badge's icon chip sits, CSS px at scale 1 from its pointer
 * tip (combatTimers' layout: disc radius 17, 24 over the tip, the chip on its
 * upper-left shoulder), and how big the C4 drawn into it is.
 */
const BADGE_CHIP_X = -17 * 0.84;
const BADGE_CHIP_Y = 24 + 17 * 0.84;
const BADGE_GLYPH_PX = 12;
/** An empty cell of the timer atlas: the badge's own chip stays blank. */
const NO_TIMER_ICON = 3;

const BACK = new THREE.Color(0x15110d);
const WHITE = new THREE.Color(0xffffff);
const RING = {
  bomb: new THREE.Color(hsl(28, 100, 55)),
  planted: new THREE.Color(hsl(0, 90, 55)),
  kit: new THREE.Color(hsl(190, 90, 55)),
};
const FUSE = hsl(28, 100, 55);
const FUSE_LATE = hsl(0, 90, 55);

export function createGroundItemsModule(): GroundItemsModule {
  let chips: SpriteBatch | null = null;
  let glyphs: SpriteBatch | null = null;
  let timers: TimerBatch | null = null;
  let atlas: IconAtlas | null = null;
  let iconBase = "/img/equipment/";
  const at = new THREE.Vector3();
  const screen = new THREE.Vector3();
  const anchor: ScreenAnchor = {
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    depth: 0,
    grow: 1,
  };

  /** The countdown over a planted bomb whose chip is at world `chip`. */
  function countdown(
    ctx: StageContext,
    chip: THREE.Vector3,
    item: { at: { x: number; y: number; z: number } },
    timer: number,
  ) {
    if (timer < 0 || !puckAnchor(ctx, item.at, anchor)) {
      return;
    }
    screen.copy(chip).project(ctx.camera);
    if (screen.z > 1) {
      return;
    }
    const sx = (screen.x * 0.5 + 0.5) * ctx.width;
    const sy = (0.5 - screen.y * 0.5) * ctx.height;
    const scale =
      overlayScale(ctx) * Math.max(0.9, 1.15 * badgeZoom(ctx, anchor.radius));
    // The pointer stands on the chip.
    const tipY = sy - CHIP_PX / 2;
    timers!.push(
      sx,
      tipY,
      scale,
      1,
      timer <= FUSE_WARN_SECS ? FUSE_LATE : FUSE,
      0,
      Math.min(1, timer / FUSE_SECS),
      // Whole seconds, then to the hundredth for the last ten (the no-kit
      // defuse): it reads 0.00 as the round's own explosion lands.
      timer < HUNDREDTHS_SECS ? timer : Math.min(99, Math.floor(timer)),
      NO_TIMER_ICON,
      timer < HUNDREDTHS_SECS,
    );
    // The C4 in the badge's chip, placed in screen px at the chip's depth.
    screen.x = ((sx + BADGE_CHIP_X * scale) / ctx.width) * 2 - 1;
    screen.y = 1 - ((tipY - BADGE_CHIP_Y * scale) / ctx.height) * 2;
    screen.unproject(ctx.camera);
    const size = BADGE_GLYPH_PX * scale;
    glyphs!.push(screen, size, size, WHITE, 1, 0, ICON.bomb);
  }

  return {
    name: "ground-items",
    init(ctx) {
      atlas = createIconAtlas(iconBase);
      chips = createSpriteBatch({
        texture: atlas.texture,
        grid: ICON_GRID,
        max: 64,
        screenSpace: true,
        depthTest: false,
        // Over the smoke, under the timers and portraits.
        renderOrder: 950,
      });
      glyphs = createSpriteBatch({
        texture: atlas.texture,
        grid: ICON_GRID,
        max: 4,
        screenSpace: true,
        depthTest: false,
        // Over the timer badge it labels.
        renderOrder: 991,
      });
      timers = createTimerBatch(4);
      for (const batch of [chips, glyphs]) {
        batch.setViewport(ctx.width, ctx.height);
      }
      timers.setViewport(ctx.width, ctx.height);
      ctx.scene.add(chips.mesh, timers.mesh, glyphs.mesh);
    },
    update(frame, ctx) {
      const s = chips!;
      s.begin();
      glyphs!.begin();
      timers!.begin();
      ctx.camera.updateMatrixWorld();
      for (const item of frame.ground ?? []) {
        ctx.wpos(item.at, at);
        at.y += LIFT;
        const ring = RING[item.kind];
        // Drops pop in rather than appearing at full size.
        const grow = Math.min(1, 0.6 + item.age * 4);
        if (item.kind === "planted") {
          const pulse = item.age % 1;
          const size = CHIP_PX * (1.1 + 0.9 * pulse);
          s.push(at, size, size, ring, 0.7 * (1 - pulse), 0, ICON.ring);
          if (item.timer != null) {
            countdown(ctx, at, item, item.timer);
          }
        }
        s.push(at, CHIP_PX * grow, CHIP_PX * grow, BACK, 0.9, 0, ICON.disc);
        s.push(at, CHIP_PX * grow, CHIP_PX * grow, ring, 1, 0, ICON.ring);
        const icon = item.kind === "kit" ? ICON.kit : ICON.bomb;
        s.push(at, ICON_PX * grow, ICON_PX * grow, WHITE, 1, 0, icon);
      }
      s.end();
      glyphs!.end();
      timers!.end();
    },
    resize(ctx) {
      chips?.setViewport(ctx.width, ctx.height);
      glyphs?.setViewport(ctx.width, ctx.height);
      timers?.setViewport(ctx.width, ctx.height);
    },
    settle() {
      return Promise.all([atlas?.settle(), timers?.ready]).then(
        () => undefined,
      );
    },
    setIconBase(base) {
      iconBase = base;
    },
    dispose() {
      for (const batch of [chips, glyphs]) {
        batch?.mesh.removeFromParent();
        batch?.dispose();
      }
      timers?.mesh.removeFromParent();
      timers?.dispose();
      atlas?.dispose();
      chips = null;
      glyphs = null;
      timers = null;
      atlas = null;
    },
  };
}
