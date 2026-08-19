<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  ArrowLeft,
  Crosshair,
  PlugZap,
  Search,
  Trash2,
} from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import FilterBar from "~/components/common/FilterBar.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { toast } from "~/components/ui/toast";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  findUtilityLineupsBlockingQuery,
  utilityLineupsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_EYE_HEIGHT_UNITS,
  UTILITY_SIDES,
  UTILITY_SIGHTLINE_TONES,
  UTILITY_SIGHTLINE_UNCHECKED_COLOR,
  readUtilitySightlineResult,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
  UtilitySightlineView,
} from "~/utilities/utilityDisplay";
import { readUtilityAnalysisNotice } from "~/types/utility";
import type {
  UtilityAnalysisNotice,
  UtilityBlockingOutput,
  UtilityBlockingResult,
  UtilityLineup,
  UtilitySightlinePoint,
  UtilityType,
} from "~/types/utility";

const route = useRoute();
const { t } = useI18n();

const mapName = computed(() => normalizeMapName(String(route.params.map)));
const mapTitle = computed(() => cleanMapName(mapName.value));

const ANY_SIDE = "any";
const RESULT_LIMIT = 30;

const from = ref<UtilitySightlinePoint | null>(null);
const to = ref<UtilitySightlinePoint | null>(null);
const side = ref<string>(ANY_SIDE);
const types = ref<UtilityType[]>([]);
const heightInput = ref(String(UTILITY_EYE_HEIGHT_UNITS));
const searching = ref(false);
const searched = ref(false);
const results = ref<UtilityBlockingResult[]>([]);
const notice = ref<UtilityAnalysisNotice | null>(null);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);

const sideOptions = computed(() => [
  { key: ANY_SIDE, label: t("common.any") },
  ...UTILITY_SIDES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.sides.${entry}`),
  })),
]);

const pickHeight = computed(() => {
  const value = Number(heightInput.value);
  return Number.isFinite(value) ? value : 0;
});

/**
 * A radar pixel carries no height, and world Z is what decides both the level
 * on a stacked map and what the ray actually hits. Seeding it from the map's
 * own lineups beats a constant that is right on Mirage and wrong on Nuke.
 */
async function seedHeight() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery,
      variables: {
        where: {
          map_name: { _eq: mapName.value },
          can_view: { _eq: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: 60,
        offset: 0,
      },
      fetchPolicy: "cache-first",
    });
    const heights = (((data as any)?.utility_lineups ?? []) as UtilityLineup[])
      .map((lineup) => Number(lineup.eye_z ?? lineup.origin_z))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!heights.length) {
      return;
    }
    heightInput.value = String(
      Math.round(heights[Math.floor(heights.length / 2)]),
    );
  } catch (error) {
    console.error("[utility] block height seed error:", error);
  }
}

watch(mapName, () => void seedHeight(), { immediate: true });

function onPick(point: UtilitySightlinePoint) {
  if (!from.value || to.value) {
    from.value = point;
    to.value = null;
    results.value = [];
    notice.value = null;
    searched.value = false;
    selectedId.value = null;
    return;
  }
  to.value = point;
}

function clearLine() {
  from.value = null;
  to.value = null;
  results.value = [];
  notice.value = null;
  searched.value = false;
  selectedId.value = null;
}

const rankedLineups = computed<
  Array<{ lineup: UtilityLineup; view: UtilitySightlineView }>
>(() => {
  const out: Array<{ lineup: UtilityLineup; view: UtilitySightlineView }> = [];
  for (const result of results.value) {
    const lineup = lineupsById.value[result.utility_lineup_id];
    if (!lineup) {
      continue;
    }
    if (types.value.length && !types.value.includes(lineup.utility_type)) {
      continue;
    }
    out.push({
      lineup,
      // The blocking action never attributes to the map, so the "world already
      // stops this" verdict cannot come out of here.
      view: readUtilitySightlineResult({
        blocked: result.blocked,
        blocked_by: null,
        depth: result.depth,
        transmittance: result.transmittance,
        world_blocked: false,
      }),
    });
  }
  return out;
});

const boardLineups = computed(() =>
  rankedLineups.value.map((entry) => entry.lineup),
);

const segments = computed<UtilityBoardSegment[]>(() => {
  if (!from.value || !to.value) {
    return [];
  }
  return [
    {
      key: "sightline",
      from: from.value,
      to: to.value,
      color: UTILITY_SIGHTLINE_UNCHECKED_COLOR,
    },
  ];
});

const markers = computed<UtilityBoardMarker[]>(() => {
  if (!from.value || to.value) {
    return [];
  }
  return [
    {
      key: "pending",
      point: from.value,
      color: UTILITY_SIGHTLINE_UNCHECKED_COLOR,
      shape: "cross" as const,
    },
  ];
});

async function search() {
  const start = from.value;
  const end = to.value;
  if (!start || !end) {
    return;
  }
  searching.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: findUtilityLineupsBlockingQuery,
      variables: {
        map_name: mapName.value,
        from_x: start.x,
        from_y: start.y,
        from_z: start.z,
        to_x: end.x,
        to_y: end.y,
        to_z: end.z,
        side: side.value === ANY_SIDE ? null : side.value,
        limit: RESULT_LIMIT,
      },
      fetchPolicy: "no-cache",
    });
    const output = (data as any)?.findUtilityLineupsBlocking as
      | UtilityBlockingOutput
      | undefined;
    notice.value = readUtilityAnalysisNotice(output);
    const hits = output?.results ?? [];
    results.value = hits;
    searched.value = true;
    selectedId.value = null;
    lineupsById.value = {};
    if (!hits.length) {
      return;
    }
    const { data: rows } = await client.query({
      query: utilityLineupsQuery,
      variables: {
        where: {
          id: { _in: hits.map((hit) => hit.utility_lineup_id) },
          can_view: { _eq: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: hits.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const byId: Record<string, UtilityLineup> = {};
    for (const lineup of ((rows as any)?.utility_lineups ?? []) as UtilityLineup[]) {
      byId[lineup.id] = lineup;
    }
    lineupsById.value = byId;
  } catch (error: any) {
    notice.value = { degraded: true, message: error?.message ?? null };
    results.value = [];
    searched.value = true;
    toast({
      title: t("pages.utility.block.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    searching.value = false;
  }
}

function selectLineup(id: string | null) {
  selectedId.value = selectedId.value === id ? null : id;
  if (!selectedId.value || typeof document === "undefined") {
    return;
  }
  document
    .getElementById(`utility-block-${selectedId.value}`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function coordinate(point: UtilitySightlinePoint) {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)}`;
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.utility.block.eyebrow") }}</template>
      <template #title>{{ $t("pages.utility.block.title") }}</template>
      <template #subtitle>
        {{ $t("pages.utility.block.subtitle", { map: mapTitle }) }}
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
        v-model="side"
        :options="sideOptions"
        square
        class="ml-auto"
      />
    </FilterBar>
  </PageTransition>

  <PageTransition :delay="80" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="lg:sticky lg:top-4 lg:self-start">
        <UtilityRadarBoard
          :map-name="mapName"
          :lineups="boardLineups"
          :selected-id="selectedId"
          :hovered-id="hoveredId"
          picking
          :pick-z="pickHeight"
          :segments="segments"
          :markers="markers"
          @pick="onPick"
          @select="selectLineup"
          @hover="(id) => (hoveredId = id)"
        />

        <p class="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {{
            from && !to
              ? $t("pages.utility.block.pending_hint")
              : $t("pages.utility.block.hint")
          }}
        </p>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <label
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.block.height_label") }}
            <Input
              v-model="heightInput"
              type="number"
              class="h-8 w-24 text-xs"
            />
          </label>
          <Button
            size="sm"
            class="tac-amber-cta"
            :disabled="!from || !to"
            :loading="searching"
            @click="search()"
          >
            <Search class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.block.search") }}
          </Button>
          <Button v-if="from" size="sm" variant="ghost" @click="clearLine()">
            <Trash2 class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.block.clear") }}
          </Button>
        </div>

        <p
          v-if="from && to"
          class="mt-2 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
        >
          {{ coordinate(from) }} → {{ coordinate(to) }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <template v-if="searching">
          <Skeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-md" />
        </template>

        <Empty v-else-if="!searched">
          <EmptyTitle>{{ $t("pages.utility.block.empty") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.block.empty_description") }}
          </EmptyDescription>
        </Empty>

        <!-- "We could not check" and "nothing closes this angle" are opposite
             answers. Only the second one is a claim, and it is only earned
             when the parser actually answered. -->
        <Empty v-else-if="!rankedLineups.length && notice?.degraded">
          <EmptyTitle>{{ $t("pages.utility.block.degraded") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.block.degraded_description") }}
            <span
              v-if="notice.message"
              class="mt-1 block whitespace-pre-wrap break-words font-mono text-[0.6rem]"
            >
              {{ notice.message }}
            </span>
          </EmptyDescription>
          <Button
            size="sm"
            variant="outline"
            class="mt-3"
            :loading="searching"
            @click="search()"
          >
            <Search class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.block.retry") }}
          </Button>
        </Empty>

        <Empty v-else-if="!rankedLineups.length">
          <EmptyTitle>{{ $t("pages.utility.block.no_results") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.block.no_results_description") }}
          </EmptyDescription>
        </Empty>

        <template v-else>
          <div
            v-if="notice?.degraded"
            class="flex items-start gap-1.5 rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1.5"
          >
            <PlugZap class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <div class="min-w-0 text-[0.7rem] leading-snug">
              <div
                class="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-destructive"
              >
                {{ $t("pages.utility.block.degraded") }}
              </div>
              <p class="text-muted-foreground">
                {{ $t("pages.utility.block.degraded_partial") }}
              </p>
            </div>
          </div>

          <p
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{
              $t("pages.utility.block.results", { count: rankedLineups.length })
            }}
          </p>

          <div
            v-for="(entry, index) of rankedLineups"
            :id="`utility-block-${entry.lineup.id}`"
            :key="entry.lineup.id"
            class="flex flex-col gap-1"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
              >
                #{{ index + 1 }}
              </span>
              <span
                class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em]"
                :class="UTILITY_SIGHTLINE_TONES[entry.view.verdict]"
              >
                {{ $t(`pages.utility.block.coverage.${entry.view.verdict}`) }}
              </span>
              <span
                class="font-mono text-[0.58rem] tabular-nums text-muted-foreground"
              >
                {{
                  $t("pages.utility.sightline.visible", {
                    percent: entry.view.visiblePercent,
                  })
                }}
                ·
                {{
                  $t("pages.utility.sightline.depth", { units: entry.view.depth })
                }}
              </span>
            </div>

            <UtilityLineupCard
              :lineup="entry.lineup"
              :selected="selectedId === entry.lineup.id"
              @select="selectLineup"
              @hover="(id) => (hoveredId = id)"
            />
          </div>
        </template>
      </div>
    </div>
  </PageTransition>
</template>
