<script setup lang="ts">
import { TriangleAlert } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// The tooltip's root is not an element, so what is passed here goes on the
// mark itself.
defineOptions({ inheritAttrs: false });

defineProps<{
  title: string;
  note?: string | null;
}>();
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120">
    <template #trigger>
      <span
        v-bind="$attrs"
        tabindex="0"
        role="img"
        data-render-warn
        class="inline-flex shrink-0 rounded-sm text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
        :aria-label="note ? `${title}. ${note}` : title"
      >
        <TriangleAlert class="h-3.5 w-3.5" />
      </span>
    </template>
    <span class="font-semibold">{{ title }}</span>
    <span v-if="note" class="block max-w-[36ch] text-muted-foreground">
      {{ note }}
    </span>
  </FiveStackToolTip>
</template>
