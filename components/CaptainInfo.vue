<template>
  <template v-if="captain">
    {{ captain.player?.name || captain.placeholder_name }}
  </template>
  <template v-else> Captain Has not been picked </template>
</template>

<script lang="ts">
export default {
  props: {
    captain: {
      required: false,
      type: Object,
    },
  },
};
</script>
