<script setup lang="ts">
import { computed } from "vue";
import AnimatedStat from "~/components/AnimatedStat.vue";

// 5stack.gg only: the server route answers null on every other panel.
const { data } = await useFetch<{ matches: number; players: number } | null>(
  "/api/network-stats",
  { key: "network-stats", default: () => null },
);

const stats = computed(() =>
  data.value
    ? [
        {
          key: "matches",
          value: data.value.matches.toLocaleString(),
          label: "pages.welcome.network.matches",
        },
        {
          key: "players",
          value: data.value.players.toLocaleString(),
          label: "pages.welcome.network.players",
        },
      ]
    : [],
);
</script>

<template>
  <section
    v-if="stats.length"
    class="mx-auto max-w-[1320px] px-8 pb-6 max-sm:px-4"
    :aria-label="$t('pages.welcome.network.label')"
  >
    <div class="grid gap-3.5 sm:grid-cols-2">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="rounded-[14px] border border-border bg-card/60 px-8 py-7 max-sm:px-6"
      >
        <AnimatedStat
          :value="stat.value"
          :stagger="40"
          class="text-[52px] font-bold leading-none tabular-nums tracking-[-0.01em] max-sm:text-[40px]"
        />
        <p class="m-0 mt-2 text-[15px] text-muted-foreground">
          {{ $t(stat.label) }}
        </p>
      </div>
    </div>
    <p class="m-0 mt-1.5 text-right text-xs text-muted-foreground">
      {{ $t("pages.welcome.network.caption") }}
    </p>
  </section>
</template>
