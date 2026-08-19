<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { ArrowUpRight, Bomb, Info, Save } from "lucide-vue-next";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import NadeSaveLineupDialog from "~/components/nades/NadeSaveLineupDialog.vue";
import { nadeMatchUtilityReportQuery } from "~/graphql/nadesGraphql";
import { matchMovementMapQuery } from "~/graphql/matchMovementPathsGraphql";
import {
  fetchReplayBlob,
  normalizeBlobGrenades,
} from "~/composables/useReplayBlob";
import { useAuthStore } from "~/stores/AuthStore";
import cleanMapName from "~/utilities/cleanMapName";
import {
  NADE_TYPES,
  NADE_TYPE_COLORS,
  canonicalNadeType,
  humanizeNadeToken,
} from "~/utilities/nadeDisplay";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import { readNadeUtilityReport } from "~/types/nade";
import type {
  NadeType,
  NadeUtilityReportOutput,
  NadeUtilityReportView,
} from "~/types/nade";

const props = defineProps<{
  match: any;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const EVERYONE = "everyone";

const report = ref<NadeUtilityReportView | null>(null);
const loading = ref(true);

const players = computed(() => {
  const rows: Array<{ steamId: string; name: string }> = [];
  const seen = new Set<string>();
  for (const lineup of [props.match?.lineup_1, props.match?.lineup_2]) {
    for (const entry of lineup?.lineup_players ?? []) {
      const steamId = entry?.steam_id ? String(entry.steam_id) : null;
      if (!steamId || seen.has(steamId)) {
        continue;
      }
      seen.add(steamId);
      rows.push({
        steamId,
        name: entry.player?.name ?? entry.placeholder_name ?? steamId,
      });
    }
  }
  return rows;
});

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const selectedSteamId = ref<string>(EVERYONE);

// Fires once, on the first roster that has anybody in it: "you threw twelve" is
// the version of this that means something, so it opens on the viewer whenever
// the viewer played. After that the choice is the viewer's, and a later roster
// update must not drag it back.
const autoPicked = ref(false);

watch(
  [players, mySteamId],
  ([roster, me]) => {
    if (autoPicked.value || !roster.length) {
      return;
    }
    autoPicked.value = true;
    if (me && roster.some((entry) => entry.steamId === String(me))) {
      selectedSteamId.value = String(me);
    }
  },
  { immediate: true },
);

let loadGen = 0;

async function load() {
  const matchId = props.match?.id;
  if (!matchId) {
    report.value = null;
    return;
  }
  const gen = ++loadGen;
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: nadeMatchUtilityReportQuery,
      variables: {
        match_id: matchId,
        steam_id:
          selectedSteamId.value === EVERYONE ? null : selectedSteamId.value,
      },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    report.value = readNadeUtilityReport(
      (data as any)?.nadeMatchUtilityReport as
        | NadeUtilityReportOutput
        | undefined,
    );
  } catch (error) {
    if (gen === loadGen) {
      console.error("[nades] match utility report error:", error);
      report.value = null;
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => [props.match?.id, selectedSteamId.value], load, {
  immediate: true,
});

// The parser's own word for the utility, shown as it came when it is not one of
// the five this UI has names for.
function utilityLabel(nadeType: string) {
  return (NADE_TYPES as readonly string[]).includes(nadeType)
    ? t(`pages.nades.types.${nadeType}`)
    : humanizeNadeToken(nadeType) || nadeType;
}

const counters = computed(() => {
  const view = report.value;
  if (!view) {
    return [];
  }
  return [
    { key: "throws", label: t("match.nades.throws"), value: view.throws },
    {
      key: "matched_lineups",
      label: t("match.nades.matched_lineups"),
      value: view.matchedLineups,
    },
    {
      key: "matched_meta",
      label: t("match.nades.matched_meta"),
      value: view.matchedMeta,
    },
    { key: "landed", label: t("match.nades.landed"), value: view.landed },
  ];
});

type MatchGrenadeRow = {
  key: string;
  grenadeId: number;
  round: number;
  throwerSteamId: string;
  throwerName: string;
  nadeType: NadeType | null;
  rawType: string;
  /** Paired with a detonation in the same demo, by grenade id. */
  landed: boolean;
};

const matchMaps = computed<any[]>(() => props.match?.match_maps ?? []);

const selectedMapId = ref<string>("");

watch(
  matchMaps,
  (maps) => {
    if (!maps.length) {
      selectedMapId.value = "";
      return;
    }
    if (!maps.some((entry) => entry.id === selectedMapId.value)) {
      selectedMapId.value = maps[0].id;
    }
  },
  { immediate: true },
);

const activeMatchMap = computed(
  () =>
    matchMaps.value.find((entry) => entry.id === selectedMapId.value) ??
    matchMaps.value[0] ??
    null,
);

// The playback blob is a 1-3MB download. The report above never needs it, so
// nobody pays for it until they ask to see the grenades themselves.
const grenadesOpen = ref(false);
const grenadesLoading = ref(false);
const grenadesFailed = ref(false);
const grenadeRows = ref<MatchGrenadeRow[]>([]);
// Throws the demo recorded without a grenade id. They cannot be paired and
// cannot be saved, but they are counted and said out loud rather than dropped.
const unidentifiedThrows = ref(0);
const loadedMapId = ref<string | null>(null);
const visibleCount = ref(25);

const GRENADE_PAGE = 25;

const playerNames = computed(() => {
  const names: Record<string, string> = {};
  for (const entry of players.value) {
    names[entry.steamId] = entry.name;
  }
  return names;
});

let blobGen = 0;

async function loadGrenades() {
  const mapId = activeMatchMap.value?.id;
  if (!mapId || loadedMapId.value === mapId) {
    return;
  }
  const gen = ++blobGen;
  grenadesLoading.value = true;
  grenadesFailed.value = false;
  grenadeRows.value = [];
  unidentifiedThrows.value = 0;
  try {
    const { data } = await apolloClient.query({
      query: matchMovementMapQuery,
      variables: { matchMapId: mapId },
      fetchPolicy: "cache-first",
    });
    if (gen !== blobGen) {
      return;
    }
    const url: string | null =
      (data as any)?.match_maps_by_pk?.demos?.[0]?.playback_url ?? null;
    if (!url) {
      loadedMapId.value = mapId;
      return;
    }
    const blob = await fetchReplayBlob(url);
    if (gen !== blobGen) {
      return;
    }
    const grenades = normalizeBlobGrenades(blob?.grenade_throws ?? []);
    const detonated = new Set<number>();
    for (const grenade of grenades) {
      if (grenade.phase === "detonated" && grenade.grenade_id != null) {
        detonated.add(Number(grenade.grenade_id));
      }
    }
    const rows: MatchGrenadeRow[] = [];
    let unidentified = 0;
    for (const grenade of grenades) {
      if (grenade.phase !== "thrown") {
        continue;
      }
      if (grenade.grenade_id == null) {
        unidentified += 1;
        continue;
      }
      const grenadeId = Number(grenade.grenade_id);
      const steamId = String(grenade.thrower_steam_id ?? "");
      const rawType = String(grenade.type ?? "");
      rows.push({
        key: `${mapId}:${grenadeId}`,
        grenadeId,
        round: Number(grenade.round ?? 0),
        throwerSteamId: steamId,
        throwerName: playerNames.value[steamId] ?? steamId,
        nadeType: canonicalNadeType(rawType),
        rawType,
        landed: detonated.has(grenadeId),
      });
    }
    rows.sort((a, b) => a.round - b.round || a.grenadeId - b.grenadeId);
    grenadeRows.value = rows;
    unidentifiedThrows.value = unidentified;
    loadedMapId.value = mapId;
  } catch (error) {
    if (gen === blobGen) {
      console.error("[nades] match grenade load error:", error);
      grenadesFailed.value = true;
    }
  } finally {
    if (gen === blobGen) {
      grenadesLoading.value = false;
    }
  }
}

watch([grenadesOpen, () => activeMatchMap.value?.id], () => {
  if (grenadesOpen.value) {
    void loadGrenades();
  }
});

// The roster picker above is the same filter here: "the twelve you threw" is
// what somebody opening this is usually after.
const filteredGrenades = computed(() => {
  if (selectedSteamId.value === EVERYONE) {
    return grenadeRows.value;
  }
  return grenadeRows.value.filter(
    (row) => row.throwerSteamId === selectedSteamId.value,
  );
});

const visibleGrenades = computed(() =>
  filteredGrenades.value.slice(0, visibleCount.value),
);

watch([filteredGrenades, () => activeMatchMap.value?.id], () => {
  visibleCount.value = GRENADE_PAGE;
});

function grenadeTypeLabel(row: MatchGrenadeRow) {
  if (row.nadeType) {
    return t(`pages.nades.types.${row.nadeType}`);
  }
  return humanizeNadeToken(row.rawType) || t("common.unknown");
}

function grenadeColor(row: MatchGrenadeRow) {
  return row.nadeType ? NADE_TYPE_COLORS[row.nadeType] : "#8b93a5";
}

const saveTarget = ref<MatchGrenadeRow | null>(null);
const saveOpen = ref(false);

// Keyed by the row key, so a saved grenade turns into a link to what it became
// rather than an unchanged Save button.
const savedLineupIds = ref<Record<string, string>>({});

function openSave(row: MatchGrenadeRow) {
  saveTarget.value = row;
  saveOpen.value = true;
}

function onSaved(id: string) {
  const row = saveTarget.value;
  if (!row) {
    return;
  }
  savedLineupIds.value = { ...savedLineupIds.value, [row.key]: id };
  // The counters above count throws that matched a saved lineup, and one more
  // lineup now exists — leaving them alone would show a stale "matched" against
  // a library the viewer just changed.
  void load();
}

const saveDefaultName = computed(() => {
  const row = saveTarget.value;
  if (!row) {
    return "";
  }
  return t("match.nades.default_lineup_name", {
    utility: grenadeTypeLabel(row),
    round: row.round,
  });
});

const canSaveLineups = computed(() => !!mySteamId.value);
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <span :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses" />
              {{ $t("match.nades.title") }}
            </span>
            <span :class="tacticalSectionDescriptionClasses">
              {{ $t("match.nades.description") }}
            </span>
          </div>

          <Select v-model="selectedSteamId">
            <SelectTrigger class="h-8 w-[12rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="EVERYONE">
                {{ $t("match.nades.everyone") }}
              </SelectItem>
              <SelectItem
                v-for="entry of players"
                :key="entry.steamId"
                :value="entry.steamId"
              >
                {{ entry.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="loading" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Skeleton v-for="i in 4" :key="i" class="h-[4.25rem] w-full rounded-md" />
        </div>

        <!-- Not mined is not zero. A demo the parser has never opened has no
             throws to count, and printing "0 landed" against it would be
             reporting a result nobody measured. -->
        <div
          v-else-if="report && !report.analysed"
          class="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-4"
        >
          <Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div class="min-w-0 text-sm">
            <div class="font-medium">{{ $t("match.nades.not_analysed") }}</div>
            <p
              class="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground"
            >
              {{ report.message || $t("match.nades.not_analysed_description") }}
            </p>
          </div>
        </div>

        <div
          v-else-if="!report"
          class="rounded-md border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {{ $t("match.nades.failed") }}
        </div>

        <template v-else>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div
              v-for="counter of counters"
              :key="counter.key"
              class="rounded-md border border-border/60 bg-card/30 px-3 py-2.5"
            >
              <div
                class="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ counter.label }}
              </div>
              <div class="mt-1 text-xl font-bold tabular-nums">
                {{ counter.value }}
              </div>
            </div>
          </div>

          <p class="text-xs leading-relaxed text-muted-foreground">
            {{
              report.radius !== null
                ? $t("match.nades.match_note_radius", {
                    units: Math.round(report.radius),
                  })
                : $t("match.nades.match_note")
            }}
          </p>

          <div v-if="report.byType.length" class="overflow-x-auto">
            <Table class="min-w-full [&_td]:px-2 [&_th]:px-2">
              <TableHeader class="[&_th]:h-10 bg-muted/20">
                <TableRow>
                  <TableHead>{{ $t("match.nades.utility") }}</TableHead>
                  <TableHead class="text-right">
                    {{ $t("match.nades.throws") }}
                  </TableHead>
                  <TableHead class="text-right">
                    {{ $t("match.nades.matched") }}
                  </TableHead>
                  <TableHead class="text-right">
                    {{ $t("match.nades.landed") }}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row of report.byType" :key="row.nadeType">
                  <TableCell class="text-left">
                    {{ utilityLabel(row.nadeType) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ row.throws }}
                  </TableCell>
                  <TableCell
                    class="text-right tabular-nums text-muted-foreground"
                  >
                    {{ row.matched }}
                  </TableCell>
                  <TableCell class="text-right font-bold tabular-nums">
                    {{ row.landed }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div class="flex flex-col gap-2 border-t border-border/60 pt-3">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="flex min-w-0 flex-col gap-0.5">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {{ $t("match.nades.grenades.title") }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ $t("match.nades.grenades.description") }}
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                <Select v-if="matchMaps.length > 1" v-model="selectedMapId">
                  <SelectTrigger class="h-8 w-[10rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="entry of matchMaps"
                      :key="entry.id"
                      :value="entry.id"
                    >
                      {{ cleanMapName(entry.map?.name ?? "") }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  @click="grenadesOpen = !grenadesOpen"
                >
                  <Bomb class="mr-1 h-4 w-4" />
                  {{
                    grenadesOpen
                      ? $t("match.nades.grenades.hide")
                      : $t("match.nades.grenades.show")
                  }}
                </Button>
              </div>
            </div>

            <template v-if="grenadesOpen">
              <Skeleton v-if="grenadesLoading" class="h-40 w-full rounded-md" />

              <p
                v-else-if="grenadesFailed"
                class="text-xs text-muted-foreground"
              >
                {{ $t("match.nades.grenades.failed") }}
              </p>

              <p
                v-else-if="!grenadeRows.length"
                class="text-xs text-muted-foreground"
              >
                {{ $t("match.nades.grenades.empty") }}
              </p>

              <p
                v-else-if="!filteredGrenades.length"
                class="text-xs text-muted-foreground"
              >
                {{ $t("match.nades.grenades.none_for_player") }}
              </p>

              <template v-else>
                <div class="overflow-x-auto">
                  <Table class="min-w-full [&_td]:px-2 [&_th]:px-2">
                    <TableHeader class="[&_th]:h-10 bg-muted/20">
                      <TableRow>
                        <TableHead>{{ $t("common.round") }}</TableHead>
                        <TableHead>{{ $t("match.nades.utility") }}</TableHead>
                        <TableHead>{{ $t("common.player") }}</TableHead>
                        <TableHead class="text-right">
                          {{ $t("common.actions_label") }}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="row of visibleGrenades" :key="row.key">
                        <TableCell class="font-mono tabular-nums">
                          {{ row.round }}
                        </TableCell>
                        <TableCell>
                          <span class="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              :style="{ backgroundColor: grenadeColor(row) }"
                            />
                            {{ grenadeTypeLabel(row) }}
                            <!-- No detonation was paired with this throw, so
                                 where it ended up is not in the demo. -->
                            <span
                              v-if="!row.landed"
                              class="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground"
                              :title="
                                $t('match.nades.grenades.no_detonation_hint')
                              "
                            >
                              {{ $t("match.nades.grenades.no_detonation") }}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell class="max-w-[10rem] truncate">
                          {{ row.throwerName }}
                        </TableCell>
                        <TableCell class="text-right">
                          <NuxtLink
                            v-if="savedLineupIds[row.key]"
                            :to="{
                              name: 'nades-lineup-id',
                              params: { id: savedLineupIds[row.key] },
                            }"
                            class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
                          >
                            <ArrowUpRight class="h-3.5 w-3.5" />
                            {{ $t("match.nades.grenades.open_lineup") }}
                          </NuxtLink>
                          <Button
                            v-else-if="canSaveLineups"
                            variant="outline"
                            size="sm"
                            @click="openSave(row)"
                          >
                            <Save class="mr-1 h-3.5 w-3.5" />
                            {{ $t("match.nades.grenades.save") }}
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span
                    class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
                  >
                    {{
                      $t("match.nades.grenades.showing", {
                        shown: visibleGrenades.length,
                        total: filteredGrenades.length,
                      })
                    }}
                  </span>
                  <Button
                    v-if="visibleGrenades.length < filteredGrenades.length"
                    variant="outline"
                    size="sm"
                    @click="visibleCount += GRENADE_PAGE"
                  >
                    {{ $t("common.more") }}
                  </Button>
                </div>
              </template>

              <!-- Counted, not hidden: a throw with no id in the demo cannot be
                   turned into a lineup, and a list that quietly drops it looks
                   like a demo with fewer grenades in it. -->
              <p
                v-if="unidentifiedThrows > 0"
                class="text-[0.7rem] leading-snug text-muted-foreground"
              >
                {{
                  $t("match.nades.grenades.unidentified", {
                    count: unidentifiedThrows,
                  })
                }}
              </p>
            </template>
          </div>
        </template>
      </div>
    </CardContent>

    <NadeSaveLineupDialog
      v-model:open="saveOpen"
      source="demo"
      :match-id="match?.id ?? null"
      :match-map-id="activeMatchMap?.id ?? null"
      :grenade-id="saveTarget?.grenadeId ?? null"
      :default-name="saveDefaultName"
      @saved="onSaved"
    />
  </Card>
</template>
