<script setup lang="ts">
import { ref, watch } from "vue";
import { ImageOff } from "lucide-vue-next";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

// The parent gives the box its size, so the placeholder and the image fill the
// same space and the swap never moves anything. The hidden copy in the
// placeholder is what loads; it is laid out, so `loading="lazy"` still holds.
const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    fit?: "cover" | "contain";
  }>(),
  { alt: "", fit: "cover" },
);

const loaded = ref(false);
const failed = ref(false);

watch(
  () => props.src,
  () => {
    loaded.value = false;
    failed.value = false;
  },
);
</script>

<template>
  <FadeSwap class="h-full w-full">
    <img
      v-if="loaded"
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
        @load="loaded = true"
        @error="failed = true"
      />
    </div>
  </FadeSwap>
</template>
