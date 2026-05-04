<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Film,
  Loader2,
  Plus,
  Trash2,
  Scissors,
  MapPin,
  Sparkles,
  Sword,
  Crown,
  Trophy,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { generateMutation } from "~/graphql/graphqlGen";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import type { ClipSpec } from "~/graphql/clipRenderJob";
import ClipRenderProgress from "~/components/clips/ClipRenderProgress.vue";
import { useClipRenderActive } from "~/composables/useClipRenderActive";

// Multi-segment trim editor. The user assembles 1..N tick ranges along
// a single timeline rail; the server concatenates them in render. Each
// segment can be dragged whole, resized via its left/right edges, or
// split at the playhead. The editor is intentionally one-track: future
// overlays / audio rows attach to the same timeline.
const props = defineProps<{
  open: boolean;
  matchMapId: string;
}>();
const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
}>();

const store = useDemoPlaybackStore();
const { seek } = useDemoPlayback();
const nuxtApp = useNuxtApp();

type Segment = { id: string; start_tick: number; end_tick: number };

const mode = ref<"manual" | "auto">("manual");
const segments = ref<Segment[]>([]);
const selectedId = ref<string | null>(null);
const title = ref("");
const destination = ref<"library" | "download">("library");
const resolution = ref<"720p" | "1080p">("1080p");
const submitting = ref(false);
const submitError = ref<string | null>(null);
const renderingJobId = ref<string | null>(null);
const { setActive: setRenderActive } = useClipRenderActive();
watch(renderingJobId, (id) => setRenderActive(!!id));

// Auto-clip preset state. The api builds the multi-segment spec on
// its end (see ClipsService.buildPresetSpec) — the web side just
// picks a player + preset and submits a different mutation.
type Preset = "knife" | "multikills" | "best_round" | "recap";
const presetTarget = ref<string | null>(null);
const presetChoice = ref<Preset>("multikills");
const PRESETS: Array<{
  value: Preset;
  label: string;
  hint: string;
  icon: any;
}> = [
  {
    value: "multikills",
    label: "Multi-kills",
    hint: "Every round with 2+ kills, trimmed to the action",
    icon: Sparkles,
  },
  {
    value: "best_round",
    label: "Best round",
    hint: "Single round with the most kills",
    icon: Trophy,
  },
  {
    value: "knife",
    label: "Knife kills",
    hint: "Each knife frag with a 5s lead-in",
    icon: Sword,
  },
  {
    value: "recap",
    label: "Match recap",
    hint: "Every round the player got at least one kill",
    icon: Crown,
  },
];

// Reseed on every open. Drop a single ~30s seed segment anchored to
// the current playback tick — gives the user something to immediately
// trim or extend rather than staring at an empty rail.
watch(
  () => props.open,
  (v) => {
    if (!v) return;
    const max = store.totalTicks || store.tickRate * 60;
    const at = Math.min(store.currentTick, Math.max(0, max - 1));
    const span = store.tickRate > 0 ? store.tickRate * 30 : 1920;
    const end = Math.min(at + span, max);
    segments.value = [{ id: crypto.randomUUID(), start_tick: at, end_tick: end }];
    selectedId.value = segments.value[0].id;
    title.value = "";
    destination.value = "library";
    resolution.value = "1080p";
    submitting.value = false;
    submitError.value = null;
    renderingJobId.value = null;
    mode.value = "manual";
    // Default the preset target to whoever the operator is currently
    // spectating — saves a click when they think "I want clips of
    // this guy" right after watching them play.
    presetTarget.value = store.spectatedSteamId ?? null;
    presetChoice.value = "multikills";
  },
);

const max = computed(() => Math.max(1, store.totalTicks || 0));
const totalTicks = computed(() =>
  segments.value.reduce(
    (acc, s) => acc + Math.max(0, s.end_tick - s.start_tick),
    0,
  ),
);
const isValid = computed(
  () => segments.value.length > 0 && totalTicks.value > 0,
);
const playheadPct = computed(
  () => `${(Math.min(store.currentTick, max.value) / max.value) * 100}%`,
);

function formatSeconds(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
function ticksToSeconds(t: number) {
  return store.tickRate > 0 ? t / store.tickRate : 0;
}
function pctOf(tick: number) {
  return `${(tick / max.value) * 100}%`;
}
function widthOf(seg: Segment) {
  return `${((seg.end_tick - seg.start_tick) / max.value) * 100}%`;
}

function addSegmentAtPlayhead() {
  const at = Math.min(store.currentTick, max.value - 1);
  const span = store.tickRate > 0 ? store.tickRate * 10 : 640;
  const end = Math.min(at + span, max.value);
  const seg = { id: crypto.randomUUID(), start_tick: at, end_tick: end };
  segments.value.push(seg);
  segments.value.sort((a, b) => a.start_tick - b.start_tick);
  selectedId.value = seg.id;
}
function splitSelectedAtPlayhead() {
  const id = selectedId.value;
  if (!id) return;
  const seg = segments.value.find((s) => s.id === id);
  if (!seg) return;
  const at = store.currentTick;
  // Refuse to split if the playhead is outside the segment or too
  // close to either edge — the resulting sliver would be unusable.
  const minSpan = Math.max(1, Math.round(store.tickRate * 0.5));
  if (at <= seg.start_tick + minSpan || at >= seg.end_tick - minSpan) return;
  const right = {
    id: crypto.randomUUID(),
    start_tick: at,
    end_tick: seg.end_tick,
  };
  seg.end_tick = at;
  segments.value.push(right);
  segments.value.sort((a, b) => a.start_tick - b.start_tick);
  selectedId.value = right.id;
}
function removeSelected() {
  const id = selectedId.value;
  if (!id) return;
  segments.value = segments.value.filter((s) => s.id !== id);
  selectedId.value = segments.value[0]?.id ?? null;
}
function selectSegment(id: string) {
  selectedId.value = id;
}
function jumpToSegmentStart(seg: Segment) {
  selectedId.value = seg.id;
  void seek(seg.start_tick);
}

// Drag handling. We compute the rail's bounding rect once at
// pointerdown and convert each pointermove's clientX into ticks via
// (x - left) / width * max. Edges, body, and add-handle all share the
// same math but apply the delta differently.
const railEl = ref<HTMLDivElement | null>(null);
type DragMode = "left" | "right" | "body";
let dragState:
  | {
      mode: DragMode;
      seg: Segment;
      origStart: number;
      origEnd: number;
      grabTick: number;
      rect: DOMRect;
    }
  | null = null;
function startDrag(seg: Segment, mode: DragMode, e: PointerEvent) {
  if (!railEl.value) return;
  e.stopPropagation();
  selectedId.value = seg.id;
  const rect = railEl.value.getBoundingClientRect();
  dragState = {
    mode,
    seg,
    origStart: seg.start_tick,
    origEnd: seg.end_tick,
    grabTick: pointerTick(e.clientX, rect),
    rect,
  };
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", onDragEnd);
}
function pointerTick(clientX: number, rect: DOMRect) {
  const ratio = (clientX - rect.left) / rect.width;
  return Math.round(Math.max(0, Math.min(1, ratio)) * max.value);
}
function onDragMove(e: PointerEvent) {
  if (!dragState) return;
  const tick = pointerTick(e.clientX, dragState.rect);
  const minSpan = Math.max(1, Math.round(store.tickRate * 0.5));
  const { mode, seg, origStart, origEnd, grabTick } = dragState;
  if (mode === "left") {
    seg.start_tick = Math.max(0, Math.min(tick, seg.end_tick - minSpan));
  } else if (mode === "right") {
    seg.end_tick = Math.max(seg.start_tick + minSpan, Math.min(tick, max.value));
  } else {
    const delta = tick - grabTick;
    const span = origEnd - origStart;
    let nextStart = origStart + delta;
    nextStart = Math.max(0, Math.min(nextStart, max.value - span));
    seg.start_tick = nextStart;
    seg.end_tick = nextStart + span;
  }
}
function onDragEnd() {
  if (!dragState) return;
  dragState = null;
  segments.value.sort((a, b) => a.start_tick - b.start_tick);
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragEnd);
  window.removeEventListener("pointercancel", onDragEnd);
}

// Click on empty rail: seek the demo to that tick (preview the
// position before deciding where to add). Clicking on a segment
// (handled separately) selects it.
function onRailClick(e: MouseEvent) {
  if (!railEl.value) return;
  const rect = railEl.value.getBoundingClientRect();
  const tick = pointerTick(e.clientX, rect);
  void seek(tick);
}

// Round/kill markers — same source as DemoPlaybackControls so the
// editor feels continuous with the player below it.
const roundMarkers = computed(() =>
  store.totalTicks > 0
    ? store.roundTicks.map((r) => ({
        round: r.round,
        left: pctOf(r.start_tick),
        tick: r.start_tick,
      }))
    : [],
);

async function submit() {
  if (mode.value === "auto") return submitPreset();
  if (!isValid.value || submitting.value) return;
  submitError.value = null;
  submitting.value = true;
  const spec: ClipSpec = {
    match_map_id: props.matchMapId,
    segments: segments.value
      .slice()
      .sort((a, b) => a.start_tick - b.start_tick)
      .map((s) => ({ start_tick: s.start_tick, end_tick: s.end_tick })),
    output: { format: "mp4", resolution: resolution.value, fps: 60 },
    destination: destination.value,
    title: title.value || undefined,
  };
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        createClipRender: [
          { spec },
          { success: true, job_id: true },
        ],
      } as any),
    });
    const out = (data as any)?.createClipRender;
    if (!out?.success || !out?.job_id) {
      throw new Error("createClipRender returned no job");
    }
    renderingJobId.value = out.job_id;
  } catch (e) {
    submitError.value =
      (e as any)?.graphQLErrors?.[0]?.message ??
      (e as Error)?.message ??
      "Failed to submit clip";
  } finally {
    submitting.value = false;
  }
}

async function submitPreset() {
  if (submitting.value) return;
  if (!presetTarget.value) {
    submitError.value = "Pick a player to highlight";
    return;
  }
  submitError.value = null;
  submitting.value = true;
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        createClipFromPreset: [
          {
            match_map_id: props.matchMapId,
            target_steam_id: presetTarget.value,
            preset: presetChoice.value,
            resolution: resolution.value,
            fps: 60,
            title: title.value || undefined,
          },
          { success: true, job_id: true },
        ],
      } as any),
    });
    const out = (data as any)?.createClipFromPreset;
    if (!out?.success || !out?.job_id) {
      throw new Error("createClipFromPreset returned no job");
    }
    renderingJobId.value = out.job_id;
  } catch (e) {
    submitError.value =
      (e as any)?.graphQLErrors?.[0]?.message ??
      (e as Error)?.message ??
      "Failed to submit highlight";
  } finally {
    submitting.value = false;
  }
}

const canSubmit = computed(() =>
  mode.value === "manual"
    ? isValid.value
    : !!presetTarget.value && !submitting.value,
);

function close(v: boolean) {
  emit("update:open", v);
}
</script>

<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="sm:max-w-[820px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Film class="h-4 w-4" />
          Create clip
        </DialogTitle>
        <DialogDescription>
          Trim the demo into one or more segments. They render as a single
          mp4 in the order they appear on the timeline.
        </DialogDescription>
      </DialogHeader>

      <ClipRenderProgress
        v-if="renderingJobId"
        :job-id="renderingJobId"
        @close="close(false)"
      />

      <form v-else class="space-y-5" @submit.prevent="submit">
        <Tabs v-model="mode" class="w-full">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <Scissors class="h-3.5 w-3.5 mr-1.5" />
              Trim
            </TabsTrigger>
            <TabsTrigger value="auto">
              <Sparkles class="h-3.5 w-3.5 mr-1.5" />
              Highlights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" class="space-y-5 mt-4">
        <!-- Timeline rail. Segments sit on the rail as draggable bars;
             round-start ticks are landmarks so the user can navigate
             the demo without leaving the dialog. The amber playhead
             tracks the live demo tick (driven by the store's tick
             estimator) so users can scrub via the player below and see
             where they'd be cutting in real time. -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Segments</Label>
            <span class="font-mono text-xs text-muted-foreground tabular-nums">
              {{ segments.length }}
              {{ segments.length === 1 ? "segment" : "segments" }}
              · total {{ formatSeconds(ticksToSeconds(totalTicks)) }}
            </span>
          </div>

          <div class="rounded-md border border-border/60 bg-muted/20 p-2">
            <div
              ref="railEl"
              class="relative h-12 rounded bg-card/40 border border-border/40 cursor-pointer overflow-hidden"
              @click="onRailClick"
            >
              <!-- Round marker rail. Same amber tick as the player. -->
              <div
                v-for="m in roundMarkers"
                :key="`r-${m.round}`"
                :style="{ left: m.left }"
                class="absolute top-0 bottom-0 w-px bg-[hsl(var(--tac-amber)/0.45)] pointer-events-none"
                :title="`Round ${m.round}`"
              />

              <!-- Segments. Body is draggable; left/right edges resize.
                   Selected gets a stronger border + brighter fill so
                   the inspector + delete actions feel anchored. -->
              <div
                v-for="seg in segments"
                :key="seg.id"
                :style="{ left: pctOf(seg.start_tick), width: widthOf(seg) }"
                :class="[
                  'absolute top-1 bottom-1 rounded border flex items-stretch transition-colors',
                  selectedId === seg.id
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.25)]'
                    : 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] hover:bg-[hsl(var(--tac-amber)/0.18)]',
                ]"
                @click.stop="selectSegment(seg.id)"
                @dblclick.stop="jumpToSegmentStart(seg)"
              >
                <!-- Left edge handle. Stops click-propagation so the
                     rail's onRailClick (which seeks the demo) doesn't
                     fire when the user starts a resize. -->
                <span
                  class="w-1.5 cursor-ew-resize bg-[hsl(var(--tac-amber)/0.55)] hover:bg-[hsl(var(--tac-amber))] rounded-l"
                  @pointerdown="(e) => startDrag(seg, 'left', e)"
                  @click.stop
                />
                <span
                  class="flex-1 cursor-grab active:cursor-grabbing"
                  @pointerdown="(e) => startDrag(seg, 'body', e)"
                  @click.stop="selectSegment(seg.id)"
                />
                <span
                  class="w-1.5 cursor-ew-resize bg-[hsl(var(--tac-amber)/0.55)] hover:bg-[hsl(var(--tac-amber))] rounded-r"
                  @pointerdown="(e) => startDrag(seg, 'right', e)"
                  @click.stop
                />
              </div>

              <!-- Live playhead. Pointer-events-none so it doesn't
                   eat seek-clicks on the rail. Tracks the demo's
                   currentTick which animates ~20Hz. -->
              <div
                :style="{ left: playheadPct }"
                class="absolute top-0 bottom-0 w-0.5 bg-foreground/80 pointer-events-none shadow-[0_0_4px_rgba(255,255,255,0.5)]"
              />
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                @click="addSegmentAtPlayhead"
              >
                <Plus class="h-3.5 w-3.5 mr-1" />
                Add at playhead
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                :disabled="!selectedId"
                @click="splitSelectedAtPlayhead"
              >
                <Scissors class="h-3.5 w-3.5 mr-1" />
                Split
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                :disabled="!selectedId"
                @click="removeSelected"
              >
                <Trash2 class="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
              <span class="ml-auto inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground/80 font-mono uppercase tracking-wider">
                <MapPin class="h-3 w-3" />
                Click rail to seek · drag edges to trim
              </span>
            </div>
          </div>

          <!-- Per-segment list, mirrors the rail. Useful for tick-precise
               adjustments + as the place to surface duration deltas at
               a glance. -->
          <div class="space-y-1.5 max-h-32 overflow-y-auto">
            <div
              v-for="(seg, idx) in segments"
              :key="seg.id"
              :class="[
                'flex items-center gap-2 rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                selectedId === seg.id
                  ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)]'
                  : 'border-border/60 bg-card/40 hover:bg-muted/40',
              ]"
              @click="selectSegment(seg.id)"
              @dblclick="jumpToSegmentStart(seg)"
            >
              <span class="font-mono w-6 text-muted-foreground">#{{ idx + 1 }}</span>
              <span class="font-mono tabular-nums">
                {{ formatSeconds(ticksToSeconds(seg.start_tick)) }} →
                {{ formatSeconds(ticksToSeconds(seg.end_tick)) }}
              </span>
              <span class="ml-auto font-mono tabular-nums text-muted-foreground">
                {{ formatSeconds(ticksToSeconds(seg.end_tick - seg.start_tick)) }}
              </span>
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="auto" class="space-y-4 mt-4">
            <!-- Pick the player to highlight. Defaults to whoever the
                 operator is spectating, but they can switch to anyone
                 in either lineup. The api builds the segments. -->
            <div class="space-y-2">
              <Label>Player</Label>
              <Select :model-value="presetTarget ?? ''" @update:model-value="(v) => (presetTarget = (v as string) || null)">
                <SelectTrigger>
                  <SelectValue placeholder="Pick a player to highlight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup v-if="store.rosters.lineup1.length">
                    <SelectLabel
                      class="text-[0.65rem] uppercase tracking-wider text-[hsl(var(--tac-amber))]"
                    >
                      {{ store.lineup1Name ?? "Team 1" }}
                    </SelectLabel>
                    <SelectItem
                      v-for="p in store.rosters.lineup1"
                      :key="p.steam_id"
                      :value="p.steam_id"
                    >
                      {{ p.name }}
                    </SelectItem>
                  </SelectGroup>
                  <SelectGroup v-if="store.rosters.lineup2.length">
                    <SelectLabel
                      class="text-[0.65rem] uppercase tracking-wider text-destructive"
                    >
                      {{ store.lineup2Name ?? "Team 2" }}
                    </SelectLabel>
                    <SelectItem
                      v-for="p in store.rosters.lineup2"
                      :key="p.steam_id"
                      :value="p.steam_id"
                    >
                      {{ p.name }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Preset</Label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in PRESETS"
                  :key="p.value"
                  type="button"
                  :class="[
                    'flex items-start gap-2 rounded-md border p-3 text-left transition-all duration-150',
                    presetChoice === p.value
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)]'
                      : 'border-border/60 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-muted/40',
                  ]"
                  @click="presetChoice = p.value"
                >
                  <component :is="p.icon" class="h-4 w-4 mt-0.5 shrink-0" />
                  <span class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-sm font-medium">{{ p.label }}</span>
                    <span class="text-[0.7rem] text-muted-foreground leading-snug">
                      {{ p.hint }}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <p class="text-[0.7rem] text-muted-foreground/80 leading-relaxed">
              The server scans this match's parsed kills, builds the segment
              list automatically, and submits to the same render pipeline
              as a manual trim. Falls back to the player's best single kill
              if the chosen preset finds nothing.
            </p>
          </TabsContent>
        </Tabs>

        <div class="space-y-2">
          <Label for="clip-title">Title</Label>
          <Input
            id="clip-title"
            v-model="title"
            :placeholder="
              mode === 'auto'
                ? 'Defaults to preset name'
                : 'Untitled clip'
            "
            maxlength="80"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Resolution</Label>
            <Select v-model="resolution">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>Destination</Label>
            <Select v-model="destination">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="library">Save to my library</SelectItem>
                <SelectItem value="download">Download only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p v-if="submitError" class="text-xs text-destructive">
          {{ submitError }}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            :disabled="submitting"
            @click="close(false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit || submitting">
            <Loader2 v-if="submitting" class="h-4 w-4 mr-2 animate-spin" />
            <span v-if="mode === 'auto'">Generate highlights</span>
            <span v-else>
              Render {{ segments.length > 1 ? `${segments.length} segments` : "" }}
            </span>
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
