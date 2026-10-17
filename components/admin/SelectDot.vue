<script setup lang="ts">
import { Checkbox } from "~/components/ui/checkbox";

// A row's status dot and its select checkbox share one 16px cell. The
// checkbox takes the dot's place while the row is hovered or focused, while
// it is checked, and on every row once anything is selected (`selecting`).
// The row needs the `group/row` class. Pair with useBulkSelect:
//   <tr class="group/row" ...>
//     <SelectDot :checked="bulk.isSelected(id)" :selecting="bulk.count.value > 0"
//       :label="`Select ${name}`" @toggle="bulk.onCheckbox(id, $event)">
//       <StatusDot tone="ok" />
//     </SelectDot>
const props = defineProps<{
  checked: boolean;
  selecting: boolean;
  /** The checkbox's accessible name, e.g. "Select fra-01". */
  label: string;
}>();

const emit = defineEmits<{ (e: "toggle", event: MouseEvent): void }>();

function onMouseDown(event: MouseEvent) {
  if (event.shiftKey) {
    event.preventDefault();
  }
}

function onClick(event: MouseEvent) {
  // The row's own click (open) must not fire.
  event.stopPropagation();
  emit("toggle", event);
}
</script>

<template>
  <span class="relative grid size-4 shrink-0 place-items-center">
    <span
      class="grid place-items-center transition-opacity duration-150"
      :class="
        props.checked || props.selecting
          ? 'opacity-0'
          : '[@media(hover:hover)]:group-hover/row:opacity-0 group-focus-within/row:opacity-0'
      "
    >
      <slot />
    </span>
    <Checkbox
      :model-value="props.checked"
      :aria-label="props.label"
      class="absolute inset-0 m-auto size-[15px] border-border transition-opacity duration-150 data-[state=checked]:border-[hsl(var(--tac-amber))] data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=checked]:text-black"
      :class="
        props.checked || props.selecting
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:hover)]:group-hover/row:pointer-events-auto [@media(hover:hover)]:group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100'
      "
      @mousedown="onMouseDown"
      @click="onClick"
    />
  </span>
</template>
