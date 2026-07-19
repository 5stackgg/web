<script setup lang="ts">
import { computed } from "vue";
import DOMPurify from "dompurify";
import {
  CUSTOM_PAGE_ICONS,
  DEFAULT_CUSTOM_PAGE_ICON,
} from "./customPageIcons";

const props = defineProps<{ name?: string | null }>();

// An icon is one of: a curated lucide name, an image/SVG URL (uploaded or served
// by the plugin), or an inline <svg> string the plugin ships in its manifest.
const value = computed(() => (props.name ?? "").trim());

const isSvg = computed(() => value.value.startsWith("<svg"));
const isImage = computed(() =>
  /^(https?:\/\/|\/|data:image\/)/.test(value.value),
);

// Inline SVG is untrusted (comes from a plugin manifest) — sanitize before
// v-html. currentColor in the markup makes it inherit the nav's theme color.
// SVG <style> applies document-wide, so a manifest icon could inject global
// CSS; forbid it (and foreignObject) explicitly.
const sanitizedSvg = computed(() =>
  isSvg.value
    ? DOMPurify.sanitize(value.value, {
        USE_PROFILES: { svg: true },
        FORBID_TAGS: ["style", "foreignObject"],
      })
    : "",
);

const icon = computed(
  () =>
    CUSTOM_PAGE_ICONS[value.value.toLowerCase()] ?? DEFAULT_CUSTOM_PAGE_ICON,
);
</script>

<template>
  <span
    v-if="isSvg"
    class="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
    v-html="sanitizedSvg"
  />
  <img
    v-else-if="isImage"
    :src="name ?? undefined"
    alt=""
    class="size-4 shrink-0 rounded-sm object-contain"
  />
  <component :is="icon" v-else />
</template>
