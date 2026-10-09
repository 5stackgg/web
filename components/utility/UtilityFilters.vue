<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Search } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Input } from "~/components/ui/input";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityTechniqueIcon from "~/components/utility/UtilityTechniqueIcon.vue";
import UtilityThrowIcon from "~/components/utility/UtilityThrowIcon.vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import { backClosesMenus, useBackDismiss } from "~/composables/useBackDismiss";
import {
  emptyUtilityFilters,
  UTILITY_SIDES,
  UTILITY_TECHNIQUES,
  UTILITY_THROW_STRENGTHS,
  UTILITY_TYPE_COLORS,
  UTILITY_TYPES,
} from "~/utilities/utilityDisplay";
import type {
  UtilityFilterState,
  UtilityScope,
  UtilitySort,
} from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

const props = withDefaults(
  defineProps<{
    availableTags?: string[];
    hasTeam?: boolean;
    signedIn?: boolean;
    canReview?: boolean;
    // How many lineups each tab would show, so the choice is informed
    // before it is made rather than after.
    scopeCounts?: Record<string, number>;
    // Which controls to render. The map page splits them across the board and
    // the panel so one flat mega-bar does not front the whole page.
    parts?: Array<"search" | "types" | "scope" | "menu">;
    bare?: boolean;
    // On a phone the type filter has no row of its own under the tabs -- the
    // sheet is too short to spend one on it -- so it lives in this menu.
    typesInMenu?: boolean;
    typeCounts?: Partial<Record<UtilityType, number>> | null;
  }>(),
  {
    availableTags: () => [],
    hasTeam: false,
    signedIn: false,
    canReview: false,
    scopeCounts: () => ({}),
    parts: () => ["search", "types", "scope", "menu"],
    bare: false,
    typesInMenu: false,
    typeCounts: null,
  },
);

const has = (part: "search" | "types" | "scope" | "menu") =>
  props.parts.includes(part);

const filters = defineModel<UtilityFilterState>({ required: true });

const { t } = useI18n();
const menuOpen = ref(false);

useBackDismiss(
  () => menuOpen.value,
  () => (menuOpen.value = false),
  { enabled: backClosesMenus },
);

const scopeOptions = computed(() => [
  {
    key: "public",
    label: t("pages.utility.scope.public"),
    count: props.scopeCounts.public,
  },
  // Every scope below Public is "whose lineups", which a signed-out visitor
  // has no answer to. Offering them greyed out is a login wall wearing a
  // filter's clothes, so they are simply not there.
  ...(props.signedIn
    ? [
        {
          key: "mine",
          label: t("pages.utility.scope.mine"),
          count: props.scopeCounts.mine,
        },
        {
          key: "team",
          label: t("pages.utility.scope.team"),
          disabled: !props.hasTeam,
          count: props.scopeCounts.team,
        },
        {
          key: "favorites",
          label: t("pages.utility.scope.favorites"),
          count: props.scopeCounts.favorites,
        },
      ]
    : []),
  // The submission queue, for the people who answer it. It stays visible at
  // zero so a reviewer can see the queue is clear rather than wonder where it
  // went.
  ...(props.canReview
    ? [
        {
          key: "pending",
          label: t("pages.utility.scope.pending"),
          count: props.scopeCounts.pending,
        },
      ]
    : []),
  // Only worth a tab when there is something in it: an always-on Archived
  // scope reads as a feature, an empty one reads as a dead end.
  ...(props.signedIn && props.scopeCounts.archived
    ? [
        {
          key: "archived",
          label: t("pages.utility.scope.archived"),
          count: props.scopeCounts.archived,
        },
      ]
    : []),
]);

const scopeModel = computed<string>({
  get: () => filters.value.scope,
  set: (value) => {
    const option = scopeOptions.value.find((entry) => entry.key === value);
    if (!option || option.disabled) {
      return;
    }
    filters.value = { ...filters.value, scope: value as UtilityScope };
  },
});

const typeModel = computed<UtilityType[]>({
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

function toggleIn<T extends string>(key: keyof UtilityFilterState, value: T) {
  const current = filters.value[key] as unknown as T[];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  filters.value = { ...filters.value, [key]: next };
}

const sortModel = computed<string>({
  get: () => filters.value.sort,
  set: (sort) => {
    filters.value = { ...filters.value, sort: sort as UtilitySort };
  },
});

// Every option in the menu is a small button you can tell apart without
// reading it: the side's logo, the mouse with the pressed button lit, the
// pose. The states are whole strings, because two border or background
// utilities on one element resolve by stylesheet order.
const TILE_BASE =
  "flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border px-1 text-center text-[0.68rem] font-medium leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
const TILE_OFF =
  "border-border/70 bg-background/40 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground";
const TILE_ON =
  "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]";

function tile(on: boolean) {
  return [TILE_BASE, on ? TILE_ON : TILE_OFF];
}

const activeCount = computed(() => {
  const f = filters.value;
  return (
    f.sides.length +
    f.techniques.length +
    f.strengths.length +
    f.tags.length +
    (f.sort === "top" ? 0 : 1) +
    // Counted on the button only where the button is where you set them.
    (props.typesInMenu ? f.types.length : 0)
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
  filters.value = emptyUtilityFilters();
}

const sortOptions = computed(() => [
  { key: "top", label: t("pages.utility.sort.top") },
  { key: "new", label: t("pages.utility.sort.new") },
]);
</script>

<template>
  <component
    :is="bare ? 'div' : FilterBar"
    :class="bare ? 'flex flex-wrap items-center gap-2' : undefined"
  >
    <div v-if="has('search')" class="relative w-full max-w-[14rem] shrink-0">
      <Search
        class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="searchDraft"
        :placeholder="$t('pages.utility.filters.search_placeholder')"
        class="h-8 pl-7 text-xs"
      />
    </div>

    <UtilityTypeChips v-if="has('types')" v-model="typeModel" />

    <!-- Stacked in the narrow column, where a row of label-plus-count pills
         does not fit and wrapping strands the last scope on its own line. -->
    <AnimatedFilters
      v-if="has('scope')"
      v-model="scopeModel"
      :options="scopeOptions"
      :square="!bare"
      :stacked="bare"
      :class="bare ? '' : 'ml-auto'"
    />

    <FilterMenu
      v-if="has('menu')"
      v-model:open="menuOpen"
      :count="activeCount"
      :active="activeCount > 0"
      :show-reset="hasAnyFilter"
      content-class="w-[min(92vw,19rem)] space-y-3 p-3"
      @reset="reset"
    >
      <!-- The order is the one thing here that is a choice between two, so it
           is a switch in the corner and not two more rows. -->
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold">{{ $t("common.filters") }}</span>
        <AnimatedFilters
          v-model="sortModel"
          :options="sortOptions"
          square
          :aria-label="$t('pages.utility.filters.sort')"
        />
      </div>

      <div v-if="typesInMenu" class="space-y-1.5">
        <span
          class="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.meta.types") }}
        </span>
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="type of UTILITY_TYPES"
            :key="type"
            type="button"
            :aria-pressed="filters.types.includes(type)"
            :class="[
              tile(filters.types.includes(type)),
              'h-[3.25rem] !px-0.5 !text-[0.62rem] tracking-tight',
              typeCounts && !typeCounts[type] && !filters.types.includes(type)
                ? 'opacity-45'
                : '',
            ]"
            @click="toggleIn('types', type)"
          >
            <span
              aria-hidden="true"
              class="size-2 shrink-0 rounded-[2px]"
              :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
            />
            <span class="max-w-full truncate">
              {{ $t(`pages.utility.types.${type}`) }}
            </span>
            <span
              v-if="typeCounts"
              class="font-mono text-[0.6rem] tabular-nums opacity-70"
            >
              {{ typeCounts[type] ?? 0 }}
            </span>
          </button>
        </div>
      </div>

      <!-- Two logos and three mouse glyphs fit one row between them. -->
      <div class="flex gap-3">
        <div class="space-y-1.5">
          <span
            class="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.filters.side") }}
          </span>
          <div class="flex gap-1.5">
            <button
              v-for="side of UTILITY_SIDES"
              :key="side"
              type="button"
              :aria-pressed="filters.sides.includes(side)"
              :class="[tile(filters.sides.includes(side)), 'h-[3.25rem] w-[3.25rem]']"
              @click="toggleIn('sides', side)"
            >
              <img
                :src="
                  side === 'CT'
                    ? '/img/teams/ct_logo.svg'
                    : '/img/teams/t_logo.svg'
                "
                alt=""
                class="size-5 shrink-0"
              />
              {{ $t(`pages.utility.sides.${side}`) }}
            </button>
          </div>
        </div>

        <div class="min-w-0 flex-1 space-y-1.5">
          <span
            class="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.filters.throw_strength") }}
          </span>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="strength of UTILITY_THROW_STRENGTHS"
              :key="strength"
              type="button"
              :aria-pressed="filters.strengths.includes(strength)"
              :class="[tile(filters.strengths.includes(strength)), 'h-[3.25rem]']"
              @click="toggleIn('strengths', strength)"
            >
              <UtilityThrowIcon
                :strength="strength"
                class="h-5 w-[0.875rem] shrink-0"
              />
              {{ $t(`pages.utility.strengths.${strength}`) }}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-1.5">
        <span
          class="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.technique") }}
        </span>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="technique of UTILITY_TECHNIQUES"
            :key="technique"
            type="button"
            :aria-pressed="filters.techniques.includes(technique)"
            :class="[
              tile(filters.techniques.includes(technique)),
              'h-[4.25rem] pb-1 pt-1.5',
            ]"
            @click="toggleIn('techniques', technique)"
          >
            <UtilityTechniqueIcon
              :technique="technique"
              class="size-7 shrink-0"
            />
            <!-- Two lines of room: "Crouch Jump" and its translations wrap
                 rather than truncate. -->
            <span class="flex min-h-[1.7em] items-center [text-wrap:balance]">
              {{ $t(`pages.utility.techniques.${technique}`) }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="props.availableTags.length" class="space-y-1.5">
        <span
          class="block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.tags") }}
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag of props.availableTags"
            :key="tag"
            type="button"
            :aria-pressed="filters.tags.includes(tag)"
            class="inline-flex h-7 max-w-full cursor-pointer items-center rounded-md border px-2 font-mono text-[0.68rem] lowercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            :class="filters.tags.includes(tag) ? TILE_ON : TILE_OFF"
            @click="toggleIn('tags', tag)"
          >
            <span class="truncate">#{{ tag }}</span>
          </button>
        </div>
      </div>
    </FilterMenu>
  </component>
</template>
