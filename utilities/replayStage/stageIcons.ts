import type * as THREE from "three";
import { STAGE_FONT, fontReady } from "./playersShared";
import { canvasTexture } from "./sprites";
import type { StageGrenadeType } from "./types";

/**
 * A small atlas for the overlays: a disc and a ring to build chips from, and
 * the equipment icons as white silhouettes with a dark rim, so a tint keeps
 * them readable on any floor, and "×2".."×9+" count tags. Cells are 128px
 * on a 4x8 grid.
 */
export const ICON = {
  disc: 0,
  ring: 1,
  smoke: 2,
  flash: 3,
  he: 4,
  molotov: 5,
  incendiary: 6,
  decoy: 7,
  bomb: 8,
  kit: 9,
} as const;

export const ICON_GRID: [number, number] = [4, 8];

/** The first count tag ("×2"); `COUNT_CELL + 7` is "×9+". */
const COUNT_CELL = 16;

/** The atlas cell of the "×n" tag for a cluster of `n`. */
export function countCell(n: number) {
  return COUNT_CELL + Math.min(9, Math.max(2, n)) - 2;
}

const CELL = 128;
const ICON_BOX = 100;

const FILES: Array<[cell: number, file: string]> = [
  [ICON.smoke, "smokegrenade"],
  [ICON.flash, "flashbang"],
  [ICON.he, "hegrenade"],
  [ICON.molotov, "molotov"],
  [ICON.incendiary, "incgrenade"],
  [ICON.decoy, "decoy"],
  [ICON.bomb, "c4"],
  [ICON.kit, "defuser"],
];

export const GRENADE_ICON: Record<StageGrenadeType, number> = {
  smoke: ICON.smoke,
  flash: ICON.flash,
  he: ICON.he,
  molotov: ICON.molotov,
  incendiary: ICON.incendiary,
  decoy: ICON.decoy,
};

export type IconAtlas = {
  texture: THREE.CanvasTexture;
  /** Resolves once every icon has loaded (or failed to). */
  settle(): Promise<void>;
  dispose(): void;
};

const COUNT_FONT = `700 54px ${STAGE_FONT}`;

/** Count tags: a dark pill with white text, centred in its cell. */
function drawCounts(g: CanvasRenderingContext2D) {
  g.save();
  g.font = COUNT_FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let n = 2; n <= 9; n++) {
    const [x, y] = origin(countCell(n));
    g.clearRect(x, y, CELL, CELL);
    g.fillStyle = "rgba(14, 12, 10, 0.9)";
    g.beginPath();
    g.roundRect(x + 6, y + 34, CELL - 12, 60, 30);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(n === 9 ? "×9+" : `×${n}`, x + CELL / 2, y + CELL / 2 + 3);
  }
  g.restore();
}

function origin(cell: number) {
  return [(cell % ICON_GRID[0]) * CELL, Math.floor(cell / ICON_GRID[0]) * CELL];
}

/** `base` is where the equipment SVGs are served, "/img/equipment/" in the app. */
export function createIconAtlas(base: string): IconAtlas {
  let g: CanvasRenderingContext2D | null = null;
  const texture = canvasTexture(
    CELL * ICON_GRID[0],
    CELL * ICON_GRID[1],
    (ctx) => {
      g = ctx;
      const [dx, dy] = origin(ICON.disc);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(dx + CELL / 2, dy + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      const [rx, ry] = origin(ICON.ring);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(rx + CELL / 2, ry + CELL / 2, CELL / 2 - 9, 0, Math.PI * 2);
      ctx.stroke();
      drawCounts(ctx);
    },
  );
  const counted = fontReady(COUNT_FONT).then(() => {
    if (g && !disposed) {
      drawCounts(g);
      texture.needsUpdate = true;
    }
  });
  let disposed = false;

  function drawIcon(cell: number, img: HTMLImageElement) {
    if (!g || disposed) {
      return;
    }
    const aspect =
      img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : 1;
    const w = aspect >= 1 ? ICON_BOX : ICON_BOX * aspect;
    const h = aspect >= 1 ? ICON_BOX / aspect : ICON_BOX;
    const scratch = document.createElement("canvas");
    scratch.width = CELL;
    scratch.height = CELL;
    const s = scratch.getContext("2d")!;
    s.drawImage(img, (CELL - w) / 2, (CELL - h) / 2, w, h);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = "#fff";
    s.fillRect(0, 0, CELL, CELL);
    const [x, y] = origin(cell);
    g.save();
    g.beginPath();
    g.rect(x, y, CELL, CELL);
    g.clip();
    // The rim: the silhouette, blurred dark, under itself.
    g.shadowColor = "rgba(0,0,0,0.85)";
    g.shadowBlur = 10;
    g.drawImage(scratch, x, y);
    g.shadowBlur = 0;
    g.drawImage(scratch, x, y);
    g.restore();
    texture.needsUpdate = true;
  }

  const loads =
    typeof Image === "undefined"
      ? []
      : FILES.map(
          ([cell, file]) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                drawIcon(cell, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = `${base}${file}.svg`;
            }),
        );
  const ready = Promise.all([...loads, counted]).then(() => undefined);

  return {
    texture,
    settle: () => ready,
    dispose() {
      disposed = true;
      texture.dispose();
    },
  };
}
