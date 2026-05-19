<script setup lang="ts">
import { ChevronUp, ChevronDown } from "lucide-vue-next";
import { TableHead } from "~/components/ui/table";

const props = defineProps<{
  sortKey: string;
  activeKey: string | null;
  direction: "asc" | "desc";
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "sort", key: string): void;
}>();
</script>

<template>
  <TableHead v-if="props.disabled" :class="$attrs.class">
    <slot />
  </TableHead>
  <TableHead
    v-else
    :class="$attrs.class"
    class="cursor-pointer select-none hover:text-foreground transition-colors"
    @click="emit('sort', props.sortKey)"
  >
    <span class="inline-flex items-center gap-1">
      <slot />
      <span class="inline-flex flex-col leading-none">
        <ChevronUp
          class="w-3 h-3"
          :class="
            props.activeKey === props.sortKey && props.direction === 'asc'
              ? 'text-[hsl(var(--tac-amber))]'
              : 'opacity-30'
          "
        />
        <ChevronDown
          class="w-3 h-3 -mt-1.5"
          :class="
            props.activeKey === props.sortKey && props.direction === 'desc'
              ? 'text-[hsl(var(--tac-amber))]'
              : 'opacity-30'
          "
        />
      </span>
    </span>
  </TableHead>
</template>
