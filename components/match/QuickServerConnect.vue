<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import ClipBoard from "~/components/ClipBoard.vue";
import { Copy } from "lucide-vue-next";
</script>

<template>
  <Button size="sm" variant="outline" class="h-8 gap-1" v-if="match.server">
    <Copy class="h-3.5 w-3.5" />
    <span class="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">
      Copy Server Connection
    </span>
  </Button>

  <template
    v-if="
      match.status != e_match_status_enum.Canceled &&
      match.status != e_match_status_enum.Finished
    "
  >
    <div class="underline flex" v-if="match.connection_string">
      <clip-board :data="match.connection_string"></clip-board>
      <a :href="`https://5stack.gg${match.connection_link}`">
        {{ match.connection_string }}
      </a>
    </div>
  </template>
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
