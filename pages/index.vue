<script setup lang="ts">
import { Separator } from "~/components/ui/separator/index.js";
</script>
<template>
  <div class="space-y-0.5">
    <h2 class="text-2xl font-bold tracking-tight">Upcoming Matches</h2>
    <p class="text-muted-foreground">
      Your upcoming matches that either you manage or are in the lineup.
    </p>
  </div>
  <Separator class="my-6" />

  <my-matches :upcoming="true"></my-matches>
</template>

<script lang="ts">
export default {
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
