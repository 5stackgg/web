<script lang="ts" setup>
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Checkbox } from "~/components/ui/checkbox";
import { Columns3 } from "lucide-vue-next";
import { useTableColumns, type ColumnDef } from "~/composables/useTableColumns";

const props = defineProps<{
  storageKey: string;
  columns: ColumnDef[];
}>();

const { visibility, toggle, reset } = useTableColumns(
  props.storageKey,
  props.columns,
);
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        class="inline-flex items-center gap-2 h-7 px-2.5 border border-border bg-[hsl(var(--card)/0.5)] rounded-sm font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:border-[hsl(var(--tac-amber)/0.5)] transition-colors"
      >
        <Columns3 class="w-3.5 h-3.5" />
        <span>{{ $t("common.columns") }}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      :side-offset="6"
      class="w-56 p-2 border-border/80 bg-[hsl(240_8%_10%)]"
    >
      <div
        class="flex items-center justify-between px-2 py-1 mb-1 border-b border-border/60"
      >
        <span
          class="font-mono text-[0.6rem] font-bold tracking-[0.22em] uppercase text-[hsl(var(--tac-amber))]"
        >
          {{ $t("common.columns") }}
        </span>
        <button
          type="button"
          class="font-mono text-[0.55rem] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground transition-colors"
          @click="reset"
        >
          {{ $t("common.reset") }}
        </button>
      </div>
      <ul class="flex flex-col">
        <li v-for="col of props.columns" :key="col.key">
          <label
            class="flex items-center gap-2.5 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-[hsl(var(--tac-amber)/0.06)]"
          >
            <Checkbox
              :model-value="visibility[col.key]"
              @update:model-value="toggle(col.key)"
            />
            <span class="text-[0.8rem] text-foreground">{{ col.label }}</span>
          </label>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
