<script setup lang="ts">
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import type { ReplayTeamBuy } from "~/composables/useReplayAnalysis";
import { formatMoney, formatMoneyShort } from "~/utilities/replayAnalysis/buy";

defineProps<{ buy: ReplayTeamBuy; compact?: boolean }>();
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span class="buy" :class="`buy--${buy.type}`">
        <span class="type">{{
          $t(`match.replay.analysis.buy_${buy.type}`)
        }}</span>
        <span v-if="!compact" class="val">{{
          formatMoneyShort(buy.value)
        }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent>
      <div>
        {{
          $t("match.replay.analysis.equipment_value", {
            value: formatMoney(buy.value),
          })
        }}
      </div>
      <div v-if="buy.start != null">
        {{
          $t("match.replay.analysis.start_money", {
            value: formatMoney(buy.start),
          })
        }}
      </div>
    </TooltipContent>
  </Tooltip>
</template>

<style scoped>
.buy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 1px 6px;
  border: 1px solid var(--line, rgba(120, 140, 165, 0.18));
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 14px;
  white-space: nowrap;
  cursor: default;
}
.type {
  color: #cfd8e3;
}
.val {
  color: #7f8fa0;
  font-variant-numeric: tabular-nums;
}
.buy--full .type {
  color: hsl(var(--success) / 0.9);
}
.buy--eco .type,
.buy--pistol .type {
  color: #9fb0c0;
}
</style>
