<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowLeft, Crosshair, Repeat, Swords, Users } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import FilterBar from "~/components/common/FilterBar.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Badge } from "~/components/ui/badge";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  utilityLineupsQuery,
  utilityMetaLineupsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_SIDES,
  UTILITY_TYPE_COLORS,
  matchUtilityMetaSpot,
  toUtilityMetaSpots,
} from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilityMetaLineup, UtilityType } from "~/types/utility";

const route = useRoute();
const { t } = useI18n();

const mapName = computed(() => normalizeMapName(String(route.params.map)));
const mapTitle = computed(() => cleanMapName(mapName.value));

const ANY_SIDE = "any";

const spots = ref<UtilityMetaSpot[]>([]);
const lineups = ref<UtilityLineup[]>([]);
const loading = ref(true);
const types = ref<UtilityType[]>([]);
const sideFilter = ref<string>(ANY_SIDE);
const selectedKey = ref<string | null>(null);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  ...UTILITY_SIDES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.sides.${entry}`),
  })),
]);

async function load() {
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const [metaResult, lineupResult] = await Promise.all([
      client.query({
        query: utilityMetaLineupsQuery,
        variables: {
          where: { map_name: { _eq: mapName.value } },
          order_by: [{ throwers: order_by.desc }],
          limit: 400,
        },
        fetchPolicy: "network-only",
      }),
      client.query({
        query: utilityLineupsQuery,
        variables: {
          where: {
            map_name: { _eq: mapName.value },
            can_view: { _eq: true },
          },
          order_by: [{ upvotes: order_by.desc }],
          limit: 200,
          offset: 0,
        },
        fetchPolicy: "network-only",
      }),
    ]);
    spots.value = toUtilityMetaSpots(
      ((metaResult.data as any)?.utility_meta_lineups ?? []) as UtilityMetaLineup[],
    );
    lineups.value = ((lineupResult.data as any)?.utility_lineups ??
      []) as UtilityLineup[];
  } catch (error) {
    console.error("[utility] meta page load error:", error);
    spots.value = [];
    lineups.value = [];
  } finally {
    loading.value = false;
  }
}

watch(mapName, load, { immediate: true });

const visibleSpots = computed(() =>
  spots.value.filter((spot) => {
    if (types.value.length && !types.value.includes(spot.utilityType)) {
      return false;
    }
    if (sideFilter.value !== ANY_SIDE && spot.side !== sideFilter.value) {
      return false;
    }
    return true;
  }),
);

// Which saved lineups sit in a cluster. The count comes from the row's own
// `lineups` column; this only names the ones on the page.
const lineupsBySpot = computed(() => {
  const grouped: Record<string, UtilityLineup[]> = {};
  for (const lineup of lineups.value) {
    const spot = matchUtilityMetaSpot(lineup, spots.value);
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

// The newest aggregation stamp on the page. A mined board is a snapshot of a
// batch job, and saying when it last ran keeps it from reading as live data.
const refreshedAt = computed(() => {
  let newest: string | null = null;
  for (const spot of spots.value) {
    if (spot.refreshedAt && (!newest || spot.refreshedAt > newest)) {
      newest = spot.refreshedAt;
    }
  }
  return newest;
});

const selectedRow = computed(
  () => rows.value.find((row) => row.spot.key === selectedKey.value) ?? null,
);

// `lineups` is the API's count and the matcher only sees the lineups this page
// fetched, so the two can legitimately differ. Saying so beats quietly showing
// the shorter list as if it were everything.
const matchGap = computed(() => {
  const row = selectedRow.value;
  if (!row) {
    return 0;
  }
  return Math.max(row.spot.lineups - row.matched.length, 0);
});

function selectSpot(key: string | null) {
  selectedKey.value = selectedKey.value === key ? null : key;
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.utility.meta.eyebrow") }}</template>
      <template #title>{{ mapTitle }}</template>
      <template #subtitle>
        {{
          $t("pages.utility.meta.subtitle", {
            clusters: visibleSpots.length,
            throws: totalThrows,
          })
        }}
      </template>
      <template #actions>
        <NuxtLink :to="{ name: 'utility-map', params: { map: mapName } }">
          <Button variant="outline">
            <ArrowLeft class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.back_to_map") }}
          </Button>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <FilterBar>
      <UtilityTypeChips v-model="types" />
      <AnimatedFilters
        v-model="sideFilter"
        :options="sideOptions"
        square
        class="ml-auto"
      />
    </FilterBar>
  </PageTransition>

  <PageTransition v-if="loading" :delay="80" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Skeleton class="aspect-square w-full rounded-md" />
      <div class="flex flex-col gap-2">
        <Skeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-md" />
      </div>
    </div>
  </PageTransition>

  <PageTransition v-else-if="!spots.length" :delay="80" class="mt-4">
    <Empty>
      <EmptyTitle>{{ $t("pages.utility.meta.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.meta.empty_description") }}
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <PageTransition v-else :delay="80" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="lg:sticky lg:top-4 lg:self-start">
        <UtilityRadarBoard
          :map-name="mapName"
          :lineups="selectedRow ? selectedRow.matched : []"
          :meta-spots="visibleSpots"
          :selected-meta-key="selectedKey"
          meta-interactive
          @select-meta="selectSpot"
        />
        <p class="mt-2 text-xs text-muted-foreground">
          {{ $t("pages.utility.meta.board_hint") }}
        </p>
        <p
          v-if="refreshedAt"
          class="mt-1 flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/70"
        >
          <Repeat class="h-3 w-3" />
          {{ $t("pages.utility.meta.refreshed") }}
          <TimeAgo :date="refreshedAt" hide-icon />
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <button
          v-for="row of rows"
          :key="row.spot.key"
          type="button"
          class="rounded-md border p-2 text-left transition-colors"
          :class="
            selectedKey === row.spot.key
              ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
              : 'border-border bg-card/40 hover:border-[hsl(var(--tac-amber)/0.35)]'
          "
          @click="selectSpot(row.spot.key)"
        >
          <div class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="h-3 w-3 shrink-0 rounded-[2px]"
              :style="{ backgroundColor: row.color }"
            />
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t(row.typeKey) }}
              <template v-if="row.sideKey"> · {{ $t(row.sideKey) }}</template>
              <template v-if="row.techniqueKey">
                · {{ $t(row.techniqueKey) }}
              </template>
            </span>
            <span
              class="ml-auto inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums text-[hsl(var(--tac-amber))]"
            >
              <Users class="h-3.5 w-3.5" />
              {{
                $t("pages.utility.meta.throwers", { count: row.spot.throwers })
              }}
            </span>
          </div>
          <div
            class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-muted-foreground"
          >
            <span>
              {{
                row.spot.lineups
                  ? $t("pages.utility.meta.has_lineups", {
                      count: row.spot.lineups,
                    })
                  : $t("pages.utility.meta.no_lineups")
              }}
            </span>
            <!-- Throws and matches next to the thrower count, never merged
                 into it: one player drilling a spot 200 times is not a meta. -->
            <span class="font-mono tabular-nums opacity-70">
              {{
                $t("pages.utility.meta.volume", {
                  throws: row.spot.throws,
                  matches: row.spot.matches,
                })
              }}
            </span>
            <span
              v-if="row.spot.lastSeenAt"
              class="ml-auto inline-flex items-center gap-1 opacity-70"
            >
              {{ $t("pages.utility.meta.last_seen") }}
              <TimeAgo :date="row.spot.lastSeenAt" hide-icon />
            </span>
          </div>
        </button>
      </div>
    </div>
  </PageTransition>

  <PageTransition v-if="selectedRow" :delay="100" class="mt-4">
    <div class="flex flex-col gap-3">
      <div
        class="grid gap-2 rounded-md border border-border bg-card/40 p-3 text-xs [backdrop-filter:blur(6px)] sm:grid-cols-4"
      >
        <div>
          <div class="text-muted-foreground">
            {{ $t("pages.utility.meta.classification") }}
          </div>
          <div class="mt-0.5 flex flex-wrap gap-1">
            <Badge variant="outline" class="font-mono text-[0.58rem] uppercase">
              {{ $t(selectedRow.typeKey) }}
            </Badge>
            <Badge
              v-if="selectedRow.sideKey"
              variant="outline"
              class="font-mono text-[0.58rem] uppercase"
            >
              {{ $t(selectedRow.sideKey) }}
            </Badge>
            <Badge
              v-if="selectedRow.techniqueKey"
              variant="outline"
              class="font-mono text-[0.58rem] uppercase"
            >
              {{ $t(selectedRow.techniqueKey) }}
            </Badge>
            <Badge
              v-if="selectedRow.strengthKey"
              variant="outline"
              class="font-mono text-[0.58rem] uppercase"
            >
              {{ $t(selectedRow.strengthKey) }}
            </Badge>
          </div>
        </div>

        <!-- The cluster's own representative aim. It is the whole reason an
             unwritten spot is worth showing: it says roughly where to look. -->
        <div>
          <div class="flex items-center gap-1 text-muted-foreground">
            <Crosshair class="h-3 w-3" />
            {{ $t("pages.utility.meta.aim") }}
          </div>
          <div class="mt-0.5 font-mono tabular-nums">
            <template
              v-if="
                selectedRow.spot.viewYaw !== null ||
                selectedRow.spot.viewPitch !== null
              "
            >
              {{ Number(selectedRow.spot.viewYaw ?? 0).toFixed(1) }} /
              {{ Number(selectedRow.spot.viewPitch ?? 0).toFixed(1) }}
            </template>
            <template v-else>{{ $t("common.na") }}</template>
          </div>
          <div class="mt-0.5 text-[0.6rem] text-muted-foreground/80">
            {{ $t("pages.utility.meta.aim_hint") }}
          </div>
        </div>

        <div>
          <div class="flex items-center gap-1 text-muted-foreground">
            <Swords class="h-3 w-3" />
            {{ $t("pages.utility.meta.usage") }}
          </div>
          <div class="mt-0.5 font-mono tabular-nums">
            {{
              $t("pages.utility.meta.usage_detail", {
                throwers: selectedRow.spot.throwers,
                throws: selectedRow.spot.throws,
                matches: selectedRow.spot.matches,
              })
            }}
          </div>
        </div>

        <div>
          <div class="text-muted-foreground">
            {{ $t("pages.utility.meta.seen") }}
          </div>
          <div class="mt-0.5 flex flex-col gap-0.5">
            <span v-if="selectedRow.spot.firstSeenAt" class="flex gap-1">
              {{ $t("pages.utility.meta.first_seen") }}
              <TimeAgo :date="selectedRow.spot.firstSeenAt" hide-icon />
            </span>
            <span v-if="selectedRow.spot.lastSeenAt" class="flex gap-1">
              {{ $t("pages.utility.meta.last_seen") }}
              <TimeAgo :date="selectedRow.spot.lastSeenAt" hide-icon />
            </span>
          </div>
        </div>
      </div>

      <h2
        class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("pages.utility.meta.matching_lineups") }}
      </h2>
      <Empty v-if="!selectedRow.spot.lineups">
        <EmptyTitle>{{ $t("pages.utility.meta.no_lineups") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.utility.meta.no_lineups_description") }}
        </EmptyDescription>
      </Empty>
      <template v-else>
        <div
          class="grid gap-2"
          style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))"
        >
          <UtilityLineupCard
            v-for="lineup of selectedRow.matched"
            :key="lineup.id"
            :lineup="lineup"
            :meta-throwers="selectedRow.spot.throwers"
          />
        </div>
        <p v-if="matchGap" class="text-[0.65rem] text-muted-foreground">
          {{
            $t("pages.utility.meta.match_gap", {
              shown: selectedRow.matched.length,
              count: selectedRow.spot.lineups,
            })
          }}
        </p>
      </template>
    </div>
  </PageTransition>
</template>
