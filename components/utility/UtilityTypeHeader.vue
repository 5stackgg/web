<script setup lang="ts">
import { ListFilter } from "lucide-vue-next";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

// The heading over one type's rows in a list of throws. It is also the type
// filter: pressing it does exactly what pressing that type's chip in the strip
// above the list does, so the list can be narrowed from wherever you are in it.
defineProps<{
  type: UtilityType;
  count: number;
  /** This type is one the list is narrowed to. */
  active?: boolean;
}>();

defineEmits<{ (event: "toggle"): void }>();
</script>

<template>
  <button
    type="button"
    class="group flex h-8 w-full items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
    :aria-pressed="!!active"
    @click="$emit('toggle')"
  >
    <span
      aria-hidden="true"
      class="size-2 shrink-0 rounded-[2px]"
      :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
    />
    <span
      class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] transition-colors"
      :class="active ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'"
    >
      {{ $t(`pages.utility.types.${type}`) }}
    </span>
    <span class="font-mono text-[0.66rem] tabular-nums text-muted-foreground">
      {{ count }}
    </span>
    <span aria-hidden="true" class="h-px flex-1 bg-border" />
    <ListFilter
      class="h-3.5 w-3.5 shrink-0 transition-colors"
      :class="
        active
          ? 'text-[hsl(var(--tac-amber))]'
          : 'text-muted-foreground/50 group-hover:text-foreground'
      "
    />
  </button>
</template>
