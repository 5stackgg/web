import * as THREE from "three";

/**
 * The map's name laid flat on the table just south of the map, like a
 * placard: a light tint of the table, lit like it, depth-tested. One canvas
 * texture on one quad, in source units under the map's rotated group.
 */
export type MapTitle = {
  mesh: THREE.Mesh;
  /** Redraws the text (once the font has loaded, or for a new name). */
  setText(text: string): void;
  /** Resolves once the app font has loaded and the text is drawn in it. */
  ready: Promise<void>;
  dispose(): void;
};

export type TitleSpot = {
  /** Centre of the text, source units. */
  x: number;
  y: number;
  z: number;
  /** Cap height of the text, source units. */
  height: number;
};

const FONT = "Oxanium, 'Arial Black', Arial, sans-serif";
const CANVAS_HEIGHT = 160;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vSrc;
void main() {
  vUv = uv;
  vSrc = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uText;
uniform vec3 uColor;
uniform vec3 uHaze;
uniform vec3 uMapCentre;
uniform vec2 uHazeRange;
varying vec2 vUv;
varying vec3 vSrc;
void main() {
  float a = texture2D(uText, vUv).r;
  if (a < 0.01) discard;
  float haze = smoothstep(uHazeRange.x, uHazeRange.y, length(vSrc.xy - uMapCentre.xy));
  gl_FragColor = linearToOutputTexel(vec4(mix(uColor, uHaze, haze * 0.85), a));
}
`;

export function createMapTitle(
  spot: TitleSpot,
  text: string,
  uniforms: Record<string, THREE.IUniform>,
  tint: THREE.Color,
): MapTitle {
  const canvas = document.createElement("canvas");
  canvas.height = CANVAS_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uText: { value: texture },
      uColor: { value: tint },
      uHaze: uniforms.uHaze,
      uMapCentre: uniforms.uMapCentre,
      uHazeRange: uniforms.uHazeRange,
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "map-title";
  // Over the table, under everything drawn on it.
  mesh.renderOrder = -1;
  let current = text;

  const height = spot.height;
  const draw = () => {
    const g = canvas.getContext("2d")!;
    const font = `800 ${CANVAS_HEIGHT * 0.78}px ${FONT}`;
    const spacing = CANVAS_HEIGHT * 0.22;
    const label = current.toUpperCase();
    g.font = font;
    let width = 0;
    for (const char of label) {
      width += g.measureText(char).width + spacing;
    }
    width = Math.max(1, Math.ceil(width - spacing + CANVAS_HEIGHT * 0.4));
    canvas.width = width;
    canvas.height = CANVAS_HEIGHT;
    g.font = font;
    g.fillStyle = "#000";
    g.fillRect(0, 0, width, CANVAS_HEIGHT);
    g.fillStyle = "#fff";
    g.textBaseline = "middle";
    let x = CANVAS_HEIGHT * 0.2;
    for (const char of label) {
      g.fillText(char, x, CANVAS_HEIGHT * 0.54);
      x += g.measureText(char).width + spacing;
    }
    texture.dispose();
    texture.needsUpdate = true;
    const across = (height * width) / CANVAS_HEIGHT;
    mesh.scale.set(across, height, 1);
    mesh.position.set(spot.x, spot.y, spot.z);
    mesh.updateMatrix();
  };
  draw();
  const ready =
    typeof document !== "undefined" && document.fonts
      ? document.fonts.load(`800 ${CANVAS_HEIGHT}px Oxanium`).then(draw, () => {})
      : Promise.resolve();

  return {
    mesh,
    setText(next) {
      current = next;
      draw();
    },
    ready,
    dispose() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
