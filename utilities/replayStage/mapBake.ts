import * as THREE from "three";
import {
  AO_BLUR_FRAG,
  AO_FRAG,
  DEPTH_FRAG,
  FULLSCREEN_VERT,
  HEIGHT_FRAG,
  MAP_VERT,
} from "./mapShaders";

/**
 * The map's lighting, baked on the GPU in a handful of draws: the sun's
 * shadow map, and a top-down height map with horizon occlusion run over it.
 * Both depend on the roof cut, so they are re-baked when it changes; nothing
 * here runs per frame.
 */
export type MapBake = {
  shadow: THREE.DepthTexture;
  shadowMatrix: THREE.Matrix4;
  shadowTexel: number;
  height: THREE.Texture;
  /** As `height`, with nothing cut: what is open to the sky. */
  sky: THREE.Texture;
  ao: THREE.Texture;
  /** minX, minY, 1/spanX, 1/spanY: source xy to height/AO uv. */
  topGrid: THREE.Vector4;
  /** z at 0, z span: the height map's packing. */
  zRange: THREE.Vector2;
  /**
   * Re-bakes. Returns the milliseconds it took; only with `measure` does it
   * wait for the GPU (a one-pixel readback) so that is the real cost.
   */
  run(measure?: boolean): number;
  dispose(): void;
};

export type BakeBounds = { min: THREE.Vector3; max: THREE.Vector3 };

export function createMapBake(
  renderer: THREE.WebGLRenderer,
  geometry: THREE.BufferGeometry,
  cutUniforms: Record<string, THREE.IUniform>,
  bounds: BakeBounds,
  sunWorld: THREE.Vector3,
  quality: "high" | "low",
): MapBake {
  const topSize = quality === "high" ? 2048 : 1024;
  const shadowSize = quality === "high" ? 4096 : 2048;
  const { min, max } = bounds;
  const spanX = max.x - min.x;
  const spanY = max.y - min.y;
  const zRange = new THREE.Vector2(min.z - 64, max.z - min.z + 128);
  const topGrid = new THREE.Vector4(min.x, min.y, 1 / spanX, 1 / spanY);

  const heightTarget = new THREE.WebGLRenderTarget(topSize, topSize, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  const skyTarget = new THREE.WebGLRenderTarget(topSize, topSize, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  const aoTarget = new THREE.WebGLRenderTarget(topSize, topSize, {
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  });
  // The raw occlusion is jittered per texel; it is blurred into `aoTarget`
  // through this one, across then down.
  const aoRawTarget = new THREE.WebGLRenderTarget(topSize, topSize, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
  const shadow = new THREE.DepthTexture(shadowSize, shadowSize);
  shadow.type = THREE.UnsignedIntType;
  shadow.compareFunction = THREE.LessEqualCompare;
  shadow.minFilter = THREE.LinearFilter;
  shadow.magFilter = THREE.LinearFilter;
  const shadowTarget = new THREE.WebGLRenderTarget(shadowSize, shadowSize, {
    format: THREE.RedFormat,
    depthTexture: shadow,
    generateMipmaps: false,
  });

  const heightMaterial = new THREE.ShaderMaterial({
    vertexShader: MAP_VERT,
    fragmentShader: HEIGHT_FRAG,
    uniforms: { ...cutUniforms, uZRange: { value: zRange } },
    side: THREE.DoubleSide,
  });
  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: MAP_VERT,
    fragmentShader: HEIGHT_FRAG,
    uniforms: {
      ...cutUniforms,
      uCut2D: { value: 1e9 },
      uZRange: { value: zRange },
    },
    side: THREE.DoubleSide,
  });
  const depthMaterial = new THREE.ShaderMaterial({
    vertexShader: MAP_VERT,
    fragmentShader: DEPTH_FRAG,
    uniforms: { ...cutUniforms },
    side: THREE.DoubleSide,
  });
  const aoMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: AO_FRAG,
    uniforms: {
      uHeightMap: { value: heightTarget.texture },
      uZRange: { value: zRange },
      uTexel: { value: new THREE.Vector2(1 / topSize, 1 / topSize) },
      uUnitsPerTexel: { value: Math.max(spanX, spanY) / topSize },
      uRadius: { value: 96 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const blurMaterial = new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: AO_BLUR_FRAG,
    uniforms: {
      uSource: { value: null },
      uStep: { value: new THREE.Vector2() },
    },
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  const mesh = new THREE.Mesh(geometry, heightMaterial);
  mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);
  scene.updateMatrixWorld(true);

  const aoScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), aoMaterial);
  quad.frustumCulled = false;
  aoScene.add(quad);

  // Straight down over the map: camera x is source x, camera y source y.
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const topCamera = new THREE.OrthographicCamera(
    -spanX / 2,
    spanX / 2,
    spanY / 2,
    -spanY / 2,
    1,
    max.z - min.z + 4000,
  );
  topCamera.up.set(0, 0, -1);
  topCamera.position.set(cx, max.z + 2000, -cy);
  topCamera.lookAt(cx, min.z, -cy);
  topCamera.updateMatrixWorld();

  const shadowCamera = new THREE.OrthographicCamera();
  const centre = new THREE.Vector3(cx, (min.z + max.z) / 2, -cy);
  const reach = Math.hypot(spanX, spanY, max.z - min.z);
  shadowCamera.position.copy(centre).addScaledVector(sunWorld, reach);
  shadowCamera.up.set(0, 1, 0);
  shadowCamera.lookAt(centre);
  shadowCamera.updateMatrixWorld();
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(
      i & 1 ? max.x : min.x,
      i & 4 ? max.z : min.z,
      -(i & 2 ? max.y : min.y),
    );
    box.expandByPoint(corner.applyMatrix4(shadowCamera.matrixWorldInverse));
  }
  shadowCamera.left = box.min.x;
  shadowCamera.right = box.max.x;
  shadowCamera.bottom = box.min.y;
  shadowCamera.top = box.max.y;
  shadowCamera.near = -box.max.z - 64;
  shadowCamera.far = -box.min.z + 64;
  shadowCamera.updateProjectionMatrix();
  const shadowMatrix = new THREE.Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(shadowCamera.projectionMatrix)
    .multiply(shadowCamera.matrixWorldInverse);
  const shadowTexel = 1 / shadowSize;

  const clearColor = new THREE.Color();
  const probe = new Uint8Array(4);

  return {
    shadow,
    shadowMatrix,
    shadowTexel,
    height: heightTarget.texture,
    sky: skyTarget.texture,
    ao: aoTarget.texture,
    topGrid,
    zRange,
    run(measure = false) {
      const started = performance.now();
      const previousTarget = renderer.getRenderTarget();
      const previousAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clearColor);
      renderer.setClearColor(0x000000, 0);

      mesh.material = skyMaterial;
      renderer.setRenderTarget(skyTarget);
      renderer.clear();
      renderer.render(scene, topCamera);

      mesh.material = heightMaterial;
      renderer.setRenderTarget(heightTarget);
      renderer.clear();
      renderer.render(scene, topCamera);

      // Occlusion into the blur's target, across into the raw one, down
      // into the result.
      quad.material = aoMaterial;
      renderer.setRenderTarget(aoTarget);
      renderer.render(aoScene, topCamera);
      quad.material = blurMaterial;
      blurMaterial.uniforms.uSource.value = aoTarget.texture;
      blurMaterial.uniforms.uStep.value.set(1 / topSize, 0);
      renderer.setRenderTarget(aoRawTarget);
      renderer.render(aoScene, topCamera);
      blurMaterial.uniforms.uSource.value = aoRawTarget.texture;
      blurMaterial.uniforms.uStep.value.set(0, 1 / topSize);
      renderer.setRenderTarget(aoTarget);
      renderer.render(aoScene, topCamera);

      mesh.material = depthMaterial;
      renderer.setRenderTarget(shadowTarget);
      renderer.clear();
      renderer.render(scene, shadowCamera);

      if (measure) {
        renderer.readRenderTargetPixels(aoTarget, 0, 0, 1, 1, probe);
      }
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clearColor, previousAlpha);
      return performance.now() - started;
    },
    dispose() {
      heightTarget.dispose();
      skyTarget.dispose();
      skyMaterial.dispose();
      aoTarget.dispose();
      aoRawTarget.dispose();
      shadowTarget.dispose();
      shadow.dispose();
      heightMaterial.dispose();
      depthMaterial.dispose();
      aoMaterial.dispose();
      blurMaterial.dispose();
      quad.geometry.dispose();
    },
  };
}
