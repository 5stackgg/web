<script setup lang="ts">
import { computed } from "vue";
import { formatPrizePool } from "~/utilities/prizePool";
import { ordinal } from "~/utilities/tournamentPlayerRank";

const props = defineProps<{ prizes?: any[] | null }>();

const pool = computed(() => formatPrizePool(props.prizes));
</script>

<template>
  <div v-if="prizes?.length" class="grid gap-2.5">
    <p class="m-0 text-xs text-muted-foreground">
      {{
        pool
          ? $t("pages.tournaments.prize_pool_total", { amount: pool })
          : $t("tournament.stats.prize_pool")
      }}
    </p>
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="(prize, index) in prizes"
        :key="index"
        class="grid min-w-0 gap-0.5 rounded-md bg-muted/35 px-3 py-2.5"
      >
        <span class="truncate text-xs text-muted-foreground">
          {{ prize.place || ordinal(index + 1) }}
        </span>
        <b
          class="truncate text-base font-bold tabular-nums"
          :class="{ 'text-[hsl(var(--tac-amber))]': index === 0 }"
        >
          {{ prize.prize }}
        </b>
      </div>
    </div>
  </div>
</template>
