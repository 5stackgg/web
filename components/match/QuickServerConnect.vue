<script setup lang="ts">
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <div v-if="match.connection_string">
    <div class="underline flex" v-if="match.connection_string">
      <clip-board :data="match.connection_string"></clip-board>
      <a :href="`https://5stack.gg${match.connection_link}`">
        {{ match.connection_string }}
      </a>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
};
</script>
