import * as THREE from "three";
import { humanizeCallout } from "~/utilities/mapCallouts";
import { groundIndexFor, pxScale, smoothstep } from "./fx";
import { BADGE } from "./playersBadges";
import {
  STAGE_FONT,
  badgeZoom,
  fontReady,
  overlayScale,
  puckAnchor,
} from "./playersShared";
import type { ScreenAnchor } from "./playersShared";
import type { StageContext, StageFrame, StageModule } from "./types";

/**
 * The map's callout names, quiet on the floor: one label per place, at the
 * middle of its widest box, flat on the ground and turned to read upright
 * whichever way the camera faces. They hold a readable size on screen, give
 * way to players walking over them and to bigger places' labels, and are
 * drawn in one call from an atlas built when the map loads. In 3D a faint
 * second pass shows the parts a wall hides, so a label never reads cut.
 */

/** Label height, world units, held between these on screen (CSS px). */
const HEIGHT = 44;
const MIN_PX = 11.5;
const MAX_PX = 16;
const ALPHA = 0.78;
/** Over the floor, so a step or a kerb does not slice a label in 3D. */
const LIFT = 14;
/** A label starts to give way this far from a player, CSS px. */
const CLEAR_PX = 14;
/** The bomb sites carry the map's own painted letters. */
const SKIP = /^bombsite[ab]$/i;

const FONT_PX = 40;
const ROW = 56;
const PAD = 10;
const ATLAS_W = 1024;
const FONT = `600 ${FONT_PX}px ${STAGE_FONT}`;

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iUv;
attribute vec2 iShape;
uniform float uPxScale;
uniform vec2 uRight;
uniform vec2 uUp;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float perPx = -mv.z * uPxScale;
  float h = clamp(${HEIGHT.toFixed(1)}, ${MIN_PX.toFixed(2)} * perPx, ${MAX_PX.toFixed(2)} * perPx);
  vec2 off = uRight * (position.x * h * iShape.x) + uUp * (position.y * h);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + vec3(off.x, 0.0, off.y), 1.0);
  vUv = mix(iUv.xy, iUv.zw, uv);
  vAlpha = iShape.y;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vAlpha * uAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uTint * t.rgb, a);
  #include <colorspace_fragment>
}
`;

type Label = {
  text: string;
  x: number;
  y: number;
  z: number;
  /** Canvas px in the atlas. */
  ax: number;
  ay: number;
  aw: number;
};

const anchor: ScreenAnchor = {
  x: 0,
  y: 0,
  cx: 0,
  cy: 0,
  radius: 0,
  depth: 0,
  grow: 1,
};

export function createCalloutsModule(): StageModule {
  let mesh: THREE.Mesh | null = null;
  let xray: THREE.Mesh | null = null;
  let geometry: THREE.InstancedBufferGeometry | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let xrayMaterial: THREE.ShaderMaterial | null = null;
  const uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uTint: { value: new THREE.Color(0xfff3dc) },
    uPxScale: { value: 0.001 },
    uRight: { value: new THREE.Vector2(1, 0) },
    uUp: { value: new THREE.Vector2(0, -1) },
  };
  let texture: THREE.CanvasTexture | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let labels: Label[] = [];
  let token = 0;
  let ready: Promise<void> = Promise.resolve();
  let pos: THREE.InstancedBufferAttribute | null = null;
  let uvs: THREE.InstancedBufferAttribute | null = null;
  let shape: THREE.InstancedBufferAttribute | null = null;
  // Screen rects of the labels placed so far this frame, and of the players.
  let placed = new Float32Array(0);
  const blockers = new Float32Array(32 * 4);

  const view = new THREE.Vector3();
  const axis = new THREE.Vector3();

  function draw() {
    if (!canvas) {
      return;
    }
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.font = FONT;
    if ("letterSpacing" in g) {
      g.letterSpacing = `${FONT_PX * 0.1}px`;
    }
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = 8;
    g.strokeStyle = "rgba(10, 8, 6, 0.62)";
    g.fillStyle = "#fff";
    for (const label of labels) {
      g.strokeText(label.text, label.ax + PAD, label.ay + ROW / 2);
      g.fillText(label.text, label.ax + PAD, label.ay + ROW / 2);
    }
    if (texture) {
      texture.needsUpdate = true;
    }
  }

  function measure(g: CanvasRenderingContext2D, text: string) {
    return Math.ceil(g.measureText(text).width) + PAD * 2;
  }

  /** Lays the labels out in the atlas; again once the font has loaded. */
  function layout() {
    if (!canvas) {
      return;
    }
    const g = canvas.getContext("2d")!;
    g.font = FONT;
    if ("letterSpacing" in g) {
      g.letterSpacing = `${FONT_PX * 0.1}px`;
    }
    let x = 0;
    let y = 0;
    for (const label of labels) {
      const w = Math.min(ATLAS_W, measure(g, label.text));
      if (x + w > ATLAS_W) {
        x = 0;
        y += ROW;
      }
      label.ax = x;
      label.ay = y;
      label.aw = w;
      x += w;
    }
    const height = Math.max(ROW, y + ROW);
    if (canvas.height !== height) {
      canvas.height = height;
      texture?.dispose();
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      uniforms.uMap.value = texture;
    }
    draw();
    const uv = uvs!.array as Float32Array;
    const sh = shape!.array as Float32Array;
    labels.forEach((label, i) => {
      uv[i * 4] = label.ax / ATLAS_W;
      uv[i * 4 + 1] = 1 - (label.ay + ROW) / height;
      uv[i * 4 + 2] = (label.ax + label.aw) / ATLAS_W;
      uv[i * 4 + 3] = 1 - label.ay / height;
      sh[i * 2] = label.aw / ROW;
    });
    uvs!.needsUpdate = true;
  }

  function buildLabels(context: StageContext) {
    const map = context.map;
    const floors = groundIndexFor(map?.tri);
    const out: Array<Label & { area: number }> = [];
    for (const callout of map?.callouts ?? []) {
      if (SKIP.test(callout.name)) {
        continue;
      }
      let widest: { min: number[]; max: number[] } | null = null;
      let area = 0;
      for (const box of callout.boxes ?? []) {
        const a = (box.max[0] - box.min[0]) * (box.max[1] - box.min[1]);
        if (a > area) {
          area = a;
          widest = box;
        }
      }
      const text = humanizeCallout(callout.name).toUpperCase();
      if (!widest || !text) {
        continue;
      }
      const x = (widest.min[0] + widest.max[0]) / 2;
      const y = (widest.min[1] + widest.max[1]) / 2;
      const z = floors?.floorAt(x, y, widest.min[2] + 72) ?? widest.min[2];
      out.push({ text, x, y, z, ax: 0, ay: 0, aw: 0, area });
    }
    // Bigger places first: they win where labels would overlap.
    out.sort((a, b) => b.area - a.area);
    return out;
  }

  function allocate(count: number) {
    const geo = geometry!;
    // Frees the last map's buffers; the shared quad uploads again on use.
    geo.dispose();
    pos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    uvs = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    shape = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    shape.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("iPos", pos);
    geo.setAttribute("iUv", uvs);
    geo.setAttribute("iShape", shape);
    placed = new Float32Array(count * 4);
  }

  /** Screen rects of everyone standing on the map, CSS px: puck and portrait. */
  function playerRects(frame: StageFrame, context: StageContext) {
    let n = 0;
    const scale = overlayScale(context);
    for (const player of frame.players) {
      if (n >= 32 || !puckAnchor(context, player, anchor)) {
        continue;
      }
      const r = Math.max(anchor.radius * anchor.grow, 10);
      const portrait = player.alive || (player.diedAge ?? Infinity) < 0.35;
      const s = scale * badgeZoom(context, anchor.radius);
      const pr = portrait ? BADGE.portraitRadius * s : 0;
      const top = portrait
        ? anchor.y - (BADGE.portraitY + BADGE.portraitRadius) * s
        : anchor.cy - r;
      blockers[n * 4] = anchor.cx - Math.max(r, pr);
      blockers[n * 4 + 1] = top;
      blockers[n * 4 + 2] = anchor.cx + Math.max(r, pr);
      blockers[n * 4 + 3] = anchor.cy + r;
      n++;
    }
    return n;
  }

  return {
    name: "callouts",
    init(context) {
      const base = new THREE.PlaneGeometry(1, 1);
      geometry = new THREE.InstancedBufferGeometry();
      geometry.index = base.index;
      geometry.setAttribute("position", base.getAttribute("position"));
      geometry.setAttribute("uv", base.getAttribute("uv"));
      geometry.instanceCount = 0;
      material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...uniforms, uAlpha: { value: 1 } },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      });
      xrayMaterial = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...uniforms, uAlpha: { value: 0.3 } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      mesh = new THREE.Mesh(geometry, material);
      xray = new THREE.Mesh(geometry, xrayMaterial);
      for (const m of [mesh, xray]) {
        m.frustumCulled = false;
        m.visible = false;
      }
      xray.renderOrder = 0.4;
      mesh.renderOrder = 0.5;
      context.scene.add(xray, mesh);
    },
    onMap(context) {
      const mine = ++token;
      labels = buildLabels(context);
      geometry!.instanceCount = 0;
      if (!labels.length) {
        return;
      }
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = ATLAS_W;
        canvas.height = 1;
      }
      allocate(labels.length);
      const p = pos!.array as Float32Array;
      labels.forEach((label, i) => {
        p[i * 3] = label.x;
        p[i * 3 + 1] = label.z + LIFT;
        p[i * 3 + 2] = -label.y;
      });
      pos!.needsUpdate = true;
      layout();
      ready = fontReady(FONT).then(() => {
        if (mine === token) {
          layout();
        }
      });
    },
    update(frame, context) {
      const m = mesh!;
      if (!frame.callouts || !labels.length || !shape) {
        m.visible = false;
        xray!.visible = false;
        return;
      }
      const camera = context.camera;
      camera.updateMatrixWorld();
      // Screen right and up, laid on the floor: labels read upright.
      axis.setFromMatrixColumn(camera.matrixWorld, 0);
      const right = uniforms.uRight.value;
      right.set(axis.x, axis.z);
      if (right.lengthSq() < 1e-6) {
        right.set(1, 0);
      }
      right.normalize();
      uniforms.uUp.value.set(right.y, -right.x);
      const scale = pxScale(context);
      uniforms.uPxScale.value = scale;
      // A radar names every place, roofed or not; in 3D walls hide them.
      material!.depthTest = context.view === "3d";

      const players = playerRects(frame, context);
      const sh = shape.array as Float32Array;
      let kept = 0;
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        view
          .set(label.x, label.z + LIFT, -label.y)
          .applyMatrix4(camera.matrixWorldInverse);
        const depth = -view.z;
        let alpha = 0;
        if (depth > camera.near) {
          view.applyMatrix4(camera.projectionMatrix);
          const sx = (view.x * 0.5 + 0.5) * context.width;
          const sy = (0.5 - view.y * 0.5) * context.height;
          const h = Math.min(
            MAX_PX,
            Math.max(MIN_PX, HEIGHT / (depth * scale)),
          );
          const hw = (h * sh[i * 2]) / 2;
          const x0 = sx - hw;
          const x1 = sx + hw;
          const y0 = sy - h / 2;
          const y1 = sy + h / 2;
          if (x1 > 0 && x0 < context.width && y1 > 0 && y0 < context.height) {
            alpha = ALPHA;
            for (let j = 0; j < kept && alpha > 0; j++) {
              const ox =
                Math.min(x1, placed[j * 4 + 2]) - Math.max(x0, placed[j * 4]);
              const oy =
                Math.min(y1, placed[j * 4 + 3]) -
                Math.max(y0, placed[j * 4 + 1]);
              if (ox > 0 && oy > 0) {
                alpha *=
                  1 -
                  smoothstep(0.02, 0.25, (ox * oy) / ((x1 - x0) * (y1 - y0)));
              }
            }
            for (let j = 0; j < players && alpha > 0; j++) {
              const dx = Math.max(
                blockers[j * 4] - x1,
                0,
                x0 - blockers[j * 4 + 2],
              );
              const dy = Math.max(
                blockers[j * 4 + 1] - y1,
                0,
                y0 - blockers[j * 4 + 3],
              );
              alpha *= smoothstep(0, CLEAR_PX, Math.hypot(dx, dy));
            }
            if (alpha > 0.02) {
              placed[kept * 4] = x0;
              placed[kept * 4 + 1] = y0;
              placed[kept * 4 + 2] = x1;
              placed[kept * 4 + 3] = y1;
              kept++;
            }
          }
        }
        sh[i * 2 + 1] = alpha;
      }
      shape.needsUpdate = true;
      geometry!.instanceCount = labels.length;
      m.visible = kept > 0;
      xray!.visible = m.visible && context.view === "3d";
    },
    settle() {
      return ready;
    },
    dispose() {
      token++;
      mesh?.removeFromParent();
      xray?.removeFromParent();
      geometry?.dispose();
      material?.dispose();
      xrayMaterial?.dispose();
      texture?.dispose();
      mesh = null;
      xray = null;
      geometry = null;
      material = null;
      xrayMaterial = null;
      texture = null;
      canvas = null;
      labels = [];
    },
  };
}
