<script setup lang="ts">
import { ref, watch } from "vue";

// Map icons ship as /img/maps/icons/<map>.svg. A workshop map has none, so a
// failed load leaves just the label.
const props = defineProps<{ map: string | null | undefined }>();

const failed = ref(false);
watch(
  () => props.map,
  () => {
    failed.value = false;
  },
);
</script>

<template>
  <img
    v-if="map && !failed"
    :src="`/img/maps/icons/${map}.svg`"
    alt=""
    width="20"
    height="20"
    class="size-5 shrink-0 object-contain"
    @error="failed = true"
  />
</template>
