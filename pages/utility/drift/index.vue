<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowUpRight, Info, Play, Wrench } from "lucide-vue-next";
import HeGrenadeIcon from "~/components/icons/HeGrenadeIcon.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Progress } from "~/components/ui/progress";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import UtilityRepairDialog from "~/components/utility/UtilityRepairDialog.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  utilityDriftResultsQuery,
  utilityDriftScansQuery,
  utilityLineupsQuery,
  startUtilityDriftScanMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import mapLabel from "~/utilities/mapLabel";
import {
  UTILITY_DRIFT_VERDICTS,
  humanizeUtilityToken,
  utilityDriftReasonKey,
  utilityDriftSeverityTone,
  utilityDriftVerdictKey,
  utilityDriftVerdictTone,
  utilityLineupRoute,
  sortUtilityDriftResults,
} from "~/utilities/utilityDisplay";
import { readUtilityDriftResult, readUtilityDriftScan } from "~/types/utility";
import type {
  UtilityDriftResult,
  UtilityDriftResultView,
  UtilityDriftScan,
  UtilityDriftScanOutput,
  UtilityDriftScanView,
  UtilityLineup,
} from "~/types/utility";

definePageMeta({
  middleware: "admin",
});

const { t } = useI18n();

const ALL_VERDICTS = "all";
const RESULT_LIMIT = 500;

const scans = ref<UtilityDriftScanView[]>([]);
const loadingScans = ref(true);
const selectedScanId = ref<string | null>(null);
const results = ref<UtilityDriftResultView[]>([]);
const loadingResults = ref(false);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const verdictFilter = ref<string>(ALL_VERDICTS);

const maps = ref<Array<{ name: string; label: string }>>([]);
const scanMap = ref<string>("");
const fromRevision = ref("");
const toRevision = ref("");
const starting = ref(false);

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
      },
      order_by: [{ name: order_by.asc }],
    },
    {
      id: true,
      name: true,
      label: true,
    },
  ],
});

async function loadMaps() {
  try {
    const [{ data }, radarMaps] = await Promise.all([
      getGraphqlClient().query({ query: mapsQuery, fetchPolicy: "cache-first" }),
      loadRadarMaps(),
    ]);
    const seen = new Set<string>();
    const tiles: Array<{ name: string; label: string }> = [];
    for (const map of ((data as any)?.maps ?? []) as Array<{
      name: string;
      label: string | null;
    }>) {
      const radar = normalizeMapName(map.name);
      if (!radarMaps.has(radar) || seen.has(radar)) {
        continue;
      }
      seen.add(radar);
      tiles.push({ name: radar, label: mapLabel(map) });
    }
    maps.value = tiles;
    if (!scanMap.value && tiles.length) {
      scanMap.value = tiles[0].name;
    }
  } catch (error) {
    console.error("[utility] drift map load error:", error);
    maps.value = [];
  }
}

async function loadScans() {
  loadingScans.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityDriftScansQuery,
      variables: {
        where: {},
        order_by: [{ created_at: order_by.desc }],
        limit: 50,
      },
      fetchPolicy: "network-only",
    });
    scans.value = (((data as any)?.utility_drift_scans ?? []) as UtilityDriftScan[])
      .map(readUtilityDriftScan);
    if (!selectedScanId.value && scans.value.length) {
      selectedScanId.value = scans.value[0].id;
    }
  } catch (error) {
    console.error("[utility] drift scan load error:", error);
    scans.value = [];
  } finally {
    loadingScans.value = false;
  }
}

async function loadResults(scanId: string) {
  loadingResults.value = true;
  results.value = [];
  lineupsById.value = {};
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: utilityDriftResultsQuery,
      variables: {
        where: { utility_drift_scan_id: { _eq: scanId } },
        // Fetch order only, and it exists to decide what survives the row cap
        // rather than what the page shows: `major` sorts before `minor`, so the
        // rows worth triaging stay inside the limit. The order on screen is the
        // triage rank below, because a broken lineup carries no distance and a
        // distance sort would bury it.
        order_by: [
          { severity: order_by.asc },
          { distance: order_by.desc_nulls_last },
        ],
        limit: RESULT_LIMIT,
      },
      fetchPolicy: "network-only",
    });
    const rows = (((data as any)?.utility_drift_results ?? []) as UtilityDriftResult[])
      .map(readUtilityDriftResult);
    if (selectedScanId.value !== scanId) {
      return;
    }
    results.value = rows;
    const ids = [...new Set(rows.map((row) => row.lineupId))];
    if (!ids.length) {
      return;
    }
    const { data: lineupRows } = await client.query({
      query: utilityLineupsQuery,
      variables: {
        where: { id: { _in: ids } },
        order_by: [{ created_at: order_by.desc }],
        limit: ids.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const byId: Record<string, UtilityLineup> = {};
    for (const lineup of ((lineupRows as any)?.utility_lineups ??
      []) as UtilityLineup[]) {
      byId[lineup.id] = lineup;
    }
    if (selectedScanId.value === scanId) {
      lineupsById.value = byId;
    }
  } catch (error) {
    console.error("[utility] drift result load error:", error);
    results.value = [];
  } finally {
    loadingResults.value = false;
  }
}

onMounted(() => {
  void loadMaps();
  void loadScans();
});

watch(selectedScanId, (scanId) => {
  verdictFilter.value = ALL_VERDICTS;
  if (scanId) {
    void loadResults(scanId);
  }
});

const selectedScan = computed(
  () => scans.value.find((scan) => scan.id === selectedScanId.value) ?? null,
);

/**
 * Counted by the scan itself, not by the rows on screen: the page only ever
 * loads a capped slice, so deriving the chips from loaded rows would quietly
 * under-count every verdict on a big scan. A verdict the scan row has no
 * column for still gets a chip from what did load.
 */
const verdictOptions = computed(() => {
  const scan = selectedScan.value;
  const loaded = new Map<string, number>();
  for (const row of results.value) {
    loaded.set(row.verdict, (loaded.get(row.verdict) ?? 0) + 1);
  }
  const counted: Record<string, number | null> = {
    unchanged: scan?.unchanged ?? null,
    moved: scan?.moved ?? null,
    broken: scan?.broken ?? null,
    unsimulatable: scan?.unsimulatable ?? null,
  };
  const options = [
    {
      key: ALL_VERDICTS,
      label: t("common.all"),
      count: scan?.scanned ?? results.value.length,
    },
  ];
  for (const verdict of UTILITY_DRIFT_VERDICTS) {
    const count = counted[verdict] ?? loaded.get(verdict) ?? 0;
    if (!count) {
      continue;
    }
    options.push({
      key: verdict,
      label: t(`pages.utility.drift.verdicts.${verdict}`),
      count,
    });
  }
  for (const [verdict, count] of [...loaded.entries()].sort()) {
    if ((UTILITY_DRIFT_VERDICTS as readonly string[]).includes(verdict)) {
      continue;
    }
    options.push({
      key: verdict,
      label: humanizeUtilityToken(verdict) || t("common.na"),
      count,
    });
  }
  return options;
});

const visibleResults = computed(() =>
  sortUtilityDriftResults(
    verdictFilter.value === ALL_VERDICTS
      ? results.value
      : results.value.filter((row) => row.verdict === verdictFilter.value),
  ),
);

async function startScan() {
  if (!scanMap.value || starting.value) {
    return;
  }
  starting.value = true;
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: startUtilityDriftScanMutation,
      variables: {
        map_name: scanMap.value,
        from_revision: fromRevision.value.trim() || null,
        to_revision: toRevision.value.trim() || null,
      },
    });
    const output = (data as any)?.startUtilityDriftScan as
      | UtilityDriftScanOutput
      | undefined;
    toast({
      title: t("pages.utility.drift.started", { count: output?.lineups ?? 0 }),
    });
    await loadScans();
    if (output?.scan_id) {
      selectedScanId.value = output.scan_id;
    }
  } catch (error: any) {
    toast({
      title: t("pages.utility.drift.start_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    starting.value = false;
  }
}

// The rows are capped; the scan's own count is not. Saying so beats a page
// that silently stops at 500 and looks complete.
const cappedBy = computed(() => {
  const scanned = selectedScan.value?.scanned ?? null;
  if (results.value.length < RESULT_LIMIT || scanned === null) {
    return null;
  }
  return scanned > results.value.length ? scanned : null;
});

function lineupName(row: UtilityDriftResultView) {
  return lineupsById.value[row.lineupId]?.name ?? null;
}

const repairOpen = ref(false);
const repairRow = ref<UtilityDriftResultView | null>(null);

/**
 * Lineups a repair has been queued for this session. A repair writes a NEW
 * lineup and leaves this one — geometry, votes, progress and verdict — exactly
 * as it was, so nothing about the row will ever change to say it happened. This
 * is the only place that says so, and without it the honest thing for an
 * operator to conclude is that the repair failed.
 */
const repairQueued = ref<Record<string, boolean>>({});

function markRepairQueued(lineupId: string) {
  repairQueued.value = { ...repairQueued.value, [lineupId]: true };
}

/**
 * Only a `moved` lineup has somewhere to aim: the solver re-throws it at the
 * landing it used to have. `broken` has no reachable target left, and
 * `unsimulatable` never said anything about the map in the first place — a
 * repair button on either would be offering a fix for a problem nobody
 * diagnosed.
 */
function canRepair(row: UtilityDriftResultView) {
  return utilityDriftVerdictKey(row.verdict) === "moved";
}

function startRepair(row: UtilityDriftResultView) {
  repairRow.value = row;
  repairOpen.value = true;
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.utility.drift.eyebrow") }}</template>
      <template #title>{{ $t("pages.utility.drift.title") }}</template>
      <template #subtitle>{{ $t("pages.utility.drift.subtitle") }}</template>
      <template #actions>
        <NuxtLink :to="{ name: 'utility' }">
          <Button variant="outline">
            <HeGrenadeIcon class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.title") }}
          </Button>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <div
      class="flex items-start gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] p-3"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
      <div class="min-w-0 text-xs leading-relaxed">
        <div class="font-semibold text-[hsl(var(--tac-amber))]">
          {{ $t("pages.utility.drift.framing_title") }}
        </div>
        <p class="mt-0.5 text-muted-foreground">
          {{ $t("pages.utility.drift.framing") }}
        </p>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="80" class="mt-4">
    <div
      class="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
    >
      <label class="flex min-w-[12rem] flex-col gap-1">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.drift.map") }}
        </span>
        <Select v-model="scanMap">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue :placeholder="$t('pages.utility.drift.map')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="map of maps" :key="map.name" :value="map.name">
              {{ map.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label class="flex flex-col gap-1">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.drift.from_revision") }}
        </span>
        <Input
          v-model="fromRevision"
          class="h-8 w-40 text-xs"
          :placeholder="$t('pages.utility.drift.revision_placeholder')"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.drift.to_revision") }}
        </span>
        <Input
          v-model="toRevision"
          class="h-8 w-40 text-xs"
          :placeholder="$t('pages.utility.drift.revision_placeholder')"
        />
      </label>

      <Button
        size="sm"
        class="tac-amber-cta"
        :disabled="!scanMap"
        :loading="starting"
        @click="startScan()"
      >
        <Play class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.drift.start") }}
      </Button>
    </div>
  </PageTransition>

  <PageTransition :delay="100" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.drift.scans") }}
        </span>

        <template v-if="loadingScans">
          <Skeleton v-for="i in 4" :key="i" class="h-16 w-full rounded-md" />
        </template>

        <p v-else-if="!scans.length" class="text-xs text-muted-foreground">
          {{ $t("pages.utility.drift.no_scans") }}
        </p>

        <template v-else>
          <button
            v-for="scan of scans"
            :key="scan.id"
            type="button"
            class="flex flex-col gap-1 rounded-md border p-2 text-left transition-colors"
            :class="
              selectedScanId === scan.id
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]'
                : 'border-border hover:border-[hsl(var(--tac-amber)/0.35)]'
            "
            @click="selectedScanId = scan.id"
          >
            <span class="text-sm font-semibold">
              {{ cleanMapName(scan.mapName) }}
            </span>
            <span
              class="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <TimeAgo v-if="scan.createdAt" :date="scan.createdAt" />
              <template v-if="scan.status"> · {{ scan.status }}</template>
              <template v-if="scan.durationSeconds !== null">
                · {{ $t("pages.utility.drift.duration", { seconds: scan.durationSeconds }) }}
              </template>
            </span>

            <span
              v-if="scan.fromRevision || scan.toRevision"
              class="truncate font-mono text-[0.58rem] text-muted-foreground"
            >
              {{ scan.fromRevision || $t("common.na") }} →
              {{ scan.toRevision || $t("common.na") }}
            </span>

            <template v-if="scan.running">
              <span
                class="font-mono text-[0.58rem] tabular-nums text-[hsl(var(--tac-amber))]"
              >
                {{
                  $t("pages.utility.drift.progress", {
                    scanned: scan.scanned ?? 0,
                    lineups: scan.lineups ?? 0,
                  })
                }}
              </span>
              <Progress
                v-if="scan.progressPercent !== null"
                :model-value="scan.progressPercent"
                class="h-1"
              />
            </template>

            <span
              v-if="scan.failureReason"
              class="whitespace-pre-wrap break-words text-[0.65rem] leading-snug text-destructive"
            >
              {{ scan.failureReason }}
            </span>

            <span
              v-if="scan.moved !== null || scan.broken !== null"
              class="flex flex-wrap gap-x-2 font-mono text-[0.58rem] tabular-nums text-muted-foreground"
            >
              <span v-if="scan.broken" class="text-destructive">
                {{
                  $t("pages.utility.drift.count_broken", { count: scan.broken })
                }}
              </span>
              <span v-if="scan.moved" class="text-[hsl(var(--tac-amber))]">
                {{ $t("pages.utility.drift.count_moved", { count: scan.moved }) }}
              </span>
              <span v-if="scan.unsimulatable">
                {{
                  $t("pages.utility.drift.count_unsimulatable", {
                    count: scan.unsimulatable,
                  })
                }}
              </span>
              <span v-if="scan.unchanged">
                {{
                  $t("pages.utility.drift.count_unchanged", {
                    count: scan.unchanged,
                  })
                }}
              </span>
              <span v-if="scan.maxDistance !== null">
                {{
                  $t("pages.utility.drift.max_distance", {
                    units: Math.round(scan.maxDistance),
                  })
                }}
              </span>
            </span>
          </button>
        </template>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-if="selectedScan"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <span>
            {{
              $t("pages.utility.drift.progress", {
                scanned: selectedScan.scanned ?? 0,
                lineups: selectedScan.lineups ?? 0,
              })
            }}
          </span>
          <NuxtLink
            v-if="selectedScan.requestedBySteamId"
            :to="{
              name: 'players-id',
              params: { id: selectedScan.requestedBySteamId },
            }"
            class="underline-offset-2 hover:text-foreground hover:underline"
          >
            {{ $t("pages.utility.drift.requested_by") }}
          </NuxtLink>
        </div>

        <p
          v-if="selectedScan?.failureReason"
          class="whitespace-pre-wrap break-words rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          {{ selectedScan.failureReason }}
        </p>

        <AnimatedFilters
          v-if="results.length"
          v-model="verdictFilter"
          :options="verdictOptions"
          square
        />

        <p
          v-if="cappedBy"
          class="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            $t("pages.utility.drift.capped", {
              shown: results.length,
              total: cappedBy,
            })
          }}
        </p>

        <template v-if="loadingResults">
          <Skeleton v-for="i in 6" :key="i" class="h-16 w-full rounded-md" />
        </template>

        <Empty v-else-if="!selectedScan">
          <EmptyTitle>{{ $t("pages.utility.drift.no_scan_selected") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.drift.no_scan_selected_description") }}
          </EmptyDescription>
        </Empty>

        <Empty v-else-if="!visibleResults.length">
          <EmptyTitle>{{ $t("pages.utility.drift.no_results") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("pages.utility.drift.no_results_description") }}
          </EmptyDescription>
        </Empty>

        <template v-else>
          <div
            v-for="row of visibleResults"
            :key="row.key"
            class="flex flex-col gap-1.5 rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em]"
                :class="utilityDriftVerdictTone(row.verdict)"
              >
                {{
                  utilityDriftVerdictKey(row.verdict)
                    ? $t(
                        `pages.utility.drift.verdicts.${utilityDriftVerdictKey(row.verdict)}`,
                      )
                    : humanizeUtilityToken(row.verdictRaw) || $t("common.na")
                }}
              </span>

              <span
                v-if="row.severity"
                class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em]"
                :class="utilityDriftSeverityTone(row.severity)"
              >
                {{ $t(`pages.utility.drift.severities.${row.severity}`) }}
              </span>

              <!-- Rendered only when the parser measured one. A null distance
                   means a side never resolved, and printing 0 or a dash there
                   would read as "it barely moved". -->
              <span
                v-if="row.distance !== null"
                class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
              >
                {{
                  $t("pages.utility.drift.moved", {
                    units: Math.round(row.distance),
                  })
                }}
                <template v-if="row.distanceXy !== null || row.distanceZ !== null">
                  {{
                    $t("pages.utility.drift.moved_axes", {
                      across:
                        row.distanceXy !== null
                          ? Math.round(row.distanceXy)
                          : $t("common.na"),
                      up:
                        row.distanceZ !== null
                          ? Math.round(row.distanceZ)
                          : $t("common.na"),
                    })
                  }}
                </template>
              </span>

              <span
                v-if="repairQueued[row.lineupId]"
                class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
                :title="$t('pages.utility.repair.queued_hint')"
              >
                <Wrench class="h-3 w-3" />
                {{ $t("pages.utility.repair.queued") }}
              </span>

              <Button
                v-else-if="canRepair(row)"
                size="sm"
                variant="outline"
                class="ml-auto shrink-0"
                @click="startRepair(row)"
              >
                <Wrench class="mr-1 h-4 w-4" />
                {{ $t("pages.utility.repair.action") }}
              </Button>

              <NuxtLink
                :to="utilityLineupRoute(selectedScan?.mapName, row.lineupId)"
                class="inline-flex shrink-0 items-center gap-1 rounded p-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                :class="
                  canRepair(row) || repairQueued[row.lineupId] ? '' : 'ml-auto'
                "
              >
                {{ lineupName(row) ?? $t("pages.utility.drift.open_lineup") }}
                <ArrowUpRight class="h-3.5 w-3.5" />
              </NuxtLink>
            </div>

            <div v-if="row.broken && utilityDriftReasonKey(row.reason)">
              <div
                class="font-mono text-[0.6rem] uppercase tracking-[0.12em]"
                :class="
                  row.reason === 'start_sealed'
                    ? 'text-destructive'
                    : 'text-foreground/80'
                "
              >
                {{ $t(`pages.utility.drift.reasons.${row.reason}`) }}
              </div>
              <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {{ $t(`pages.utility.drift.reason_notes.${row.reason}`) }}
              </p>
            </div>

            <p
              v-else-if="row.reason"
              class="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"
            >
              {{ humanizeUtilityToken(row.reason) }}
            </p>

            <p
              v-if="row.unsimulatable"
              class="text-xs leading-relaxed text-muted-foreground"
            >
              {{ $t("pages.utility.drift.unsimulatable_note") }}
            </p>

            <p
              v-else-if="row.broken && row.distance === null"
              class="text-xs leading-relaxed text-muted-foreground"
            >
              {{ $t("pages.utility.drift.no_distance") }}
            </p>
          </div>
        </template>
      </div>
    </div>
  </PageTransition>

  <UtilityRepairDialog
    v-model:open="repairOpen"
    :lineup-id="repairRow?.lineupId ?? null"
    :lineup-name="repairRow ? lineupName(repairRow) : null"
    :map-name="selectedScan?.mapName ?? ''"
    :distance="repairRow?.distance ?? null"
    @queued="markRepairQueued"
  />
</template>
