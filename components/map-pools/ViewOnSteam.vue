<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";
</script>

<template>
  <a
    :href="`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshop_map_id}`"
    target="_blank"
    class="flex items-center gap-2"
  >
    {{ $t("components.map_pools.view_on_steam") }}
    <ExternalLink class="h-4 w-4" />
  </a>
</template>

<script lang="ts">
export default {
  props: {
    workshop_map_id: {
      type: String,
      required: true,
    },
  },
};
</script>
