<template>
  <template v-if="value"> Yes </template>
  <template v-else> No </template>
</template>

<script lang="ts">
export default {
  props: {
    value: {
      type: Boolean,
      required: true,
    },
  },
};
</script>
