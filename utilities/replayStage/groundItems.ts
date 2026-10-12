import * as THREE from "three";
import { createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import { ICON, ICON_GRID, createIconAtlas } from "./stageIcons";
import type { IconAtlas } from "./stageIcons";
import { hsl } from "./teamColors";
import type { StageModule } from "./types";

/**
 * What lies on the floor: the bomb dropped or planted, and the kits dead CTs
 * left behind. Each is a small chip (a dark disc, a coloured ring, the icon)
 * that keeps its size on screen and reads through walls like the portraits;
 * a planted bomb pulses once a second.
 */
export type GroundItemsModule = StageModule & {
  /** Where the equipment SVGs are served, "/img/equipment/" in the app. */
  setIconBase(base: string): void;
};

const CHIP_PX = 27;
const ICON_PX = 21;
/** The chip sits this far over the spot, so it stands on the floor in 3D. */
const LIFT = 12;

const BACK = new THREE.Color(0x15110d);
const WHITE = new THREE.Color(0xffffff);
const RING = {
  bomb: new THREE.Color(hsl(28, 100, 55)),
  planted: new THREE.Color(hsl(0, 90, 55)),
  kit: new THREE.Color(hsl(190, 90, 55)),
};

export function createGroundItemsModule(): GroundItemsModule {
  let chips: SpriteBatch | null = null;
  let atlas: IconAtlas | null = null;
  let iconBase = "/img/equipment/";
  const at = new THREE.Vector3();

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
      chips.setViewport(ctx.width, ctx.height);
      ctx.scene.add(chips.mesh);
    },
    update(frame, ctx) {
      const s = chips!;
      s.begin();
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
        }
        s.push(at, CHIP_PX * grow, CHIP_PX * grow, BACK, 0.9, 0, ICON.disc);
        s.push(at, CHIP_PX * grow, CHIP_PX * grow, ring, 1, 0, ICON.ring);
        const icon = item.kind === "kit" ? ICON.kit : ICON.bomb;
        s.push(at, ICON_PX * grow, ICON_PX * grow, WHITE, 1, 0, icon);
      }
      s.end();
    },
    resize(ctx) {
      chips?.setViewport(ctx.width, ctx.height);
    },
    settle() {
      return atlas?.settle() ?? Promise.resolve();
    },
    setIconBase(base) {
      iconBase = base;
    },
    dispose() {
      chips?.mesh.removeFromParent();
      chips?.dispose();
      atlas?.dispose();
      chips = null;
      atlas = null;
    },
  };
}
