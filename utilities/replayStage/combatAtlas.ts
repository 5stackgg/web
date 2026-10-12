import type * as THREE from "three";
import { STAGE_FONT, fontReady } from "./playersShared";
import { canvasTexture } from "./sprites";

/** Cells of the 4x4 effects atlas. */
export const FX = {
  glow: 0,
  muzzle: 1,
  spark: 2,
  burstA: 3,
  burstB: 4,
  burstHead: 5,
  shardA: 6,
  shardB: 7,
  puff: 8,
  star: 9,
  ring: 10,
} as const;

export const FX_GRID: [number, number] = [4, 4];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function starburst(
  g: CanvasRenderingContext2D,
  spikes: number,
  outer: number,
  inner: number,
  seed: number,
) {
  const next = rand(seed);
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + (next() - 0.5) * 0.22;
    const r =
      i % 2 === 0
        ? outer * (0.62 + 0.38 * next())
        : inner * (0.75 + 0.45 * next());
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

function cell(g: CanvasRenderingContext2D, index: number, draw: () => void) {
  g.save();
  g.translate((index % 4) * 128 + 64, Math.floor(index / 4) * 128 + 64);
  draw();
  g.restore();
}

/** Glows, rings, muzzle flash, comic starbursts, shards and dust, drawn once. */
export function createFxAtlas(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (g) => {
    cell(g, FX.glow, () => {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 62);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.18, "rgba(255,255,255,0.8)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.25)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(-64, -64, 128, 128);
    });
    cell(g, FX.muzzle, () => {
      // A comic star stretched along +x: long spikes forward, stubs behind.
      const next = rand(7);
      g.translate(-30, 0);
      const star = (scale: number) => {
        g.beginPath();
        const points = 16;
        for (let i = 0; i < points; i++) {
          const a = (i / points) * Math.PI * 2;
          const reach = 20 + 72 * Math.max(0, Math.cos(a)) ** 2;
          const r =
            i % 2 === 0 ? reach * (0.75 + 0.25 * next()) : 14 + 4 * next();
          g.lineTo(Math.cos(a) * r * scale, Math.sin(a) * r * scale);
        }
        g.closePath();
      };
      star(1);
      g.fillStyle = "#ff8f24";
      g.fill();
      star(0.62);
      g.fillStyle = "#ffd65a";
      g.fill();
      g.fillStyle = "#fffbe8";
      g.beginPath();
      g.arc(0, 0, 8, 0, Math.PI * 2);
      g.fill();
    });
    cell(g, FX.spark, () => {
      const grad = g.createLinearGradient(-60, 0, 60, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.8, "rgba(255,255,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,1)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-60, 0);
      g.lineTo(52, -5);
      g.quadraticCurveTo(62, 0, 52, 5);
      g.closePath();
      g.fill();
    });
    const comic = (
      index: number,
      spikes: number,
      seed: number,
      head: boolean,
    ) =>
      cell(g, index, () => {
        const fill = g.createRadialGradient(0, 0, 0, 0, 0, 60);
        if (head) {
          fill.addColorStop(0, "#ffffff");
          fill.addColorStop(0.42, "#fff4b8");
          fill.addColorStop(0.75, "#ffd23a");
          fill.addColorStop(1, "#f0a020");
        } else {
          fill.addColorStop(0, "#fffbe3");
          fill.addColorStop(0.3, "#ffe36e");
          fill.addColorStop(0.62, "#ffd84a");
          fill.addColorStop(1, "#d19133");
        }
        starburst(g, spikes, 60, 25, seed);
        g.fillStyle = fill;
        g.fill();
        g.lineJoin = "miter";
        g.lineWidth = 2.5;
        g.strokeStyle = head ? "#c97a12" : "#b86a1e";
        g.stroke();
        starburst(g, spikes - 2, head ? 38 : 30, head ? 15 : 12, seed + 11);
        g.fillStyle = head ? "#ffffff" : "#fffbea";
        g.fill();
      });
    comic(FX.burstA, 10, 3, false);
    comic(FX.burstB, 9, 19, false);
    comic(FX.burstHead, 12, 41, true);
    cell(g, FX.shardA, () => {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(-34, -22);
      g.lineTo(46, -4);
      g.lineTo(-18, 30);
      g.closePath();
      g.fill();
      g.fillStyle = "#d9dde6";
      g.beginPath();
      g.moveTo(46, -4);
      g.lineTo(-18, 30);
      g.lineTo(-4, 4);
      g.closePath();
      g.fill();
    });
    cell(g, FX.shardB, () => {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(-40, 6);
      g.lineTo(-6, -30);
      g.lineTo(42, -12);
      g.lineTo(10, 28);
      g.closePath();
      g.fill();
      g.fillStyle = "#dfe2ea";
      g.beginPath();
      g.moveTo(42, -12);
      g.lineTo(10, 28);
      g.lineTo(4, 0);
      g.closePath();
      g.fill();
    });
    cell(g, FX.puff, () => {
      const next = rand(5);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const x = Math.cos(a) * 22 * next();
        const y = Math.sin(a) * 22 * next();
        const r = 22 + 14 * next();
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(255,255,255,0.55)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(-64, -64, 128, 128);
      }
    });
    cell(g, FX.ring, () => {
      const grad = g.createRadialGradient(0, 0, 46, 0, 0, 62);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.6, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(-64, -64, 128, 128);
    });
    cell(g, FX.star, () => {
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 60);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = glow;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 62 : 9;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    });
  });
}

/** Digits 0-9, then "!" and a skull, for damage numbers. */
export const GLYPH_BANG = 10;
export const GLYPH_SKULL = 11;
export const GLYPH_GRID: [number, number] = [12, 1];
const GLYPH_W = 1024 / 12;
const GLYPH_FONT = `800 90px ${STAGE_FONT}`;
/** Oxanium has no italic: the digits lean by a shear instead. */
const GLYPH_SLANT = 0.2;

export type GlyphAtlas = {
  texture: THREE.CanvasTexture;
  /** Advance of each glyph as a fraction of the cell height. */
  advance: Float32Array;
  /** Cell width over cell height. */
  aspect: number;
  /** Resolves once the digits are redrawn in the real font. */
  ready: Promise<void>;
};

function drawGlyphs(g: CanvasRenderingContext2D, advance: Float32Array) {
  g.clearRect(0, 0, 1024, 128);
  g.font = GLYPH_FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  const chars = "0123456789!";
  for (let i = 0; i < chars.length; i++) {
    g.save();
    g.translate(i * GLYPH_W + GLYPH_W / 2, 66);
    g.transform(1, 0, -GLYPH_SLANT, 1, 0, 0);
    const fill = g.createLinearGradient(0, -36, 0, 34);
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(1, "#e9e3d6");
    g.lineWidth = 14;
    g.strokeStyle = "rgba(24,10,4,0.95)";
    g.strokeText(chars[i], 0, 0);
    g.fillStyle = fill;
    g.fillText(chars[i], 0, 0);
    g.restore();
    // Tight, like a game's damage font; the outline keeps them apart.
    advance[i] = (g.measureText(chars[i]).width * 0.92 + 4) / 128;
  }
  // Skull, for the hit that killed.
  g.save();
  g.translate(GLYPH_SKULL * GLYPH_W + GLYPH_W / 2, 64);
  g.lineWidth = 12;
  g.strokeStyle = "rgba(24,10,4,0.95)";
  g.fillStyle = "#ffffff";
  const skull = () => {
    g.beginPath();
    g.arc(0, -8, 27, Math.PI * 0.82, Math.PI * 2.18);
    g.lineTo(16, 24);
    g.lineTo(-16, 24);
    g.closePath();
  };
  skull();
  g.stroke();
  skull();
  g.fill();
  g.fillStyle = "rgba(24,10,4,1)";
  g.beginPath();
  g.ellipse(-10, -4, 7, 8, 0, 0, Math.PI * 2);
  g.ellipse(10, -4, 7, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(0, 6);
  g.lineTo(-4, 13);
  g.lineTo(4, 13);
  g.closePath();
  g.fill();
  g.fillRect(-7, 18, 3, 7);
  g.fillRect(4, 18, 3, 7);
  g.restore();
  advance[GLYPH_SKULL] = 0.5;
}

export function createGlyphAtlas(): GlyphAtlas {
  const advance = new Float32Array(12);
  const texture = canvasTexture(1024, 128, (g) => drawGlyphs(g, advance));
  const ready = fontReady(GLYPH_FONT).then(() => {
    const canvas = texture.image as HTMLCanvasElement;
    drawGlyphs(canvas.getContext("2d")!, advance);
    texture.needsUpdate = true;
  });
  return { texture, advance, aspect: GLYPH_W / 128, ready };
}
