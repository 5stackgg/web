<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { Loader2 } from "lucide-vue-next";
import cleanMapName from "~/utilities/cleanMapName";
import { createStage } from "~/utilities/replayStage/stage";
import type { Stage } from "~/utilities/replayStage/stage";
import { createStageModules } from "~/utilities/replayStage/modules";
import { EMPTY_FRAME } from "~/utilities/replayStage/types";
import type { StageFrame, StageView } from "~/utilities/replayStage/types";
import type { MapLevel } from "~/utilities/replayStage/mapLevels";
import { useI18n } from "vue-i18n";

/**
 * The replay stage: one three.js renderer for both the 2D (straight down) and
 * the 3D playback. Whoever owns the clock builds a `StageFrame` for the
 * moment on screen and hands it here; this only draws it.
 */
const props = withDefaults(
  defineProps<{
    mapName: string | null;
    frame: StageFrame;
    view?: StageView;
    /** False while hidden: the stage stays loaded but stops drawing. */
    running?: boolean;
    /** The storey shown on a stacked map (Nuke, Vertigo); null is the top. */
    level?: string | null;
    /** A stacked map's storeys laid side by side, or one at a time (`level`). */
    levelLayout?: "side" | "single";
    /** The map's own name when its file name is not one (workshop maps). */
    mapTitle?: string | null;
  }>(),
  {
    view: "3d",
    running: true,
    level: null,
    levelLayout: "side",
    mapTitle: null,
  },
);

const emit = defineEmits<{
  // This browser cannot run it (no WebGL2).
  (e: "unsupported"): void;
  // There is no model of this map to draw.
  (e: "missing-map"): void;
  // The loaded map's storeys, top first; empty on a one-storey map.
  (e: "levels", levels: MapLevel[]): void;
}>();

const runtimeConfig = useRuntimeConfig();
const { t } = useI18n();
const canvas = ref<HTMLCanvasElement | null>(null);
const stage = shallowRef<Stage | null>(null);
const camera = shallowRef<
  ReturnType<typeof createStageModules>["camera"] | null
>(null);
// The heatmap and picked grenades, for picking what a click landed on.
const utility = shallowRef<
  ReturnType<typeof createStageModules>["utility"] | null
>(null);
const map = shallowRef<ReturnType<typeof createStageModules>["map"] | null>(
  null,
);
let observer: ResizeObserver | null = null;
// Nothing is drawn until the map has finished building, then it fades in
// already framed: no players on an empty table, no camera jumping.
const ready = ref(false);
let loadToken = 0;
const SETTLE_TIMEOUT_MS = 20000;
const mapLabel = computed(
  () => props.mapTitle || (props.mapName ? cleanMapName(props.mapName) : ""),
);

onMounted(() => {
  if (!canvas.value) {
    return;
  }
  let parts: ReturnType<typeof createStageModules>;
  // Building the modules needs 2D canvases too, which a browser can refuse.
  try {
    parts = createStageModules();
    stage.value = createStage({
      canvas: canvas.value,
      modules: parts.modules,
      view: props.view,
      assetBase: (runtimeConfig.public.mapMeshCdn as string) || null,
    });
  } catch (error) {
    console.warn("[replay-stage]", error);
    emit("unsupported");
    return;
  }
  const { camera: rig, map: mapModule, utility: overlay } = parts;
  camera.value = rig;
  map.value = mapModule;
  mapModule.setTitle(props.mapTitle);
  mapModule.setLevelLabels({
    upper: t("match.replay.chrome.level_upper"),
    lower: t("match.replay.chrome.level_lower"),
  });
  mapModule.setLevelLayout(props.levelLayout);
  utility.value = overlay;
  stage.value.setFrame(EMPTY_FRAME);
  stage.value.setRunning(props.running);
  stage.value.resize(canvas.value.clientWidth, canvas.value.clientHeight);
  observer = new ResizeObserver(([entry]) => {
    stage.value?.resize(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(canvas.value);
  void loadMap(props.mapName);
});

async function loadMap(name: string | null) {
  const token = ++loadToken;
  ready.value = false;
  stage.value?.setFrame(EMPTY_FRAME);
  const result = await stage.value?.setMap(name);
  if (token !== loadToken || !stage.value || result === "stale") {
    return;
  }
  emit("levels", map.value?.levels() ?? []);
  map.value?.setLevel(props.level, false);
  if (result === "missing") {
    emit("missing-map");
  } else {
    await Promise.race([
      stage.value.settle(),
      new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS)),
    ]);
    if (token !== loadToken || !stage.value) {
      return;
    }
    if (!camera.value?.following) {
      camera.value?.frameMap(false);
    }
  }
  stage.value.setFrame(props.frame);
  ready.value = true;
  for (const fn of readyQueue.splice(0)) {
    fn();
  }
}

// Work that has to wait for the map to settle and be framed (a shared
// moment's camera): it runs then, or now if that already happened.
const readyQueue: Array<() => void> = [];
function whenReady(fn: () => void) {
  if (ready.value) {
    fn();
  } else {
    readyQueue.push(fn);
  }
}

watch(
  () => props.frame,
  (frame) => {
    if (ready.value) {
      stage.value?.setFrame(frame);
    }
  },
);
watch(
  () => props.mapName,
  (name) => void loadMap(name),
);
watch(
  () => props.view,
  (view) => stage.value?.setView(view),
);
watch(
  () => props.running,
  (running) => stage.value?.setRunning(running),
);
watch(
  () => props.level,
  (level) => map.value?.setLevel(level),
);
watch(
  () => props.levelLayout,
  (layout) => {
    map.value?.setLevelLayout(layout);
    // Back out to the whole table, however far in the viewer had zoomed.
    if (ready.value) {
      camera.value?.frameMap(true);
    }
  },
);
watch(
  () => props.mapTitle,
  (title) => map.value?.setTitle(title),
);

onBeforeUnmount(() => {
  observer?.disconnect();
  stage.value?.dispose();
  stage.value = null;
});

defineExpose({ stage, camera, map, utility, whenReady });
</script>

<template>
  <div>
    <!-- The stage adds its cursor layer next to the canvas: it has to land in
         an element whose children Vue never patches. -->
    <div
      class="absolute inset-0 transition-opacity duration-500 ease-out"
      :class="ready ? 'opacity-100' : 'opacity-0'"
    >
      <canvas ref="canvas" class="block h-full w-full touch-none" />
    </div>
    <Transition
      leave-active-class="transition-opacity duration-500 ease-out"
      leave-to-class="opacity-0"
    >
      <div
        v-if="!ready && mapName"
        class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 class="h-4 w-4 animate-spin" />
        {{ $t("match.replay.chrome.loading_map", { map: mapLabel }) }}
      </div>
    </Transition>
  </div>
</template>
