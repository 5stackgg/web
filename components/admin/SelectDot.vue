<script setup lang="ts">
import { Checkbox } from "~/components/ui/checkbox";

// A row's status dot and its select checkbox share one 16px cell. The dot
// stays put while the row is hovered or open: the checkbox takes its place
// only while it is checked, on every row once anything is selected
// (`selecting`, started with ⌘/Ctrl- or Shift-click), and while it has
// keyboard focus. Pair with useBulkSelect:
//   <tr ...>
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
  <span class="group/sel relative grid size-4 shrink-0 place-items-center">
    <span
      class="grid place-items-center transition-opacity duration-150"
      :class="
        props.checked || props.selecting
          ? 'opacity-0'
          : 'group-has-[:focus-visible]/sel:opacity-0'
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
          : 'pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100'
      "
      @mousedown="onMouseDown"
      @click="onClick"
    />
  </span>
</template>
