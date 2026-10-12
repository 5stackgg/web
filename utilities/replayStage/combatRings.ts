import * as THREE from "three";
import { OUTPUT_GLSL, writeSrgb } from "./playersShared";

/**
 * Glowing rings lying flat on the ground (impact flares, kill shockwaves),
 * one additive instanced draw. Flat, so they stay rings from any pitch
 * instead of discs standing up in front of the puck.
 */

const VERT = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iColor;
attribute vec2 iShape;
varying vec2 vQ;
varying vec4 vColor;
varying vec3 vShape;
void main() {
  float extent = iPos.w + iShape.x * 2.5;
  vQ = position.xy * extent;
  vec4 mv = viewMatrix * vec4(iPos.xyz + vec3(vQ.x, 1.0, -vQ.y), 1.0);
  mv.xyz -= normalize(mv.xyz) * 4.0;
  gl_Position = projectionMatrix * mv;
  vColor = iColor;
  vShape = vec3(iPos.w, iShape);
}
`;

const FRAG = /* glsl */ `
varying vec2 vQ;
varying vec4 vColor;
varying vec3 vShape;
${OUTPUT_GLSL}
void main() {
  float r = length(vQ);
  float radius = vShape.x;
  float width = vShape.y;
  float d = (r - radius) / width;
  float ring = exp(-d * d * 1.6);
  // The inside of a shockwave carries a faint wash that thins toward the centre.
  float fill = vShape.z * smoothstep(0.0, radius, r) * step(r, radius) * 0.45;
  float k = (ring + fill) * vColor.a;
  gl_FragColor = vec4(toOutput(vColor.rgb) * k, 0.0);
}
`;

export type RingBatch = {
  mesh: THREE.Mesh;
  begin(): void;
  /** `width` is the ring's soft thickness in world units, `fill` 0..1 washes its inside. */
  push(
    at: THREE.Vector3,
    radius: number,
    width: number,
    fill: number,
    color: number,
    alpha: number,
  ): void;
  end(): void;
  dispose(): void;
};

export function createRingBatch(max: number): RingBatch {
  const plane = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.setAttribute("position", plane.getAttribute("position"));
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const shape = new THREE.InstancedBufferAttribute(
    new Float32Array(max * 2),
    2,
  );
  const attrs = [pos, col, shape];
  for (const attr of attrs) {
    attr.setUsage(THREE.DynamicDrawUsage);
  }
  geometry.setAttribute("iPos", pos);
  geometry.setAttribute("iColor", col);
  geometry.setAttribute("iShape", shape);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 29;
  const p = pos.array as Float32Array;
  const c = col.array as Float32Array;
  const s = shape.array as Float32Array;
  let count = 0;
  return {
    mesh,
    begin() {
      count = 0;
    },
    push(at, radius, width, fill, color, alpha) {
      if (count >= max || alpha <= 0) {
        return;
      }
      const i = count++;
      p[i * 4] = at.x;
      p[i * 4 + 1] = at.y;
      p[i * 4 + 2] = at.z;
      p[i * 4 + 3] = radius;
      writeSrgb(c, i * 4, color);
      c[i * 4 + 3] = alpha;
      s[i * 2] = width;
      s[i * 2 + 1] = fill;
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
