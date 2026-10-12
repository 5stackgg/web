import * as THREE from "three";
import { SUN_WORLD } from "./map";
import {
  CORE_RADIUS,
  OUTPUT_GLSL,
  PUCK_HEIGHT,
  PUCK_RADIUS,
  writeSrgb,
} from "./playersShared";

/**
 * The puck body, its x-ray ghost and the decal under it, each one instanced
 * draw for every player. Colours arrive as sRGB and are shaded in sRGB: the pucks are
 * graded by hand, not physically lit.
 */

/** Lit by the map's own sun, so pucks and their shadows agree. */
const LIGHT = SUN_WORLD;

/** Half the decal quad: the selection halo, or the death X as it pops in. */
const DECAL_HALF_ALIVE = PUCK_RADIUS * 1.9;
const DECAL_HALF = PUCK_RADIUS * 2.3;

type Attr = THREE.InstancedBufferAttribute;

function instanced(
  geometry: THREE.InstancedBufferGeometry,
  max: number,
  layout: Record<string, number>,
) {
  const byName: Record<string, Float32Array> = {};
  const list: Attr[] = [];
  for (const [name, size] of Object.entries(layout)) {
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(max * size),
      size,
    );
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
    byName[name] = attr.array as Float32Array;
    list.push(attr);
  }
  return { byName, list };
}

function flush(
  geometry: THREE.InstancedBufferGeometry,
  attrs: Attr[],
  count: number,
) {
  geometry.instanceCount = count;
  for (const attr of attrs) {
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, count * attr.itemSize);
    attr.needsUpdate = true;
  }
}

/** A short bevelled cylinder lathed from a profile with its own normals, plus the C4 box. */
function puckGeometry() {
  const R = PUCK_RADIUS;
  const H = PUCK_HEIGHT;
  const bevel = 3;
  const segments = 48;
  const profile: Array<[number, number, number, number]> = [
    [R - 1, 0, 0.7, -0.7],
    [R, 1.2, 1, 0],
    [R, H - bevel, 1, 0],
  ];
  for (let k = 1; k <= 4; k++) {
    const a = (k / 4) * (Math.PI / 2);
    profile.push([
      R - bevel + bevel * Math.cos(a),
      H - bevel + bevel * Math.sin(a),
      Math.cos(a),
      Math.sin(a),
    ]);
  }
  profile.push([0, H, 0, 1]);

  const positions: number[] = [];
  const normals: number[] = [];
  const parts: number[] = [];
  const indices: number[] = [];
  for (const [r, y, nr, ny] of profile) {
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      positions.push(r * c, y, r * s);
      normals.push(nr * c, ny, nr * s);
      parts.push(0);
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * segments + j;
      const b = i * segments + ((j + 1) % segments);
      const c = a + segments;
      const d = b + segments;
      indices.push(a, c, b, b, c, d);
    }
  }

  // The bomb rides on the puck like a backpack, behind the facing tick.
  const box = new THREE.BoxGeometry(13, 7, 21);
  box.rotateY(0.3);
  box.translate(-5, H + 3.5, 0);
  const base = positions.length / 3;
  const boxPos = box.getAttribute("position");
  const boxNormal = box.getAttribute("normal");
  for (let i = 0; i < boxPos.count; i++) {
    positions.push(boxPos.getX(i), boxPos.getY(i), boxPos.getZ(i));
    normals.push(boxNormal.getX(i), boxNormal.getY(i), boxNormal.getZ(i));
    parts.push(1);
  }
  const boxIndex = box.getIndex()!;
  for (let i = 0; i < boxIndex.count; i++) {
    indices.push(base + boxIndex.getX(i));
  }
  box.dispose();

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aPart", new THREE.Float32BufferAttribute(parts, 1));
  geometry.setIndex(indices);
  return geometry;
}

const PUCK_VERT = /* glsl */ `
attribute float aPart;
attribute vec4 iPosYaw;
attribute vec4 iShape;
attribute vec3 iRim;
attribute vec3 iCore;
attribute vec4 iFx;
attribute float iDim;
varying vec3 vLocal;
varying vec3 vNormal;
varying float vPart;
varying vec3 vRim;
varying vec3 vCore;
varying vec4 vFx;
varying float vDim;
varying float vSelected;
void main() {
  vSelected = iShape.w;
#ifdef GHOST
  vec3 p = position * (1.0 - aPart);
#else
  vec3 p = position * step(aPart, iShape.z);
#endif
  p.xz *= iShape.x;
  p.y *= iShape.y;
  float c = cos(iPosYaw.w);
  float s = sin(iPosYaw.w);
  vec3 world = iPosYaw.xyz + vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  vNormal = vec3(c * normal.x + s * normal.z, normal.y, -s * normal.x + c * normal.z);
  vLocal = position;
  vPart = aPart;
  vRim = iRim;
  vCore = iCore;
  vFx = iFx;
  vDim = iDim;
  vec4 mv = viewMatrix * vec4(world, 1.0);
#ifdef GHOST
  // Toward the eye by more than the bomb stands proud of the core, so the
  // puck never ghosts through itself, only through what stands in front.
  mv.xyz -= normalize(mv.xyz) * 12.0;
#endif
  gl_Position = projectionMatrix * mv;
}
`;

const PUCK_FRAG = /* glsl */ `
uniform vec3 uLight;
varying vec3 vLocal;
varying vec3 vNormal;
varying float vPart;
varying vec3 vRim;
varying vec3 vCore;
varying vec4 vFx;
varying float vDim;
${OUTPUT_GLSL}
const float H = ${PUCK_HEIGHT.toFixed(1)};
const float RC = ${CORE_RADIUS.toFixed(2)};
const vec3 CHARCOAL = vec3(0.125, 0.145, 0.098);
void main() {
  float flash = vFx.x;
  float fire = vFx.y;
  float dead = vFx.z;
  float blind = vFx.w;
  vec3 n = normalize(vNormal);
  float lambert = max(dot(n, uLight), 0.0);
  float r = length(vLocal.xz);

  vec3 rim = mix(vRim, vec3(1.0, 0.22, 0.34), flash * 0.85);
  vec3 body = rim * (0.55 + 0.6 * lambert);

  vec3 core = mix(vCore, vec3(1.0), clamp(fire * 0.8 + blind * 0.85 + flash * 0.25, 0.0, 1.0));
  vec3 coreCol = core * (0.95 + 0.1 * (1.0 - r / RC));
  coreCol *= 1.0 - 0.06 * smoothstep(RC - 3.0, RC, r);
  // The emissive core bleeds onto the rim like a little bloom.
  float spill = exp(-max(r - RC, 0.0) / (1.3 + fire * 6.0)) * (0.2 + fire * 0.9);
  vec3 rimTop = rim * (0.95 + 0.2 * lambert) + core * spill * (1.0 - dead);
  vec3 top = mix(rimTop, coreCol, cover(r - RC));

  // Facing: a short white arc on the core's edge, local +x.
  float ang = abs(atan(vLocal.z, vLocal.x));
  float hw = max(1.6, fwidth(r) * 1.1);
  float dTick = max(abs(r - (RC - 2.8)) - hw, (ang - 0.32) * r);
  top = mix(top, vec3(1.0), cover(dTick) * (1.0 - dead));

  float isTop = step(H - 0.05, vLocal.y);
  vec3 col = mix(body, top, isTop);
  col = mix(col, CHARCOAL * (0.75 + 0.6 * lambert) + vec3(0.04) * isTop, dead);

  vec3 bomb = vec3(0.74, 0.07, 0.05) * (0.55 + 0.55 * lambert) + vec3(0.12, 0.03, 0.02) * step(0.9, n.y);
  col = mix(col, bomb, vPart);
  // Off the storey in view: greyed and darkened, so it reads as elsewhere.
  float luma = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, mix(vec3(luma), col, 0.3) * 0.5 + vec3(0.06), vDim);
  gl_FragColor = vec4(toOutput(col), 1.0);
}
`;

/** Where a wall or roof hides a puck, a flat see-through copy shows where it is. */
const GHOST_FRAG = /* glsl */ `
varying float vSelected;
varying vec3 vLocal;
varying vec3 vNormal;
varying float vPart;
varying vec3 vRim;
varying vec3 vCore;
varying vec4 vFx;
varying float vDim;
${OUTPUT_GLSL}
const float H = ${PUCK_HEIGHT.toFixed(1)};
const float RC = ${CORE_RADIUS.toFixed(2)};
void main() {
  float r = length(vLocal.xz);
  float isTop = step(H - 0.05, vLocal.y) * (1.0 - vPart);
  vec3 col = mix(mix(vRim, vec3(1.0), 0.3), vCore, cover(r - RC) * isTop);
  col = mix(col, vec3(0.3, 0.32, 0.28), vFx.z);
  float a = mix(mix(0.5, 0.75, vSelected), 0.25, vFx.z) * (1.0 - 0.6 * vDim);
  gl_FragColor = vec4(toOutput(col) * a, a);
}
`;

export type PuckBatch = {
  mesh: THREE.Mesh;
  ghost: THREE.Mesh;
  begin(): void;
  push(
    pos: THREE.Vector3,
    yaw: number,
    scale: number,
    height: number,
    bomb: boolean,
    selected: boolean,
    rim: number,
    core: number,
    flash: number,
    fire: number,
    dead: number,
    blind: number,
    /** 0..1, how far it is dimmed for standing off the storey in view. */
    dim: number,
  ): void;
  end(): void;
  dispose(): void;
};

export function createPuckBatch(max: number): PuckBatch {
  const geometry = puckGeometry();
  const attrs = instanced(geometry, max, {
    iPosYaw: 4,
    iShape: 4,
    iRim: 3,
    iCore: 3,
    iFx: 4,
    iDim: 1,
  });
  const material = new THREE.ShaderMaterial({
    vertexShader: PUCK_VERT,
    fragmentShader: PUCK_FRAG,
    uniforms: { uLight: { value: LIGHT } },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const ghostMaterial = new THREE.ShaderMaterial({
    vertexShader: PUCK_VERT,
    fragmentShader: GHOST_FRAG,
    defines: { GHOST: "" },
    transparent: true,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
  });
  const ghost = new THREE.Mesh(geometry, ghostMaterial);
  ghost.frustumCulled = false;
  ghost.renderOrder = -5;
  let count = 0;
  const {
    iPosYaw: posYaw,
    iShape: shape,
    iRim: rimA,
    iCore: coreA,
    iFx: fx,
    iDim: dimA,
  } = attrs.byName;
  return {
    mesh,
    ghost,
    begin() {
      count = 0;
    },
    push(
      pos,
      yaw,
      scale,
      height,
      bomb,
      selected,
      rim,
      core,
      flash,
      fire,
      dead,
      blind,
      dim,
    ) {
      if (count >= max) {
        return;
      }
      const i = count++;
      posYaw[i * 4] = pos.x;
      posYaw[i * 4 + 1] = pos.y;
      posYaw[i * 4 + 2] = pos.z;
      posYaw[i * 4 + 3] = yaw;
      shape[i * 4] = scale;
      shape[i * 4 + 1] = height;
      shape[i * 4 + 2] = bomb ? 1 : 0;
      shape[i * 4 + 3] = selected ? 1 : 0;
      writeSrgb(rimA, i * 3, rim);
      writeSrgb(coreA, i * 3, core);
      fx[i * 4] = flash;
      fx[i * 4 + 1] = fire;
      fx[i * 4 + 2] = dead;
      fx[i * 4 + 3] = blind;
      dimA[i] = dim;
    },
    end() {
      flush(geometry, attrs.list, count);
      mesh.visible = count > 0;
      ghost.visible = count > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ghostMaterial.dispose();
    },
  };
}

const GROUND_VERT = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iGlow;
attribute vec4 iMark;
uniform float uPull;
varying vec2 vQ;
varying vec4 vA;
varying vec4 vB;
varying vec4 vGlow;
varying vec4 vMark;
void main() {
  // The fragment works in puck units; a puck grown for a far zoom grows its
  // decal. Only the dead need the room for the X.
  float dead = step(0.001, iA.w) + step(0.001, iGlow.w);
  vec2 q = position.xy * mix(${DECAL_HALF_ALIVE.toFixed(1)}, ${DECAL_HALF.toFixed(1)}, min(dead, 1.0));
  vQ = vec2(q.x, -q.y);
  vec4 mv = viewMatrix * vec4(iPos.xyz + vec3(vQ.x, 0.8, vQ.y) * iB.w, 1.0);
  // Pulled toward the eye so ramps and stairs do not swallow it; walls,
  // being far taller than the pull, still hide it.
  mv.xyz += normalize(-mv.xyz) * uPull;
  gl_Position = projectionMatrix * mv;
  vA = iA;
  vB = vec4(iB.xyz, iPos.w);
  vGlow = iGlow;
  vMark = iMark;
}
`;

const GROUND_FRAG = /* glsl */ `
varying vec2 vQ;
varying vec4 vA;
varying vec4 vB;
varying vec4 vGlow;
varying vec4 vMark;
${OUTPUT_GLSL}
const float R = ${PUCK_RADIUS.toFixed(1)};
const vec3 CHARCOAL = vec3(0.125, 0.145, 0.098);
vec4 acc = vec4(0.0);
void over(vec3 c, float a) {
  acc = vec4(c * a, a) + acc * (1.0 - a);
}
float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  float shadowA = vA.x;
  float selected = vA.y;
  float flash = vA.z;
  float markA = vA.w;
  float r = length(vQ);

  // Contact shadow / AO under the puck, nudged away from the light.
  float rs = length(vQ - vB.xy);
  float shadow = shadowA * (0.42 * (1.0 - smoothstep(R * 0.8, R * 1.45, rs)) + 0.3 * (1.0 - smoothstep(R * 0.95, R * 1.08, rs)));

  // The dead body: a flat charcoal disc where the puck sank, and the team X
  // over it, both centred on the death spot and scaled together.
  float body = vGlow.w;
  over(vec3(0.0), shadow * (1.0 - body * 0.5));
  over(CHARCOAL, 0.92 * body * cover(r - R * 0.92));
  vec2 xq = mat2(0.70711, 0.70711, -0.70711, 0.70711) * vQ / vB.w;
  float dX = min(box(xq, vec2(R * 1.1, R * 0.19)), box(xq, vec2(R * 0.19, R * 1.1))) * vB.w;
  over(vec3(0.0), 0.5 * markA * cover(dX - 2.5));
  over(vMark.rgb, 0.95 * markA * cover(dX));

  float sel = selected * (0.5 * exp(-pow((r - R * 1.32) / (R * 0.2), 2.0)) + 0.22 * smoothstep(R * 1.75, R * 1.0, r) * step(R * 0.9, r));
  float hurtR = mix(1.1, 1.75, vB.z) * R;
  float hurt = flash * exp(-pow((r - hurtR) / (R * 0.16), 2.0));
  // Blinded: a white glow pooled around the puck.
  float blind = vMark.w * (0.9 * exp(-pow((r - R * 1.15) / (R * 0.3), 2.0)) + 0.45 * smoothstep(R * 1.85, R * 0.9, r) * step(R * 0.85, r));
  vec3 add = vGlow.rgb * sel + vec3(1.0, 0.32, 0.45) * hurt + vec3(1.0) * blind;

  vec3 straight = acc.a > 0.0001 ? acc.rgb / acc.a : vec3(0.0);
  gl_FragColor = vec4(toOutput(straight) * acc.a + toOutput(add), acc.a);
}
`;

export type GroundBatch = {
  mesh: THREE.Mesh;
  begin(): void;
  push(
    feet: THREE.Vector3,
    shadow: number,
    shadowX: number,
    shadowZ: number,
    selected: number,
    flash: number,
    flashAge: number,
    mark: number,
    markScale: number,
    grow: number,
    glow: number,
    markColor: number,
    /** 0..1, the white glow of a blinded player. */
    blind: number,
    /** 0..1, the flat charcoal body of a dead player. */
    body: number,
  ): void;
  end(): void;
  dispose(): void;
};

export function createGroundBatch(max: number): GroundBatch {
  const plane = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  const attrs = instanced(geometry, max, {
    iPos: 4,
    iA: 4,
    iB: 4,
    iGlow: 4,
    iMark: 4,
  });
  const material = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: { uPull: { value: 4 } },
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  const { iPos: pos, iA: a, iB: b, iGlow: glowA, iMark: markA } = attrs.byName;
  let count = 0;
  return {
    mesh,
    begin() {
      count = 0;
    },
    push(
      feet,
      shadow,
      shadowX,
      shadowZ,
      selected,
      flash,
      flashAge,
      mark,
      markScale,
      grow,
      glow,
      markColor,
      blind,
      body,
    ) {
      if (count >= max) {
        return;
      }
      const i = count++;
      pos[i * 4] = feet.x;
      pos[i * 4 + 1] = feet.y;
      pos[i * 4 + 2] = feet.z;
      pos[i * 4 + 3] = markScale;
      a[i * 4] = shadow;
      a[i * 4 + 1] = selected;
      a[i * 4 + 2] = flash;
      a[i * 4 + 3] = mark;
      b[i * 4] = shadowX;
      b[i * 4 + 1] = shadowZ;
      b[i * 4 + 2] = flashAge;
      b[i * 4 + 3] = grow;
      writeSrgb(glowA, i * 4, glow);
      glowA[i * 4 + 3] = body;
      writeSrgb(markA, i * 4, markColor);
      markA[i * 4 + 3] = blind;
    },
    end() {
      flush(geometry, attrs.list, count);
      mesh.visible = count > 0;
    },
    dispose() {
      plane.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
