<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
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
import TableSkeleton from "~/components/player/stats/TableSkeleton.vue";
import { resolveWeapon } from "~/utilities/weaponIcon";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { hltvColor } from "~/utils/statTiers";

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
}>();

function buildWhere(steamId: string = props.steamId) {
  const where: Record<string, any> = {
    player_steam_id: { _eq: steamId },
  };
  if (props.source && props.source !== "all") {
    where.source =
      props.source === "external" ? { _neq: "5stack" } : { _eq: "5stack" };
  }
  if (props.matchType) {
    where.type = {
      _in: Array.isArray(props.matchType)
        ? props.matchType
        : [props.matchType],
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
  try {
    const { data } = await apolloClient.query({
      query: playerWeaponStatsQuery,
      variables: {
        where: buildWhere(),
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    weaponKills.value = ((data as any)?.v_player_weapon_kills ??
      []) as RawWeaponKill[];
  } catch {
    if (gen === loadGen) {
      weaponKills.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }

  // Best-effort: per-weapon damage + rounds live in views/columns that may
  // not be deployed yet. If this fails the table still renders kills/usage.
  try {
    const where = buildWhere();
    const { data: extra } = await apolloClient.query({
      query: playerWeaponExtraQuery,
      variables: { whereDmg: where, whereKills: where },
      fetchPolicy: "network-only",
    });
    if (gen === loadGen) {
      weaponDamage.value = ((extra as any)?.v_player_weapon_damage ??
        []) as RawWeaponDamage[];
      weaponRounds.value = ((extra as any)?.v_player_weapon_kills ??
        []) as RawWeaponRounds[];
    }
  } catch {
    if (gen === loadGen) {
      weaponDamage.value = [];
      weaponRounds.value = [];
    }
  }
}

watch(
  () => [props.steamId, props.source, props.matchType],
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

// Comparison overlay — the pinned player's per-weapon usage %, keyed the same
// way so each row can show a "vs X%" next to the primary player's usage.
const { comparePlayer, compareData } = usePlayerComparison(
  playerWeaponStatsQuery,
  (steamId) => ({ where: buildWhere(steamId) }),
  (data: any) => (data?.v_player_weapon_kills ?? []) as RawWeaponKill[],
  () => [props.source, props.matchType],
);
const compareWeapon = computed(() => {
  const byKey = new Map<string, { kills: number; usage: number }>();
  const kills = (compareData.value ?? []).filter(
    (w) => !EXCLUDED_WEAPONS.has((w.with ?? "").toLowerCase().trim()),
  );
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
    <div :class="[tacticalSectionLabelClasses, 'mb-3']">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("pages.players.detail.weapons_table.section") }}
    </div>

    <FadeSwap>
      <TableSkeleton
        v-if="loading && !hasData"
        key="skeleton"
        :rows="10"
        :cols="hasExtra ? 7 : 3"
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
          <Table
            class="[&_th]:px-3 [&_td]:px-3 [&_th]:whitespace-nowrap"
          >
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
                  :title="$t('pages.players.detail.weapons_table.rating_tooltip')"
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
                  :title="$t('pages.players.detail.weapons_table.economy_tooltip')"
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
                  :title="$t('pages.players.detail.weapons_table.rounds_tooltip')"
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
