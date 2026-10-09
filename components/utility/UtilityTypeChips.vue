<script setup lang="ts">
import { UTILITY_TYPES, UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    // Authoring picks one utility, filtering picks any number. Single mode
    // never clears: a lineup always has a type, so re-clicking the current chip
    // must not leave the form with nothing chosen.
    single?: boolean;
    // How many of each type there are to filter down to. Given, each chip says
    // its number -- which is what makes a row of chips read as a filter before
    // anyone presses one -- and a type with none steps back.
    counts?: Partial<Record<UtilityType, number>> | null;
    // Fill the row instead of sitting at their natural width: the strip under
    // a card's tabs is exactly as wide as the card. Each grows from its own
    // width, so the long names get the room the short ones do not need. A
    // name is never cut short to fit: the counts go first, and past that the
    // row is expected to scroll.
    fill?: boolean;
  }>(),
  {
    single: false,
    counts: null,
    fill: false,
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
    class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border font-mono text-[0.6rem] font-bold uppercase leading-none transition-[color,background-color,border-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
    :class="[
      fill
        ? 'flex-auto justify-center px-1.5 tracking-[0.06em]'
        : 'shrink-0 px-2.5 tracking-[0.14em]',
      selected.includes(type)
        ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
        : 'border-border/70 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
      counts && !counts[type] && !selected.includes(type) ? 'opacity-45' : '',
    ]"
    @click="toggle(type)"
  >
    <span
      aria-hidden="true"
      class="h-2 w-2 shrink-0 rounded-[1px] transition-opacity duration-150"
      :class="selected.includes(type) ? 'opacity-100' : 'opacity-45'"
      :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
    />
    <!-- One line high and wrapping: a count with no room beside its name
         drops to a second line that is not shown, so the chip can give up
         the count but never a letter of the name. -->
    <span
      class="flex min-w-0 flex-wrap justify-center gap-x-1.5 overflow-hidden"
      :class="fill ? 'h-[1.4em] leading-[1.4]' : ''"
    >
      <span data-type-name class="shrink-0 whitespace-nowrap">
        {{ $t(`pages.utility.types.${type}`) }}
      </span>
      <span v-if="counts" class="font-medium tabular-nums opacity-60">
        {{ counts[type] ?? 0 }}
      </span>
    </span>
  </button>
</template>
