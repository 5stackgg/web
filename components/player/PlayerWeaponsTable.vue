<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  playerWeaponStatsQuery,
  playerWeaponExtraQuery,
} from "~/graphql/playerWeaponStatsGraphql";
import { usePlayerComparison } from "~/composables/usePlayerComparison";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import { useTableSort } from "~/composables/useTableSort";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { CardContent } from "~/components/ui/card";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import { useRememberedCount } from "~/composables/useRememberedCount";
import TableSkeleton from "~/components/player/stats/TableSkeleton.vue";
import { resolveWeapon } from "~/utilities/weaponIcon";
import { hltvColor } from "~/utils/statTiers";
import { schemaHasType } from "~/utilities/schemaHasType";

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
  limit?: number | null;
  since?: string | null;
  until?: string | null;
}>();

function sourceFilter() {
  if (!props.source || props.source === "all") return null;
  return props.source === "5stack"
    ? { _eq: "5stack" }
    : props.source === "external"
      ? { _neq: "5stack" }
      : props.source === "unknown"
        ? { _nin: ["5stack", "valve", "faceit"] }
        : { _eq: props.source };
}

function matchTypes() {
  if (!props.matchType) return null;
  return Array.isArray(props.matchType) ? props.matchType : [props.matchType];
}

function buildWhere(steamId: string = props.steamId) {
  const where: Record<string, any> = {
    player_steam_id: { _eq: steamId },
  };
  if (props.source && props.source !== "all") {
    where.source =
      props.source === "5stack"
        ? { _eq: "5stack" }
        : props.source === "external"
          ? { _neq: "5stack" }
          : props.source === "unknown"
            ? { _nin: ["5stack", "valve", "faceit"] }
            : { _eq: props.source };
  }
  if (props.matchType) {
    where.type = {
      _in: Array.isArray(props.matchType) ? props.matchType : [props.matchType],
    };
  }
  return where;
}

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

interface RawWeaponKill {
  with: string;
  kill_count: number | string;
}

// Per-match weapon rows let the table follow the stats range and a season
// compare. The career views above stay the fallback until these are deployed.
const WEAPON_MATCH_QUERY = gql`
  query PlayerWeaponMatchStats(
    $kills: v_player_weapon_match_kills_bool_exp!
    $damage: v_player_weapon_match_damage_bool_exp!
  ) {
    v_player_weapon_match_kills(where: $kills) {
      with
      kill_count
      rounds
    }
    v_player_weapon_match_damage(where: $damage) {
      with
      damage
    }
  }
`;

const RECENT_MATCHES_QUERY = gql`
  query PlayerWeaponRecentMatches($where: matches_bool_exp!, $limit: Int!) {
    matches(where: $where, order_by: { started_at: desc }, limit: $limit) {
      id
    }
  }
`;

function matchFilter(range: { since?: string | null; until?: string | null }) {
  const match: Record<string, any> = {};
  const source = sourceFilter();
  const types = matchTypes();
  if (source) match.source = source;
  if (types) match.options = { type: { _in: types } };
  if (range.since || range.until) {
    match.started_at = {
      ...(range.since ? { _gte: range.since } : {}),
      ...(range.until ? { _lte: range.until } : {}),
    };
  }
  return match;
}

async function loadWindowed(
  range: { since?: string | null; until?: string | null },
  limit: number | null,
) {
  if (!(await schemaHasType(apolloClient, "v_player_weapon_match_kills"))) {
    throw new Error("per-match weapon views not deployed");
  }
  let scope: Record<string, any>;
  if (limit && !range.since && !range.until) {
    const player = {
      lineup_players: { steam_id: { _eq: props.steamId } },
    };
    const { data } = await apolloClient.query({
      query: RECENT_MATCHES_QUERY,
      variables: {
        where: {
          ...matchFilter({}),
          status: { _eq: "Finished" },
          _or: [{ lineup_1: player }, { lineup_2: player }],
        },
        limit,
      },
      fetchPolicy: "network-only",
    });
    scope = {
      match_id: {
        _in: ((data as any)?.matches ?? []).map((m: any) => m.id),
      },
    };
  } else {
    scope = { match: matchFilter(range) };
  }
  const where = { player_steam_id: { _eq: props.steamId }, ...scope };
  const { data } = await apolloClient.query({
    query: WEAPON_MATCH_QUERY,
    variables: { kills: where, damage: where },
    fetchPolicy: "network-only",
  });
  return {
    kills: ((data as any)?.v_player_weapon_match_kills ?? []) as Array<
      RawWeaponKill & RawWeaponRounds
    >,
    damage: ((data as any)?.v_player_weapon_match_damage ??
      []) as RawWeaponDamage[],
  };
}

interface RawWeaponDamage {
  with: string;
  damage: number | string;
}

interface RawWeaponRounds {
  with: string;
  rounds: number | string;
}

interface WeaponRow {
  key: string;
  icon: string;
  label: string;
  kills: number;
  damage: number;
  rounds: number;
  adr: number | null;
  kpr: number | null;
  rating: number | null;
  economy: number | null;
}

// Static CS2 buy prices keyed by canonical weapon basename (the resolveWeapon
// key). Used only for the economy column (damage produced per $1k of weapon
// cost). Weapons with no buy price (knife / grenades / c4) get no economy.
const WEAPON_PRICE: Record<string, number> = {
  ak47: 2700,
  m4a1: 3000,
  m4a1_silencer: 2900,
  awp: 4750,
  famas: 2050,
  galilar: 1800,
  aug: 3300,
  sg556: 3000,
  ssg08: 1700,
  scar20: 5000,
  g3sg1: 5000,
  glock: 200,
  usp_silencer: 200,
  p2000: 200,
  p250: 300,
  deagle: 700,
  elite: 300,
  fiveseven: 500,
  cz75a: 500,
  tec9: 500,
  revolver: 600,
  mac10: 1050,
  mp9: 1250,
  mp7: 1500,
  mp5sd: 1500,
  ump45: 1200,
  p90: 2350,
  bizon: 1400,
  nova: 1050,
  xm1014: 2000,
  sawedoff: 1100,
  mag7: 1300,
  m249: 5200,
  negev: 1700,
  taser: 200,
};

// Directional rating from the terms we can derive per weapon (KPR + ADR +
// impact). NOT a true HLTV 2.0 rating — no per-weapon deaths or KAST — so
// it's labeled approximate in the UI.
function weaponRating(kpr: number | null, adr: number | null): number | null {
  if (kpr === null || adr === null) {
    return null;
  }
  const impact = 2.13 * kpr - 0.41;
  return 0.45 + 0.3591 * kpr + 0.2372 * impact + 0.0032 * adr;
}

const loading = ref(true);
const { skeleton: showSkeleton, refreshing } = useDeferredLoading(
  () => loading.value,
);
const { count: skeletonCount, remember: rememberCount } = useRememberedCount(
  () => `weapons:${props.steamId}`,
  12,
);
const weaponKills = ref<RawWeaponKill[]>([]);
const weaponDamage = ref<RawWeaponDamage[]>([]);
const weaponRounds = ref<RawWeaponRounds[]>([]);

let loadGen = 0;

async function load() {
  if (!props.steamId) {
    weaponKills.value = [];
    weaponDamage.value = [];
    weaponRounds.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  if (props.limit || props.since || props.until) {
    try {
      const windowed = await loadWindowed(
        { since: props.since, until: props.until },
        props.limit ?? null,
      );
      if (gen !== loadGen) {
        return;
      }
      weaponKills.value = windowed.kills;
      weaponRounds.value = windowed.kills;
      weaponDamage.value = windowed.damage;
      loading.value = false;
      return;
    } catch {
      // Per-match views not deployed yet: career totals below.
    }
    if (gen !== loadGen) {
      return;
    }
  }
  const where = buildWhere();
  // Best-effort: per-weapon damage + rounds live in views/columns that may
  // not be deployed yet. If that query fails the table still renders
  // kills/usage. Both land together so the extra columns never pop in late.
  const [kills, extra] = await Promise.allSettled([
    apolloClient.query({
      query: playerWeaponStatsQuery,
      variables: { where },
      fetchPolicy: "network-only",
    }),
    apolloClient.query({
      query: playerWeaponExtraQuery,
      variables: { whereDmg: where, whereKills: where },
      fetchPolicy: "network-only",
    }),
  ]);
  if (gen !== loadGen) {
    return;
  }
  const killsData = kills.status === "fulfilled" ? kills.value.data : null;
  const extraData = extra.status === "fulfilled" ? extra.value.data : null;
  weaponKills.value = ((killsData as any)?.v_player_weapon_kills ??
    []) as RawWeaponKill[];
  weaponDamage.value = ((extraData as any)?.v_player_weapon_damage ??
    []) as RawWeaponDamage[];
  weaponRounds.value = ((extraData as any)?.v_player_weapon_kills ??
    []) as RawWeaponRounds[];
  loading.value = false;
}

watch(
  () => [
    props.steamId,
    props.source,
    props.matchType,
    props.limit,
    props.since,
    props.until,
  ],
  load,
  { immediate: true },
);

const EXCLUDED_WEAPONS = new Set(["world", "planted_c4"]);

const includedKills = computed(() =>
  weaponKills.value.filter(
    (w) => !EXCLUDED_WEAPONS.has((w.with ?? "").toLowerCase().trim()),
  ),
);

function sumByWeaponKey(
  list: Array<{ with: string }>,
  valueOf: (x: any) => number,
): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const item of list) {
    if (EXCLUDED_WEAPONS.has((item.with ?? "").toLowerCase().trim())) {
      continue;
    }
    const r = resolveWeapon(item.with);
    byKey.set(r.key, (byKey.get(r.key) ?? 0) + (valueOf(item) || 0));
  }
  return byKey;
}

const damageByKey = computed(() =>
  sumByWeaponKey(weaponDamage.value, (d) => Number(d.damage)),
);
const roundsByKey = computed(() =>
  sumByWeaponKey(weaponRounds.value, (r) => Number(r.rounds)),
);

const rows = computed<WeaponRow[]>(() => {
  const merged = new Map<
    string,
    { key: string; icon: string; label: string; kills: number }
  >();
  for (const w of includedKills.value) {
    const r = resolveWeapon(w.with);
    const entry = merged.get(r.key) ?? { ...r, kills: 0 };
    entry.kills += Number(w.kill_count) || 0;
    merged.set(r.key, entry);
  }
  return [...merged.values()].map((entry) => {
    const damage = damageByKey.value.get(entry.key) ?? 0;
    const rounds = roundsByKey.value.get(entry.key) ?? 0;
    const adr = rounds > 0 ? damage / rounds : null;
    const kpr = rounds > 0 ? entry.kills / rounds : null;
    const price = WEAPON_PRICE[entry.key];
    const rating = weaponRating(kpr, adr);
    // Economy rating: the weapon rating adjusted for buy cost so producing
    // with a cheaper gun scores higher. Reference = AK ($2700); the gentle
    // exponent keeps it on a ~0.4–2.0 rating scale instead of raw $-ratios.
    const economy =
      rating !== null && price ? rating * Math.pow(2700 / price, 0.17) : null;
    return {
      ...entry,
      damage,
      rounds,
      adr,
      kpr,
      rating,
      economy,
    };
  });
});

const hasData = computed(() => rows.value.length > 0);

watch(loading, (isLoading) => {
  if (!isLoading) {
    rememberCount(rows.value.length);
  }
});

// Comparison overlay — the pinned player's per-weapon usage %, keyed the same
// way so each row can show a "vs X%" next to the primary player's usage.
const { comparePlayer, compareData } = usePlayerComparison(
  playerWeaponStatsQuery,
  (steamId) => ({ where: buildWhere(steamId) }),
  (data: any) => (data?.v_player_weapon_kills ?? []) as RawWeaponKill[],
  () => [props.source, props.matchType],
);
// The weapon views are career totals, so a season comparison counts that
// season's kills per weapon from player_kills: one aggregate per weapon.
const seasonKills = ref<RawWeaponKill[]>([]);
let seasonGen = 0;

async function loadSeasonKills() {
  const season = comparePlayer.value?.window;
  if (!season || !props.steamId) {
    seasonKills.value = [];
    return;
  }
  const gen = ++seasonGen;
  try {
    const windowed = await loadWindowed(season, null);
    if (gen === seasonGen) seasonKills.value = windowed.kills;
    return;
  } catch {
    // Per-match views not deployed yet: count kills per weapon below.
  }
  const weapons = [
    ...new Set(weaponKills.value.map((w) => w.with).filter(Boolean)),
  ];
  if (gen !== seasonGen || !weapons.length) {
    if (gen === seasonGen) seasonKills.value = [];
    return;
  }
  const match: Record<string, any> = {
    started_at: {
      _gte: season.since,
      ...(season.until ? { _lte: season.until } : {}),
    },
  };
  const { source, type } = buildWhere();
  if (source) match.source = source;
  if (type) match.options = { type };
  const variables: Record<string, any> = {};
  const params: string[] = [];
  const fields: string[] = [];
  weapons.forEach((weapon, i) => {
    variables[`w${i}`] = {
      attacker_steam_id: { _eq: props.steamId },
      with: { _eq: weapon },
      match,
    };
    params.push(`$w${i}: player_kills_bool_exp!`);
    fields.push(
      `w${i}: player_kills_aggregate(where: $w${i}) { aggregate { count } }`,
    );
  });
  try {
    const { data } = await apolloClient.query({
      query: gql(
        `query PlayerSeasonWeaponKills(${params.join(", ")}) { ${fields.join(" ")} }`,
      ),
      variables,
      fetchPolicy: "network-only",
    });
    if (gen !== seasonGen) return;
    seasonKills.value = weapons.map((weapon, i) => ({
      with: weapon,
      kill_count: (data as any)?.[`w${i}`]?.aggregate?.count ?? 0,
    }));
  } catch {
    if (gen === seasonGen) seasonKills.value = [];
  }
}

watch(
  () => [
    comparePlayer.value?.window?.season_id,
    props.source,
    props.matchType,
    weaponKills.value,
  ],
  loadSeasonKills,
  { immediate: true },
);

const compareWeapon = computed(() => {
  const byKey = new Map<string, { kills: number; usage: number }>();
  const kills = (
    (comparePlayer.value?.window ? seasonKills.value : compareData.value) ?? []
  ).filter((w) => !EXCLUDED_WEAPONS.has((w.with ?? "").toLowerCase().trim()));
  const killsByKey = new Map<string, number>();
  let total = 0;
  for (const w of kills) {
    const r = resolveWeapon(w.with);
    const k = Number(w.kill_count) || 0;
    killsByKey.set(r.key, (killsByKey.get(r.key) ?? 0) + k);
    total += k;
  }
  for (const [key, k] of killsByKey) {
    byKey.set(key, { kills: k, usage: total > 0 ? (k / total) * 100 : 0 });
  }
  return byKey;
});
const hasCompare = computed(
  () => !!comparePlayer.value && compareWeapon.value.size > 0,
);

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>(
  "kills",
  "desc",
);

const sortedRows = computed(() =>
  sortRows(rows.value, {
    weapon: (r) => r.label,
    kills: (r) => r.kills,
    rounds: (r) => r.rounds,
    adr: (r) => r.adr ?? -1,
    kpr: (r) => r.kpr ?? -1,
    rating: (r) => r.rating ?? -1,
    economy: (r) => r.economy ?? -1,
  }),
);

// Extra columns (ADR/KPR/Rounds) only show once the damage view + rounds
// column are deployed and returning data.
const hasExtra = computed(() => rows.value.some((r) => r.rounds > 0));

function fmt1(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}
function fmt2(n: number | null): string {
  return n === null ? "—" : n.toFixed(2);
}
function fmtInt(n: number | null): string {
  return n === null ? "—" : Math.round(n).toLocaleString();
}

function onIconError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = "none";
}
</script>

<template>
  <div>
    <FadeSwap
      class="transition-opacity duration-200"
      :class="refreshing && 'pointer-events-none opacity-50'"
    >
      <TableSkeleton
        v-if="showSkeleton"
        key="skeleton"
        :rows="skeletonCount"
        :cols="7"
      />

      <Empty
        v-else-if="!hasData"
        key="empty"
        class="min-h-[200px] border border-border/60"
      >
        <EmptyTitle>{{
          $t("pages.players.detail.weapons_table.empty_title")
        }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.players.detail.weapons_table.empty_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="content">
        <AnimatedCard variant="elevated" class="flex flex-col p-4">
          <CardContent class="p-0">
            <Table class="[&_th]:px-3 [&_td]:px-3 [&_th]:whitespace-nowrap">
              <TableHeader class="[&_th]:h-10 bg-muted/20">
                <TableRow>
                  <SortableTableHead
                    sort-key="weapon"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-left"
                    @sort="toggle"
                    >{{
                      $t("pages.players.detail.weapons_table.weapon")
                    }}</SortableTableHead
                  >
                  <SortableTableHead
                    sort-key="kills"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                    >{{
                      $t("pages.players.detail.weapons_table.kills")
                    }}</SortableTableHead
                  >
                  <SortableTableHead
                    v-if="hasExtra"
                    sort-key="rating"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    :title="
                      $t('pages.players.detail.weapons_table.rating_tooltip')
                    "
                    @sort="toggle"
                    ><StatLabel
                      stat="hltv"
                      :label="$t('pages.players.detail.weapons_table.rating')"
                  /></SortableTableHead>
                  <SortableTableHead
                    v-if="hasExtra"
                    sort-key="adr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                    ><StatLabel
                      stat="adr"
                      :label="$t('pages.players.detail.weapons_table.adr')"
                  /></SortableTableHead>
                  <SortableTableHead
                    v-if="hasExtra"
                    sort-key="economy"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    :title="
                      $t('pages.players.detail.weapons_table.economy_tooltip')
                    "
                    @sort="toggle"
                    >{{
                      $t("pages.players.detail.weapons_table.economy")
                    }}</SortableTableHead
                  >
                  <SortableTableHead
                    v-if="hasExtra"
                    sort-key="kpr"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    @sort="toggle"
                    ><StatLabel
                      stat="kpr"
                      :label="$t('pages.players.detail.weapons_table.kpr')"
                  /></SortableTableHead>
                  <SortableTableHead
                    v-if="hasExtra"
                    sort-key="rounds"
                    :active-key="sortKey"
                    :direction="sortDir"
                    class="text-right"
                    :title="
                      $t('pages.players.detail.weapons_table.rounds_tooltip')
                    "
                    @sort="toggle"
                    >{{
                      $t("pages.players.detail.weapons_table.rounds")
                    }}</SortableTableHead
                  >
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in sortedRows"
                  :key="row.key"
                  class="hover:bg-muted/40 transition-colors"
                >
                  <TableCell class="text-left">
                    <img
                      v-if="row.icon"
                      :src="row.icon"
                      :alt="row.label"
                      :title="row.label"
                      class="h-8 w-10 object-contain"
                      @error="onIconError"
                    />
                    <span v-else class="font-medium">{{ row.label }}</span>
                  </TableCell>
                  <TableCell class="text-right font-bold tabular-nums">
                    <AnimatedStat :value="row.kills" />
                    <div
                      v-if="hasCompare"
                      class="text-[0.6rem] font-normal"
                      style="color: #38bdf8"
                    >
                      {{ $t("pages.players.detail.compare.vs") }}
                      {{ compareWeapon.get(row.key)?.kills ?? 0 }}
                    </div>
                  </TableCell>
                  <TableCell
                    v-if="hasExtra"
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    <AnimatedStat
                      :value="fmt2(row.rating)"
                      :style="{ color: hltvColor(row.rating) }"
                    />
                  </TableCell>
                  <TableCell
                    v-if="hasExtra"
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    <AnimatedStat :value="fmt1(row.adr)" />
                  </TableCell>
                  <TableCell
                    v-if="hasExtra"
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    <AnimatedStat :value="fmt2(row.economy)" />
                  </TableCell>
                  <TableCell
                    v-if="hasExtra"
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    <AnimatedStat :value="fmt2(row.kpr)" />
                  </TableCell>
                  <TableCell
                    v-if="hasExtra"
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    <AnimatedStat :value="fmtInt(row.rounds)" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </AnimatedCard>
      </div>
    </FadeSwap>
  </div>
</template>
