<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Card, CardContent } from "~/components/ui/card";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { matchRolesQuery } from "~/graphql/playerMatchMapRolesGraphql";
import {
  normalizeViewRole,
  tallyRoles,
  type CombatRole,
} from "~/utilities/roleClassify";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";

interface Signals {
  rounds: number;
  awpShare: number;
  entryRate: number;
  supportIdx: number;
}

interface RolePlayer {
  steamId: string;
  player: any;
  role: CombatRole;
  sig: Signals;
}

interface ViewRow {
  match_map_id: string;
  steam_id: string | number;
  role: string;
  rounds: number;
  awp_share: number;
  entry_rate: number;
  support_idx: number;
}

const props = defineProps<{
  match: any;
  lineup: any;
  combineWith?: any;
  selectedMapId?: string | null;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const ROLE_META: Record<CombatRole, { color: string; bg: string }> = {
  sniper: { color: "rgb(167, 139, 250)", bg: "rgba(167, 139, 250, 0.12)" },
  entry: { color: "rgb(248, 113, 113)", bg: "rgba(248, 113, 113, 0.12)" },
  support: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" },
  rifler: { color: "rgb(148, 163, 184)", bg: "rgba(148, 163, 184, 0.1)" },
};

const ROLE_ORDER: CombatRole[] = ["sniper", "entry", "support", "rifler"];

const rows = ref<ViewRow[]>([]);
let loadGen = 0;

async function load() {
  const matchId = props.match?.id;
  if (!matchId) {
    rows.value = [];
    return;
  }
  const gen = ++loadGen;
  try {
    const { data } = await apolloClient.query({
      query: matchRolesQuery,
      variables: { matchId },
      fetchPolicy: "cache-first",
    });
    if (gen !== loadGen) {
      return;
    }
    rows.value = ((data as any)?.v_player_match_map_roles ?? []) as ViewRow[];
  } catch {
    if (gen === loadGen) {
      rows.value = [];
    }
  }
}

watch(() => props.match?.id, load, { immediate: true });

// Per-player aggregate scoped to the selected map (or all maps). The view's
// per-map role is authoritative for a single map; across maps we combine the
// signals (rounds-weighted) and re-classify with the shared rule.
const aggregatedBySteamId = computed(() => {
  const out = new Map<string, RolePlayer["sig"] & { role: CombatRole }>();
  const grouped = new Map<string, ViewRow[]>();
  for (const row of rows.value) {
    if (props.selectedMapId && row.match_map_id !== props.selectedMapId) {
      continue;
    }
    const sid = String(row.steam_id);
    const arr = grouped.get(sid);
    if (arr) {
      arr.push(row);
    } else {
      grouped.set(sid, [row]);
    }
  }
  for (const [sid, list] of grouped.entries()) {
    let rounds = 0;
    let wAwp = 0;
    let wEntry = 0;
    let wSupport = 0;
    for (const r of list) {
      const rr = Number(r.rounds ?? 0);
      rounds += rr;
      wAwp += Number(r.awp_share ?? 0) * rr;
      wEntry += Number(r.entry_rate ?? 0) * rr;
      wSupport += Number(r.support_idx ?? 0) * rr;
    }
    const sig = {
      rounds,
      awpShare: rounds ? wAwp / rounds : 0,
      entryRate: rounds ? wEntry / rounds : 0,
      supportIdx: rounds ? wSupport / rounds : 0,
    };
    // Per-map role is authoritative; across maps the player's dominant role
    // (most rounds) wins — same data the view already classified, just tallied.
    const role =
      list.length === 1
        ? normalizeViewRole(list[0].role)
        : (tallyRoles(list)[0]?.role ?? "rifler");
    out.set(sid, { ...sig, role });
  }
  return out;
});

function teamRoles(lineup: any): RolePlayer[] {
  if (!lineup) {
    return [];
  }
  const players: RolePlayer[] = [];
  for (const member of lineup.lineup_players ?? []) {
    if (!member.player) {
      continue;
    }
    const sid = String(member.steam_id ?? member.player?.steam_id ?? "");
    const agg = aggregatedBySteamId.value.get(sid);
    players.push({
      steamId: sid,
      player: member.player,
      role: agg?.role ?? "rifler",
      sig: {
        rounds: agg?.rounds ?? 0,
        awpShare: agg?.awpShare ?? 0,
        entryRate: agg?.entryRate ?? 0,
        supportIdx: agg?.supportIdx ?? 0,
      },
    });
  }
  return players.sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
}

const teams = computed(() =>
  [props.lineup, props.combineWith]
    .filter(Boolean)
    .map((lineup) => ({ lineup, players: teamRoles(lineup) })),
);

const hasData = computed(() =>
  teams.value.some((team) => team.players.some((p) => p.sig.rounds > 0)),
);

function roleLabel(role: CombatRole): string {
  return t(`match.roles.names.${role}`);
}

function bar(value: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <span :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("match.roles.title") }}
          </span>
          <span :class="tacticalSectionDescriptionClasses">
            {{ $t("match.roles.description") }}
          </span>
        </div>

        <div
          v-if="!hasData"
          class="rounded-md border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {{ $t("match.roles.no_data") }}
        </div>

        <div v-else class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="team of teams"
            :key="team.lineup.id"
            class="flex flex-col gap-2"
          >
            <span
              class="text-xs font-bold uppercase tracking-[0.14em] text-foreground/80 truncate"
            >
              {{ team.lineup.name }}
            </span>
            <div
              v-for="p of team.players"
              :key="p.steamId"
              class="rounded-md border border-border/60 bg-card/30 p-2.5"
            >
              <div class="flex items-center justify-between gap-2">
                <PlayerDisplay
                  :player="p.player"
                  size="xs"
                  :show-flag="false"
                  :show-role="false"
                  :linkable="true"
                />
                <span
                  class="shrink-0 rounded-sm px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em]"
                  :style="{
                    color: ROLE_META[p.role].color,
                    backgroundColor: ROLE_META[p.role].bg,
                  }"
                >
                  {{ roleLabel(p.role) }}
                </span>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <div
                  v-for="sig of [
                    {
                      key: 'awp',
                      label: $t('match.roles.signals.awp'),
                      pct: bar(p.sig.awpShare, 0.6),
                      value: Math.round(p.sig.awpShare * 100) + '%',
                      color: ROLE_META.sniper.color,
                    },
                    {
                      key: 'entry',
                      label: $t('match.roles.signals.entry'),
                      pct: bar(p.sig.entryRate, 0.6),
                      value: p.sig.entryRate.toFixed(2),
                      color: ROLE_META.entry.color,
                    },
                    {
                      key: 'support',
                      label: $t('match.roles.signals.support'),
                      pct: bar(p.sig.supportIdx, 1.5),
                      value: p.sig.supportIdx.toFixed(2),
                      color: ROLE_META.support.color,
                    },
                  ]"
                  :key="sig.key"
                  class="flex flex-col gap-1"
                >
                  <div
                    class="flex items-baseline justify-between gap-1 text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    <span>{{ sig.label }}</span>
                    <span class="tabular-nums text-foreground/80">
                      {{ sig.value }}
                    </span>
                  </div>
                  <div class="h-1.5 rounded-sm bg-muted/30 overflow-hidden">
                    <div
                      class="h-full rounded-sm transition-all"
                      :style="{
                        width: sig.pct + '%',
                        backgroundColor: sig.color,
                      }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
