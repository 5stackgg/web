<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Crosshair, Users } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Badge } from "~/components/ui/badge";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import {
  UTILITY_SIDES,
  UTILITY_TYPE_COLORS,
  matchUtilityMetaSpot,
} from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  spots: UtilityMetaSpot[];
  lineups: UtilityLineup[];
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  (event: "update:selectedKey", value: string | null): void;
  (event: "open", id: string): void;
}>();

const { t } = useI18n();

const ANY_SIDE = "any";
const sideFilter = ref<string>(ANY_SIDE);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  ...UTILITY_SIDES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.sides.${entry}`),
  })),
]);

const visibleSpots = computed(() =>
  props.spots.filter(
    (spot) => sideFilter.value === ANY_SIDE || spot.side === sideFilter.value,
  ),
);

// Which saved lineups sit in a cluster. The count comes from the row's own
// `lineups` column; this only names the ones the page happens to have loaded.
const lineupsBySpot = computed(() => {
  const grouped: Record<string, UtilityLineup[]> = {};
  for (const lineup of props.lineups) {
    const spot = matchUtilityMetaSpot(lineup, props.spots);
    if (spot) {
      (grouped[spot.key] ??= []).push(lineup);
    }
  }
  return grouped;
});

const rows = computed(() =>
  visibleSpots.value.map((spot, index) => ({
    spot,
    rank: index + 1,
    color: UTILITY_TYPE_COLORS[spot.utilityType] ?? "#ffffff",
    typeKey: `pages.utility.types.${spot.utilityType}`,
    sideKey: spot.side ? `pages.utility.sides.${spot.side}` : "",
    techniqueKey: spot.technique
      ? `pages.utility.techniques.${spot.technique}`
      : "",
    strengthKey: spot.throwStrength
      ? `pages.utility.strengths.${spot.throwStrength}`
      : "",
    matched: lineupsBySpot.value[spot.key] ?? [],
  })),
);

// Throws add up across clusters; throwers do not — the same player shows up in
// every spot they throw, so summing `throwers` would invent a player count.
const totalThrows = computed(() =>
  visibleSpots.value.reduce((sum, spot) => sum + spot.throws, 0),
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

function toggle(key: string) {
  emit("update:selectedKey", props.selectedKey === key ? null : key);
}

// A spot filtered out from under the selection would otherwise stay highlighted
// on the board with nothing in the list pointing at it.
watch(visibleSpots, (list) => {
  if (
    props.selectedKey &&
    !list.some((spot) => spot.key === props.selectedKey)
  ) {
    emit("update:selectedKey", null);
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <AnimatedFilters v-model="sideFilter" :options="sideOptions" square block />

    <div
      class="flex items-center justify-between gap-2 px-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span>
        {{
          $t("pages.utility.meta.summary", {
            spots: visibleSpots.length,
            throws: totalThrows,
          })
        }}
      </span>
      <span v-if="refreshedAt" class="flex shrink-0 items-center gap-1">
        <TimeAgo :date="refreshedAt" hide-icon />
      </span>
    </div>

    <Empty v-if="!rows.length">
      <EmptyTitle>{{ $t("pages.utility.meta.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.meta.empty_description") }}
      </EmptyDescription>
    </Empty>

    <div v-else class="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pr-1">
      <div
        v-for="row of rows"
        :key="row.spot.key"
        class="rounded-md border transition-colors"
        :class="
          selectedKey === row.spot.key
            ? 'border-[hsl(var(--tac-amber))]/60 bg-card/70'
            : 'border-border/60 bg-card/30 hover:border-border'
        "
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 p-2 text-left"
          @click="toggle(row.spot.key)"
        >
          <span
            class="w-5 shrink-0 text-center font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            {{ row.rank }}
          </span>
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: row.color }"
          />
          <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <Badge variant="outline" class="font-mono text-[0.55rem] uppercase">
              {{ $t(row.typeKey) }}
            </Badge>
            <Badge
              v-if="row.sideKey"
              variant="outline"
              class="font-mono text-[0.55rem] uppercase"
            >
              {{ $t(row.sideKey) }}
            </Badge>
            <Badge
              v-if="row.matched.length"
              variant="secondary"
              class="font-mono text-[0.55rem]"
            >
              {{ row.matched.length }}
            </Badge>
          </span>
          <span
            class="flex shrink-0 items-center gap-1 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            <Users class="h-3 w-3" />
            {{ row.spot.throwers }}
          </span>
        </button>

        <div
          v-if="selectedKey === row.spot.key"
          class="flex flex-col gap-2 border-t border-border/60 p-2"
        >
          <div class="grid grid-cols-2 gap-2 text-[0.65rem]">
            <div>
              <div class="flex items-center gap-1 text-muted-foreground">
                <Crosshair class="h-3 w-3" />
                {{ $t("pages.utility.meta.aim") }}
              </div>
              <div class="mt-0.5 font-mono tabular-nums">
                <template
                  v-if="
                    row.spot.viewYaw !== null || row.spot.viewPitch !== null
                  "
                >
                  {{ Number(row.spot.viewYaw ?? 0).toFixed(1) }} /
                  {{ Number(row.spot.viewPitch ?? 0).toFixed(1) }}
                </template>
                <template v-else>{{ $t("common.na") }}</template>
              </div>
            </div>
            <div>
              <div class="text-muted-foreground">
                {{ $t("pages.utility.meta.usage") }}
              </div>
              <div class="mt-0.5 font-mono tabular-nums">
                {{
                  $t("pages.utility.meta.usage_detail", {
                    throwers: row.spot.throwers,
                    throws: row.spot.throws,
                    matches: row.spot.matches,
                  })
                }}
              </div>
            </div>
          </div>

          <div
            v-if="row.spot.lastSeenAt"
            class="flex gap-1 text-[0.6rem] text-muted-foreground"
          >
            {{ $t("pages.utility.meta.last_seen") }}
            <TimeAgo :date="row.spot.lastSeenAt" hide-icon />
          </div>

          <p v-if="!row.matched.length" class="text-[0.65rem] text-muted-foreground">
            {{ $t("pages.utility.meta.no_lineups_description") }}
          </p>
          <div v-else class="flex flex-col gap-2">
            <UtilityLineupCard
              v-for="lineup of row.matched"
              :key="lineup.id"
              :lineup="lineup"
              :meta-throwers="row.spot.throwers"
              open-in-place
              @open="(id: string) => emit('open', id)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
