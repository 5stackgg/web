<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  props: {
    regions: {
      type: Array as () => string[],
      required: true,
    },
    emptyText: {
      type: String,
      default: "Any region",
    },
  },
  emits: ["update:regions"],
  computed: {
    availableRegions() {
      return useApplicationSettingsStore().availableRegions ?? [];
    },
  },
  methods: {
    toggleRegion(region: string) {
      const next = [...this.regions];
      const index = next.indexOf(region);
      if (index === -1) {
        next.push(region);
      } else {
        next.splice(index, 1);
      }
      this.$emit("update:regions", next);
    },
  },
};
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="region in availableRegions"
      :key="region.value"
      type="button"
      class="rounded-md border px-3 py-1.5 text-sm transition-colors"
      :class="
        regions.includes(region.value)
          ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
          : 'border-border text-muted-foreground hover:bg-muted/40'
      "
      @click="toggleRegion(region.value)"
    >
      {{ region.description || region.value }}
    </button>
    <span
      v-if="availableRegions.length === 0"
      class="text-sm text-muted-foreground"
    >
      {{ emptyText }}
    </span>
  </div>
</template>
