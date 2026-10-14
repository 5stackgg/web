<script setup lang="ts">
import { computed } from "vue";
import {
  UTILITY_TYPE_COLORS,
  UTILITY_TYPE_ICONS,
} from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

// The game's equipment icon as a mask, so the grenade is drawn in its own
// colour -- the same mark the map puts on each landing.
const props = defineProps<{ type: UtilityType | string; color?: string | null }>();

const style = computed(() => {
  const type = props.type as UtilityType;
  const color = props.color ?? UTILITY_TYPE_COLORS[type] ?? "#ffffff";
  const src = UTILITY_TYPE_ICONS[type];
  return src
    ? {
        backgroundColor: color,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
      }
    : { backgroundColor: color };
});
</script>

<template>
  <span
    aria-hidden="true"
    data-utility-glyph
    class="inline-block size-3.5 shrink-0 [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
    :style="style"
  />
</template>
