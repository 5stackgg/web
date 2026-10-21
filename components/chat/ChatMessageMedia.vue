<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import { Film, Pause, Play } from "lucide-vue-next";
import FadeImage from "~/components/media/FadeImage.vue";
import MediaLightbox from "~/components/media/MediaLightbox.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import {
  chatAttachmentPosterUrl,
  chatAttachmentUrl,
} from "~/composables/chatAttachmentUploads";
import { useRightSidebar } from "~/composables/useRightSidebar";
import {
  chatGifUrl,
  formatChatDuration,
  type ChatAttachment,
  type ChatGif,
} from "~/utilities/chatAttachments";

const props = defineProps<{
  message: { attachments?: ChatAttachment[]; gif?: ChatGif | null };
}>();

// Tall images are held to this height, so one portrait shot can't take over a
// narrow chat panel.
const SINGLE_MAX_HEIGHT = 300;

const images = computed(() =>
  (props.message.attachments ?? []).filter(({ kind }) => kind === "image"),
);

const videos = computed(() =>
  (props.message.attachments ?? []).filter(({ kind }) => kind === "video"),
);

// GIPHY serves a still first frame; an uploaded GIF or animated webp is drawn
// once, frozen, by FadeImage.
const motion = usePreferredReducedMotion();
const still = computed(() => motion.value === "reduce");
const ANIMATED = ["image/gif", "image/webp"];
const gifPlaying = ref(false);

const gif = computed(() =>
  props.message.gif && chatGifUrl(props.message.gif.id, "full")
    ? props.message.gif
    : null,
);

function ratio(media: { width?: number; height?: number }) {
  return media.width && media.height
    ? `${media.width} / ${media.height}`
    : "4 / 3";
}

function singleStyle(media: { width?: number; height?: number }) {
  const width =
    media.width && media.height
      ? Math.min(
          media.width,
          Math.round((SINGLE_MAX_HEIGHT * media.width) / media.height),
        )
      : 340;

  return { aspectRatio: ratio(media), width: "100%", maxWidth: `${width}px` };
}

const single = computed(() => {
  const [image] = images.value;

  if (images.value.length !== 1) {
    return null;
  }

  return { image, style: singleStyle(image) };
});

const viewing = ref<ChatAttachment | null>(null);
const lightboxOpen = ref(false);

function open(attachment: ChatAttachment) {
  viewing.value = attachment;
  lightboxOpen.value = true;
}

// The lightbox sits over the right hub, which closes itself when the pointer
// leaves it.
let holding = false;

watch(lightboxOpen, (value) => {
  if (value && !holding) {
    holding = true;
    useRightSidebar().suspendHoverClose();
  } else if (!value && holding) {
    holding = false;
    useRightSidebar().resumeHoverClose();
  }
});

onBeforeUnmount(() => {
  if (holding) {
    useRightSidebar().resumeHoverClose();
  }
});

const tileClasses =
  "group/media relative block overflow-hidden rounded-md border border-border/40 bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <div class="mt-1.5 flex max-w-[min(100%,340px)] flex-col gap-1">
    <button
      v-if="single"
      type="button"
      :class="[tileClasses, 'cursor-zoom-in']"
      :style="single.style"
      :data-attachment-id="single.image.id"
      :aria-label="$t('chat.attachments.open_image', { name: single.image.name })"
      @click="open(single.image)"
    >
      <FadeImage
        :src="chatAttachmentUrl(single.image.id)"
        :alt="single.image.name"
        :still="still && ANIMATED.includes(single.image.mime_type)"
      />
    </button>

    <div
      v-else-if="images.length > 1"
      data-chat-image-grid
      class="grid grid-cols-2 gap-1"
    >
      <button
        v-for="(image, index) in images"
        :key="image.id"
        type="button"
        :class="[
          tileClasses,
          'cursor-zoom-in',
          images.length === 3 && index === 0
            ? 'row-span-2 h-full'
            : 'aspect-square',
        ]"
        :data-attachment-id="image.id"
        :aria-label="$t('chat.attachments.open_image', { name: image.name })"
        @click="open(image)"
      >
        <FadeImage
          :src="chatAttachmentUrl(image.id)"
          :alt="image.name"
          :still="still && ANIMATED.includes(image.mime_type)"
        />
      </button>
    </div>

    <button
      v-for="video in videos"
      :key="video.id"
      type="button"
      :class="[tileClasses, 'w-full bg-black/50']"
      :style="{ aspectRatio: ratio(video) }"
      :data-attachment-id="video.id"
      :aria-label="$t('chat.attachments.play_video', { name: video.name })"
      @click="open(video)"
    >
      <FadeImage
        v-if="video.poster"
        data-video-poster
        :data-src="chatAttachmentPosterUrl(video.id)"
        :src="chatAttachmentPosterUrl(video.id)"
        :alt="video.name"
      />
      <span v-else class="flex h-full w-full items-center justify-center">
        <Film class="size-7 text-muted-foreground" />
      </span>
      <span
        class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors duration-150 group-hover/media:bg-black/35 motion-reduce:transition-none"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.6)] bg-black/60 text-[hsl(var(--tac-amber))]"
        >
          <Play class="ml-0.5 h-5 w-5" />
        </span>
      </span>
      <span
        class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-1.5 pt-5 text-[11px] text-white/90"
      >
        <span class="truncate">{{ video.name }}</span>
        <span class="shrink-0 font-mono tabular-nums">
          {{ formatChatDuration(video.duration_ms) }}
        </span>
      </span>
    </button>

    <div
      v-if="gif"
      :data-gif-id="gif.id"
      class="relative overflow-hidden rounded-lg border border-border/40"
      :style="singleStyle(gif)"
    >
      <FadeImage
        :src="chatGifUrl(gif.id, 'full', still)"
        :alt="$t('chat.gifs.label')"
      />
      <div v-if="still" class="pointer-events-none absolute inset-0">
        <FadeSwap class="h-full w-full">
          <div
            v-if="gifPlaying"
            key="animated"
            data-gif-animated
            class="h-full w-full"
          >
            <FadeImage :src="chatGifUrl(gif.id, 'full')" />
          </div>
        </FadeSwap>
      </div>
      <span
        class="pointer-events-none absolute left-1.5 top-1.5 rounded-sm bg-black/60 px-1 py-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-wider text-white/90"
      >
        {{ $t("chat.gifs.label") }}
      </span>
      <button
        v-if="still"
        type="button"
        data-gif-play
        :aria-label="$t('chat.gifs.play')"
        :aria-pressed="gifPlaying"
        :class="[
          'absolute flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]',
          gifPlaying
            ? 'bottom-1.5 right-1.5 size-7 rounded-full border border-white/20 bg-black/60 text-white/90 before:absolute before:-inset-2'
            : 'inset-0 focus-visible:ring-inset',
        ]"
        @click="gifPlaying = !gifPlaying"
      >
        <FadeSwap>
          <Pause
            v-if="gifPlaying"
            key="pause"
            data-gif-pause-icon
            class="size-3.5"
          />
          <span
            v-else
            key="play"
            class="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.6)] bg-black/60 text-[hsl(var(--tac-amber))]"
          >
            <Play class="ml-0.5 h-5 w-5" />
          </span>
        </FadeSwap>
      </button>
    </div>

    <MediaLightbox
      v-if="viewing"
      v-model:open="lightboxOpen"
      :kind="viewing.kind"
      :src="chatAttachmentUrl(viewing.id)"
      :poster="viewing.poster ? chatAttachmentPosterUrl(viewing.id) : null"
      :title="viewing.name"
      :media-key="viewing.id"
    />
  </div>
</template>
