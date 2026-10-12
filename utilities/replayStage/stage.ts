import * as THREE from "three";
import {
  fetchMeshBuffer,
  normalizeMapName,
  parseViewMesh,
  resolveMapAssets,
} from "~/utilities/mapAssets";
import { EMPTY_FRAME } from "./types";
import type {
  StageContext,
  StageFrame,
  StageMap,
  StageModule,
  StageQuality,
  StageView,
  Vec3,
} from "./types";

export type StageOptions = {
  canvas: HTMLCanvasElement;
  modules: StageModule[];
  view?: StageView;
  quality?: StageQuality;
  /** NUXT_PUBLIC_MAP_MESH_CDN-style override: `<cdn>/<map>.tri.gz` etc. */
  assetBase?: string | null;
  /** Leave the loop to the caller (the harness renders one frame at a time). */
  manual?: boolean;
};

export type MapLoad = "ready" | "missing" | "stale";

export type Stage = {
  ctx: StageContext;
  /**
   * Loads a map. "missing" means there is nothing to draw it from (no view
   * mesh); "stale" that another call took over first.
   */
  setMap(mapName: string | null): Promise<MapLoad>;
  setView(view: StageView): void;
  setFrame(frame: StageFrame): void;
  /** Stops drawing while the stage is hidden; the loop resumes on true. */
  setRunning(running: boolean): void;
  /**
   * Resolves once every module has finished what the current map started
   * (the map's prep and bake, fonts, smoke grids): when it first looks right.
   */
  settle(): Promise<void>;
  /** Draws one frame now. `clock` pins the wall clock (harness). */
  render(clock?: number): void;
  /**
   * Called right after each frame is drawn, while the canvas still holds it
   * (clip export copies it from here).
   */
  onRender(listener: () => void): () => void;
  resize(width: number, height: number): void;
  dispose(): void;
};

function wpos(p: Vec3, out = new THREE.Vector3()) {
  return out.set(p.x, p.z, -p.y);
}

/**
 * Downloaded map files, kept across stages: turning the stage off and on, or
 * leaving a replay for another on the same map, should not fetch and inflate
 * tens of megabytes again. Only the most recent maps are kept.
 */
const MAP_CACHE_SIZE = 2;
const mapFiles = new Map<string, Promise<ArrayBuffer | null>>();

function mapFile(url: string) {
  let file = mapFiles.get(url);
  if (!file) {
    file = fetchMeshBuffer(url).catch(() => null);
    mapFiles.set(url, file);
    // Three files per map.
    while (mapFiles.size > MAP_CACHE_SIZE * 3) {
      mapFiles.delete(mapFiles.keys().next().value!);
    }
  }
  return file;
}

export function createStage(options: StageOptions): Stage {
  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches;
  const quality: StageQuality = options.quality ?? (isTouch ? "low" : "high");

  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    antialias: quality === "high",
    powerPreference: "high-performance",
    preserveDrawingBuffer: !!options.manual,
  });
  // Smoke volumes, the map bake and the shadow taps all need WebGL2; three
  // would otherwise carry on in WebGL1 and draw nothing.
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Error("The replay stage needs WebGL2");
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES flattens saturated team colours; the look is graded by hand instead.
  renderer.toneMapping = THREE.NoToneMapping;
  const pixelRatio = Math.min(
    typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
    quality === "high" ? 2 : 1.5,
  );
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 4, 60000);
  camera.position.set(0, 4000, 0);
  camera.lookAt(0, 0, 0);

  const ctx: StageContext = {
    THREE,
    renderer,
    scene,
    camera,
    view: options.view ?? "3d",
    quality,
    map: null,
    // Through `levelShift`: a lower storey laid beside the map moves
    // whatever stands on it.
    wpos: (p, out) => {
      const at = wpos(p, out);
      const shift = ctx.levelShift;
      if (shift && p.z < shift.below) {
        at.x += shift.offset.x;
        at.y += shift.offset.z;
        at.z -= shift.offset.y;
      }
      return at;
    },
    width: 1,
    height: 1,
    pixelRatio,
    clock: 0,
    assetBase: options.assetBase ?? null,
  };

  const modules = options.modules;
  let frame: StageFrame = EMPTY_FRAME;
  let disposed = false;
  let mapToken = 0;
  let raf = 0;
  const renderListeners = new Set<() => void>();
  const ready = Promise.all(modules.map((module) => module.init(ctx)));

  async function setMap(mapName: string | null): Promise<MapLoad> {
    const token = ++mapToken;
    await ready;
    const name = mapName ? normalizeMapName(mapName) : "";
    if (!name) {
      ctx.map = null;
      return "missing";
    }
    const urls = await resolveMapAssets(name, ctx.assetBase ?? "");
    if (token !== mapToken || disposed) {
      return "stale";
    }
    if (!urls) {
      return "missing";
    }
    const [tri, view, callouts] = await Promise.all([
      urls.tri
        ? mapFile(urls.tri).then((buffer) =>
            buffer ? new Float32Array(buffer) : null,
          )
        : null,
      urls.view
        ? mapFile(urls.view).then((buffer) => {
            try {
              return buffer ? parseViewMesh(buffer) : null;
            } catch {
              return null;
            }
          })
        : null,
      urls.callouts
        ? fetch(urls.callouts)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        : null,
    ]);
    if (token !== mapToken || disposed) {
      return "stale";
    }
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    if (view) {
      min.x = view.bboxMin[0];
      min.y = view.bboxMin[1];
      min.z = view.bboxMin[2];
      max.x = view.bboxMax[0];
      max.y = view.bboxMax[1];
      max.z = view.bboxMax[2];
    } else if (tri) {
      for (let i = 0; i < tri.length; i += 3) {
        min.x = Math.min(min.x, tri[i]);
        max.x = Math.max(max.x, tri[i]);
        min.y = Math.min(min.y, tri[i + 1]);
        max.y = Math.max(max.y, tri[i + 1]);
        min.z = Math.min(min.z, tri[i + 2]);
        max.z = Math.max(max.z, tri[i + 2]);
      }
    }
    const map: StageMap = {
      // A variant loads its base map's meshes but keeps its own name, so it
      // can be painted its own way (de_dust2_night moonlit).
      name: /_night$/i.test((mapName ?? "").trim()) ? `${name}_night` : name,
      tri,
      view,
      min,
      max,
      callouts: callouts?.callouts ?? [],
      colliders: [],
    };
    ctx.map = map;
    for (const module of modules) {
      await module.onMap?.(ctx);
      if (token !== mapToken || disposed) {
        return "stale";
      }
    }
    // The map is drawn from its view mesh alone.
    return view ? "ready" : "missing";
  }

  function setView(view: StageView) {
    if (ctx.view === view) {
      return;
    }
    ctx.view = view;
    for (const module of modules) {
      module.onView?.(ctx);
    }
  }

  function render(clock?: number) {
    if (disposed) {
      return;
    }
    ctx.clock = clock ?? performance.now() / 1000;
    for (const module of modules) {
      module.update(frame, ctx);
    }
    let drawn = false;
    for (let i = modules.length - 1; i >= 0 && !drawn; i--) {
      drawn = !!modules[i].render?.(ctx);
    }
    if (!drawn) {
      renderer.render(scene, camera);
    }
    for (const listener of renderListeners) {
      listener();
    }
  }

  function resize(width: number, height: number) {
    ctx.width = Math.max(1, Math.round(width));
    ctx.height = Math.max(1, Math.round(height));
    renderer.setSize(ctx.width, ctx.height, false);
    camera.aspect = ctx.width / ctx.height;
    camera.updateProjectionMatrix();
    for (const module of modules) {
      module.resize?.(ctx);
    }
  }

  function loop() {
    render();
    raf = requestAnimationFrame(loop);
  }

  function setRunning(running: boolean) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (running && !options.manual && !disposed) {
      raf = requestAnimationFrame(loop);
    }
  }

  setRunning(true);

  return {
    ctx,
    setMap,
    setView,
    setFrame(next) {
      frame = next;
    },
    setRunning,
    settle() {
      return Promise.all(modules.map((module) => module.settle?.())).then(
        () => undefined,
      );
    },
    render,
    onRender(listener) {
      renderListeners.add(listener);
      return () => renderListeners.delete(listener);
    },
    resize,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const module of modules) {
        module.dispose();
      }
      renderer.dispose();
      // Browsers cap live contexts per page; without this, turning the stage
      // off and on a few times starts evicting contexts still in use.
      renderer.forceContextLoss();
    },
  };
}
