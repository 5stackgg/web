<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { Check, SlidersHorizontal, X } from "lucide-vue-next";
import Fold from "~/components/ui/transitions/Fold.vue";
import {
  activeFacetCount,
  facetChips,
  isFacetDefault,
  resetFacets,
  toggleFacet,
  type FacetGroup,
  type FacetOption,
  type FacetSelection,
} from "./facets";

// A slim facet column beside a list: groups of checkbox values, OR inside a
// group and AND across groups (the page does the filtering). Values that would
// return nothing dim. With `counts` each value carries a live count that
// glides to its new number. Below lg the column folds behind a Filters button
// and the chips of what is picked lead the list column; at lg the column itself
// shows what is picked, so the chips step aside.
const props = withDefaults(
  defineProps<{
    groups: FacetGroup[];
    modelValue: FacetSelection;
    defaults?: FacetSelection;
    counts?: boolean;
    label: string;
  }>(),
  { defaults: () => ({}), counts: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: FacetSelection): void;
}>();

const wide = useMediaQuery("(min-width: 1024px)");
const open = ref(false);
const expanded = ref<Record<string, boolean>>({});

const selected = (key: string, value: string) =>
  (props.modelValue[key] ?? []).includes(value);

const groupKeys = computed(() => props.groups.map((group) => group.key));
const hasDefault = (key: string) => !!props.defaults[key]?.length;
const changed = (key: string) =>
  !isFacetDefault(props.modelValue, props.defaults, key);

const activeCount = computed(() =>
  activeFacetCount(props.groups, props.modelValue, props.defaults),
);
const chips = computed(() =>
  facetChips(props.groups, props.modelValue, props.defaults),
);

function visibleOptions(group: FacetGroup): FacetOption[] {
  if (!group.limit || expanded.value[group.key]) {
    return group.options;
  }
  return group.options.filter(
    (option, index) =>
      index < group.limit! || selected(group.key, option.value),
  );
}

function dim(group: FacetGroup, option: FacetOption) {
  if (selected(group.key, option.value)) {
    return false;
  }
  return props.counts ? (option.count ?? 0) === 0 : !!option.empty;
}

function toggle(key: string, value: string) {
  emit("update:modelValue", toggleFacet(props.modelValue, key, value));
}

function resetGroup(key: string) {
  emit(
    "update:modelValue",
    resetFacets([key], props.defaults, props.modelValue),
  );
}

function resetAll() {
  emit(
    "update:modelValue",
    resetFacets(groupKeys.value, props.defaults, props.modelValue),
  );
}

// Counts glide to their new value instead of snapping, one frame loop for
// the whole rail.
const shown = reactive<Record<string, number>>({});
let frame = 0;

const countKey = (group: string, value: string) => `${group}\u0000${value}`;

const targets = computed(() => {
  const next: Record<string, number> = {};
  for (const group of props.groups) {
    for (const option of group.options) {
      next[countKey(group.key, option.value)] = option.count ?? 0;
    }
  }
  return next;
});

function reducedMotion() {
  return (
    typeof window === "undefined" ||
    !window.matchMedia ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

watch(
  () => (props.counts ? JSON.stringify(targets.value) : ""),
  () => {
    if (!props.counts) {
      return;
    }
    const to = targets.value;
    const from: Record<string, number> = {};
    let moves = false;
    for (const key of Object.keys(to)) {
      from[key] = key in shown ? shown[key] : to[key];
      if (from[key] !== to[key]) {
        moves = true;
      }
    }
    cancelAnimationFrame(frame);
    if (!moves || reducedMotion()) {
      Object.assign(shown, to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      for (const key of Object.keys(to)) {
        shown[key] = Math.round(from[key] + (to[key] - from[key]) * eased);
      }
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
  },
  { immediate: true },
);

onBeforeUnmount(() => cancelAnimationFrame(frame));

const countOf = (group: string, value: string) =>
  shown[countKey(group, value)] ?? targets.value[countKey(group, value)] ?? 0;
</script>

<template>
  <div
    class="grid items-start gap-5 lg:grid-cols-[13.25rem_minmax(0,1fr)] lg:items-stretch lg:gap-6"
    data-facet-layout
  >
    <!-- The divider runs the column's full height; the facets inside stay
         sticky as the list scrolls. -->
    <div class="min-w-0 lg:border-r lg:border-border/70 lg:pr-3">
      <aside
        :aria-label="label"
        class="grid min-w-0 gap-2 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1"
      >
        <button
          v-if="!wide"
          type="button"
          class="inline-flex h-8 items-center gap-1.5 justify-self-start rounded-md border border-border bg-card/60 px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
          :class="
            activeCount &&
            'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber))]'
          "
          :aria-expanded="open"
          data-facet-toggle
          @click="open = !open"
        >
          <SlidersHorizontal class="size-3.5" />
          {{ $t("common.filters") }}
          <span v-if="activeCount" class="tabular-nums"
            >· {{ activeCount }}</span
          >
        </button>

        <Fold :open="wide || open">
          <div
            class="grid gap-4 pb-1 max-lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] max-lg:rounded-md max-lg:border max-lg:border-border max-lg:p-3"
          >
            <div
              v-for="group in groups"
              :key="group.key"
              role="group"
              :aria-label="group.label"
              class="grid content-start gap-px"
              :data-facet-group="group.key"
            >
              <div
                class="flex min-h-[1.375rem] items-center justify-between gap-2 px-1.5 pb-1"
              >
                <span
                  class="text-[0.72rem] font-semibold text-muted-foreground"
                >
                  {{ group.label }}
                </span>
                <button
                  v-if="changed(group.key)"
                  type="button"
                  class="text-[0.72rem] text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
                  data-facet-reset
                  @click="resetGroup(group.key)"
                >
                  {{
                    hasDefault(group.key)
                      ? $t("common.reset")
                      : $t("common.clear")
                  }}
                </button>
              </div>

              <label
                v-for="option in visibleOptions(group)"
                :key="option.value"
                class="flex min-h-[1.875rem] min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[0.8125rem] transition-[background-color,opacity] duration-150 hover:bg-muted/60"
                :class="dim(group, option) && 'opacity-40'"
                :data-facet-value="option.value"
                :data-dim="dim(group, option) || undefined"
              >
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="selected(group.key, option.value)"
                  @change="toggle(group.key, option.value)"
                />
                <span
                  class="grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[hsl(var(--tac-amber)/0.5)] peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background"
                  :class="
                    selected(group.key, option.value)
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))]'
                      : 'border-[hsl(240_4%_32%)]'
                  "
                  aria-hidden="true"
                >
                  <Check
                    v-if="selected(group.key, option.value)"
                    class="size-2.5 text-[hsl(var(--tac-amber-foreground))]"
                    :stroke-width="3.5"
                  />
                </span>
                <span
                  v-if="option.swatch"
                  class="size-2 shrink-0 rounded-[2px]"
                  :style="{ background: option.swatch }"
                  aria-hidden="true"
                />
                <span
                  class="min-w-0 flex-1 truncate"
                  :class="option.mono && 'font-mono text-xs'"
                  :title="option.label"
                >
                  {{ option.label }}
                </span>
                <span
                  v-if="option.tag"
                  class="shrink-0 text-[0.66rem] text-muted-foreground/70"
                >
                  {{ option.tag }}
                </span>
                <span
                  v-if="counts"
                  class="min-w-[2ch] shrink-0 text-right text-xs tabular-nums text-muted-foreground"
                  data-facet-count
                >
                  {{ countOf(group.key, option.value) }}
                </span>
                <span
                  v-else-if="dim(group, option)"
                  class="shrink-0 text-[0.68rem] text-muted-foreground"
                >
                  {{ $t("components.facet_rail.none") }}
                </span>
              </label>

              <button
                v-if="group.limit && group.options.length > group.limit"
                type="button"
                class="justify-self-start px-1.5 pt-1 text-[0.72rem] text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
                @click="expanded[group.key] = !expanded[group.key]"
              >
                {{
                  expanded[group.key]
                    ? $t("components.facet_rail.show_fewer")
                    : $t("components.facet_rail.show_all", {
                        count: group.options.length,
                      })
                }}
              </button>
            </div>
          </div>
        </Fold>
      </aside>
    </div>

    <div class="grid min-w-0 content-start gap-3">
      <slot name="top" />

      <TransitionGroup
        tag="div"
        class="flex flex-wrap items-center gap-1.5 empty:hidden lg:hidden"
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        enter-from-class="scale-[0.85] opacity-0"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
        data-facet-chips
      >
        <span
          v-for="chip in chips"
          :key="`${chip.key}:${chip.value}`"
          class="inline-flex h-6 max-w-full items-center gap-0.5 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] pl-2 pr-0.5 text-xs text-[hsl(var(--tac-amber))]"
          data-facet-chip
        >
          <span class="truncate">{{ chip.label }}</span>
          <button
            type="button"
            class="grid size-5 shrink-0 place-items-center rounded transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)/0.2)]"
            :aria-label="
              $t('components.facet_rail.remove', { label: chip.label })
            "
            @click="toggle(chip.key, chip.value)"
          >
            <X class="size-3" />
          </button>
        </span>
        <button
          v-if="chips.length > 1"
          key="clear-all"
          type="button"
          class="px-1 text-xs text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
          data-facet-clear-all
          @click="resetAll"
        >
          {{ $t("components.facet_rail.clear_all") }}
        </button>
      </TransitionGroup>

      <slot />
    </div>
  </div>
</template>
