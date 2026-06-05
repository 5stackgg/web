<script lang="ts" setup>
import { computed } from "vue";
import LineupMember from "~/components/match/LineupMember.vue";
import SortableTableHead from "~/components/common/SortableTableHead.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { useTableSort } from "~/composables/useTableSort";
import { useTradeColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";

const { visibility: tradeVis } = useTradeColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();

const { sortKey, sortDir, toggle, sortRows } = useTableSort<string>();

function pickStats(member: any) {
  const arr =
    member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

const sortGetters: Record<string, (m: any) => unknown> = {
  trade_kill_opportunities: (m) => pickStats(m)?.trade_kill_opportunities ?? -1,
  trade_kill_attempts: (m) => pickStats(m)?.trade_kill_attempts ?? -1,
  trade_kill_pct: (m) => {
    const s = pickStats(m);
    if (!s?.trade_kill_opportunities) return -1;
    return (s.trade_kill_successes ?? 0) / s.trade_kill_opportunities;
  },
  traded_death_opportunities: (m) =>
    pickStats(m)?.traded_death_opportunities ?? -1,
  traded_death_attempts: (m) => pickStats(m)?.traded_death_attempts ?? -1,
  traded_death_pct: (m) => {
    const s = pickStats(m);
    if (!s?.traded_death_opportunities) return -1;
    return (s.traded_death_successes ?? 0) / s.traded_death_opportunities;
  },
  net_trade: (m) => {
    const s = pickStats(m);
    if (!s) return -1;
    return (
      (s.trade_kill_successes ?? 0) -
      ((s.traded_death_opportunities ?? 0) - (s.traded_death_successes ?? 0))
    );
  },
};

const allTradeColumns: Array<{ label: string; tooltipKey: string }> = [
  { label: "trade_kill_opportunities", tooltipKey: "trade_kill_opportunities" },
  { label: "trade_kill_attempts", tooltipKey: "trade_kill_attempts" },
  { label: "trade_kill_pct", tooltipKey: "trade_kill_pct" },
  {
    label: "traded_death_opportunities",
    tooltipKey: "traded_death_opportunities",
  },
  { label: "traded_death_attempts", tooltipKey: "traded_death_attempts" },
  { label: "traded_death_pct", tooltipKey: "traded_death_pct" },
  { label: "net_trade", tooltipKey: "net_trade" },
];

const tradeColumns = computed(() =>
  allTradeColumns.filter(
    (c) =>
      c.label === "trade_kill_opportunities" ||
      tradeVis.value[c.label] !== false,
  ),
);
</script>

<template>
  <Table
    class="min-w-full w-max [&_td]:whitespace-nowrap [&_th]:px-2 [&_td]:px-2 [&_th.sticky+th]:!pl-5 [&_td.sticky+td]:!pl-5"
  >
    <template v-for="(lp, lpIdx) of lineupsToRender" :key="lp.id">
      <TableHeader
        :class="[
          '[&_th]:h-12 bg-muted/20',
          lpIdx > 0 ? '[&_th]:pt-7 border-t-[3px] border-border/80' : '',
        ]"
      >
        <TableRow>
          <TableHead
            v-if="!hideMember"
            class="w-[110px] md:w-[220px] text-left whitespace-nowrap sticky left-0 z-20 bg-card border-r border-border shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)] [transform:translateZ(0)]"
          >
            {{ lp.name }}
          </TableHead>
          <SortableTableHead
            v-for="col of tradeColumns"
            :key="col.label"
            :sort-key="col.label"
            :active-key="sortKey"
            :direction="sortDir"
            class="whitespace-nowrap"
            @sort="toggle"
          >
            <Tooltip>
              <TooltipTrigger
                class="inline-flex items-center gap-1 underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground"
              >
                {{ $t(`match.lineup.stats.${col.label}`) }}
              </TooltipTrigger>
              <TooltipContent class="max-w-sm space-y-3">
                <div>
                  <div
                    class="font-mono text-[0.7rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
                  >
                    {{
                      $t(`match.lineup.stats.tooltips.${col.tooltipKey}.title`)
                    }}
                  </div>
                  <div class="text-xs mt-1 leading-snug text-foreground/90">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.description`,
                      )
                    }}
                  </div>
                </div>
                <div class="pt-2 border-t border-border/60">
                  <div
                    class="font-mono text-[0.65rem] font-bold tracking-[0.18em] uppercase text-muted-foreground"
                  >
                    {{ $t("match.lineup.stats.calc_header") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug text-foreground/80">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.calculation`,
                      )
                    }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </SortableTableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="member of sortRows(lp.lineup_players, sortGetters)"
          :class="['group', rowClass(member)]"
        >
          <TableCell
            v-if="!hideMember"
            :class="[
              'w-[110px] md:w-[220px] sticky left-0 z-10 border-r border-border [transform:translateZ(0)]',
              stickyCellClass(member) ||
                'bg-card group-hover:bg-muted shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]',
            ]"
          >
            <lineup-member :member="member" :lineup_id="lp.id"></lineup-member>
          </TableCell>
          <TableCell>
            <AnimatedStat
              :value="statsFor(member)?.trade_kill_opportunities ?? '—'"
            />
          </TableCell>
          <TableCell v-if="tradeVis.trade_kill_attempts !== false">
            <AnimatedStat
              :value="statsFor(member)?.trade_kill_attempts ?? '—'"
            />
          </TableCell>
          <TableCell v-if="tradeVis.trade_kill_pct !== false">
            <AnimatedStat
              :value="
                tradeKillPct(member) !== null
                  ? tradeKillPct(member) + '%'
                  : '—'
              "
            />
          </TableCell>
          <TableCell v-if="tradeVis.traded_death_opportunities !== false">
            <AnimatedStat
              :value="statsFor(member)?.traded_death_opportunities ?? '—'"
            />
          </TableCell>
          <TableCell v-if="tradeVis.traded_death_attempts !== false">
            <AnimatedStat
              :value="statsFor(member)?.traded_death_attempts ?? '—'"
            />
          </TableCell>
          <TableCell v-if="tradeVis.traded_death_pct !== false">
            <AnimatedStat
              :value="
                tradedDeathPct(member) !== null
                  ? tradedDeathPct(member) + '%'
                  : '—'
              "
            />
          </TableCell>
          <TableCell v-if="tradeVis.net_trade !== false">
            <span
              v-if="netTrade(member) !== null"
              :class="{
                'text-success': (netTrade(member) ?? 0) > 0,
                'text-destructive': (netTrade(member) ?? 0) < 0,
              }"
            >
              <AnimatedStat
                :value="
                  ((netTrade(member) ?? 0) > 0 ? '+' : '') + netTrade(member)
                "
              />
            </span>
            <template v-else>—</template>
          </TableCell>
        </TableRow>
      </TableBody>
    </template>
  </Table>
</template>

<script lang="ts">
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return Math.round((num / den) * 100);
}

export default {
  computed: {
    lineupsToRender(): any[] {
      return this.combineWith ? [this.lineup, this.combineWith] : [this.lineup];
    },
  },
  methods: {
    statsFor(member: any) {
      const arr =
        member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    tradeKillPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(
        toNumber(s?.trade_kill_successes),
        toNumber(s?.trade_kill_opportunities),
      );
    },
    tradedDeathPct(member: any): number | null {
      const s = this.statsFor(member);
      return pct(
        toNumber(s?.traded_death_successes),
        toNumber(s?.traded_death_opportunities),
      );
    },
    netTrade(member: any): number | null {
      const s = this.statsFor(member);
      const successes = toNumber(s?.trade_kill_successes);
      const opps = toNumber(s?.traded_death_opportunities);
      const traded = toNumber(s?.traded_death_successes);
      if (successes === null || opps === null || traded === null) return null;
      // Trades you completed minus untraded deaths you suffered.
      return successes - (opps - traded);
    },
  },
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    combineWith: {
      type: Object,
      default: null,
    },
    hideMember: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
