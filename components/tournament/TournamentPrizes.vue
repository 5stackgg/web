<script setup lang="ts">
import { computed } from "vue";
import { Trophy } from "lucide-vue-next";
import { Card } from "~/components/ui/card";
import { formatPrizePool } from "~/utilities/prizePool";

const props = defineProps<{
  prizes: Array<{
    id: string;
    place: string;
    prize: string;
    order?: number;
  }>;
}>();

// The podium shows the top three; anything below sits in a plain payout row.
const podium = computed(() => props.prizes.slice(0, 3));
const extras = computed(() => props.prizes.slice(3));
const pool = computed(() => formatPrizePool(props.prizes));

// Champion sits center, runner-up left, third right (desktop). Each rank drives
// its own accent, height and podium order.
const TIERS = [
  {
    label: "text-[hsl(var(--tac-amber))]",
    bar: "bg-[hsl(var(--tac-amber))]",
    amount: "text-[hsl(var(--tac-amber))] text-[1.7rem]",
    frame:
      "border-[hsl(var(--tac-amber)/0.4)] [background:linear-gradient(180deg,hsl(var(--tac-amber)/0.12),hsl(var(--card)/0.4))] sm:pt-7",
    order: "sm:order-2",
  },
  {
    label: "text-[hsl(220_9%_72%)]",
    bar: "bg-[hsl(220_9%_72%)]",
    amount: "",
    frame: "sm:pt-5",
    order: "sm:order-1",
  },
  {
    label: "text-[hsl(28_45%_52%)]",
    bar: "bg-[hsl(28_45%_52%)]",
    amount: "",
    frame: "",
    order: "sm:order-3",
  },
];
</script>

<template>
  <Card v-if="prizes && prizes.length > 0" class="overflow-hidden">
    <div class="flex flex-col gap-5 p-5">
      <div class="flex items-center gap-2">
        <Trophy class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
        <span
          class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("tournament.prizes.distribution") }}
        </span>
        <span
          v-if="pool"
          class="ml-auto font-sans text-base font-bold tabular-nums text-[hsl(var(--tac-amber))]"
        >
          {{ pool }}
        </span>
      </div>

      <div class="grid items-end gap-3 sm:grid-cols-3">
        <div
          v-for="(prize, index) in podium"
          :key="prize.id"
          :class="[
            'relative overflow-hidden rounded-lg border border-border bg-card/40 px-4 py-4 text-center [backdrop-filter:blur(6px)]',
            TIERS[index].frame,
            TIERS[index].order,
          ]"
        >
          <div
            :class="[
              'font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em]',
              TIERS[index].label,
            ]"
          >
            {{ prize.place || `#${index + 1}` }}
          </div>
          <div
            :class="[
              'mt-1 font-sans text-[1.35rem] font-bold leading-none tabular-nums',
              TIERS[index].amount,
            ]"
          >
            {{ prize.prize }}
          </div>
          <div
            :class="[
              'absolute inset-x-0 bottom-0 h-[3px]',
              TIERS[index].bar,
            ]"
          ></div>
        </div>
      </div>

      <ul
        v-if="extras.length > 0"
        class="flex flex-col divide-y divide-border/60 border-t border-dashed border-border pt-1"
      >
        <li
          v-for="prize in extras"
          :key="prize.id"
          class="flex items-center justify-between gap-4 py-2"
        >
          <span
            class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ prize.place }}
          </span>
          <span class="text-right text-sm font-medium">{{ prize.prize }}</span>
        </li>
      </ul>
    </div>
  </Card>
</template>
