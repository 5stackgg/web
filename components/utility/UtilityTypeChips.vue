<script setup lang="ts">
import { UTILITY_TYPES, UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    // Authoring picks one utility, filtering picks any number. Single mode
    // never clears: a lineup always has a type, so re-clicking the current chip
    // must not leave the form with nothing chosen.
    single?: boolean;
  }>(),
  {
    single: false,
  },
);

const selected = defineModel<UtilityType[]>({ required: true });

function toggle(type: UtilityType) {
  if (props.single) {
    selected.value = [type];
    return;
  }
  selected.value = selected.value.includes(type)
    ? selected.value.filter((entry) => entry !== type)
    : [...selected.value, type];
}
</script>

<template>
  <!-- Not FilterChip: the swatch has to carry the utility's own colour so a
       chip reads as the same thing as its markers on the board. -->
  <button
    v-for="type of UTILITY_TYPES"
    :key="type"
    type="button"
    :aria-pressed="selected.includes(type)"
    class="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 font-mono text-[0.6rem] font-bold uppercase leading-none tracking-[0.14em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
    :class="
      selected.includes(type)
        ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
        : 'border-border/70 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
    "
    @click="toggle(type)"
  >
    <span
      aria-hidden="true"
      class="h-2 w-2 shrink-0 rounded-[1px] transition-opacity duration-150"
      :class="selected.includes(type) ? 'opacity-100' : 'opacity-45'"
      :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
    />
    {{ $t(`pages.utility.types.${type}`) }}
  </button>
</template>
