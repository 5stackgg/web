<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from "vue";
import { BadgeCheck, Check, Search } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityTypeSections from "~/components/utility/UtilityTypeSections.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_TYPES,
  UTILITY_TYPE_COLORS,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilityType } from "~/types/utility";

/**
 * Putting lineups into a collection, from the collection's side. Every lineup
 * on this map you can see, in the same type sections as the library, each row
 * a tick: on is in, off is out. It opens over the collection it is filling,
 * so Done lands back on the set you just changed.
 */
const props = defineProps<{
  open: boolean;
  mapName: string;
  /** The collection being filled, for the dock's running count. */
  name: string;
  /** What is in it on this map, so its rows are ticked and always listed. */
  members: UtilityLineup[];
  types: UtilityType[];
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "toggle", lineup: UtilityLineup): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "hover", lineup: UtilityLineup | null): void;
}>();

const { isMobile } = useSidebar();

// A library can run to hundreds on one map; this is the first screenful, and
// the search under the strip reaches the rest.
const PAGE = 150;

const results = ref<UtilityLineup[]>([]);
const loading = ref(false);
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

const searchId = useId();
const searchDraft = ref("");
const search = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchDraft, (value) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    searchTimer = null;
    search.value = value.trim();
  }, 300);
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

let loadGen = 0;

async function load() {
  const gen = ++loadGen;
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery(),
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
          archived_at: { _is_null: true },
          ...(search.value
            ? {
                _or: [
                  { name: { _ilike: `%${search.value}%` } },
                  { description: { _ilike: `%${search.value}%` } },
                ],
              }
            : {}),
        },
        order_by: [{ upvotes: order_by.desc }, { created_at: order_by.desc }],
        limit: PAGE,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (gen === loadGen) {
      results.value = ((data as any)?.utility_lineups ?? []) as UtilityLineup[];
    }
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] collection picker load error:", error);
      results.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

// Asked each time it opens: the library moves under it, and a list that still
// shows a lineup archived a minute ago is a list you cannot trust the ticks on.
watch(
  () => [props.open, props.mapName, search.value] as const,
  ([open, mapName], previous) => {
    if (!open) {
      return;
    }
    // Opening, or a new map under it: what was listed belongs to neither.
    if (!previous || !previous[0] || previous[1] !== mapName) {
      results.value = [];
      reset();
    }
    void load();
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      searchDraft.value = "";
      search.value = "";
      emit("hover", null);
    }
  },
);

const memberIds = computed(() => new Set(props.members.map((entry) => entry.id)));

// What is already in the collection is listed whether or not the first page
// reached it -- you cannot untick a row that is not there. A search narrows
// to what it found.
const lineups = computed(() => {
  if (search.value) {
    return results.value;
  }
  const listed = new Set(results.value.map((entry) => entry.id));
  return [
    ...results.value,
    ...props.members.filter((entry) => !listed.has(entry.id)),
  ];
});

const counts = computed(() => {
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const lineup of lineups.value) {
    tally[lineup.utility_type] = (tally[lineup.utility_type] ?? 0) + 1;
  }
  return tally;
});

const typeOf = (lineup: UtilityLineup) => lineup.utility_type;
const keyOf = (lineup: UtilityLineup) => lineup.id;

function toggleType(type: UtilityType) {
  emit("toggle-type", type);
}

// The type filter can be left on types this list has none of.
const hiddenByTypes = computed(
  () =>
    lineups.value.length > 0 &&
    props.types.length > 0 &&
    !lineups.value.some((lineup) => props.types.includes(lineup.utility_type)),
);

function showAllTypes() {
  for (const type of props.types) {
    emit("toggle-type", type);
  }
}

// The strip speaks in whole lists; the page's filter moves one type at a time.
function onTypes(next: UtilityType[]) {
  for (const type of UTILITY_TYPES) {
    if (next.includes(type) !== props.types.includes(type)) {
      emit("toggle-type", type);
    }
  }
}
</script>

<template>
  <UtilityCardView
    :open="open"
    :label="$t('pages.utility.collections.add_kicker')"
    @back="emit('back')"
  >
    <template #kicker>
      <span class="truncate">
        {{ $t("pages.utility.collections.add_kicker") }}
      </span>
    </template>

    <template #head>
      <div class="flex flex-col gap-2">
        <div
          v-if="!isMobile"
          class="flex gap-1"
          role="group"
          :aria-label="$t('pages.utility.meta.types')"
        >
          <UtilityTypeChips
            :model-value="types"
            :counts="counts"
            fill
            @update:model-value="onTypes"
          />
        </div>
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <label class="sr-only" :for="searchId">
            {{ $t("pages.utility.filters.search_placeholder") }}
          </label>
          <Input
            :id="searchId"
            v-model="searchDraft"
            spellcheck="false"
            class="h-8 pl-7 text-base md:text-xs"
            :placeholder="$t('pages.utility.filters.search_placeholder')"
          />
        </div>
      </div>
    </template>

    <p class="px-0.5 text-xs leading-relaxed text-muted-foreground">
      {{ $t("pages.utility.collections.add_hint") }}
    </p>

    <UtilitySkeletonList v-if="skeleton" :count="4" shape="row" />

    <p
      v-else-if="!lineups.length"
      class="px-0.5 text-xs leading-relaxed text-muted-foreground"
    >
      {{
        $t("pages.utility.collections.add_empty", {
          map: cleanMapName(mapName),
        })
      }}
    </p>

    <p
      v-else-if="hiddenByTypes"
      class="px-0.5 text-xs leading-relaxed text-muted-foreground"
    >
      {{ $t("pages.utility.collections.types_hidden") }}
      <button
        type="button"
        class="font-semibold text-foreground underline underline-offset-2 hover:text-[hsl(var(--tac-amber))]"
        @click="showAllTypes()"
      >
        {{ $t("pages.utility.collections.show_all_types") }}
      </button>
    </p>

    <UtilityTypeSections
      v-else
      class="-mt-3.5 transition-opacity [transition-duration:180ms]"
      :class="refreshing ? 'opacity-50' : ''"
      :items="lineups"
      :type-of="typeOf"
      :key-of="keyOf"
      :types="types"
      @toggle-type="toggleType"
    >
      <template #default="{ item }">
        <!-- The whole row is the tick: a 20px box is not a target. -->
        <UtilityRow
          role="checkbox"
          :aria-checked="memberIds.has(item.id)"
          :color="UTILITY_TYPE_COLORS[item.utility_type]"
          :selected="memberIds.has(item.id)"
          @select="emit('toggle', item)"
          @hover="(over: boolean) => emit('hover', over ? item : null)"
        >
          <template #thumb>
            <UtilityRadarThumb
              :map-name="item.map_name"
              :origin="utilityOrigin(item)"
              :landing="utilityLanding(item)"
              :color="UTILITY_TYPE_COLORS[item.utility_type]"
              :size="40"
            />
          </template>
          {{ item.name }}
          <template v-if="item.confidence === 'exact'" #badges>
            <BadgeCheck class="h-3.5 w-3.5 shrink-0 text-success" />
          </template>
          <template #line2>
            <UtilitySpecLine :lineup="item" compact class="min-w-0 truncate" />
          </template>
          <template #right>
            <span
              aria-hidden="true"
              class="grid size-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors duration-150"
              :class="
                memberIds.has(item.id)
                  ? 'border-transparent bg-[hsl(var(--tac-amber))] text-[#1a1a1a]'
                  : 'border-white/25 text-transparent'
              "
            >
              <Check class="h-3 w-3" :stroke-width="3" />
            </span>
          </template>
        </UtilityRow>
      </template>
    </UtilityTypeSections>

    <template #dock>
      <span
        class="min-w-0 truncate pr-1 text-xs tabular-nums text-muted-foreground"
      >
        {{
          $t("pages.utility.collections.add_count", {
            count: members.length,
            name,
          })
        }}
      </span>
      <Button
        size="sm"
        class="tac-amber-cta h-8 shrink-0 px-3.5 text-[13px] font-semibold"
        @click="emit('back')"
      >
        {{ $t("common.done") }}
      </Button>
    </template>
  </UtilityCardView>
</template>
