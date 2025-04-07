<template>
  <template v-if="captain">
    {{ captain.player?.name || captain.placeholder_name }}
  </template>
  <template v-else> {{ $t("common.tbd") }} </template>
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
