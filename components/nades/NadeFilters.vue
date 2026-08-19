<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Check, Search } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Input } from "~/components/ui/input";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import FilterToggle from "~/components/common/FilterToggle.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import NadeTypeChips from "~/components/nades/NadeTypeChips.vue";
import {
  emptyNadeFilters,
  NADE_SIDES,
  NADE_TECHNIQUES,
  NADE_THROW_STRENGTHS,
} from "~/utilities/nadeDisplay";
import type {
  NadeFilterState,
  NadeScope,
  NadeSort,
} from "~/utilities/nadeDisplay";
import type { NadeType } from "~/types/nade";

const props = withDefaults(
  defineProps<{
    availableTags?: string[];
    hasTeam?: boolean;
    signedIn?: boolean;
  }>(),
  {
    availableTags: () => [],
    hasTeam: false,
    signedIn: false,
  },
);

const filters = defineModel<NadeFilterState>({ required: true });

const { t } = useI18n();
const menuOpen = ref(false);

const scopeOptions = computed(() => [
  {
    key: "public",
    label: t("pages.nades.scope.public"),
  },
  {
    key: "mine",
    label: t("pages.nades.scope.mine"),
    disabled: !props.signedIn,
  },
  {
    key: "team",
    label: t("pages.nades.scope.team"),
    disabled: !props.hasTeam,
  },
  {
    key: "favorites",
    label: t("pages.nades.scope.favorites"),
    disabled: !props.signedIn,
  },
]);

const scopeModel = computed<string>({
  get: () => filters.value.scope,
  set: (value) => {
    const option = scopeOptions.value.find((entry) => entry.key === value);
    if (!option || option.disabled) {
      return;
    }
    filters.value = { ...filters.value, scope: value as NadeScope };
  },
});

const typeModel = computed<NadeType[]>({
  get: () => filters.value.types,
  set: (types) => {
    filters.value = { ...filters.value, types };
  },
});

// Typing must not put a query on the wire per keystroke — the search lives in
// the URL, so every write is also a navigation.
const searchDraft = ref(filters.value.search);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => filters.value.search,
  (value) => {
    if (value !== searchDraft.value) {
      searchDraft.value = value;
    }
  },
);

watch(searchDraft, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    searchTimer = null;
    if (value !== filters.value.search) {
      filters.value = { ...filters.value, search: value };
    }
  }, 300);
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

function toggleIn<T extends string>(key: keyof NadeFilterState, value: T) {
  const current = filters.value[key] as unknown as T[];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  filters.value = { ...filters.value, [key]: next };
}

function setSort(sort: NadeSort) {
  filters.value = { ...filters.value, sort };
}

const activeCount = computed(() => {
  const f = filters.value;
  return (
    f.sides.length +
    f.techniques.length +
    f.strengths.length +
    f.tags.length +
    (f.sort === "top" ? 0 : 1)
  );
});

const hasAnyFilter = computed(() => {
  const f = filters.value;
  return (
    activeCount.value > 0 ||
    f.types.length > 0 ||
    f.search.length > 0 ||
    f.scope !== "public"
  );
});

function reset() {
  searchDraft.value = "";
  filters.value = emptyNadeFilters();
}

const sortOptions = computed<Array<{ value: NadeSort; label: string }>>(() => [
  { value: "top", label: t("pages.nades.sort.top") },
  { value: "new", label: t("pages.nades.sort.new") },
]);
</script>

<template>
  <FilterBar>
    <div class="relative w-full max-w-[14rem] shrink-0">
      <Search
        class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="searchDraft"
        :placeholder="$t('pages.nades.filters.search_placeholder')"
        class="h-8 pl-7 text-xs"
      />
    </div>

    <NadeTypeChips v-model="typeModel" />

    <AnimatedFilters
      v-model="scopeModel"
      :options="scopeOptions"
      square
      class="ml-auto"
    />

    <FilterMenu
      v-model:open="menuOpen"
      :count="activeCount"
      :active="activeCount > 0"
      :show-reset="hasAnyFilter"
      content-class="w-[min(92vw,300px)] space-y-3 p-2"
      @reset="reset"
    >
      <div class="space-y-0.5">
        <span
          class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.filters.side") }}
        </span>
        <FilterToggle
          v-for="side of NADE_SIDES"
          :key="side"
          :model-value="filters.sides.includes(side)"
          :label="$t(`pages.nades.sides.${side}`)"
          @update:model-value="toggleIn('sides', side)"
        />
      </div>

      <div class="space-y-0.5 border-t border-border/50 pt-3">
        <span
          class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.filters.technique") }}
        </span>
        <FilterToggle
          v-for="technique of NADE_TECHNIQUES"
          :key="technique"
          :model-value="filters.techniques.includes(technique)"
          :label="$t(`pages.nades.techniques.${technique}`)"
          @update:model-value="toggleIn('techniques', technique)"
        />
      </div>

      <div class="space-y-0.5 border-t border-border/50 pt-3">
        <span
          class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.filters.throw_strength") }}
        </span>
        <FilterToggle
          v-for="strength of NADE_THROW_STRENGTHS"
          :key="strength"
          :model-value="filters.strengths.includes(strength)"
          :label="$t(`pages.nades.strengths.${strength}`)"
          @update:model-value="toggleIn('strengths', strength)"
        />
      </div>

      <div
        v-if="props.availableTags.length"
        class="space-y-0.5 border-t border-border/50 pt-3"
      >
        <span
          class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.filters.tags") }}
        </span>
        <FilterToggle
          v-for="tag of props.availableTags"
          :key="tag"
          :model-value="filters.tags.includes(tag)"
          :label="tag"
          @update:model-value="toggleIn('tags', tag)"
        />
      </div>

      <div class="space-y-0.5 border-t border-border/50 pt-3">
        <span
          class="block px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.filters.sort") }}
        </span>
        <button
          v-for="option of sortOptions"
          :key="option.value"
          type="button"
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
          @click="setSort(option.value)"
        >
          <span>{{ option.label }}</span>
          <Check
            v-if="filters.sort === option.value"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
        </button>
      </div>
    </FilterMenu>
  </FilterBar>
</template>
