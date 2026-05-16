<script lang="ts" setup>
import { HelpCircle } from "lucide-vue-next";
import LineupMember from "~/components/match/LineupMember.vue";

const tradeColumns: Array<{ label: string; tooltipKey: string }> = [
  { label: "trade_kill_opportunities", tooltipKey: "trade_kill_opportunities" },
  { label: "trade_kill_attempts", tooltipKey: "trade_kill_attempts" },
  { label: "trade_kill_pct", tooltipKey: "trade_kill_pct" },
  {
    label: "traded_death_opportunities",
    tooltipKey: "traded_death_opportunities",
  },
  { label: "traded_death_pct", tooltipKey: "traded_death_pct" },
  { label: "net_trade", tooltipKey: "net_trade" },
];
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[220px] text-left whitespace-nowrap">
          {{ lineup.name }}
        </TableHead>
        <TableHead
          v-for="col of tradeColumns"
          :key="col.label"
          class="whitespace-nowrap"
        >
          <TooltipProvider :delay-duration="100">
            <Tooltip>
              <TooltipTrigger class="inline-flex items-center gap-1">
                {{ $t(`match.lineup.stats.${col.label}`) }}
                <HelpCircle class="w-3 h-3 opacity-60" />
              </TooltipTrigger>
              <TooltipContent class="max-w-sm space-y-3">
                <div>
                  <div class="font-semibold">
                    {{
                      $t(`match.lineup.stats.tooltips.${col.tooltipKey}.title`)
                    }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.description`,
                      )
                    }}
                  </div>
                </div>
                <div>
                  <div class="font-semibold text-xs">
                    {{ $t("match.lineup.stats.calc_header") }}
                  </div>
                  <div class="text-xs mt-1 leading-snug">
                    {{
                      $t(
                        `match.lineup.stats.tooltips.${col.tooltipKey}.calculation`,
                      )
                    }}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="member of lineup.lineup_players">
        <TableCell>
          <lineup-member
            :member="member"
            :lineup_id="lineup.id"
          ></lineup-member>
        </TableCell>
        <TableCell>
          {{ statsFor(member)?.trade_kill_opportunities ?? "—" }}
        </TableCell>
        <TableCell>
          {{ statsFor(member)?.trade_kill_attempts ?? "—" }}
        </TableCell>
        <TableCell>
          <template v-if="tradeKillPct(member) !== null">
            {{ tradeKillPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          {{ statsFor(member)?.traded_death_opportunities ?? "—" }}
        </TableCell>
        <TableCell>
          <template v-if="tradedDeathPct(member) !== null">
            {{ tradedDeathPct(member) }}%
          </template>
          <template v-else>—</template>
        </TableCell>
        <TableCell>
          <template v-if="netTrade(member) !== null">
            <span
              :class="{
                'text-success': (netTrade(member) ?? 0) > 0,
                'text-destructive': (netTrade(member) ?? 0) < 0,
              }"
            >
              {{ (netTrade(member) ?? 0) > 0 ? "+" : "" }}{{ netTrade(member) }}
            </span>
          </template>
          <template v-else>—</template>
        </TableCell>
      </TableRow>
    </TableBody>
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
  methods: {
    statsFor(member: any) {
      const arr =
        member?.player?.match_map_stats ?? member?.player?.match_stats ?? null;
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
  },
};
</script>
