<script setup lang="ts">
import { Copy } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <div v-if="match.connection_string">
    <Button size="sm" variant="outline" class="h-8 gap-1">
      <Copy class="h-3.5 w-3.5" />
      <span class="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">
        Copy Server Connection
      </span>
    </Button>

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
