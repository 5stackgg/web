<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ImageOff } from "lucide-vue-next";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

// The parent gives the box its size, so the placeholder and the image fill the
// same space and the swap never moves anything. The hidden copy in the
// placeholder is what loads; it is laid out, so `loading="lazy"` still holds.
//
// `still` freezes an animated image on its first frame by drawing it once to a
// canvas. Drawing a cross-origin image only taints the canvas, and nothing here
// reads it back.
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    fit?: "cover" | "contain";
    still?: boolean;
  }>(),
  { alt: "", fit: "cover", still: false },
);

const loaded = ref(false);
const failed = ref(false);
const canvas = ref<HTMLCanvasElement | null>(null);
let source: HTMLImageElement | null = null;

watch(
  () => props.src,
  () => {
    loaded.value = false;
    failed.value = false;
    source = null;
  },
);

async function onLoad(event: Event) {
  source = event.target as HTMLImageElement;
  loaded.value = true;

  if (!props.still) {
    return;
  }

  await nextTick();

  const target = canvas.value;

  if (!target || !source) {
    return;
  }

  target.width = source.naturalWidth;
  target.height = source.naturalHeight;
  target.getContext("2d")?.drawImage(source, 0, 0);
}
</script>

<template>
  <FadeSwap class="h-full w-full">
    <canvas
      v-if="loaded && still"
      key="still"
      ref="canvas"
      role="img"
      :aria-label="alt"
      class="block h-full w-full"
      :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
    ></canvas>
    <img
      v-else-if="loaded"
      key="image"
      :src="src"
      :alt="alt"
      draggable="false"
      class="block h-full w-full"
      :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
    />
    <div
      v-else
      key="placeholder"
      class="relative flex h-full w-full items-center justify-center bg-muted/40"
    >
      <ImageOff
        v-if="failed"
        class="size-5 text-muted-foreground/60"
        :aria-label="$t('chat.attachments.unavailable')"
      />
      <img
        v-else
        :src="src"
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        class="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        @load="onLoad"
        @error="failed = true"
      />
    </div>
  </FadeSwap>
</template>
