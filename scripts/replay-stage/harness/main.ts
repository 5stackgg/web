import type { CombatModule } from "../../../utilities/replayStage/combat";
import { TRACER_STYLES } from "../../../utilities/replayStage/combatTiming";
import type { TracerStyle } from "../../../utilities/replayStage/combatTiming";
import type { MapModule } from "../../../utilities/replayStage/map";
import type { PlayersModule } from "../../../utilities/replayStage/players";
import { createStage } from "../../../utilities/replayStage/stage";
import { createStageModules } from "../../../utilities/replayStage/modules";
import { EMPTY_FRAME } from "../../../utilities/replayStage/types";
import type { StageFrameOptions } from "../../../utilities/replayStage/frame";
import type {
  StageGrenadeType,
  StageQuality,
  StageView,
} from "../../../utilities/replayStage/types";
import { groundFor, scenarios } from "../fixtures";
import type { Scenario } from "../fixtures";
import { blobScenario } from "../fixtures/blob";

/**
 * Renders one moment of a scenario so it can be screenshotted headless:
 *
 *   ?scenario=mirage-a-site&t=6.8&view=3d&cam=x,y,z,tx,ty,tz&clock=1.5
 *
 * `cam` is eye then target in source units; without it the camera frames the
 * map. `follow=1` lets the camera follow the selected player or the fight.
 * `live=1` plays the scenario on a loop from `t` instead, at `speed` (0 holds
 * the moment, for trying the camera), for looking at it by hand; the stage and
 * camera are on `window.__stage` / `window.__camera` for driving it. Sets
 * `window.__stageReady` once the frame is on the canvas.
 *
 * A real demo: `?scenario=blob&fixture=inferno&round=8&t=14.5&select=Lisu`
 * (see fixtures/blob.ts; build the fixture with build-fixture.mjs).
 *
 * `bakestats=1` times the map's lighting bake on the GPU and prints the map
 * stats as a warning, so shot.mjs shows them.
 *
 * `tracer=comet|pulse|bolt|classic` picks how shots are drawn.
 *
 * The viewer's toggles, for blob scenarios: `heat=1` (utility heatmap),
 * `hide=flash,he` (utility types filtered out), `pick=12,15` (grenade ids
 * picked), `trails=1`, `deaths=0`, `bomb=0`, `kits=0`, `callouts=1`,
 * `vision=1` (fog of war and sight lines; `side=ct|t|both`, else the
 * followed player's side), `blast=1` (the C4's damage zones).
 * `overlay=1,2,3` stacks those rounds on one clock (the buy-round overlay).
 */

declare global {
  interface Window {
    __stageReady?: boolean;
    __stageError?: string;
    __stage?: unknown;
    __camera?: unknown;
  }
}

const query = new URLSearchParams(location.search);
const view = (query.get("view") ?? "3d") as StageView;
const quality = (query.get("quality") ?? "high") as StageQuality;
const t = Number(query.get("t") ?? 0);
const clock = Number(query.get("clock") ?? t);
const live = query.get("live") === "1";
const speed = Number(query.get("speed") ?? 1);
const follow = query.get("follow") === "1";
const bakeStats = query.get("bakestats") === "1";
const tracer = query.get("tracer") as TracerStyle | null;

function frameOptions(): StageFrameOptions {
  const flag = (name: string) =>
    query.has(name) ? query.get(name) !== "0" : undefined;
  const utility: Partial<Record<StageGrenadeType, boolean>> = {};
  for (const type of (query.get("hide") ?? "").split(",").filter(Boolean)) {
    utility[type as StageGrenadeType] = false;
    if (type === "molotov") {
      utility.incendiary = false;
    }
  }
  const pick = (query.get("pick") ?? "").split(",").filter(Boolean).map(Number);
  return {
    utility,
    selectedGids: pick,
    heatmap: flag("heat"),
    trails: flag("trails"),
    deaths: flag("deaths"),
    groundBomb: flag("bomb"),
    groundKits: flag("kits"),
    callouts: flag("callouts"),
    vision: flag("vision"),
    visionSide: (query.get("side") as StageFrameOptions["visionSide"]) ?? null,
    blastZones: flag("blast"),
  };
}

function loadScenario(): Promise<Scenario> | Scenario {
  // `?map=de_dust2` alone: just the map, nothing on it.
  const mapName = query.get("map");
  if (mapName && !query.get("scenario")) {
    return {
      name: "map",
      map: mapName,
      floor: 0,
      duration: 1,
      frameAt: () => EMPTY_FRAME,
    };
  }
  const name = query.get("scenario") ?? "mirage-a-site";
  if (name === "blob") {
    const round = query.get("round");
    return blobScenario(
      query.get("fixture") ?? "inferno",
      round ? Number(round) : null,
      query.get("select"),
      frameOptions(),
      query.get("overlay")?.split(",").filter(Boolean).map(Number) ?? null,
    );
  }
  const scenario = scenarios[name];
  if (!scenario) {
    throw new Error(`no scenario ${name}`);
  }
  return scenario;
}

async function main() {
  const scenario = await loadScenario();
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  const {
    camera,
    modules,
    utility,
    ground: groundItems,
  } = createStageModules();
  const map = modules.find((module) => module.name === "map") as MapModule;
  map.measure = bakeStats;
  const combat = modules.find(
    (module) => module.name === "combat",
  ) as CombatModule;
  const players = modules.find(
    (module) => module.name === "players",
  ) as PlayersModule;
  // shot.mjs serves the app's public files under /public.
  players.setIconBase("/public/img/equipment/");
  utility.setIconBase("/public/img/equipment/");
  groundItems.setIconBase("/public/img/equipment/");
  // `roof=none` or a height: the map's roof cut, as a slider would set it.
  const roofParam = query.get("roof");
  if (roofParam) {
    map.setRoof(roofParam === "none" ? null : Number(roofParam));
  }
  const stage = createStage({
    canvas,
    modules,
    view,
    quality,
    manual: true,
    assetBase: `${location.origin}/assets`,
  });
  stage.resize(window.innerWidth, window.innerHeight);
  if (tracer && TRACER_STYLES.includes(tracer)) {
    combat.setTracerStyle(tracer);
  }
  window.__stage = stage;
  window.__camera = camera;
  const opening = performance.now();
  // `play=x0,y0,z0,x1,y1,z1`: where the match was played (StageMap.play).
  const play = query.get("play")?.split(",").map(Number);
  await stage.setMap(
    scenario.map,
    play?.length === 6 && play.every(Number.isFinite)
      ? {
          min: { x: play[0], y: play[1], z: play[2] },
          max: { x: play[3], y: play[4], z: play[5] },
        }
      : null,
  );
  const fetched = performance.now() - opening;
  // `level=lower`: one storey of a stacked map, shown at once.
  // `layout=single` (implied by `level=`): one storey at a time, not side by side.
  const levelParam = query.get("level");
  if (levelParam || query.get("layout") === "single") {
    map.setLevelLayout("single");
    camera.frameMap();
  }
  if (levelParam) {
    map.setLevel(levelParam, false);
  }

  const cam = query.get("cam")?.split(",").map(Number);
  if (cam?.length === 6 && cam.every(Number.isFinite)) {
    camera.place(
      { x: cam[0], y: cam[1], z: cam[2] },
      { x: cam[3], y: cam[4], z: cam[5] },
    );
  }

  const ground = groundFor(stage.ctx.map, scenario.floor);
  camera.setFollow(follow);

  if (live) {
    const start = performance.now();
    const tick = () => {
      const now =
        (t + ((performance.now() - start) / 1000) * speed) % scenario.duration;
      stage.setFrame(scenario.frameAt(now, ground));
      stage.render();
      requestAnimationFrame(tick);
    };
    tick();
    window.__stageReady = true;
    return;
  }

  stage.setFrame(scenario.frameAt(t, ground));
  // Render, let modules finish what that started (workers, textures), and
  // render again until nothing is outstanding.
  for (let i = 0; i < 4; i++) {
    stage.render(clock);
    if (i === 0 && follow) {
      // The clock is pinned, so the follow would never ease there by itself.
      camera.snap();
    }
    await Promise.all(modules.map((module) => module.settle?.()));
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  stage.render(clock);
  if (bakeStats) {
    // fetchMs: assets fetched and parsed; openMs: to the first finished frame.
    const timing = {
      fetchMs: Math.round(fetched),
      openMs: Math.round(performance.now() - opening),
    };
    console.warn(`map stats ${JSON.stringify({ ...map.stats, ...timing })}`);
  }
  window.__stageReady = true;
}

main().catch((error) => {
  console.error(error);
  window.__stageError = String(error?.stack ?? error);
  window.__stageReady = true;
});
