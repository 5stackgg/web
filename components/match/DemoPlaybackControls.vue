<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Gauge,
  Crosshair,
  Bomb,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useDemoPlayback } from "~/composables/useDemoPlayback";

const {
  store,
  togglePause,
  skip,
  seek,
  setSpeed,
  jumpToRound,
  jumpToNextKill,
  jumpToPrevKill,
  jumpToNextBomb,
  jumpToPrevBomb,
  jumpToNextRound,
  jumpToPrevRound,
} = useDemoPlayback();

// Most controls bind to keys in cs2's autoexec — each click fires a
// single xdotool keystroke (no console flash). The seek slider, round
// chips, and event-jump buttons depend on parser metadata; without it
// we render a thinner UI with just play/pause/skip/speed.
const hasMetadata = computed(() => store.totalTicks > 0 && store.tickRate > 0);

const seekModel = ref<number[]>([0]);
const dragging = ref(false);
watch(
  () => store.currentTick,
  (tick) => {
    if (!dragging.value) seekModel.value = [tick];
  },
);
function onSeekStart() {
  dragging.value = true;
}
function onSeekUpdate(v: number[] | undefined) {
  if (v) seekModel.value = v;
}
async function onSeekCommit(v: number[] | undefined) {
  dragging.value = false;
  if (v && v.length) await seek(v[0]);
}
function onSpeedChange(value: unknown) {
  const n = Number(value);
  if (Number.isFinite(n)) void setSpeed(n);
}

const formattedCurrent = computed(() => formatSeconds(store.currentSeconds));
const formattedTotal = computed(() => formatSeconds(store.totalSeconds));
function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

// Marker rendering. Each event gets a thin tick mark on the seek
// bar at its position. Kills are dense (often hundreds per match);
// bomb events are sparse; round starts are the cleanest landmarks.
// Position = tick / total_ticks * 100%.
type Marker = { left: string; type: "kill" | "bomb" | "round"; label: string };
const markers = computed<Marker[]>(() => {
  if (!hasMetadata.value) return [];
  const out: Marker[] = [];
  const total = store.totalTicks;
  for (const r of store.roundTicks) {
    out.push({
      left: `${(r.start_tick / total) * 100}%`,
      type: "round",
      label: `Round ${r.round}`,
    });
  }
  for (const b of store.bombs) {
    out.push({
      left: `${(b.tick / total) * 100}%`,
      type: "bomb",
      label: `Bomb ${b.type}${b.site ? ` (${b.site})` : ""}`,
    });
  }
  // Kills are too noisy to render every one; downsample to ~80
  // markers across the whole demo. The raw list is still in the
  // store for the next-kill jump buttons.
  const killStride = Math.max(1, Math.floor(store.kills.length / 80));
  for (let i = 0; i < store.kills.length; i += killStride) {
    const k = store.kills[i];
    out.push({
      left: `${(k.tick / total) * 100}%`,
      type: "kill",
      label: k.headshot ? "Headshot kill" : "Kill",
    });
  }
  return out;
});
</script>

<template>
  <!-- All Tooltip primitives in this component need a TooltipProvider
       ancestor — without it reka-ui throws "Injection
       Symbol(TooltipProviderContext) not found" at setup time and the
       whole controls panel fails to mount. -->
  <TooltipProvider :delay-duration="200">
    <div
      class="flex flex-col gap-3 px-3 py-2 bg-card/95 backdrop-blur-sm border-t border-border/60"
    >
      <!-- Seek slider with event markers overlaid. Slider sits above
         the marker rail — markers are pointer-events: none so they
         don't intercept drags. -->
      <div v-if="hasMetadata" class="flex items-center gap-3">
        <span class="font-mono text-xs tabular-nums text-muted-foreground">
          {{ formattedCurrent }}
        </span>
        <div class="flex-1 relative h-5">
          <Slider
            :model-value="seekModel"
            :min="0"
            :max="store.totalTicks"
            :step="1"
            class="absolute inset-0 z-10"
            @update:model-value="onSeekUpdate"
            @pointerdown="onSeekStart"
            @value-commit="onSeekCommit"
          />
          <!-- Marker rail — under the slider thumb. Round markers are
             tallest, bomb medium, kills thin. -->
          <div
            class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 pointer-events-none"
          >
            <Tooltip v-for="(m, idx) in markers" :key="idx">
              <TooltipTrigger as-child>
                <span
                  :style="{ left: m.left }"
                  class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                  :class="{
                    'h-3 w-[2px] bg-[hsl(var(--tac-amber))]':
                      m.type === 'round',
                    'h-2.5 w-[2px] bg-orange-500/80': m.type === 'bomb',
                    'h-1.5 w-px bg-red-500/60': m.type === 'kill',
                  }"
                />
              </TooltipTrigger>
              <TooltipContent>{{ m.label }}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <span class="font-mono text-xs tabular-nums text-muted-foreground">
          {{ formattedTotal }}
        </span>
      </div>
      <p
        v-else
        class="text-[0.65rem] uppercase tracking-wider text-muted-foreground/70 px-1"
      >
        Demo metadata not parsed yet — play/pause + skip + speed still work.
      </p>

      <!-- Round chips. Render winner color when known. -->
      <div
        v-if="store.roundTicks.length"
        class="flex flex-wrap gap-1 max-h-12 overflow-y-auto"
      >
        <button
          v-for="r in store.roundTicks"
          :key="r.round"
          type="button"
          class="px-2 py-0.5 rounded-sm text-[0.65rem] font-mono uppercase tracking-wider border hover:bg-primary/10 hover:border-primary transition-colors"
          :class="{
            'border-blue-500/60 text-blue-200': r.winner === 'ct',
            'border-amber-500/60 text-amber-200': r.winner === 't',
            'border-border/60': !r.winner,
          }"
          @click="jumpToRound(r.round)"
        >
          R{{ r.round }}
        </button>
      </div>

      <!-- Buttons row. Three groups:
         (a) playback transport   — always present
         (b) event-jump nav       — only when parser data
         (c) speed                — always present
    -->
      <div class="flex items-center gap-1 flex-wrap">
        <Button
          variant="ghost"
          size="icon"
          title="Skip back 15s"
          @click="skip(-15)"
        >
          <SkipBack class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          :title="store.paused ? 'Play' : 'Pause'"
          @click="togglePause"
        >
          <Play v-if="store.paused" class="h-5 w-5" />
          <Pause v-else class="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Skip forward 15s"
          @click="skip(15)"
        >
          <SkipForward class="h-4 w-4" />
        </Button>

        <template v-if="hasMetadata">
          <span class="w-px h-5 bg-border/60 mx-1" />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.roundTicks.length"
                @click="jumpToPrevRound"
              >
                <ChevronsLeft class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous round</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.roundTicks.length"
                @click="jumpToNextRound"
              >
                <ChevronsRight class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next round</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.kills.length"
                @click="jumpToPrevKill"
              >
                <Crosshair class="h-4 w-4" />
                <ChevronsLeft class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous kill</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.kills.length"
                @click="jumpToNextKill"
              >
                <Crosshair class="h-4 w-4" />
                <ChevronsRight class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next kill</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.bombs.length"
                @click="jumpToPrevBomb"
              >
                <Bomb class="h-4 w-4" />
                <ChevronsLeft class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous bomb event</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                :disabled="!store.bombs.length"
                @click="jumpToNextBomb"
              >
                <Bomb class="h-4 w-4" />
                <ChevronsRight class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next bomb event</TooltipContent>
          </Tooltip>
        </template>

        <div class="ml-auto flex items-center gap-1">
          <Gauge class="h-4 w-4 text-muted-foreground" />
          <Select
            :model-value="String(store.rate)"
            @update:model-value="onSpeedChange"
          >
            <SelectTrigger class="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="s in SPEED_OPTIONS"
                :key="s"
                :value="String(s)"
              >
                {{ s }}×
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
