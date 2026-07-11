<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Empty from "~/components/ui/empty/Empty.vue";
import { Upload, FileCheck2, FileWarning } from "lucide-vue-next";
import EventMediaCard from "~/components/events/EventMediaCard.vue";
import { useEventMediaUpload } from "~/composables/useEventMediaUpload";
import { useEventMediaQueue } from "~/composables/useEventMediaQueue";

type EventMedia = {
  id: string;
  filename: string;
  mime_type: string;
  title?: string | null;
  thumbnail_filename?: string | null;
  size?: number | string;
  uploader_steam_id: string;
  uploader?: { name?: string } | null;
  players?: any[];
};

const props = defineProps<{
  event: {
    id: string;
    is_organizer?: boolean;
    can_upload_media?: boolean;
    banner_media_id?: string | null;
    media?: EventMedia[];
  };
}>();

const { accept } = useEventMediaUpload(() => props.event.id);

// Module-scoped: uploads keep running (and the queue stays intact) when this
// panel or the whole page unmounts; a hard tab close triggers a warning.
const { queue, working, enqueue, clearQueue } = useEventMediaQueue(
  props.event.id,
);

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const media = computed<EventMedia[]>(() =>
  (props.event.media ?? []).filter(
    (item: EventMedia) => item.id !== props.event.banner_media_id,
  ),
);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files?.length) enqueue(target.files);
  target.value = "";
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (event.dataTransfer?.files?.length) {
    enqueue(event.dataTransfer.files);
  }
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="event.can_upload_media"
      class="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
      :class="[
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-accent/30',
      ]"
      role="button"
      tabindex="0"
      @click="triggerFileInput"
      @keydown.enter.prevent="triggerFileInput"
      @keydown.space.prevent="triggerFileInput"
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
    >
      <Upload
        class="mx-auto mb-2 h-8 w-8"
        :class="isDragging ? 'text-primary' : 'text-muted-foreground'"
      />
      <p class="mb-1 text-sm font-medium">
        <template v-if="isDragging">{{
          $t("event.media.drop_to_upload")
        }}</template>
        <template v-else>{{ $t("event.media.click_to_choose") }}</template>
      </p>
      <p class="text-xs text-muted-foreground">
        {{ $t("event.media.supported_types") }}
      </p>
    </div>

    <!-- Upload queue: one row per file so a mass drop is never a mystery. -->
    <div
      v-if="queue.length > 0"
      class="rounded-lg border border-border bg-card/50 p-3"
    >
      <div class="mb-2 flex items-center justify-between">
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("event.media.upload_queue") }}
          ({{ queue.filter((q) => q.status === "done").length }}/{{
            queue.length
          }})
        </span>
        <Button
          v-if="!working"
          variant="ghost"
          size="sm"
          class="h-6 px-2 font-mono text-[0.6rem] uppercase tracking-[0.14em]"
          @click="clearQueue"
        >
          {{ $t("event.media.queue_clear") }}
        </Button>
      </div>

      <div class="space-y-1.5">
        <div
          v-for="(item, index) in queue"
          :key="`${item.name}-${index}`"
          class="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded"
              :class="{
                'bg-emerald-500/15 text-emerald-400': item.status === 'done',
                'bg-destructive/15 text-destructive': item.status === 'error',
                'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]':
                  item.status === 'uploading',
                'bg-muted text-muted-foreground': item.status === 'waiting',
              }"
            >
              <FileCheck2 v-if="item.status === 'done'" class="h-3.5 w-3.5" />
              <FileWarning
                v-else-if="item.status === 'error'"
                class="h-3.5 w-3.5"
              />
              <Upload v-else class="h-3.5 w-3.5" />
            </span>
            <span class="min-w-0 flex-1 truncate text-xs">{{ item.name }}</span>
            <span
              class="shrink-0 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
            >
              {{ formatBytes(item.size) }}
            </span>
            <span
              class="w-20 shrink-0 text-right font-mono text-[0.6rem] uppercase tracking-[0.1em] tabular-nums"
              :class="{
                'text-emerald-400': item.status === 'done',
                'text-destructive': item.status === 'error',
                'text-[hsl(var(--tac-amber))]': item.status === 'uploading',
                'text-muted-foreground': item.status === 'waiting',
              }"
            >
              <template v-if="item.status === 'uploading'">
                <!-- 100% only means the browser finished sending; the API is
                     still writing to storage / making the poster. -->
                {{
                  item.progress < 100
                    ? `${item.progress}%`
                    : $t("event.media.queue_processing")
                }}
              </template>
              <template v-else>
                {{ $t(`event.media.queue_${item.status}`) }}
              </template>
            </span>
          </div>
          <Progress
            v-if="item.status === 'uploading'"
            :model-value="item.progress"
            class="mt-1.5 h-1"
          />
        </div>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />

    <Empty v-if="media.length === 0" class="min-h-[160px]">
      <p class="text-muted-foreground">{{ $t("event.media.none") }}</p>
    </Empty>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <EventMediaCard
        v-for="item in media"
        :key="item.id"
        :event="event"
        :item="item"
      />
    </div>
  </div>
</template>
