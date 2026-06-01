<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import {
  Plus,
  Trash2,
  Scissors,
  Play,
  Square,
  X,
  Loader2,
  Film,
  Users,
  ChevronDown,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useClipEditor, type EditorSegment } from "~/composables/useClipEditor";
import { useClipRenderActive } from "~/composables/useClipRenderActive";
import { generateMutation } from "~/graphql/graphqlGen";
import type { ClipSpec } from "~/graphql/clipRenderJob";
import ClipRenderProgress from "~/components/clips/ClipRenderProgress.vue";

const props = defineProps<{
  matchMapId: string;
}>();

const store = useDemoPlaybackStore();
const appSettings = useApplicationSettingsStore();

const clipFps = computed<30 | 60>(() => {
  const raw = appSettings.settings.find((s) => s.name === "clip_fps")?.value;
  return raw === "30" ? 30 : 60;
});

const clipResolutionDefault = computed<"720p" | "1080p">(() => {
  const raw = appSettings.settings.find(
    (s) => s.name === "clip_resolution",
  )?.value;
  return raw === "720p" ? "720p" : "1080p";
});
const { seek, setHudVisible } = useDemoPlayback();
const editor = useClipEditor();
const nuxtApp = useNuxtApp();
const { active: renderActive, trackJob: trackRenderJob } =
  useClipRenderActive();

const title = ref("");
const resolution = ref<"720p" | "1080p">(clipResolutionDefault.value);
watch(clipResolutionDefault, (v) => {
  resolution.value = v;
});
const submitting = ref(false);
const submitError = ref<string | null>(null);
const renderingJobId = ref<string | null>(null);
watch(renderingJobId, (id) => trackRenderJob(id));

// The inline render captures the pod's live frames, so the JT HUD
// overlay would otherwise be baked into the clip. Hide it for the
// duration of the render and restore it once the job reaches a
// terminal status (renderActive flips false). Only restore if we were
// the ones who hid it, so we don't fight an operator who had the HUD
// off already.
const hudHiddenForRender = ref(false);
function restoreHudAfterRender() {
  if (hudHiddenForRender.value) {
    setHudVisible(true);
    hudHiddenForRender.value = false;
  }
}
watch(renderActive, (active) => {
  if (!active) restoreHudAfterRender();
});

const max = computed(() => Math.max(1, store.totalTicks || 0));
const playheadPct = computed(
  () => `${(Math.min(store.currentTick, max.value) / max.value) * 100}%`,
);

function pctOf(tick: number) {
  return `${(Math.max(0, Math.min(tick, max.value)) / max.value) * 100}%`;
}
function widthPct(seg: EditorSegment) {
  return `${(Math.max(0, seg.end_tick - seg.start_tick) / max.value) * 100}%`;
}

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

const roundMarkers = computed(() =>
  store.totalTicks > 0
    ? store.roundTicks.map((r) => ({
        round: r.round,
        left: pctOf(r.start_tick),
        tick: r.start_tick,
      }))
    : [],
);

// Sourced from kills + GSI rather than the api lineup — demos can be
// cross-loaded against a different match.
type DemoPlayer = {
  steam_id: string;
  name: string;
  team: "T" | "CT" | null;
};
const demoPlayers = computed<DemoPlayer[]>(() => {
  const seen = new Set<string>();
  const out: DemoPlayer[] = [];
  const gsiBySid = new Map<string, (typeof store.specSlots)[number]>();
  for (const s of store.specSlots) {
    if (s.steam_id) gsiBySid.set(s.steam_id, s);
  }
  const add = (sid: string | undefined | null) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    const gsi = gsiBySid.get(sid);
    out.push({
      steam_id: sid,
      name: gsi?.name ?? store.playerNames[sid] ?? `#${sid.slice(-4)}`,
      team: gsi?.team ?? null,
    });
  };
  for (const k of store.kills) {
    add(k.killer);
    add(k.victim);
  }
  for (const s of store.specSlots) add(s.steam_id);
  return out.sort((a, b) => a.name.localeCompare(b.name));
});

function povNameFor(seg: EditorSegment): string {
  if (!seg.pov_steam_id) return t("clips.editor.auto");
  const p = demoPlayers.value.find((x) => x.steam_id === seg.pov_steam_id);
  return p?.name ?? t("clips.default_player");
}
function povTeamFor(seg: EditorSegment): "CT" | "T" | null {
  if (!seg.pov_steam_id) return null;
  const p = demoPlayers.value.find((x) => x.steam_id === seg.pov_steam_id);
  return p?.team ?? null;
}

const railEl = ref<HTMLDivElement | null>(null);
type DragMode = "left" | "right" | "body";
let dragState: {
  mode: DragMode;
  seg: EditorSegment;
  origStart: number;
  origEnd: number;
  grabTick: number;
  rect: DOMRect;
} | null = null;
function pointerTick(clientX: number, rect: DOMRect) {
  const ratio = (clientX - rect.left) / rect.width;
  return Math.round(Math.max(0, Math.min(1, ratio)) * max.value);
}
function startDrag(seg: EditorSegment, mode: DragMode, e: PointerEvent) {
  if (!railEl.value) return;
  e.stopPropagation();
  editor.selectedId.value = seg.id;
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
function onDragMove(e: PointerEvent) {
  if (!dragState) return;
  const tick = pointerTick(e.clientX, dragState.rect);
  if (dragState.mode === "left") {
    editor.moveSegmentEdge(dragState.seg.id, "left", tick);
  } else if (dragState.mode === "right") {
    editor.moveSegmentEdge(dragState.seg.id, "right", tick);
  } else {
    editor.moveSegmentBody(dragState.seg.id, tick - dragState.grabTick);
    dragState.grabTick = tick;
  }
}
function onDragEnd() {
  if (!dragState) return;
  dragState = null;
  editor.commitSort();
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragEnd);
  window.removeEventListener("pointercancel", onDragEnd);
}

// Click-drag on the empty rail commits a new segment.
const draft = ref<{ startTick: number; endTick: number } | null>(null);
let draftRect: DOMRect | null = null;
function onRailPointerDown(e: PointerEvent) {
  if (!railEl.value) return;
  // Bubbled pointerdown from an existing segment's body — ignore.
  if ((e.target as HTMLElement).dataset.segmentBody === "true") return;
  draftRect = railEl.value.getBoundingClientRect();
  const tick = pointerTick(e.clientX, draftRect);
  draft.value = { startTick: tick, endTick: tick };
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  window.addEventListener("pointermove", onDraftMove);
  window.addEventListener("pointerup", onDraftEnd);
  window.addEventListener("pointercancel", onDraftCancel);
}
function onDraftMove(e: PointerEvent) {
  if (!draft.value || !draftRect) return;
  draft.value.endTick = pointerTick(e.clientX, draftRect);
}
function onDraftEnd() {
  if (draft.value) {
    const { startTick, endTick } = draft.value;
    const minSpan = Math.max(1, Math.round((store.tickRate || 64) * 0.5));
    if (Math.abs(endTick - startTick) < minSpan) {
      // Treat tiny gestures as a click → seek to that tick instead of
      // committing a useless segment.
      void seek(startTick);
    } else {
      editor.addSegmentRange(startTick, endTick);
    }
  }
  cleanupDraft();
}
function onDraftCancel() {
  cleanupDraft();
}
function cleanupDraft() {
  draft.value = null;
  draftRect = null;
  window.removeEventListener("pointermove", onDraftMove);
  window.removeEventListener("pointerup", onDraftEnd);
  window.removeEventListener("pointercancel", onDraftCancel);
}

const draftStyle = computed(() => {
  if (!draft.value) return null;
  const { startTick, endTick } = draft.value;
  const lo = Math.min(startTick, endTick);
  const hi = Math.max(startTick, endTick);
  return {
    left: pctOf(lo),
    width: `${((hi - lo) / max.value) * 100}%`,
  };
});

function addAtPlayhead() {
  editor.addSegmentAt(store.currentTick);
}
function splitSelected() {
  if (!editor.selectedId.value) return;
  editor.splitSegmentAtPlayhead(editor.selectedId.value);
}
function deleteSelected() {
  if (!editor.selectedId.value) return;
  editor.removeSegment(editor.selectedId.value);
}
function jumpToSegment(seg: EditorSegment) {
  editor.selectedId.value = seg.id;
  void seek(seg.start_tick);
}

function togglePreview() {
  if (editor.previewing.value) {
    editor.stopPreview();
  } else {
    editor.startPreview();
  }
}

async function submit() {
  if (!editor.isValid.value || submitting.value) return;
  submitError.value = null;
  submitting.value = true;
  const sorted = editor.sortedSegments.value;
  const spec: ClipSpec = {
    match_map_id: props.matchMapId,
    segments: sorted.map((s) => ({
      start_tick: s.start_tick,
      end_tick: s.end_tick,
      ...(s.pov_steam_id ? { pov_steam_id: s.pov_steam_id } : {}),
    })),
    output: { format: "mp4", resolution: resolution.value, fps: clipFps.value },
    destination: "library",
    title: title.value || undefined,
  };
  // Hide the JT HUD before the pod starts capturing; restored when the
  // job finishes (watch on renderActive) or if submission fails below.
  if (store.hudVisible) {
    setHudVisible(false);
    hudHiddenForRender.value = true;
  }
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        createClipRender: [{ spec }, { success: true, job_id: true }],
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
    restoreHudAfterRender();
  } finally {
    submitting.value = false;
  }
}

function close() {
  editor.close();
}

function onRenderClose() {
  renderingJobId.value = null;
  editor.close();
}
</script>

<template>
  <div
    class="border-t border-b border-border/60 bg-card/40 [backdrop-filter:blur(8px)] px-3 sm:px-4 py-3"
  >
    <ClipRenderProgress
      v-if="renderingJobId"
      :job-id="renderingJobId"
      @close="onRenderClose"
    />

    <div v-else class="space-y-3">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2.5">
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)]"
          >
            <Film class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
          </span>
          <span
            class="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-foreground/90"
          >
            {{ $t("clips.editor.title") }}
          </span>
        </div>

        <!-- Stat readout: segment count + total duration as discrete
             fields, duration promoted to amber as the focal number. -->
        <div
          class="flex items-center gap-2 font-mono text-[0.62rem] tabular-nums text-muted-foreground"
        >
          <span>
            {{ editor.segments.value.length }}
            {{ editor.segments.value.length === 1 ? "segment" : "segments" }}
          </span>
          <span class="h-3 w-px bg-border/60" />
          <span class="text-[hsl(var(--tac-amber)/0.85)]">
            {{
              formatSeconds(ticksToSeconds(editor.totalSelectedTicks.value))
            }}
          </span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <!-- Segment edit ops — one connected control instead of three
               free-floating buttons. -->
          <div
            class="inline-flex items-center rounded-md border border-border/60 bg-card/40 p-0.5"
          >
            <button
              type="button"
              class="inline-flex h-6 items-center gap-1 rounded-[3px] px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors cursor-pointer hover:bg-[hsl(var(--tac-amber)/0.1)] hover:text-[hsl(var(--tac-amber))]"
              @click="addAtPlayhead"
            >
              <Plus class="h-3.5 w-3.5" />
              Add
            </button>
            <span class="h-4 w-px bg-border/50" />
            <button
              type="button"
              :disabled="!editor.selectedId.value"
              class="inline-flex h-6 items-center gap-1 rounded-[3px] px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors cursor-pointer hover:bg-muted/50 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              @click="splitSelected"
            >
              <Scissors class="h-3.5 w-3.5" />
              {{ $t("clips.editor.split") }}
            </button>
            <span class="h-4 w-px bg-border/50" />
            <button
              type="button"
              :disabled="!editor.selectedId.value"
              class="inline-flex h-6 items-center gap-1 rounded-[3px] px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors cursor-pointer hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              @click="deleteSelected"
            >
              <Trash2 class="h-3.5 w-3.5" />
              {{ $t("clips.editor.delete") }}
            </button>
          </div>

          <span class="h-5 w-px bg-border/60" />

          <!-- Preview / Stop — set apart as the playback control. -->
          <button
            type="button"
            :disabled="!editor.isValid.value"
            class="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            :class="
              editor.previewing.value
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                : 'border-border/60 text-foreground/90 hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))]'
            "
            @click="togglePreview"
          >
            <Square v-if="editor.previewing.value" class="h-3.5 w-3.5" />
            <Play v-else class="h-3.5 w-3.5" />
            {{ editor.previewing.value ? "Stop" : "Preview" }}
          </button>

          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors cursor-pointer hover:bg-muted/50 hover:text-foreground"
            :title="$t('clips.editor.close')"
            @click="close"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="space-y-1">
        <div
          class="flex items-center gap-2 text-[0.58rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/70"
        >
          <span
            class="inline-block h-[2px] w-2.5 bg-[hsl(var(--tac-amber)/0.7)]"
          ></span>
          {{ $t("clips.editor.segments") }}
          <span class="ml-auto text-muted-foreground/50">
            click + drag empty rail to add range
          </span>
        </div>

        <div
          ref="railEl"
          class="relative h-10 rounded-md border border-border/40 bg-card/60 overflow-hidden"
          @pointerdown="onRailPointerDown"
        >
          <div
            v-for="m in roundMarkers"
            :key="`r-${m.round}`"
            :style="{ left: m.left }"
            class="absolute top-0 bottom-0 w-px bg-[hsl(var(--tac-amber)/0.35)] pointer-events-none"
            :title="`Round ${m.round}`"
          />

          <div
            v-for="seg in editor.segments.value"
            :key="seg.id"
            :style="{ left: pctOf(seg.start_tick), width: widthPct(seg) }"
            :class="[
              'absolute top-1 bottom-1 rounded border flex items-stretch transition-colors',
              editor.selectedId.value === seg.id
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.28)]'
                : 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.14)] hover:bg-[hsl(var(--tac-amber)/0.2)]',
            ]"
            @pointerdown.stop
            @click.stop="editor.selectedId.value = seg.id"
            @dblclick.stop="jumpToSegment(seg)"
          >
            <span
              class="w-1.5 cursor-ew-resize bg-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber))] rounded-l"
              @pointerdown="(e) => startDrag(seg, 'left', e)"
            />
            <span
              data-segment-body="true"
              class="flex-1 cursor-grab active:cursor-grabbing"
              @pointerdown="(e) => startDrag(seg, 'body', e)"
            />
            <span
              class="w-1.5 cursor-ew-resize bg-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber))] rounded-r"
              @pointerdown="(e) => startDrag(seg, 'right', e)"
            />
          </div>

          <div
            v-if="draftStyle"
            :style="draftStyle"
            class="absolute top-1 bottom-1 rounded border border-dashed border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.18)] pointer-events-none"
          />

          <div
            :style="{ left: playheadPct }"
            class="absolute top-0 bottom-0 w-0.5 bg-foreground/80 pointer-events-none shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          />
        </div>

        <div
          class="flex items-center gap-2 mt-2 text-[0.58rem] font-mono uppercase tracking-[0.18em] text-muted-foreground/70"
        >
          <span class="inline-block h-[2px] w-2.5 bg-primary/70"></span>
          POV
          <span class="ml-auto text-muted-foreground/50">
            click chip to switch the spectated player
          </span>
        </div>

        <div class="relative h-9 rounded-md bg-card/30 border border-border/40">
          <Popover v-for="seg in editor.segments.value" :key="`pov-${seg.id}`">
            <PopoverTrigger as-child>
              <button
                type="button"
                :style="{ left: pctOf(seg.start_tick), width: widthPct(seg) }"
                :class="[
                  'absolute top-1 bottom-1 rounded border px-2 text-[0.65rem] font-medium transition-colors flex items-center gap-1.5 truncate',
                  editor.selectedId.value === seg.id
                    ? 'border-primary bg-primary/15'
                    : 'border-border/60 bg-card/60 hover:bg-muted/40',
                ]"
                @click.stop="editor.selectedId.value = seg.id"
              >
                <Users
                  class="h-3 w-3 shrink-0"
                  :class="
                    povTeamFor(seg) === 'CT'
                      ? 'text-blue-400'
                      : povTeamFor(seg) === 'T'
                        ? 'text-amber-400'
                        : 'text-muted-foreground'
                  "
                />
                <span class="truncate flex-1 text-left">
                  {{ povNameFor(seg) }}
                </span>
                <ChevronDown class="h-3 w-3 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="w-56 p-1" align="start">
              <div class="max-h-64 overflow-y-auto">
                <button
                  type="button"
                  class="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 text-muted-foreground"
                  @click="editor.setSegmentPov(seg.id, null)"
                >
                  {{ $t("clips.editor.auto_current_spectator") }}
                </button>
                <div class="border-t border-border/40 my-1"></div>
                <div
                  v-if="!demoPlayers.length"
                  class="px-2 py-2 text-[0.65rem] text-muted-foreground"
                >
                  {{ $t("clips.editor.no_players_yet_demo") }}
                </div>
                <button
                  v-for="p in demoPlayers"
                  :key="p.steam_id"
                  type="button"
                  :class="[
                    'w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 flex items-center gap-2',
                    seg.pov_steam_id === p.steam_id ? 'bg-muted/60' : '',
                  ]"
                  @click="editor.setSegmentPov(seg.id, p.steam_id)"
                >
                  <span
                    class="inline-block h-1.5 w-1.5 rounded-full"
                    :class="
                      p.team === 'CT'
                        ? 'bg-blue-400'
                        : p.team === 'T'
                          ? 'bg-amber-400'
                          : 'bg-muted-foreground/50'
                    "
                  ></span>
                  <span class="truncate">{{ p.name }}</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div
            v-if="
              editor.previewing.value &&
              editor.previewSegmentIndex.value >= 0 &&
              editor.sortedSegments.value[editor.previewSegmentIndex.value]
            "
            :style="{
              left: pctOf(
                editor.sortedSegments.value[editor.previewSegmentIndex.value]
                  .start_tick,
              ),
              width: widthPct(
                editor.sortedSegments.value[editor.previewSegmentIndex.value],
              ),
            }"
            class="absolute top-0 bottom-0 rounded-md border-2 border-primary pointer-events-none animate-pulse"
          />
        </div>
      </div>

      <div
        class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end"
      >
        <div class="space-y-1">
          <Label
            for="clip-editor-title"
            class="text-[0.6rem] font-mono uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("clips.editor.title_label") }}
          </Label>
          <Input
            id="clip-editor-title"
            v-model="title"
            :placeholder="$t('clips.untitled_clip')"
            class="h-8 text-sm"
            maxlength="80"
          />
        </div>
        <div class="space-y-1">
          <Label
            class="text-[0.6rem] font-mono uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("clips.editor.resolution") }}
          </Label>
          <Select v-model="resolution">
            <SelectTrigger class="h-8 w-[6.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          class="h-8 self-end"
          :disabled="!editor.isValid.value || submitting"
          @click="submit"
        >
          <Loader2 v-if="submitting" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
          <Film v-else class="h-3.5 w-3.5 mr-1.5" />
          {{ $t("clips.editor.render") }}
        </Button>
      </div>

      <p v-if="submitError" class="text-xs text-destructive">
        {{ submitError }}
      </p>
    </div>
  </div>
</template>
