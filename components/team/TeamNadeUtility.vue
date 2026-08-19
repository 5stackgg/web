<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { Info } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import { useApolloClient } from "@vue/apollo-composable";
import {
  nadeLineupsQuery,
  nadeTeamUtilityReportQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { useTableSort } from "~/composables/useTableSort";
import cleanMapName from "~/utilities/cleanMapName";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import { readNadeTeamUtility } from "~/types/nade";
import type {
  NadeLineup,
  NadeTeamUtilityOutput,
  NadeTeamUtilityView,
} from "~/types/nade";

const props = defineProps<{
  teamId: string;
}>();

const REPORT_LIMIT = 25;

const { client: apolloClient } = useApolloClient();

const report = ref<NadeTeamUtilityView | null>(null);
const lineupsById = ref<Record<string, NadeLineup>>({});
const loading = ref(true);

const { sortKey, sortDir, toggle, sortRows } = useTableSort<
  "lineup" | "map" | "thrown" | "landed" | "rate" | "players"
>("thrown", "desc");

let loadGen = 0;

async function load() {
  if (!props.teamId) {
    report.value = null;
    return;
  }
  const gen = ++loadGen;
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: nadeTeamUtilityReportQuery,
      variables: {
        team_id: props.teamId,
        map_name: null,
        limit: REPORT_LIMIT,
      },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    const view = readNadeTeamUtility(
      (data as any)?.nadeTeamUtilityReport as NadeTeamUtilityOutput | undefined,
    );
    report.value = view;
    lineupsById.value = {};
    const ids = [...new Set(view.entries.map((entry) => entry.lineupId))];
    if (!ids.length) {
      return;
    }
    const { data: lineupRows } = await apolloClient.query({
      query: nadeLineupsQuery,
      variables: {
        where: { id: { _in: ids } },
        order_by: [{ created_at: order_by.desc }],
        limit: ids.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    const byId: Record<string, NadeLineup> = {};
    for (const lineup of ((lineupRows as any)?.nade_lineups ??
      []) as NadeLineup[]) {
      byId[lineup.id] = lineup;
    }
    lineupsById.value = byId;
  } catch (error) {
    if (gen === loadGen) {
      console.error("[nades] team utility report error:", error);
      report.value = null;
      lineupsById.value = {};
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => props.teamId, load, { immediate: true });

const rows = computed(() =>
  (report.value?.entries ?? []).map((entry) => {
    const lineup = lineupsById.value[entry.lineupId] ?? null;
    return {
      ...entry,
      lineup,
      name: lineup?.name ?? null,
      mapName: lineup?.map_name ?? null,
    };
  }),
);

const sortedRows = computed(() =>
  sortRows(rows.value, {
    lineup: (row) => row.name ?? "",
    map: (row) => row.mapName ?? "",
    thrown: (row) => row.thrown,
    landed: (row) => row.landed,
    rate: (row) => row.landRate,
    players: (row) => row.players,
  }),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <span :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses" />
        {{ $t("team.nade_utility.title") }}
      </span>
      <span :class="tacticalSectionDescriptionClasses">
        {{ $t("team.nade_utility.description") }}
      </span>
    </div>

    <template v-if="loading">
      <Skeleton class="h-10 w-full rounded-md" />
      <Skeleton v-for="i in 5" :key="i" class="h-9 w-full rounded-md" />
    </template>

    <!-- Not analysed is not "your team throws nothing". The report either ran
         or it did not, and an empty table under a report that never ran would
         be an accusation nobody measured. -->
    <div
      v-else-if="report && !report.analysed"
      class="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-4"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div class="min-w-0 text-sm">
        <div class="font-medium">
          {{ $t("team.nade_utility.not_analysed") }}
        </div>
        <p
          class="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"
        >
          {{
            report.message || $t("team.nade_utility.not_analysed_description")
          }}
        </p>
      </div>
    </div>

    <Empty v-else-if="!report">
      <EmptyTitle>{{ $t("team.nade_utility.failed") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("team.nade_utility.failed_description") }}
      </EmptyDescription>
    </Empty>

    <Empty v-else-if="!sortedRows.length">
      <EmptyTitle>{{ $t("team.nade_utility.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("team.nade_utility.empty_description") }}
      </EmptyDescription>
    </Empty>

    <template v-else>
      <div
        class="overflow-x-auto rounded-lg border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
      >
        <Table class="min-w-full [&_td]:px-2 [&_th]:px-2">
          <TableHeader class="[&_th]:h-10 bg-muted/20">
            <TableRow>
              <SortableTableHead
                sort-key="lineup"
                :active-key="sortKey"
                :direction="sortDir"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.lineup") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="map"
                :active-key="sortKey"
                :direction="sortDir"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.map") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="players"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.players") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="thrown"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.thrown") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="landed"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.landed") }}
              </SortableTableHead>
              <SortableTableHead
                sort-key="rate"
                :active-key="sortKey"
                :direction="sortDir"
                class="text-right"
                @sort="toggle"
              >
                {{ $t("team.nade_utility.land_rate") }}
              </SortableTableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row of sortedRows" :key="row.lineupId">
              <TableCell class="text-left">
                <NuxtLink
                  :to="{
                    name: 'nades-lineup-id',
                    params: { id: row.lineupId },
                  }"
                  class="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {{ row.name ?? $t("pages.nades.playbooks.unknown_lineup") }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-left text-muted-foreground">
                {{ row.mapName ? cleanMapName(row.mapName) : $t("common.na") }}
              </TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">
                {{ row.players }}
              </TableCell>
              <TableCell class="text-right font-bold tabular-nums">
                {{ row.thrown }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ row.landed }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{
                  row.landRate === null
                    ? $t("common.na")
                    : $t("pages.nades.progress.hit_rate", {
                        percent: row.landRate,
                      })
                }}
              </TableCell>
              <TableCell class="text-right">
                <span
                  v-if="row.lineup"
                  class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {{ $t(`pages.nades.types.${row.lineup.nade_type}`) }}
                  ·
                  {{ $t(`pages.nades.sides.${row.lineup.side}`) }}
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p class="text-xs leading-relaxed text-muted-foreground">
        {{ $t("team.nade_utility.attribution_note") }}
      </p>
    </template>
  </div>
</template>
