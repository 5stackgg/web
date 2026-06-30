<script setup lang="ts">
import { SlidersHorizontal, ChevronDown, X } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { filterBadgeClasses } from "~/utilities/tacticalClasses";

/**
 * The generalized "Filters" control pinned to the right of a FilterBar — a
 * single GROUPED input: the Filters popover button + a joined Reset (✕)
 * sharing one border with a thin divider between them.
 *
 * The reset is ALWAYS rendered (so the control's width never changes and the
 * bar/popover don't shift as filters are toggled) — it's just dimmed +
 * non-interactive until `showReset`, then it brightens and clears on click.
 */
defineProps<{
  count?: number;
  active?: boolean;
  showReset?: boolean;
  label?: string;
  align?: "start" | "center" | "end";
  contentClass?: string;
}>();
const emit = defineEmits<{ (e: "reset"): void }>();
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <div
    class="inline-flex items-stretch overflow-hidden rounded-md border font-mono text-[0.64rem] uppercase leading-none tracking-[0.14em] transition-colors duration-150"
    :class="
      active
        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
        : 'border-border bg-muted/30 text-muted-foreground'
    "
  >
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="inline-flex h-8 cursor-pointer items-center gap-1.5 px-2.5 transition-colors"
          :class="active ? '' : 'hover:bg-muted/50 hover:text-foreground'"
        >
          <SlidersHorizontal class="h-3.5 w-3.5" />
          {{ label || $t("common.filters") }}
          <span v-if="count" :class="filterBadgeClasses">{{ count }}</span>
          <ChevronDown class="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        :align="align || 'end'"
        :class="contentClass || 'w-[min(90vw,440px)] p-4'"
      >
        <slot />
      </PopoverContent>
    </Popover>

    <!-- Reset — always present (reserves width → no shift); dimmed until active -->
    <span
      aria-hidden="true"
      class="my-1.5 w-px shrink-0 transition-colors"
      :class="active ? 'bg-[hsl(var(--tac-amber)/0.4)]' : 'bg-border'"
    />
    <button
      type="button"
      class="inline-flex items-center px-2 transition-[color,opacity]"
      :class="
        showReset
          ? 'cursor-pointer hover:bg-muted/50 hover:text-destructive'
          : 'pointer-events-none opacity-30'
      "
      :tabindex="showReset ? 0 : -1"
      :aria-hidden="!showReset"
      :title="$t('common.reset_filters')"
      @click="emit('reset')"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
