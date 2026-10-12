import * as THREE from "three";
import { OUTPUT_GLSL, writeSrgb } from "./playersShared";

/**
 * Camera-facing ribbons between two points, one instanced draw: glows
 * (additive) and tracers, comets, bolts and the thick jagged comic beam of a
 * hit (solid), mixed per instance through premultiplied alpha. Ends can be
 * rounded into a capsule, with a white-hot head.
 */

const VERT = /* glsl */ `
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iW;
attribute vec4 iEdge;
attribute vec4 iCore;
attribute vec4 iMisc;
uniform float uPxScale;
varying vec2 vUv;
varying float vAlong;
varying vec3 vShape;
varying vec4 vEdge;
varying vec4 vCore;
varying vec4 vMisc;
void main() {
  float s = position.x + 0.5;
  float u = mix(iA.w, iB.w, s);
  vec3 a = (modelViewMatrix * vec4(iA.xyz, 1.0)).xyz;
  vec3 b = (modelViewMatrix * vec4(iB.xyz, 1.0)).xyz;
  vec3 p = mix(a, b, u);
  vec3 side = cross(b - a, p);
  side = dot(side, side) > 1e-8 ? normalize(side) : vec3(0.0, 1.0, 0.0);
  // The pixel floor tapers with the ribbon, so a comet keeps its shape when far.
  float taper = mix(iW.x, iW.y, s);
  float floorPx = iW.z * taper / max(max(iW.x, iW.y), 1e-3);
  float w = max(taper, floorPx * -p.z * uPxScale);
  p += side * w * position.y;
  gl_Position = projectionMatrix * vec4(p, 1.0);
  vUv = vec2(s, position.y);
  vAlong = u * iMisc.z;
  // World distance from the tail end, the instance's length, local half-width.
  float span = iMisc.z * (iB.w - iA.w);
  vShape = vec3(s * span, span, w);
  vEdge = iEdge;
  vCore = iCore;
  vMisc = vec4(iMisc.xy, iW.w, iMisc.w);
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying float vAlong;
varying vec3 vShape;
varying vec4 vEdge;
varying vec4 vCore;
varying vec4 vMisc;
${OUTPUT_GLSL}
void main() {
  float s = vUv.x;
  float v = abs(vUv.y);
  float ramp = vMisc.x;
  float caps = vMisc.y;
  float solid = vCore.w < 0.5 ? 1.0 : 0.0;
  float jag = vMisc.z;
  // Rounded ends: distance from the capsule's axis in half-widths.
  float x = vShape.x;
  float len = max(vShape.y, 1e-3);
  float w = max(vShape.z, 1e-3);
  float rc = min(w, len * 0.5);
  float toHead = len - x;
  float r = v;
  if (caps > 0.5 && toHead < rc) {
    r = length(vec2((rc - toHead) / rc, v));
  }
  if (caps > 1.5 && x < rc) {
    r = length(vec2((rc - x) / rc, v));
  }
  // Comic jaggedness: the edge saws in and out along the beam.
  float saw = abs(fract(vAlong / 34.0 + vMisc.w) * 2.0 - 1.0);
  float edge = 1.0 - jag * 0.42 * saw;
  float hard = clamp((edge - r) / max(fwidth(r), 1e-4) + 0.5, 0.0, 1.0);
  float soft = smoothstep(edge, edge * 0.2, r);
  float across = mix(soft, hard, solid);
  float bright = mix(1.0, pow(s, 1.6), ramp);
  float coreK = smoothstep(edge * (0.35 + 0.3 * solid), 0.0, r) * mix(0.35, 1.0, bright);
  vec3 col = mix(vEdge.rgb, vCore.rgb, coreK);
  // A capped round burns white-hot at its head.
  float hot = step(0.5, caps) * smoothstep(w * 3.0, w * 0.6, toHead) * (1.0 - r * r);
  col = mix(col, vec3(1.0), clamp(hot, 0.0, 1.0));
  float a = vEdge.w * across * mix(0.12, 1.0, max(bright, hot));
  gl_FragColor = vec4(toOutput(col) * a, a * solid);
}
`;

export type BeamBatch = {
  mesh: THREE.Mesh;
  begin(camera: THREE.PerspectiveCamera, viewportHeight: number): void;
  /**
   * A ribbon over the part [tail, head] (0..1) of the segment a→b. Widths are
   * half-widths in world units at the tail and head ends, never under `minPx`
   * at the wider end (tapering with them). `ramp` brightens toward the head,
   * `jag` saws the edges, `caps` rounds the head (1) or both ends (2).
   */
  push(
    a: THREE.Vector3,
    b: THREE.Vector3,
    tail: number,
    head: number,
    tailWidth: number,
    headWidth: number,
    minPx: number,
    edge: number,
    core: number,
    alpha: number,
    additive: boolean,
    ramp: number,
    jag: number,
    seed: number,
    caps?: number,
  ): void;
  end(): void;
  dispose(): void;
};

export function createBeamBatch(max: number): BeamBatch {
  const plane = new THREE.PlaneGeometry(1, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  const layout = { iA: 4, iB: 4, iW: 4, iEdge: 4, iCore: 4, iMisc: 4 };
  const attrs: THREE.InstancedBufferAttribute[] = [];
  const arrays: Record<string, Float32Array> = {};
  for (const [name, size] of Object.entries(layout)) {
    const attr = new THREE.InstancedBufferAttribute(
      new Float32Array(max * size),
      size,
    );
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
    attrs.push(attr);
    arrays[name] = attr.array as Float32Array;
  }
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uPxScale: { value: 0.001 } },
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  const { iA, iB, iW, iEdge, iCore, iMisc } = arrays;
  let count = 0;
  return {
    mesh,
    begin(camera, viewportHeight) {
      count = 0;
      material.uniforms.uPxScale.value =
        (2 * Math.tan((camera.fov * Math.PI) / 360)) /
        Math.max(1, viewportHeight);
    },
    push(
      a,
      b,
      tail,
      head,
      tailWidth,
      headWidth,
      minPx,
      edge,
      core,
      alpha,
      additive,
      ramp,
      jag,
      seed,
      caps = 0,
    ) {
      if (count >= max || alpha <= 0 || head <= tail) {
        return;
      }
      const i = count++ * 4;
      iA[i] = a.x;
      iA[i + 1] = a.y;
      iA[i + 2] = a.z;
      iA[i + 3] = tail;
      iB[i] = b.x;
      iB[i + 1] = b.y;
      iB[i + 2] = b.z;
      iB[i + 3] = head;
      iW[i] = tailWidth;
      iW[i + 1] = headWidth;
      iW[i + 2] = minPx;
      iW[i + 3] = jag;
      writeSrgb(iEdge, i, edge);
      iEdge[i + 3] = alpha;
      writeSrgb(iCore, i, core);
      iCore[i + 3] = additive ? 1 : 0;
      iMisc[i] = ramp;
      iMisc[i + 1] = caps;
      iMisc[i + 2] = a.distanceTo(b);
      iMisc[i + 3] = seed;
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
    dispose() {
      plane.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
