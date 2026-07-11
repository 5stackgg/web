<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Empty from "~/components/ui/empty/Empty.vue";
import { Upload, FileCheck2, FileWarning, X, Plus } from "lucide-vue-next";
import EventMediaCard from "~/components/events/EventMediaCard.vue";
import EventMediaDropzone from "~/components/events/EventMediaDropzone.vue";
import EventAddMediaDialog from "~/components/events/EventAddMediaDialog.vue";
import EventPlayerPicker from "~/components/events/EventPlayerPicker.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useEventMediaQueue } from "~/composables/useEventMediaQueue";

type EventMedia = {
  id: string;
  filename?: string | null;
  mime_type?: string | null;
  title?: string | null;
  thumbnail_filename?: string | null;
  external_url?: string | null;
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

// Module-scoped: uploads keep running (and the queue stays intact) when this
// panel or the whole page unmounts; a hard tab close triggers a warning. The
// dropzone enqueues into this same shared queue.
const { queue, working, clearQueue } = useEventMediaQueue(props.event.id);

const addDialogOpen = ref(false);
const filterPlayer = ref<{ steam_id: string | number; name?: string } | null>(
  null,
);

// All gallery media (banner excluded) before the player filter — drives the
// filter row's visibility and the "no media at all" empty state.
const baseMedia = computed<EventMedia[]>(() =>
  (props.event.media ?? []).filter(
    (item: EventMedia) => item.id !== props.event.banner_media_id,
  ),
);

const media = computed<EventMedia[]>(() => {
  if (!filterPlayer.value) return baseMedia.value;
  const steamId = String(filterPlayer.value.steam_id);
  return baseMedia.value.filter((item) =>
    (item.players ?? []).some((p: any) => String(p.steam_id) === steamId),
  );
});

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="space-y-4">
    <!-- Once media exists, uploading + adding links live behind a modal so the
         dropzone isn't always taking up space. -->
    <div
      v-if="event.can_upload_media && baseMedia.length > 0"
      class="flex justify-end"
    >
      <Button size="sm" @click="addDialogOpen = true">
        <Plus class="mr-1.5 h-4 w-4" />
        {{ $t("event.media.add_media") }}
      </Button>
    </div>

    <!-- Empty event: keep the dropzone visible to prompt the first upload. -->
    <EventMediaDropzone
      v-if="event.can_upload_media && baseMedia.length === 0"
      :event-id="event.id"
    />

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

    <Empty
      v-if="baseMedia.length === 0 && !event.can_upload_media"
      class="min-h-[160px]"
    >
      <p class="text-muted-foreground">{{ $t("event.media.none") }}</p>
    </Empty>

    <template v-else-if="baseMedia.length > 0">
      <!-- Filter by a tagged player (event participants only). -->
      <div class="flex items-center gap-2">
        <div class="w-full max-w-xs">
          <span
            v-if="filterPlayer"
            class="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/50 py-1 pl-1.5 pr-1"
          >
            <PlayerDisplay
              :player="filterPlayer"
              size="xs"
              compact
              :show-flag="false"
              :show-role="false"
              :show-elo="false"
              :show-online="false"
              :tooltip="false"
              :linkable="false"
            />
            <button
              type="button"
              class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              :aria-label="$t('common.remove')"
              @click="filterPlayer = null"
            >
              <X class="h-3 w-3" />
            </button>
          </span>
          <EventPlayerPicker
            v-else
            :event-id="event.id"
            :label="$t('event.media.filter_by_player')"
            @selected="filterPlayer = $event"
          />
        </div>
      </div>

      <Empty v-if="media.length === 0" class="min-h-[160px]">
        <p class="text-muted-foreground">
          {{ $t("event.media.none_for_player") }}
        </p>
      </Empty>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EventMediaCard
          v-for="item in media"
          :key="item.id"
          :event="event"
          :item="item"
        />
      </div>
    </template>

    <EventAddMediaDialog v-model:open="addDialogOpen" :event-id="event.id" />
  </div>
</template>
