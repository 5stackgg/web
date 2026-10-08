<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { BadgeCheck } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import UtilityRow from "~/components/utility/UtilityRow.vue";
import UtilityThrowersMeter from "~/components/utility/UtilityThrowersMeter.vue";
import UtilityTypeSections from "~/components/utility/UtilityTypeSections.vue";
import { useMapCallouts } from "~/composables/useMapCallouts";
import {
  UTILITY_TYPE_COLORS,
  utilityThrowButtonsKey,
} from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityType } from "~/types/utility";

export type UtilityMetaScope = "all" | "unwritten" | "written";

/**
 * What people actually throw on this map, one row per spot. A spot somebody
 * has written up and one nobody has are the same row -- the dashed frame and
 * the amber meter say which -- and either opens into the card, where the
 * page shows how it is thrown and what to do about it.
 */
const props = withDefaults(
  defineProps<{
    mapName: string;
    // Past the threshold and the side filter, cut to the scope: everything
    // the list would show with no type picked.
    spots: UtilityMetaSpot[];
    // How many lineups the viewer can open sit in each cluster, by spot key.
    // Null until that is known, and the server's own count stands in.
    written: Record<string, number> | null;
    // The busiest spot on the map, so every meter reads against one scale.
    busiest: number;
    types: UtilityType[];
    scope: UtilityMetaScope;
    scopeCounts: Record<UtilityMetaScope, number>;
    // The floor lives in the map's top row. The panel only reads it, to say
    // so when nothing clears it and to offer the one below.
    threshold: string;
    thresholdOptions: Array<{ key: string; label: string }>;
    hoveredKey: string | null;
    // The page has not asked this map for its mined spots yet. An empty list
    // is then not an answer.
    loading?: boolean;
  }>(),
  { loading: false },
);

const emit = defineEmits<{
  (event: "update:scope", value: UtilityMetaScope): void;
  (event: "update:hoveredKey", value: string | null): void;
  (event: "update:threshold", value: string): void;
  (event: "open", key: string): void;
  (event: "toggle-type", type: UtilityType): void;
}>();

const { t } = useI18n();

const scopeModel = computed<string>({
  get: () => props.scope,
  set: (value) => emit("update:scope", value as UtilityMetaScope),
});

const scopeOptions = computed(() => [
  {
    key: "all",
    label: t("pages.utility.meta.scope_all"),
    count: props.scopeCounts.all,
  },
  {
    key: "unwritten",
    label: t("pages.utility.meta.scope_unwritten"),
    count: props.scopeCounts.unwritten,
  },
  {
    key: "written",
    label: t("pages.utility.meta.scope_written"),
    count: props.scopeCounts.written,
  },
]);

function writtenCount(spot: UtilityMetaSpot) {
  return props.written ? (props.written[spot.key] ?? 0) : spot.lineups;
}

const { autoName } = useMapCallouts(() => props.mapName);

// A cluster has no name of its own, but the map knows where it goes and where
// it comes from -- a better handle to scan a list by than its classification.
function spotName(spot: UtilityMetaSpot) {
  return (
    autoName(spot.utilityType, spot.origin, spot.landing) ||
    t("pages.utility.meta.unnamed", {
      type: t(`pages.utility.types.${spot.utilityType}`),
    })
  );
}

const shown = computed(() =>
  props.spots.filter(
    (spot) => !props.types.length || props.types.includes(spot.utilityType),
  ),
);

// Throws add up across clusters; throwers do not -- the same player shows up
// in every spot they throw, so summing them would invent a player count.
const totalThrows = computed(() =>
  props.spots.reduce((sum, spot) => sum + spot.throws, 0),
);

const refreshedAt = computed(() => {
  let newest: string | null = null;
  for (const spot of props.spots) {
    if (spot.refreshedAt && (!newest || spot.refreshedAt > newest)) {
      newest = spot.refreshedAt;
    }
  }
  return newest;
});

// Nothing clears the floor: offer the one below it instead of a dead end.
const lowerThreshold = computed(() => {
  const at = props.thresholdOptions.findIndex(
    (option) => option.key === props.threshold,
  );
  return at > 0 ? props.thresholdOptions[at - 1] : null;
});

const typeOf = (spot: UtilityMetaSpot) => spot.utilityType;
const keyOf = (spot: UtilityMetaSpot) => spot.key;
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Which spots, where Public and Mine sit on Lineups. -->
    <AnimatedFilters
      v-model="scopeModel"
      :options="scopeOptions"
      stacked
      :aria-label="$t('pages.utility.meta.scope_label')"
    />

    <HeightSwap>
      <UtilitySkeletonList v-if="loading" key="loading" :count="3" shape="row" />

      <p
        v-else-if="!scopeCounts.all"
        key="none"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{ $t("pages.utility.meta.none_at_threshold", { count: threshold }) }}
        <button
          v-if="lowerThreshold"
          type="button"
          class="font-semibold text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
          @click="emit('update:threshold', lowerThreshold.key)"
        >
          {{
            $t("pages.utility.meta.show_threshold", {
              label: lowerThreshold.label,
            })
          }}
        </button>
      </p>

      <p
        v-else-if="!spots.length"
        key="scope-empty"
        class="px-0.5 text-xs leading-relaxed text-muted-foreground"
      >
        {{
          scope === "written"
            ? $t("pages.utility.meta.none_written")
            : $t("pages.utility.meta.all_written")
        }}
      </p>

      <div v-else key="rows" class="flex flex-col">
        <p
          class="flex items-center justify-between gap-2 px-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <span class="tabular-nums">
            {{
              $t("pages.utility.meta.summary", {
                spots: spots.length,
                throws: totalThrows.toLocaleString(),
              })
            }}
          </span>
          <span v-if="refreshedAt" class="flex shrink-0 items-center gap-1">
            <TimeAgo :date="refreshedAt" hide-icon />
          </span>
        </p>

        <UtilityTypeSections
          :items="shown"
          :type-of="typeOf"
          :key-of="keyOf"
          :types="types"
          @toggle-type="(type) => emit('toggle-type', type)"
        >
          <template #default="{ item: spot }">
            <UtilityRow
              :id="`utility-meta-${spot.key}`"
              :color="UTILITY_TYPE_COLORS[spot.utilityType]"
              :dashed="!writtenCount(spot)"
              :hovered="hoveredKey === spot.key"
              @select="emit('open', spot.key)"
              @hover="(on) => emit('update:hoveredKey', on ? spot.key : null)"
            >
              <template #thumb>
                <UtilityRadarThumb
                  :map-name="mapName"
                  :origin="spot.origin"
                  :landing="spot.landing"
                  :color="UTILITY_TYPE_COLORS[spot.utilityType]"
                  :size="40"
                />
              </template>

              {{ spotName(spot) }}

              <template v-if="writtenCount(spot)" #badges>
                <FiveStackToolTip as-child :delay-duration="120">
                  <template #trigger>
                    <BadgeCheck class="h-3.5 w-3.5 shrink-0 text-success" />
                  </template>
                  {{ $t("pages.utility.meta.written_up") }}
                </FiveStackToolTip>
              </template>

              <template #line2>
                <span class="min-w-0 truncate">
                  <template v-if="spot.side">
                    <span class="text-foreground">
                      {{ $t(`pages.utility.sides.${spot.side}`) }}
                    </span>
                    <span aria-hidden="true" class="mx-1.5 text-border">/</span>
                  </template>
                  <template v-if="spot.technique">
                    {{ $t(`pages.utility.techniques.${spot.technique}`) }}
                    <span aria-hidden="true" class="mx-1.5 text-border">/</span>
                  </template>
                  {{
                    $t(
                      `pages.utility.throw_buttons.${utilityThrowButtonsKey(spot.throwStrength)}_short`,
                    )
                  }}
                  <template v-if="writtenCount(spot)">
                    <span aria-hidden="true" class="mx-1.5 text-border">/</span>
                    {{
                      $t(
                        "pages.utility.meta.lineup_count",
                        { count: writtenCount(spot) },
                        writtenCount(spot),
                      )
                    }}
                  </template>
                </span>
              </template>

              <template #right>
                <UtilityThrowersMeter
                  :count="spot.throwers"
                  :max="busiest"
                  :color="UTILITY_TYPE_COLORS[spot.utilityType]"
                  :amber="!writtenCount(spot)"
                  class="!w-14"
                />
              </template>
            </UtilityRow>
          </template>
        </UtilityTypeSections>
      </div>
    </HeightSwap>
  </div>
</template>
