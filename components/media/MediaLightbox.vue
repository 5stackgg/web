<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useEventListener } from "@vueuse/core";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  kind: "image" | "video";
  src: string;
  title?: string | null;
  caption?: string | null;
  poster?: string | null;
  mediaKey?: string;
  // Gallery mode: the parent owns the list and swaps src/kind on
  // previous/next. Left/right arrows step through it, like the clip modal.
  hasPrevious?: boolean;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  previous: [];
  next: [];
  play: [];
}>();

const player = ref<InstanceType<typeof ClipPlayer> | null>(null);

// Autoplay on open, and again whenever the gallery steps onto another video.
watch([open, () => props.kind, () => props.src], async ([value]) => {
  if (!value || props.kind !== "video") {
    return;
  }

  await nextTick();
  player.value?.play();
});

function goPrevious() {
  if (props.hasPrevious) emit("previous");
}

function goNext() {
  if (props.hasNext) emit("next");
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "ArrowLeft" && props.hasPrevious) {
    e.preventDefault();
    goPrevious();
  } else if (e.key === "ArrowRight" && props.hasNext) {
    e.preventDefault();
    goNext();
  }
}

useEventListener("keydown", onKeydown);

const edgeButton =
  "absolute top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors duration-150 hover:bg-black/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-5xl border-border/60 bg-black/90 p-2 sm:p-3"
      data-right-hub-interactive
    >
      <DialogTitle class="sr-only">
        {{ title }}
      </DialogTitle>
      <div class="relative">
        <img
          v-if="kind === 'image'"
          :src="src"
          :alt="title ?? ''"
          class="max-h-[80vh] w-full rounded object-contain"
        />
        <ClipPlayer
          v-else
          ref="player"
          :src="src"
          :poster="poster"
          :clip-key="mediaKey ?? src"
          @play="emit('play')"
          @prev="goPrevious"
          @next="goNext"
        />
        <button
          v-if="hasPrevious"
          type="button"
          data-lightbox-previous
          :class="[edgeButton, 'left-2']"
          :aria-label="$t('common.previous')"
          @click="goPrevious"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <button
          v-if="hasNext"
          type="button"
          data-lightbox-next
          :class="[edgeButton, 'right-2']"
          :aria-label="$t('common.next')"
          @click="goNext"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
      <p
        v-if="caption"
        class="px-1 pb-1 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ caption }}
      </p>
    </DialogContent>
  </Dialog>
</template>
