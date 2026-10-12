import * as THREE from "three";
import type {
  RadarMeta,
  RadarVolume,
} from "../../../composables/useRadarProjection";
import { createMapModule } from "../../../utilities/replayStage/map";
import { paletteFor } from "../../../utilities/replayStage/mapPalette";
import {
  INFO_OUTSIDE,
  INFO_WALKABLE,
} from "../../../utilities/replayStage/mapPrep";
import { MAP_VERT } from "../../../utilities/replayStage/mapShaders";
import { createStage } from "../../../utilities/replayStage/stage";

/**
 * Bakes a map's radar for scripts/replay-stage/bake-radars.mjs: the stage's
 * map straight down through an orthographic camera, framed by a radar
 * calibration so a world point lands where `projectWithCalibration` puts it.
 *
 *   radar.html?job=<base64 JSON { map, size, line, calib }>
 *
 * Every level (the main one, then each split, then each volume) is drawn
 * twice: in colour with the 2D roof cut, and as a mask of its walkable floor
 * (red, green where it is inside the playable area). A lower storey is cut
 * at the main level's lowest floor: what lies wholly above is dropped from
 * the mesh and the lighting re-baked, so it is lit as if open to the sky.
 * Each PNG is POSTed to `/out/<map>.<level>.<color|floor>.png`; the levels and
 * the calibration used land on `window.__radar`.
 */

/** A volume's world box; heights only when the extractor recorded them. */
type VolumeBounds = RadarVolume["bounds"] & { minZ?: number; maxZ?: number };

/** As in public/radars/metadata.json: `zRange` is the main level's floors. */
type Calib = RadarMeta & { zRange?: { min: number; max: number } };

type Job = {
  map: string;
  /** Pixels per side of each render. */
  size: number;
  /** Outline width in pixels of a 1024px radar. */
  line: number;
  /** Frames the bake; null frames the map's walkable floor and reports it. */
  calib: Calib | null;
};

type Level = {
  name: string;
  /** Source units: x0, y0, x1, y1. */
  frame: [number, number, number, number];
  /** Drop everything above this height. */
  cut: number | null;
  /** The floor heights that belong to this level. */
  z: [number, number];
  /** The floor that belongs to this level, when it is a volume. */
  xy: [number, number, number, number] | null;
};

declare global {
  interface Window {
    __radar?: unknown;
    __radarReady?: boolean;
    __radarError?: string;
  }
}

const RADAR_PX = 1024;
const FAR = 1e9;

const FLOOR_FRAG = /* glsl */ `
uniform vec2 uZ;
uniform vec4 uXY;
varying vec3 vSrc;
flat varying float vInfo;
void main() {
  int info = int(vInfo + 0.5);
  if ((info & ${INFO_WALKABLE}) == 0 || vSrc.z < uZ.x || vSrc.z > uZ.y) discard;
  if (any(lessThan(vSrc.xy, uXY.xy)) || any(greaterThan(vSrc.xy, uXY.zw))) discard;
  gl_FragColor = vec4(1.0, (info & ${INFO_OUTSIDE}) == 0 ? 1.0 : 0.0, 0.0, 1.0);
}
`;

function frameOf(
  resolution: number,
  offset: { x: number; y: number },
  shift = { x: 0, y: 0 },
): Level["frame"] {
  const span = RADAR_PX * resolution;
  const x0 = -offset.x - (shift.x / 100) * span;
  const y0 = -offset.y - (shift.y / 100) * span;
  return [x0, y0, x0 + span, y0 + span];
}

function levelsOf(calib: Calib): Level[] {
  const splits = calib.splits ?? [];
  const top = splits.length
    ? Math.max(...splits.map((s) => s.bounds.top))
    : -FAR;
  // A split's bounds only say where a player is drawn; its storey reaches up
  // to the main level's lowest floor (Vertigo's ramps sit between the two).
  const ceiling = calib.zRange?.min ?? -FAR;
  const levels: Level[] = [
    {
      name: "main",
      frame: frameOf(calib.resolution, calib.offset),
      cut: null,
      z: [top, FAR],
      xy: null,
    },
  ];
  splits.forEach((split, i) => {
    levels.push({
      name: `split${i}`,
      frame: frameOf(calib.resolution, calib.offset, split.offset),
      cut: Math.max(split.bounds.top, ceiling),
      z: [split.bounds.bottom, Math.max(split.bounds.top, ceiling)],
      xy: null,
    });
  });
  for (const volume of calib.volumes ?? []) {
    const { minX, minY, maxX, maxY, minZ, maxZ } =
      volume.bounds as VolumeBounds;
    // Rooms stack (Rush's 2xx over 1xx): from above, only a volume's own
    // heights tell which storey it is.
    if (minZ === undefined || maxZ === undefined) {
      continue;
    }
    levels.push({
      name: volume.name,
      frame: frameOf(volume.resolution, volume.offset),
      cut: maxZ,
      z: [minZ, maxZ],
      xy: [minX, minY, maxX, maxY],
    });
  }
  return levels;
}

/** A square around the walkable floor, with a margin, in round numbers. */
function autoCalib(positions: Float32Array, info: Uint16Array): Calib {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let v = 0; v < info.length; v++) {
    if (!(info[v] & INFO_WALKABLE) || info[v] & INFO_OUTSIDE) {
      continue;
    }
    minX = Math.min(minX, positions[v * 3]);
    maxX = Math.max(maxX, positions[v * 3]);
    minY = Math.min(minY, positions[v * 3 + 1]);
    maxY = Math.max(maxY, positions[v * 3 + 1]);
  }
  const resolution =
    Math.ceil(((Math.max(maxX - minX, maxY - minY) * 1.12) / RADAR_PX) * 100) /
    100;
  const half = (RADAR_PX * resolution) / 2;
  return {
    resolution,
    offset: {
      x: Math.round(half - (minX + maxX) / 2),
      y: Math.round(half - (minY + maxY) / 2),
    },
  };
}

function floorHistogram(
  positions: Float32Array,
  info: Uint16Array,
  bin: number,
) {
  const counts = new Map<number, number>();
  for (let v = 0; v < info.length; v += 3) {
    if (info[v] & INFO_WALKABLE) {
      const z = Math.floor(positions[v * 3 + 2] / bin) * bin;
      counts.set(z, (counts.get(z) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

async function main() {
  const job = JSON.parse(
    atob(new URLSearchParams(location.search).get("job") ?? ""),
  ) as Job;
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  const mapModule = createMapModule();
  const stage = createStage({
    canvas,
    modules: [mapModule],
    view: "2d",
    quality: "high",
    manual: true,
    assetBase: `${location.origin}/assets`,
  });
  stage.resize(job.size, job.size);
  const { renderer, scene } = stage.ctx;
  const gl = renderer.getContext();
  if (
    gl.drawingBufferWidth !== job.size ||
    gl.drawingBufferHeight !== job.size
  ) {
    throw new Error(
      `drawing buffer is ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}, not ${job.size}`,
    );
  }
  await stage.setMap(job.map);
  await mapModule.settle?.();
  const map = stage.ctx.map;
  const group = map?.colliders[0];
  if (!map || !group) {
    throw new Error(`${job.map} did not load`);
  }

  const dunes = group.getObjectByName("dunes") as THREE.Mesh;
  const meshes = group.children.filter(
    (child) => child !== dunes,
  ) as THREE.Mesh[];
  const solid = meshes[0];
  const material = solid.material as THREE.ShaderMaterial;
  const uniforms = material.uniforms;
  uniforms.uLineWidth.value = (job.line * job.size) / RADAR_PX;
  // A radar is read edge to edge: nothing fades into the distance.
  uniforms.uHazeRange.value.set(1e9, 2e9);
  for (const name of ["sky", "vignette"]) {
    const object = scene.getObjectByName(name);
    if (object) {
      object.visible = false;
    }
  }

  const positions = meshes.map(
    (mesh) => mesh.geometry.getAttribute("position") as THREE.BufferAttribute,
  );
  const originals = positions.map((attr) =>
    (attr.array as Float32Array).slice(),
  );
  const solidInfo = solid.geometry.getAttribute("aInfo").array as Uint16Array;
  const calib = job.calib ?? autoCalib(originals[0], solidInfo);
  const levels = levelsOf(calib);

  const floorMaterial = new THREE.ShaderMaterial({
    vertexShader: MAP_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {
      uZ: { value: new THREE.Vector2() },
      uXY: { value: new THREE.Vector4() },
    },
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
  });

  const span = Math.max(map.max.x - map.min.x, map.max.y - map.min.y);
  // Above the map and every dune around it.
  const eye = Math.max(map.max.z, map.min.z + span * 0.2) + 500;
  const camera = new THREE.OrthographicCamera();
  camera.up.set(0, 0, -1);
  function aim([x0, y0, x1, y1]: Level["frame"], cut: number | null) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    camera.left = -(x1 - x0) / 2;
    camera.right = (x1 - x0) / 2;
    camera.top = (y1 - y0) / 2;
    camera.bottom = -(y1 - y0) / 2;
    camera.near = cut === null ? 1 : eye - cut;
    camera.far = eye - map!.min.z + 2000;
    camera.position.set(cx, eye, -cy);
    camera.lookAt(cx, eye - 1, -cy);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // Wholly above the cut goes; what straddles it is the roof cut's to open.
  function cutAt(height: number | null) {
    positions.forEach((attr, i) => {
      const array = attr.array as Float32Array;
      array.set(originals[i]);
      if (height !== null) {
        for (let t = 0; t < array.length; t += 9) {
          if (Math.min(array[t + 2], array[t + 5], array[t + 8]) > height) {
            array.fill(array[t], t, t + 9);
          }
        }
      }
      attr.needsUpdate = true;
    });
    // Re-bakes the sun shadow and occlusion against what is left.
    mapModule.setRoof(mapModule.defaultRoof("2d"));
  }

  async function post(name: string) {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      ),
    );
    const res = await fetch(`/out/${job.map}.${name}.png`, {
      method: "POST",
      body: blob,
    });
    if (!res.ok) {
      throw new Error(`posting ${name}: ${res.status}`);
    }
  }

  const background = scene.background;
  for (const level of levels) {
    cutAt(level.cut);
    aim(level.frame, level.cut);
    renderer.render(scene, camera);
    await post(`${level.name}.color`);

    solid.material = floorMaterial;
    floorMaterial.uniforms.uZ.value.set(level.z[0], level.z[1]);
    floorMaterial.uniforms.uXY.value.set(
      ...(level.xy ?? [-FAR, -FAR, FAR, FAR]),
    );
    const hidden = [dunes, ...meshes.slice(1)];
    hidden.forEach((mesh) => (mesh.visible = false));
    scene.background = new THREE.Color(0x000000);
    aim(level.frame, null);
    renderer.render(scene, camera);
    await post(`${level.name}.floor`);
    scene.background = background;
    hidden.forEach((mesh) => (mesh.visible = true));
    solid.material = material;
  }
  cutAt(null);

  window.__radar = {
    calib,
    levels,
    bounds: { min: map.min, max: map.max },
    floors: floorHistogram(originals[0], solidInfo, 64),
    palette: paletteFor(job.map),
    stats: mapModule.stats,
  };
  window.__radarReady = true;
}

main().catch((error) => {
  console.error(error);
  window.__radarError = String(error?.stack ?? error);
  window.__radarReady = true;
});
