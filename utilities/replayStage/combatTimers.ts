import * as THREE from "three";
import {
  OUTPUT_GLSL,
  STAGE_FONT,
  badgeZoom,
  fontReady,
  overlayScale,
  puckAnchor,
  writeSrgb,
} from "./playersShared";
import type { ScreenAnchor } from "./playersShared";
import { canvasTexture } from "./sprites";
import { TEAM_BASE } from "./teamColors";
import type { StageContext, StageFrame, StageSmokeVoxels, Vec3 } from "./types";

/**
 * Countdown badges over smokes, fires and decoys, one screen-space instanced draw:
 * a dark disc with the whole seconds left, a team-coloured arc emptying
 * clockwise over a dark track, and a chip with the utility's icon. Fixed
 * pixel size like the portraits, drawn under them.
 */

export const TIMER_ICON = { smoke: 0, fire: 1, decoy: 2 } as const;

const DIGIT_W = 48;
const DIGIT_H = 64;
const ICON = 64;
const ATLAS_W = 512;
const ATLAS_H = 128;
const DIGIT_FONT = `800 52px ${STAGE_FONT}`;
/** Digit height on the badge, CSS px at scale 1, against its 64px cell. */
const DIGIT_PX = 18;

/** Layout in CSS px at scale 1, y up from the pointer tip. */
const R = 17;
const CY = 24;
const QUAD = [-30, -2, 30, 50] as const;

function drawAtlas(g: CanvasRenderingContext2D, advance: Float32Array) {
  g.clearRect(0, 0, ATLAS_W, ATLAS_H);
  g.font = DIGIT_FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  for (let i = 0; i < 10; i++) {
    g.fillText(String(i), i * DIGIT_W + DIGIT_W / 2, DIGIT_H / 2 + 2);
    advance[i] = (g.measureText(String(i)).width * DIGIT_PX) / DIGIT_H;
  }

  // Smoke: a cloud of three puffs on a flat base.
  g.save();
  g.translate(TIMER_ICON.smoke * ICON + ICON / 2, DIGIT_H + ICON / 2 + 4);
  g.beginPath();
  g.arc(-12, 4, 11, 0, Math.PI * 2);
  g.arc(2, -6, 15, 0, Math.PI * 2);
  g.arc(15, 5, 10, 0, Math.PI * 2);
  g.rect(-12, 4, 27, 11);
  g.fill();
  g.restore();

  // Fire: a two-tongued flame.
  g.save();
  g.translate(TIMER_ICON.fire * ICON + ICON / 2, DIGIT_H + ICON / 2 + 2);
  g.beginPath();
  g.moveTo(0, 24);
  g.bezierCurveTo(-20, 24, -22, 6, -12, -6);
  g.bezierCurveTo(-10, 2, -6, 4, -4, 2);
  g.bezierCurveTo(-8, -10, -2, -20, 6, -26);
  g.bezierCurveTo(4, -14, 20, -8, 18, 8);
  g.bezierCurveTo(17, 18, 10, 24, 0, 24);
  g.fill();
  g.restore();

  // Decoy: a grenade body putting out sound.
  g.save();
  g.translate(TIMER_ICON.decoy * ICON + ICON / 2 - 8, DIGIT_H + ICON / 2 + 2);
  g.beginPath();
  g.roundRect(-11, -14, 18, 30, 7);
  g.fill();
  g.fillRect(-6, -21, 8, 8);
  g.lineWidth = 4.5;
  g.lineCap = "round";
  g.strokeStyle = "#fff";
  for (const r of [16, 25]) {
    g.beginPath();
    g.arc(-2, 1, r, -0.6, 0.6);
    g.stroke();
  }
  g.restore();
}

const VERT = /* glsl */ `
attribute vec4 iAnchor;
attribute vec4 iColor;
attribute vec4 iTimer;
uniform vec2 uViewport;
varying vec2 vP;
varying vec4 vAnchor;
varying vec4 vColor;
varying vec4 vTimer;
void main() {
  vec2 local = mix(vec2(${QUAD[0].toFixed(1)}, ${QUAD[1].toFixed(1)}), vec2(${QUAD[2].toFixed(1)}, ${QUAD[3].toFixed(1)}), uv);
  vec2 px = iAnchor.xy + vec2(local.x, -local.y) * iAnchor.z;
  gl_Position = vec4(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0, 0.0, 1.0);
  vP = local;
  vAnchor = iAnchor;
  vColor = iColor;
  vTimer = iTimer;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uAdvance[10];
varying vec2 vP;
varying vec4 vAnchor;
varying vec4 vColor;
varying vec4 vTimer;
${OUTPUT_GLSL}
const float R = ${R.toFixed(1)};
const float CY = ${CY.toFixed(1)};
const float TAU = 6.2831853;
const float DIGIT_PX = ${DIGIT_PX.toFixed(1)};

vec4 acc = vec4(0.0);
void over(vec3 c, float a) {
  acc = vec4(c * a, a) + acc * (1.0 - a);
}
float advance(float d) {
  float a = 0.0;
  for (int i = 0; i < 10; i++) {
    a += uAdvance[i] * step(abs(float(i) - d), 0.5);
  }
  return a;
}
float digit(vec2 p, float d) {
  vec2 q = p / DIGIT_PX * ${DIGIT_H.toFixed(1)};
  float inside = step(abs(q.x), ${(DIGIT_W / 2).toFixed(1)}) * step(abs(q.y), ${(DIGIT_H / 2).toFixed(1)});
  vec2 uv = vec2(d * ${DIGIT_W.toFixed(1)} + ${(DIGIT_W / 2).toFixed(1)} + q.x, ${(DIGIT_H / 2).toFixed(1)} - q.y);
  return texture2D(uAtlas, uv / vec2(${ATLAS_W.toFixed(1)}, ${ATLAS_H.toFixed(1)})).a * inside;
}

void main() {
  vec3 team = vColor.rgb;
  float warn = vColor.w;
  float fraction = vTimer.x;
  float seconds = vTimer.y;
  float icon = vTimer.z;
  vec2 p = vP;
  vec2 c = p - vec2(0.0, CY);
  float r = length(c);
  vec3 dark = vec3(0.06, 0.07, 0.09);

  // Pointer down to the utility.
  float tri = max((abs(p.x) * 6.0 - (p.y - 1.0) * 4.0) / 7.2, p.y - CY + R);
  over(dark, 0.85 * cover(tri));

  // Disc, track, and the arc of time left from twelve o'clock clockwise.
  over(dark, 0.85 * cover(r - R - 3.6));
  float turn = fract(atan(c.x, c.y) / TAU + 1.0);
  float band = cover(abs(r - R - 0.6) - 2.0);
  vec3 arc = mix(team, vec3(1.0), warn);
  over(vec3(0.0), 0.35 * band);
  over(arc, band * step(turn, fraction));

  // Whole seconds left, centred.
  float tens = floor(seconds / 10.0);
  float ones = seconds - tens * 10.0;
  float two = step(0.5, tens);
  float wTens = advance(tens) * two;
  float wOnes = advance(ones);
  float left = -0.5 * (wTens + wOnes);
  vec2 dp = c - vec2(0.0, -0.5);
  float ink = digit(dp - vec2(left + 0.5 * wTens, 0.0), tens) * two
    + digit(dp - vec2(left + wTens + 0.5 * wOnes, 0.0), ones);
  over(mix(vec3(1.0), vec3(1.0, 0.86, 0.45), warn), clamp(ink, 0.0, 1.0));

  // Utility chip on the disc's shoulder.
  vec2 cc = c - vec2(-R * 0.84, R * 0.84);
  float chip = length(cc) - 8.5;
  over(team, cover(chip - 1.4));
  over(dark, cover(chip));
  vec2 iq = cc / 7.0 * ${(ICON / 2 - 6).toFixed(1)};
  vec2 iuv = vec2(icon * ${ICON.toFixed(1)} + ${(ICON / 2).toFixed(1)} + iq.x, ${(DIGIT_H + ICON / 2).toFixed(1)} - iq.y);
  float glyph = texture2D(uAtlas, iuv / vec2(${ATLAS_W.toFixed(1)}, ${ATLAS_H.toFixed(1)})).a * step(chip, 0.0);
  over(vec3(0.94), glyph);

  vec4 result = acc * vAnchor.w;
  vec3 straight = result.a > 0.0001 ? result.rgb / result.a : vec3(0.0);
  gl_FragColor = vec4(toOutput(straight) * result.a, result.a);
}
`;

export type TimerBatch = {
  mesh: THREE.Mesh;
  /** Resolves once the digits are drawn in the stage font. */
  ready: Promise<void>;
  begin(): void;
  push(
    x: number,
    y: number,
    scale: number,
    alpha: number,
    team: number,
    warn: number,
    fraction: number,
    seconds: number,
    icon: number,
  ): void;
  end(): void;
  setViewport(width: number, height: number): void;
  dispose(): void;
};

export function createTimerBatch(max: number): TimerBatch {
  const advance = new Float32Array(10);
  const texture = canvasTexture(ATLAS_W, ATLAS_H, (g) => drawAtlas(g, advance));
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  const ready = fontReady(DIGIT_FONT).then(() => {
    const canvas = texture.image as HTMLCanvasElement;
    drawAtlas(canvas.getContext("2d")!, advance);
    texture.needsUpdate = true;
  });

  const plane = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  geometry.setAttribute("uv", plane.getAttribute("uv"));
  const attrs: THREE.InstancedBufferAttribute[] = [];
  const arrays: Record<string, Float32Array> = {};
  for (const name of ["iAnchor", "iColor", "iTimer"]) {
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 4),
      4,
    );
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
    attrs.push(attr);
    arrays[name] = attr.array as Float32Array;
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uAtlas: { value: texture },
      uAdvance: { value: advance },
      uViewport: { value: new THREE.Vector2(1, 1) },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // Over the world and its effects, under portraits and damage numbers.
  mesh.renderOrder = 990;
  const { iAnchor, iColor, iTimer } = arrays;
  let count = 0;
  return {
    mesh,
    ready,
    begin() {
      count = 0;
    },
    push(x, y, scale, alpha, team, warn, fraction, seconds, icon) {
      if (count >= max || alpha <= 0) {
        return;
      }
      const i = count++ * 4;
      iAnchor[i] = x;
      iAnchor[i + 1] = y;
      iAnchor[i + 2] = scale;
      iAnchor[i + 3] = alpha;
      writeSrgb(iColor, i, team);
      iColor[i + 3] = warn;
      iTimer[i] = fraction;
      iTimer[i + 1] = seconds;
      iTimer[i + 2] = icon;
    },
    end() {
      geometry.instanceCount = count;
      for (const attr of attrs) {
        attr.clearUpdateRanges();
        attr.addUpdateRange(0, count * attr.itemSize);
        attr.needsUpdate = true;
      }
      mesh.visible = count > 0;
    },
    setViewport(width, height) {
      material.uniforms.uViewport.value.set(width, height);
    },
    dispose() {
      plane.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

/** The last seconds, when the arc turns white. */
const WARN_SECS = 3;
/** A decoy's badge over the decoy on the ground. */
const DECOY_TOP = 24;
/** A smoke's top when the frame has no voxels to measure, above the detonation. */
const SMOKE_TOP = 128;
const FIRE_TOP = 64;
const MAX_TIMERS = 32;
const MAX_PLAYERS = 32;

/** The top of a smoke's final volume, from Valve's grid; computed once per grid. */
const smokeTops = new WeakMap<StageSmokeVoxels, number>();
function smokeTop(voxels: StageSmokeVoxels) {
  let top = smokeTops.get(voxels);
  if (top === undefined) {
    const { dx, dy, dz, arrival } = voxels;
    top = voxels.oz + SMOKE_TOP;
    search: for (let k = dz - 1; k >= 0; k--) {
      for (let v = k * dx * dy, end = v + dx * dy; v < end; v++) {
        if (arrival[v] < 255) {
          top = voxels.oz + (k + 1) * voxels.vs;
          break search;
        }
      }
    }
    smokeTops.set(voxels, top);
  }
  return top;
}

export type UtilityTimers = {
  mesh: THREE.Mesh;
  ready: Promise<void>;
  update(frame: StageFrame, ctx: StageContext): void;
  resize(ctx: StageContext): void;
  dispose(): void;
};

/**
 * How long each smoke, fire and decoy has left. A badge slides off any puck
 * it would cover, so a timer never hides who is standing in the utility.
 */
export function createUtilityTimers(): UtilityTimers {
  const batch = createTimerBatch(MAX_TIMERS);
  const anchor: ScreenAnchor = {
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    depth: 0,
    grow: 1,
  };
  const point: Vec3 = { x: 0, y: 0, z: 0 };
  const px = new Float32Array(MAX_PLAYERS);
  const py = new Float32Array(MAX_PLAYERS);
  const pr = new Float32Array(MAX_PLAYERS);
  let players = 0;

  function push(
    ctx: StageContext,
    overlay: number,
    team: number,
    total: number,
    remaining: number,
    icon: number,
  ) {
    if (remaining <= 0 || !puckAnchor(ctx, point, anchor)) {
      return;
    }
    if (
      anchor.cx < -40 ||
      anchor.cx > ctx.width + 40 ||
      anchor.cy < -60 ||
      anchor.cy > ctx.height + 20
    ) {
      return;
    }
    const scale = overlay * Math.max(0.9, 1.15 * badgeZoom(ctx, anchor.radius));
    // Slide off any puck it would cover; fade if it still can't clear.
    let ox = 0;
    let oy = 0;
    const reach = (R + 3.6) * scale;
    for (let i = 0; i < players; i++) {
      const dx = anchor.cx + ox - px[i];
      const dy = anchor.cy - CY * scale + oy - py[i];
      const d = Math.hypot(dx, dy);
      const need = reach + pr[i] * 0.9;
      if (d < need) {
        ox += d > 1e-3 ? (dx / d) * (need - d) : 0;
        oy += d > 1e-3 ? (dy / d) * (need - d) : -need;
      }
    }
    let alpha = 1;
    for (let i = 0; i < players; i++) {
      const d = Math.hypot(
        anchor.cx + ox - px[i],
        anchor.cy - CY * scale + oy - py[i],
      );
      if (d < reach + pr[i] * 0.6) {
        alpha = 0.5;
      }
    }
    const warn = Math.min(1, Math.max(0, (WARN_SECS - remaining) / 0.4));
    batch.push(
      anchor.cx + ox,
      anchor.cy + oy,
      scale,
      alpha * Math.min(1, remaining / 0.25),
      team,
      warn,
      Math.min(1, Math.max(0, remaining / Math.max(total, 1e-3))),
      Math.min(99, Math.ceil(remaining - 1e-3)),
      icon,
    );
  }

  return {
    mesh: batch.mesh,
    ready: batch.ready,
    update(frame, ctx) {
      batch.begin();
      players = 0;
      for (const player of frame.players) {
        if (players >= MAX_PLAYERS || !player.alive) {
          continue;
        }
        if (puckAnchor(ctx, player, anchor)) {
          px[players] = anchor.cx;
          py[players] = anchor.cy;
          pr[players] = anchor.radius * anchor.grow;
          players++;
        }
      }
      const overlay = overlayScale(ctx);
      for (const smoke of frame.smokes) {
        if (smoke.remaining === null) {
          continue;
        }
        point.x = smoke.at.x;
        point.y = smoke.at.y;
        point.z = smoke.voxels
          ? smokeTop(smoke.voxels)
          : smoke.at.z + SMOKE_TOP;
        push(
          ctx,
          overlay,
          TEAM_BASE[smoke.team],
          smoke.age + smoke.remaining,
          smoke.remaining,
          TIMER_ICON.smoke,
        );
      }
      for (const inferno of frame.infernos) {
        if (inferno.remaining === null || !inferno.flames.length) {
          continue;
        }
        let x = 0;
        let y = 0;
        let z = -Infinity;
        for (const flame of inferno.flames) {
          x += flame.x;
          y += flame.y;
          z = Math.max(z, flame.z);
        }
        point.x = x / inferno.flames.length;
        point.y = y / inferno.flames.length;
        point.z = z + FIRE_TOP;
        push(
          ctx,
          overlay,
          TEAM_BASE[inferno.team],
          inferno.age + inferno.remaining,
          inferno.remaining,
          TIMER_ICON.fire,
        );
      }
      for (const det of frame.detonations) {
        if (det.type !== "decoy" || det.remaining == null) {
          continue;
        }
        point.x = det.at.x;
        point.y = det.at.y;
        point.z = det.at.z + DECOY_TOP;
        push(
          ctx,
          overlay,
          TEAM_BASE[det.team],
          det.age + det.remaining,
          det.remaining,
          TIMER_ICON.decoy,
        );
      }
      batch.end();
    },
    resize(ctx) {
      batch.setViewport(ctx.width, ctx.height);
    },
    dispose() {
      batch.mesh.removeFromParent();
      batch.dispose();
    },
  };
}
