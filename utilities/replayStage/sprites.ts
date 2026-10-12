import * as THREE from "three";

/**
 * Many camera-facing quads in one draw call. Effects push every live sprite
 * each frame (a pure function of their age), so a batch holds no history and
 * scrubbing backwards is free.
 */
export type SpriteBatchOptions = {
  /** Null draws a soft round dot. */
  texture?: THREE.Texture | null;
  /** Columns and rows when `texture` is an atlas; `cell` picks one. */
  grid?: [number, number];
  max: number;
  blending?: "additive" | "normal";
  /** Sizes in CSS pixels, constant on screen, instead of world units. */
  screenSpace?: boolean;
  depthTest?: boolean;
  renderOrder?: number;
};

export type SpriteBatch = {
  mesh: THREE.Mesh;
  begin(): void;
  /**
   * `pos` is world space. Colour is linear (use THREE.Color, which converts
   * from sRGB hex), alpha 0..1. Rotation is radians in the screen plane.
   */
  push(
    pos: THREE.Vector3,
    width: number,
    height: number,
    color: THREE.Color,
    alpha: number,
    rotation?: number,
    cell?: number,
  ): void;
  end(): void;
  setViewport(width: number, height: number): void;
  dispose(): void;
};

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iColor;
attribute vec2 iRotCell;
uniform vec2 uGrid;
uniform vec2 uViewport;
uniform float uScreen;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iRotCell.x);
  float s = sin(iRotCell.x);
  vec2 corner = position.xy;
  vec2 r = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) * iSize;
  if (uScreen > 0.5) {
    vec4 clip = projectionMatrix * mv;
    clip.xy += r * 2.0 / uViewport * clip.w;
    gl_Position = clip;
  } else {
    mv.xy += r;
    gl_Position = projectionMatrix * mv;
  }
  float col = mod(iRotCell.y, uGrid.x);
  float row = floor(iRotCell.y / uGrid.x);
  vUv = (vec2(col, uGrid.y - 1.0 - row) + uv) / uGrid;
  vColor = iColor;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uAdditive;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = uHasMap > 0.5
    ? texture2D(uMap, vUv)
    : vec4(1.0, 1.0, 1.0, pow(max(0.0, 1.0 - length(vUv * 2.0 - 1.0)), 2.0));
  float a = t.a * vColor.a;
  if (a < 0.002) discard;
  gl_FragColor = uAdditive > 0.5
    ? vec4(vColor.rgb * t.rgb * a, 1.0)
    : vec4(vColor.rgb * t.rgb, a);
  #include <colorspace_fragment>
}
`;

export function createSpriteBatch(options: SpriteBatchOptions): SpriteBatch {
  const max = options.max;
  const additive = options.blending === "additive";
  const base = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute("position", base.getAttribute("position"));
  geometry.setAttribute("uv", base.getAttribute("uv"));
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  const rotCell = new THREE.InstancedBufferAttribute(
    new Float32Array(max * 2),
    2,
  );
  for (const attr of [pos, size, color, rotCell]) {
    attr.setUsage(THREE.DynamicDrawUsage);
  }
  geometry.setAttribute("iPos", pos);
  geometry.setAttribute("iSize", size);
  geometry.setAttribute("iColor", color);
  geometry.setAttribute("iRotCell", rotCell);
  geometry.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: options.texture ?? null },
      uHasMap: { value: options.texture ? 1 : 0 },
      uGrid: { value: new THREE.Vector2(...(options.grid ?? [1, 1])) },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uScreen: { value: options.screenSpace ? 1 : 0 },
      uAdditive: { value: additive ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: options.depthTest ?? true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = options.renderOrder ?? 0;

  let count = 0;

  return {
    mesh,
    begin() {
      count = 0;
    },
    push(p, width, height, c, alpha, rotation = 0, cell = 0) {
      if (count >= max || alpha <= 0) {
        return;
      }
      const i = count++;
      pos.array[i * 3] = p.x;
      pos.array[i * 3 + 1] = p.y;
      pos.array[i * 3 + 2] = p.z;
      size.array[i * 2] = width;
      size.array[i * 2 + 1] = height;
      color.array[i * 4] = c.r;
      color.array[i * 4 + 1] = c.g;
      color.array[i * 4 + 2] = c.b;
      color.array[i * 4 + 3] = alpha;
      rotCell.array[i * 2] = rotation;
      rotCell.array[i * 2 + 1] = cell;
    },
    end() {
      geometry.instanceCount = count;
      for (const attr of [pos, size, color, rotCell]) {
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
      geometry.dispose();
      base.dispose();
      material.dispose();
    },
  };
}

/** A texture drawn once on a 2D canvas: glows, sparks, starbursts, icons. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
