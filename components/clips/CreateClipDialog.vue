<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Film, Loader2 } from "lucide-vue-next";
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
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { generateMutation } from "~/graphql/graphqlGen";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import type { ClipSpec } from "~/graphql/clipRenderJob";
import ClipRenderProgress from "~/components/clips/ClipRenderProgress.vue";

// MVP single-segment trim. Full timeline editor (multi-segment,
// overlays, audio) is phase 2 — see plan file. The render itself runs
// on the game-streamer pod; this dialog only builds the spec.
const props = defineProps<{
  open: boolean;
  matchMapId: string;
}>();
const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
}>();

const store = useDemoPlaybackStore();
const { $apollo } = useNuxtApp();

const startTick = ref(0);
const endTick = ref(0);
const title = ref("");
const destination = ref<"library" | "download">("library");
const resolution = ref<"720p" | "1080p">("1080p");
const submitting = ref(false);
const submitError = ref<string | null>(null);
const renderingJobId = ref<string | null>(null);

// Re-seed every time the dialog opens — closing without submit
// discards in-progress edits, and the user expects to resume from the
// new playback position next time. Default range is 30s starting at
// the current playback tick, clamped against the demo's total.
watch(
  () => props.open,
  (v) => {
    if (!v) return;
    const max = store.totalTicks || store.tickRate * 60;
    const at = Math.min(store.currentTick, Math.max(0, max - 1));
    const span = store.tickRate > 0 ? store.tickRate * 30 : 1920;
    startTick.value = at;
    endTick.value = Math.min(at + span, max);
    title.value = "";
    destination.value = "library";
    resolution.value = "1080p";
    submitting.value = false;
    submitError.value = null;
    renderingJobId.value = null;
  },
);

const range = computed<number[]>(() => [startTick.value, endTick.value]);
function onRangeUpdate(v: number[] | undefined) {
  if (!v || v.length < 2) return;
  // Slider returns sorted values for range mode, but normalize anyway
  // so we never end up with start > end if the underlying primitive
  // ever changes behaviour.
  const lo = Math.min(v[0], v[1]);
  const hi = Math.max(v[0], v[1]);
  startTick.value = lo;
  endTick.value = hi;
}

const durationTicks = computed(() =>
  Math.max(0, endTick.value - startTick.value),
);
const isValid = computed(() => durationTicks.value > 0);

function formatSeconds(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
const startSeconds = computed(() =>
  store.tickRate > 0 ? startTick.value / store.tickRate : 0,
);
const endSeconds = computed(() =>
  store.tickRate > 0 ? endTick.value / store.tickRate : 0,
);
const durationSeconds = computed(() =>
  store.tickRate > 0 ? durationTicks.value / store.tickRate : 0,
);

async function submit() {
  if (!isValid.value || submitting.value) return;
  submitError.value = null;
  submitting.value = true;
  const spec: ClipSpec = {
    match_map_id: props.matchMapId,
    segments: [{ start_tick: startTick.value, end_tick: endTick.value }],
    output: { format: "mp4", resolution: resolution.value, fps: 60 },
    destination: destination.value,
    title: title.value || undefined,
  };
  try {
    const { data } = await $apollo.defaultClient.mutate({
      // Cast: schema not yet in zeus — see graphql/clipRenderJob.ts.
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

function close(v: boolean) {
  emit("update:open", v);
}
</script>

<template>
  <Dialog :open="open" @update:open="close">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Film class="h-4 w-4" />
          Create clip
        </DialogTitle>
        <DialogDescription>
          Trim the current demo into a clip. The render runs on the
          game-streamer pod and lands in your library when it finishes.
        </DialogDescription>
      </DialogHeader>

      <!-- Once the job is queued, swap the form for the progress view —
           the user can close this dialog and walk away; the render
           continues server-side and remains visible at /clips. -->
      <ClipRenderProgress
        v-if="renderingJobId"
        :job-id="renderingJobId"
        @close="close(false)"
      />

      <form v-else class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Range</Label>
            <span class="font-mono text-xs text-muted-foreground tabular-nums">
              {{ formatSeconds(startSeconds) }} →
              {{ formatSeconds(endSeconds) }}
              <span class="ml-2 text-foreground">
                ({{ formatSeconds(durationSeconds) }})
              </span>
            </span>
          </div>
          <Slider
            :model-value="range"
            :min="0"
            :max="store.totalTicks || endTick"
            :step="1"
            @update:model-value="onRangeUpdate"
          />
          <p class="text-[0.65rem] text-muted-foreground/70">
            Drag the handles to set the in/out points. Range is tick-accurate
            against the parsed demo.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="clip-title">Title</Label>
          <Input
            id="clip-title"
            v-model="title"
            placeholder="Untitled clip"
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
          <Button type="submit" :disabled="!isValid || submitting">
            <Loader2 v-if="submitting" class="h-4 w-4 mr-2 animate-spin" />
            Render
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
