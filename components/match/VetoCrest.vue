<script setup lang="ts">
import type { VetoBoardLineup } from "~/utilities/vetoOrder";

// A lineup's crest on the veto board: the team avatar (a pickup captain's
// face), or its monogram.
withDefaults(defineProps<{ lineup: VetoBoardLineup; size?: number }>(), {
  size: 20,
});
</script>

<template>
  <span class="veto-crest" :style="{ '--s': `${size}px` }">
    <img v-if="lineup.crest" :src="lineup.crest" alt="" />
    <template v-else>{{ lineup.monogram }}</template>
  </span>
</template>

<style scoped>
.veto-crest {
  width: var(--s);
  height: var(--s);
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: calc(var(--s) * 0.26);
  background: hsl(var(--secondary));
  color: hsl(var(--foreground));
  font-size: calc(var(--s) * 0.4);
  font-weight: 700;
  line-height: 1;
}
.veto-crest img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
