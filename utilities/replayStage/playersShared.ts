import * as THREE from "three";
import type { StageContext, Vec3 } from "./types";

/** Pucks are about twice a CS hull across, so a player reads at whole-map zoom. */
export const PUCK_RADIUS = 32;
export const PUCK_HEIGHT = 14;
export const CORE_RADIUS = PUCK_RADIUS * 0.66;

export const DEAD_PUCK = 0x202519;

/**
 * Damage and deaths land on the tick the shot is fired; drawn tracers take
 * this long to reach their target, so hurt, death and numbers wait for them.
 */
export const IMPACT_DELAY = 0.04;

/** Writes 0..1 sRGB channels of `hex` into `out` at `offset`, no colour management. */
export function writeSrgb(out: Float32Array, offset: number, hex: number) {
  out[offset] = ((hex >> 16) & 255) / 255;
  out[offset + 1] = ((hex >> 8) & 255) / 255;
  out[offset + 2] = (hex & 255) / 255;
}

/**
 * The overlay shaders compose in sRGB like a canvas would, then hand the
 * result to three's output conversion so they stay right if a module renders
 * through a linear target.
 */
export const OUTPUT_GLSL = /* glsl */ `
vec3 srgbToLinear(vec3 c) {
  return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, step(c, vec3(0.04045)));
}
vec3 toOutput(vec3 srgb) {
  return linearToOutputTexel(vec4(srgbToLinear(clamp(srgb, 0.0, 1.0)), 1.0)).rgb;
}
float cover(float d) {
  return clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);
}
`;

/**
 * The app's typeface as the stage's own face: the app's @font-face stops at
 * weight 700 and the file goes to 800. Registered on import, before any
 * module draws its first canvas text.
 */
const STAGE_FAMILY = "Oxanium Stage";
export const STAGE_FONT = `"${STAGE_FAMILY}", "Oxanium", system-ui, sans-serif`;

if (
  typeof document !== "undefined" &&
  typeof FontFace !== "undefined" &&
  ![...document.fonts].some((face) => face.family === STAGE_FAMILY)
) {
  document.fonts.add(
    new FontFace(STAGE_FAMILY, "url(/fonts/Oxanium-VariableFont_wght.ttf)", {
      weight: "200 800",
    }),
  );
}

/**
 * Resolves once `font` (a canvas font string) has loaded, or failed to:
 * canvas text silently falls back to another face until then.
 */
export function fontReady(font: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }
  return document.fonts.load(font).then(
    () => undefined,
    () => undefined,
  );
}

/** Portrait size factor for the viewport: 1 at 1080p, smaller on phones. */
export function overlayScale(ctx: StageContext) {
  const base = Math.min(1.15, Math.max(0.74, ctx.height / 1080));
  return ctx.quality === "low" ? base * 0.9 : base;
}

function smoothstep(a: number, b: number, v: number) {
  const k = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

/**
 * Portrait size factor for how far out the camera is, from the puck's true
 * size on screen (at 1080p): 1 in follow and close views, easing down to 0.6
 * by a whole-map fit so portraits stop burying the smokes they stand by.
 */
export function badgeZoom(ctx: StageContext, puckRadius: number) {
  const r = (puckRadius * 1080) / ctx.height;
  return 0.6 + 0.4 * smoothstep(6, 24, r);
}

/** Name plates fade out as portraits shrink; the selected player keeps theirs. */
export function nameShown(zoom: number, selected: boolean) {
  return selected ? 1 : smoothstep(0.64, 0.74, zoom);
}

/** Pucks never shrink below this radius on screen, CSS px, so they read at whole-map zoom. */
export const MIN_PUCK_PX = 11;

export type ScreenAnchor = {
  /** CSS pixels from the top left: just inside the far edge of the puck top. */
  x: number;
  y: number;
  /** Puck centre on screen. */
  cx: number;
  cy: number;
  /** Puck radius on screen, CSS pixels, before `grow`. */
  radius: number;
  /** View depth of the puck top, world units. */
  depth: number;
  /** How much the puck is scaled up to stay `MIN_PUCK_PX` on screen. */
  grow: number;
};

const top = new THREE.Vector3();
const edge = new THREE.Vector3();
const upOnGround = new THREE.Vector3();

function toScreen(ctx: StageContext, v: THREE.Vector3) {
  v.applyMatrix4(ctx.camera.matrixWorldInverse);
  const depth = -v.z;
  v.applyMatrix4(ctx.camera.projectionMatrix);
  v.x = (v.x * 0.5 + 0.5) * ctx.width;
  v.y = (0.5 - v.y * 0.5) * ctx.height;
  return depth;
}

/**
 * Where a puck standing at `feet` sits on screen, and the point its portrait
 * pointer should touch: the far edge of the (grown) puck top, so the pointer
 * lands on the puck at every zoom and pitch. False when behind the camera.
 */
export function puckAnchor(ctx: StageContext, feet: Vec3, out: ScreenAnchor) {
  const camera = ctx.camera;
  ctx.wpos(feet, top);
  top.y += PUCK_HEIGHT;
  upOnGround.setFromMatrixColumn(camera.matrixWorld, 1);
  upOnGround.y = 0;
  if (upOnGround.lengthSq() < 1e-6) {
    upOnGround.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    upOnGround.y = 0;
  }
  upOnGround.normalize();
  edge.copy(top).addScaledVector(upOnGround, PUCK_RADIUS);
  const depth = toScreen(ctx, top);
  if (depth < camera.near) {
    return false;
  }
  toScreen(ctx, edge);
  const fov = (camera.fov * Math.PI) / 180;
  out.cx = top.x;
  out.cy = top.y;
  out.depth = depth;
  out.radius = (PUCK_RADIUS * ctx.height) / (2 * depth * Math.tan(fov / 2));
  out.grow = Math.min(2.4, Math.max(1, MIN_PUCK_PX / out.radius));
  out.x = top.x + (edge.x - top.x) * out.grow;
  out.y = top.y + (edge.y - top.y) * out.grow + Math.min(4, out.radius * 0.12);
  return true;
}
