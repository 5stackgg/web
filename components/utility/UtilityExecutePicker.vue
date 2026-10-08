<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BadgeCheck } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityTypeSections from "~/components/utility/UtilityTypeSections.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import {
  UTILITY_TYPE_COLORS,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilitySide, UtilityType } from "~/types/utility";

/**
 * Where an execute gets its throws: every lineup on the map for the execute's
 * side, in the same type sections the Lineups tab is. A click puts a lineup in
 * as the next step and another takes it out again, and the view stays put --
 * an execute is four or five throws, and leaving after each one would make
 * picking them feel like a mistake. Throwing one twice is the rare case, and
 * it is done from the step itself in the editor.
 */
const props = defineProps<{
  open: boolean;
  mapName: string;
  side: UtilitySide;
  /** The page's one type filter. */
  types: UtilityType[];
  /** The steps each lineup already holds, 1-based. */
  numbers: Record<string, number[]>;
  count: number;
  max: number;
  hoveredId?: string | null;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "pick", lineup: UtilityLineup): void;
  (e: "drop", id: string): void;
  (e: "toggle-type", type: UtilityType): void;
  (e: "hover", id: string | null): void;
  // What is on offer, so the caller can put it on the map.
  (e: "lineups", list: UtilityLineup[]): void;
}>();

const PICK_LIMIT = 200;

const lineups = ref<UtilityLineup[]>([]);
const loading = ref(false);

// Only the first fill draws shapes; flipping the execute's side afterwards
// keeps the rows you are picking from and dims them.
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

let fetchId = 0;
async function fetchLineups() {
  const myFetch = ++fetchId;
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery(),
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          side: { _eq: props.side },
          can_view: { _eq: true },
          archived_at: { _is_null: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: PICK_LIMIT,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (myFetch !== fetchId) {
      return;
    }
    lineups.value = (data as any)?.utility_lineups ?? [];
  } catch (error) {
    if (myFetch === fetchId) {
      console.error("[utility] execute picker fetch error:", error);
      lineups.value = [];
    }
  } finally {
    if (myFetch === fetchId) {
      loading.value = false;
    }
  }
}

watch(
  () => [props.open, props.mapName, props.side] as const,
  ([isOpen, mapName, side], previous) => {
    if (!isOpen) {
      return;
    }
    // A different map or side is a different shelf, not a refresh of this one.
    if (!previous?.[0] || previous[1] !== mapName || previous[2] !== side) {
      lineups.value = [];
      reset();
    }
    void fetchLineups();
  },
  { immediate: true },
);

watch(lineups, (list) => emit("lineups", list), { immediate: true });

const counts = computed(() => {
  const tally: Partial<Record<UtilityType, number>> = {};
  for (const lineup of lineups.value) {
    tally[lineup.utility_type] = (tally[lineup.utility_type] ?? 0) + 1;
  }
  return tally;
});

// The chips hand back the whole set; the page's filter moves one type at a
// time, so the one that changed is what gets passed on.
function onTypes(next: UtilityType[]) {
  for (const type of new Set([...next, ...props.types])) {
    if (next.includes(type) !== props.types.includes(type)) {
      emit("toggle-type", type);
    }
  }
}

const typeOf = (lineup: UtilityLineup) => lineup.utility_type;
const keyOf = (lineup: UtilityLineup) => lineup.id;

const atLimit = computed(() => props.count >= props.max);

// In or out. A row that is in can always be taken out, even at the limit.
function toggle(lineup: UtilityLineup) {
  if (props.numbers[lineup.id]) {
    emit("drop", lineup.id);
  } else {
    emit("pick", lineup);
  }
}
</script>

<template>
  <UtilityCardView
    :open="open"
    :label="$t('pages.utility.playbooks.add_throw')"
    @back="emit('back')"
  >
    <template #kicker>
      <span class="truncate">{{ $t("pages.utility.playbooks.add_throw") }}</span>
    </template>

    <template #head>
      <div
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
    </template>

    <p class="text-xs leading-relaxed text-muted-foreground">
      {{ $t("pages.utility.playbooks.pick_hint") }}
    </p>

    <HeightSwap>
      <UtilitySkeletonList
        v-if="skeleton"
        key="loading"
        :count="4"
        shape="row"
      />

      <p
        v-else-if="!lineups.length"
        key="empty"
        class="text-xs leading-relaxed text-muted-foreground"
      >
        {{
          $t("pages.utility.playbooks.pick_empty", {
            side: $t(`pages.utility.sides.${side}`),
          })
        }}
      </p>

      <UtilityTypeSections
        v-else
        key="list"
        class="-mt-2 transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
        :items="lineups"
        :type-of="typeOf"
        :key-of="keyOf"
        :types="types"
        @toggle-type="(type) => emit('toggle-type', type)"
      >
        <template #default="{ item }">
          <UtilityRow
            :color="UTILITY_TYPE_COLORS[item.utility_type]"
            :hovered="hoveredId === item.id"
            :selected="!!numbers[item.id]"
            role="checkbox"
            :aria-checked="!!numbers[item.id]"
            :aria-disabled="(atLimit && !numbers[item.id]) || undefined"
            @select="toggle(item)"
            @hover="(on) => emit('hover', on ? item.id : null)"
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
            <template #badges>
              <BadgeCheck
                v-if="item.confidence === 'exact'"
                aria-hidden="true"
                class="h-3.5 w-3.5 shrink-0 text-success"
              />
            </template>
            <template #line2>
              <UtilitySpecLine :lineup="item" compact class="min-w-0 truncate" />
            </template>
            <template #right>
              <!-- The steps it already holds, as the numbers it wears on the
                   map; an empty box until it holds one. -->
              <span
                v-if="numbers[item.id]"
                class="grid h-[1.375rem] min-w-[1.375rem] shrink-0 place-items-center rounded-full px-1 text-[0.69rem] font-bold leading-none tabular-nums text-[#05070b]"
                :style="{
                  backgroundColor: UTILITY_TYPE_COLORS[item.utility_type],
                }"
              >
                {{ numbers[item.id].join("·") }}
              </span>
              <span
                v-else
                aria-hidden="true"
                class="size-5 shrink-0 rounded-[5px] border-[1.5px] border-white/25"
              />
            </template>
          </UtilityRow>
        </template>
      </UtilityTypeSections>
    </HeightSwap>

    <template #dock>
      <span
        class="min-w-0 truncate pr-1 text-xs tabular-nums"
        :class="
          atLimit ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
        "
      >
        {{ $t("pages.utility.playbooks.steps_count", { count, max }) }}
      </span>
      <Button
        size="sm"
        class="tac-amber-cta h-8 shrink-0 px-3.5 text-[13px] font-semibold"
        @click="emit('back')"
      >
        {{ $t("pages.utility.playbooks.done") }}
      </Button>
    </template>
  </UtilityCardView>
</template>
