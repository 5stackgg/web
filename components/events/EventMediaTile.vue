<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Film, Play } from "lucide-vue-next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import EventAudioPlayer from "~/components/events/EventAudioPlayer.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { useMediaPlayback } from "~/composables/useMediaPlayback";

// Pure playback tile: clicking a video swaps the poster for the real player
// (the mp4 is only fetched at that moment), clicking an image opens a
// lightbox. Editing lives behind the parent's explicit Details action.
const props = defineProps<{
  event: { id: string };
  item: {
    id: string;
    filename: string;
    mime_type: string;
    title?: string | null;
    thumbnail_filename?: string | null;
  };
}>();

const playing = ref(false);
const lightboxOpen = ref(false);
const playerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);
const playback = useMediaPlayback();

// Only one media element plays at a time: when another tile claims the
// slot, this one unmounts its player (which stops the download too).
watch(playback.current, (activeId) => {
  if (playing.value && activeId !== props.item.id) {
    playing.value = false;
  }
});

const src = computed(() => eventMediaUrl(props.event.id, props.item.filename));
const posterSrc = computed(() =>
  props.item.thumbnail_filename
    ? eventMediaUrl(props.event.id, props.item.thumbnail_filename)
    : null,
);

async function startPlayback() {
  playback.claim(props.item.id);
  playing.value = true;
  await nextTick();
  playerRef.value?.play();
}
</script>

<template>
  <div class="h-full w-full bg-black/50">
    <!-- video -->
    <template v-if="item.mime_type.startsWith('video/')">
      <ClipPlayer
        v-if="playing"
        ref="playerRef"
        :src="src"
        :clip-key="item.id"
        :poster="posterSrc"
        @play="playback.claim(item.id)"
      />
      <button
        v-else
        type="button"
        class="group/vid relative h-full w-full"
        @click="startPlayback"
      >
        <img
          v-if="posterSrc"
          :src="posterSrc"
          class="h-full w-full object-cover"
          loading="lazy"
        />
        <div v-else class="flex h-full w-full items-center justify-center">
          <Film class="h-7 w-7 text-muted-foreground" />
        </div>
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover/vid:bg-black/35"
        >
          <span
            class="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.6)] bg-black/60 text-[hsl(var(--tac-amber))]"
          >
            <Play class="ml-0.5 h-5 w-5" />
          </span>
        </span>
      </button>
    </template>

    <!-- audio -->
    <div
      v-else-if="item.mime_type.startsWith('audio/')"
      class="absolute inset-0"
    >
      <EventAudioPlayer :src="src" :title="item.title" :media-id="item.id" />
    </div>

    <!-- image -->
    <template v-else>
      <button
        type="button"
        class="absolute inset-0 h-full w-full cursor-zoom-in"
        @click="lightboxOpen = true"
      >
        <img :src="src" class="h-full w-full object-cover" loading="lazy" />
      </button>

      <Dialog v-model:open="lightboxOpen">
        <DialogContent
          class="max-w-5xl border-border/60 bg-black/90 p-2 sm:p-3"
        >
          <DialogTitle class="sr-only">
            {{ item.title || item.filename }}
          </DialogTitle>
          <img :src="src" class="max-h-[80vh] w-full rounded object-contain" />
          <p
            v-if="item.title"
            class="px-1 pb-1 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ item.title }}
          </p>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
