<script setup lang="ts">
import { computed, provide } from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { SORTABLE_HEADER_KEY } from "~/components/common/sortableHeader";
import { ariaSortFor, type SortDir } from "~/components/admin/sort";

// A sortable column header. It renders the header cell itself (a <th> by
// default) so aria-sort always sits on it and always matches the arrow.
// `secondary` adds more sort keys to the same header, after a dot, the way
// Dedicated's "Server · Status" sorts by either.
type SortOption = { key: string; label: string; tip?: string };

const props = withDefaults(
  defineProps<{
    sortKey: string;
    label: string;
    /** The key the table is sorted by now. */
    active: string | null | undefined;
    dir: SortDir;
    /** Explains a cryptic label: dotted underline + tooltip. */
    tip?: string;
    /** "end" for right-aligned numeric columns: the arrow leads. */
    align?: "start" | "end";
    secondary?: SortOption[];
    /** "th" in a table; any element with role=columnheader in a grid. */
    as?: string;
    /** Renders a plain label: no button, no aria-sort. */
    disabled?: boolean;
  }>(),
  { align: "start", as: "th", secondary: () => [], disabled: false },
);

const emit = defineEmits<{ (e: "sort", key: string): void }>();

const options = computed<SortOption[]>(() => [
  { key: props.sortKey, label: props.label, tip: props.tip },
  ...props.secondary,
]);

const ariaSort = computed(() =>
  props.disabled
    ? undefined
    : ariaSortFor(
        { key: props.active, dir: props.dir },
        options.value.map((option) => option.key),
      ),
);

// A StatLabel inside keeps the tap for sorting on touch.
provide(
  SORTABLE_HEADER_KEY,
  computed(() => !props.disabled),
);
</script>

<template>
  <component
    :is="props.as"
    :role="props.as === 'th' ? undefined : 'columnheader'"
    :aria-sort="ariaSort"
  >
    <slot v-if="props.disabled">{{ props.label }}</slot>
    <span v-else class="inline-flex items-center">
      <template v-for="(option, index) in options" :key="option.key">
        <span
          v-if="index > 0"
          class="mx-1.5 text-muted-foreground/40"
          aria-hidden="true"
          >·</span
        >
        <FiveStackToolTip
          as-child
          :disabled="!option.tip"
          :tap-toggle="false"
          :delay-duration="120"
          side="bottom"
        >
          <template #trigger>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-sm transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              :class="[
                props.active === option.key && 'text-foreground',
                props.align === 'end' && 'flex-row-reverse',
              ]"
              @click="emit('sort', option.key)"
            >
              <span
                :class="
                  option.tip &&
                  'cursor-help underline decoration-muted-foreground/70 decoration-dotted underline-offset-[3px]'
                "
                ><slot v-if="index === 0">{{ option.label }}</slot
                ><template v-else>{{ option.label }}</template></span
              >
              <span
                v-if="props.active === option.key"
                aria-hidden="true"
                class="text-[10px] text-[hsl(var(--tac-amber))]"
                >{{ props.dir === "asc" ? "▲" : "▼" }}</span
              >
              <!-- One header, several keys: say which one sorts. -->
              <span
                v-if="options.length > 1 && props.active === option.key"
                class="sr-only"
                >{{
                  props.dir === "asc"
                    ? $t("admin.sort.sorted_ascending")
                    : $t("admin.sort.sorted_descending")
                }}</span
              >
            </button>
          </template>
          <span class="block max-w-[240px] text-xs leading-snug">{{
            option.tip
          }}</span>
        </FiveStackToolTip>
      </template>
    </span>
  </component>
</template>
