<script setup lang="ts">
// `read` caps the content at --settings-measure so label/control rows stay
// readable on a wide monitor; `full` lets it fill the column for the handful of
// pages whose content is genuinely wide (lists, charts, editors, media grids).
withDefaults(
  defineProps<{
    width?: "read" | "full";
  }>(),
  {
    width: "read",
  },
);
</script>

<template>
  <div class="min-w-0 space-y-6" :class="width === 'read' && 'settings-measure'">
    <slot />
  </div>
</template>
