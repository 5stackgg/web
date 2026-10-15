<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// A control's icon and label in the admin dock. When the dock is too narrow
// for its labels it shows the icon alone and the label as a tooltip. The
// tooltip sits inside the control, so a menu trigger around it keeps its own
// anchor.
defineProps<{
  label: string;
  compact?: boolean;
}>();
</script>

<template>
  <FiveStackToolTip
    as-child
    side="top"
    :delay-duration="120"
    :disabled="!compact"
    :tap-toggle="false"
  >
    <template #trigger>
      <span class="inline-flex items-center gap-2">
        <slot />
        <span :class="compact && 'sr-only'">{{ label }}</span>
      </span>
    </template>
    {{ label }}
  </FiveStackToolTip>
</template>
