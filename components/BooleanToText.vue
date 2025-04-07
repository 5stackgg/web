<template>
  <template v-if="value"> {{ $t("common.boolean.yes") }} </template>
  <template v-else> {{ $t("common.boolean.no") }} </template>
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
