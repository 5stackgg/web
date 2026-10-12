import * as THREE from "three";
import { minFilter, type GroundFill } from "./mapPrep";
import { SAND_GLSL } from "./mapShaders";

/**
 * What the map sits in: soft sand dunes rolling away from its footprint and
 * a warm sky dome, so no view ever shows black. Dunes are a fixed mesh in
 * source units (under the map's rotated group), smooth shaded so no grid
 * line shows; everything is lit in the shader from the same sun as the map.
 */

const DUNE_VERT = /* glsl */ `
attribute vec2 aYard;
varying vec3 vSrc;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vYard;
void main() {
  vSrc = position;
  vNormal = normal;
  vYard = aYard;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const DUNE_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uFloor;
uniform vec3 uSand;
uniform vec3 uSandShade;
uniform vec3 uShadow;
uniform vec3 uHaze;
uniform vec3 uMapCentre;
uniform vec2 uHazeRange;
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uHasShadow;
varying vec3 vSrc;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vYard;
${SAND_GLSL}

void main() {
  vec3 n = normalize(vNormal);
  float lit = clamp(dot(n, uSun) / uSun.z, 0.0, 1.15);
  if (uHasShadow > 0.5) {
    vec4 sc = uShadowMatrix * vec4(vWorld, 1.0);
    // Faded out toward the shadow map's edge, so its extent never shows as
    // a line across the sand.
    float edge = smoothstep(0.0, 0.08, min(min(sc.x, 1.0 - sc.x), min(sc.y, 1.0 - sc.y)));
    if (edge > 0.0) {
      float seen = texture(uShadowMap, vec3(sc.xy, sc.z - 0.003));
      lit *= mix(1.0, mix(0.55, 1.0, seen), edge);
    }
  }
  vec3 col = sandColor(vSrc, lit, uSand, uSandShade);
  // Ground in a closed-off courtyard is the map's own, a shade darker as it
  // is never walked and darker still toward its walls; the table only shows
  // round the outside of the map.
  vec3 yard = uFloor * 0.8 * mix(uShadow, vec3(1.0), clamp(lit, 0.0, 1.0));
  yard *= mix(0.62, 1.0, smoothstep(0.0, 1.0, vYard.y));
  col = mix(col, yard, smoothstep(0.0, 1.0, vYard.x));
  float haze = smoothstep(uHazeRange.x, uHazeRange.y, length(vSrc.xy - uMapCentre.xy));
  col = mix(col, uHaze, haze * 0.85);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunWorld;
varying vec3 vDir;
void main() {
  float y = max(vDir.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(y, 0.55));
  float sun = max(dot(normalize(vDir), uSunWorld), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(sun, 24.0) * 0.06;
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}
`;

export type WorldBounds = { min: THREE.Vector3; max: THREE.Vector3 };

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Height of the dunes above the base, source units. */
function dune(x: number, y: number, scale: number) {
  const s = 1 / scale;
  const wx = x + valueNoise(x * s * 0.6, y * s * 0.6) * scale * 0.8;
  const wy = y + valueNoise(y * s * 0.6 + 7, x * s * 0.6) * scale * 0.8;
  // Sharp-crested ridges with soft backs, like wind-built sand.
  const ridge = 1 - Math.abs(valueNoise(wx * s, wy * s * 1.4) * 2 - 1);
  const swell = valueNoise(wx * s * 0.35 + 3, wy * s * 0.35);
  return ridge * ridge * 0.55 + swell * 0.6 + valueNoise(wx * s * 2.7, wy * s * 2.7) * 0.08;
}

/**
 * The dunes' plateau sits at the ground round the map and stays level over
 * the ground fill's reach before the dunes rise; under the map it is pushed
 * below the fill, so it never shows through the map's low ground.
 */
export function createDunes(
  bounds: WorldBounds,
  uniforms: Record<string, THREE.IUniform>,
  ground: GroundFill,
): THREE.Mesh {
  const { min, max } = bounds;
  const span = Math.max(max.x - min.x, max.y - min.y);
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const radius = span * 4;
  const cells = 120;
  const step = (radius * 2) / cells;
  // A little under the fill's rim, so the two never fight for depth.
  const base = ground.level - 8;
  const margin = ground.reach + 200;
  // The lowest fill within a dune cell's reach of each point, so no dune
  // triangle ever rises through the fill between its corners.
  const reach = Math.ceil((step * 1.5) / ground.cell);
  const lowest = minFilter(ground.z, ground.width, ground.height, reach);
  const under = (x: number, y: number) => {
    const gx = Math.round((x - ground.minX) / ground.cell);
    const gy = Math.round((y - ground.minY) / ground.cell);
    if (gx < -reach || gy < -reach || gx >= ground.width + reach || gy >= ground.height + reach) {
      return Infinity;
    }
    const cx = Math.min(ground.width - 1, Math.max(0, gx));
    const cy = Math.min(ground.height - 1, Math.max(0, gy));
    return lowest[cy * ground.width + cx] - 24;
  };
  const heights = new Float32Array((cells + 1) * (cells + 1));
  for (let j = 0; j <= cells; j++) {
    for (let i = 0; i <= cells; i++) {
      const x = cx - radius + i * step;
      const y = cy - radius + j * step;
      const ox = Math.max(min.x - margin - x, 0, x - max.x - margin);
      const oy = Math.max(min.y - margin - y, 0, y - max.y - margin);
      // A wavy shore, so the flat sand does not end on a ruled line; it only
      // ever reaches further out, never in over the map.
      const shore = valueNoise(x / (span * 0.35) + 5, y / (span * 0.35)) * span * 0.3;
      const away = Math.max(0, Math.hypot(ox, oy) - shore);
      const ramp = Math.min(1, away / (span * 0.9));
      const rise = ramp * ramp * ramp * (ramp * (ramp * 6 - 15) + 10);
      heights[j * (cells + 1) + i] = Math.min(
        base + rise * dune(x, y, span * 0.32) * span * 0.16,
        under(x, y),
      );
    }
  }
  const geometry = gridGeometry(
    cells + 1,
    cells + 1,
    (i, j) => [cx - radius + i * step, cy - radius + j * step, heights[j * (cells + 1) + i]],
    () => true,
  );
  const material = new THREE.ShaderMaterial({
    vertexShader: DUNE_VERT,
    fragmentShader: DUNE_FRAG,
    uniforms,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "dunes";
  return mesh;
}

/**
 * Ground at the map's own level in its holes and round it (see
 * `GroundFill`), lit like the dunes it slopes down into; closed-in
 * courtyards are painted as the map's ground, the rest as the table.
 */
export function createGroundFill(
  ground: GroundFill,
  uniforms: Record<string, THREE.IUniform>,
): THREE.Mesh | null {
  const { minX, minY, cell, width, height, z, enclosed, open } = ground;
  const geometry = gridGeometry(
    width,
    height,
    (gx, gy) => [minX + gx * cell, minY + gy * cell, z[gy * width + gx]],
    // Under the map too (it sits below the map's lowest surface there), so
    // an eave seen from the side never shows a hole. Only where the map
    // stands far above its surroundings (a tower) would the fill hang off it
    // as a cliff: there the dunes are the ground.
    (a, b, c, d) =>
      Math.max(z[a], z[b], z[c], z[d]) - Math.min(z[a], z[b], z[c], z[d]) <= cell * 1.5,
  );
  if (!geometry.index?.count) {
    geometry.dispose();
    return null;
  }
  // How closed in each point is, and how far from the courtyard's walls.
  const yard = new Float32Array(width * height * 2);
  for (let i = 0; i < width * height; i++) {
    yard[i * 2] = enclosed[i] / 255;
    yard[i * 2 + 1] = open[i] / 255;
  }
  geometry.setAttribute("aYard", new THREE.BufferAttribute(yard, 2));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: DUNE_VERT,
      fragmentShader: DUNE_FRAG,
      uniforms,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = "ground";
  return mesh;
}

/**
 * An indexed grid with smooth normals; `keep` decides each cell (corner
 * indices a, b at the bottom, c, d at the top).
 */
function gridGeometry(
  width: number,
  height: number,
  point: (i: number, j: number) => [number, number, number],
  keep: (a: number, b: number, c: number, d: number) => boolean,
): THREE.BufferGeometry {
  const positions = new Float32Array(width * height * 3);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      positions.set(point(i, j), (j * width + i) * 3);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j + 1 < height; j++) {
    for (let i = 0; i + 1 < width; i++) {
      const a = j * width + i;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      if (keep(a, b, c, d)) {
        indices.push(a, b, d, a, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createSky(
  top: THREE.Color,
  horizon: THREE.Color,
  sunWorld: THREE.Vector3,
): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTop: { value: top },
      uHorizon: { value: horizon },
      uSunWorld: { value: sunWorld },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), material);
  mesh.name = "sky";
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  // Follows the camera so it is always "at infinity".
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.position.copy(camera.position);
    mesh.updateMatrixWorld();
  };
  return mesh;
}

const VIGNETTE_FRAG = /* glsl */ `
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) * vec2(1.0, 0.8);
  float edge = smoothstep(0.38, 0.85, length(d));
  // Multiplied straight into the framebuffer, so no output encoding.
  gl_FragColor = vec4(mix(vec3(1.0), uTint, edge), 1.0);
}
`;

/**
 * A soft warm vignette multiplied over the map and everything opaque on it,
 * drawn first among the transparent passes so labels and effects stay clean.
 */
export function createVignette(tint: THREE.Color): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: VIGNETTE_FRAG,
    uniforms: { uTint: { value: tint } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.name = "vignette";
  mesh.frustumCulled = false;
  mesh.renderOrder = -1e6;
  return mesh;
}
