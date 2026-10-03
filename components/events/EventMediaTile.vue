<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Film, Play, ExternalLink, Twitch, Youtube } from "lucide-vue-next";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import EventAudioPlayer from "~/components/events/EventAudioPlayer.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { useMediaPlayback } from "~/composables/useMediaPlayback";
import { parseExternalMedia } from "~/utilities/externalMedia";

// Pure playback tile: clicking a video swaps the poster for the real player
// (the mp4 is only fetched at that moment), clicking an image emits `view`
// so the list can open its gallery lightbox, external links embed
// (YouTube/Twitch) or open in a new tab. Editing lives behind the parent's
// explicit Details action.
const props = defineProps<{
  event: { id: string };
  item: {
    id: string;
    filename?: string | null;
    mime_type?: string | null;
    title?: string | null;
    thumbnail_filename?: string | null;
    external_url?: string | null;
  };
}>();

const emit = defineEmits<{ (e: "view", id: string): void }>();

const playing = ref(false);
const playerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);
const playback = useMediaPlayback();

// Only one media element plays at a time: when another tile claims the
// slot, this one unmounts its player (which stops the download too).
watch(playback.current, (activeId) => {
  if (playing.value && activeId !== props.item.id) {
    playing.value = false;
  }
});

const src = computed(() =>
  props.item.filename ? eventMediaUrl(props.event.id, props.item.filename) : "",
);
const posterSrc = computed(() =>
  props.item.thumbnail_filename
    ? eventMediaUrl(props.event.id, props.item.thumbnail_filename)
    : null,
);

const external = computed(() =>
  props.item.external_url
    ? parseExternalMedia(props.item.external_url, useRequestURL().hostname)
    : null,
);

const embedSrc = computed(() => {
  const url = external.value?.embedUrl;
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
});

async function startPlayback() {
  playback.claim(props.item.id);
  playing.value = true;
  await nextTick();
  playerRef.value?.play();
}
</script>

<template>
  <div class="h-full w-full bg-black/50">
    <!-- external link (YouTube / Twitch embed, or generic new-tab card) -->
    <template v-if="external">
      <!-- embeddable: click-to-play swaps in the provider iframe -->
      <template v-if="external.embedUrl">
        <iframe
          v-if="playing"
          :src="embedSrc"
          class="h-full w-full"
          frameborder="0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowfullscreen
        />
        <button
          v-else
          type="button"
          class="group/vid relative h-full w-full"
          @click="startPlayback"
        >
          <img
            v-if="external.thumbnailUrl"
            :src="external.thumbnailUrl"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center bg-black/60"
          >
            <Twitch
              v-if="external.provider === 'twitch'"
              class="h-8 w-8 text-[hsl(264_70%_65%)]"
            />
            <Youtube v-else class="h-8 w-8 text-muted-foreground" />
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

      <!-- generic link: open in a new tab -->
      <a
        v-else
        :href="external.watchUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="group/link flex h-full w-full flex-col items-center justify-center gap-2 bg-black/60 p-4 text-center transition-colors hover:bg-black/75"
      >
        <ExternalLink
          class="h-7 w-7 text-muted-foreground transition-colors group-hover/link:text-[hsl(var(--tac-amber))]"
        />
        <span class="truncate text-xs text-white/80">
          {{ external.hostname }}
        </span>
      </a>
    </template>

    <!-- video -->
    <template v-else-if="item.mime_type?.startsWith('video/')">
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
      v-else-if="item.mime_type?.startsWith('audio/')"
      class="absolute inset-0"
    >
      <EventAudioPlayer :src="src" :title="item.title" :media-id="item.id" />
    </div>

    <!-- image -->
    <template v-else>
      <button
        type="button"
        class="absolute inset-0 h-full w-full cursor-zoom-in"
        @click="emit('view', item.id)"
      >
        <img :src="src" class="h-full w-full object-cover" loading="lazy" />
      </button>
    </template>
  </div>
</template>
