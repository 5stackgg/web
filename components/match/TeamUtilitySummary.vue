<script lang="ts" setup>
import { computed } from "vue";

const props = defineProps<{
  lineup: any;
}>();

function pickStats(member: any) {
  const arr =
    member?.player?.match_stats ?? member?.player?.match_map_stats ?? null;
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

function sumField(field: string): number {
  let total = 0;
  for (const member of props.lineup?.lineup_players ?? []) {
    const s = pickStats(member);
    const v = Number(s?.[field]);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

const teamUtility = computed(() => {
  const flashes = sumField("flashes_thrown");
  const smokes = sumField("smoke_throws");
  const hes = sumField("he_throws");
  const molotovs = sumField("molotov_throws");
  const total = flashes + smokes + hes + molotovs;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    total,
    flashes,
    smokes,
    hes,
    molotovs,
    flashesPct: pct(flashes),
    smokesPct: pct(smokes),
    hesPct: pct(hes),
    molotovsPct: pct(molotovs),
  };
});
</script>

<template>
  <div v-if="teamUtility.total > 0" class="flex flex-wrap items-center gap-2">
    <div
      class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-border rounded-sm bg-[hsl(var(--card)/0.5)] font-mono text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground leading-none"
    >
      <span class="font-bold text-foreground tabular-nums text-[0.85rem]">{{
        teamUtility.total
      }}</span>
      <span>{{ $t("match.lineup.stats.utility_summary_total") }}</span>
    </div>
    <div
      v-for="pill of [
        {
          key: 'flash',
          icon: '/img/equipment/flashbang.svg',
          count: teamUtility.flashes,
          pct: teamUtility.flashesPct,
          label: $t('match.lineup.stats.utility_summary_flashes'),
        },
        {
          key: 'smoke',
          icon: '/img/equipment/smokegrenade.svg',
          count: teamUtility.smokes,
          pct: teamUtility.smokesPct,
          label: $t('match.lineup.stats.utility_summary_smokes'),
        },
        {
          key: 'he',
          icon: '/img/equipment/hegrenade.svg',
          count: teamUtility.hes,
          pct: teamUtility.hesPct,
          label: $t('match.lineup.stats.utility_summary_hes'),
        },
        {
          key: 'molotov',
          icon: '/img/equipment/molotov.svg',
          count: teamUtility.molotovs,
          pct: teamUtility.molotovsPct,
          label: $t('match.lineup.stats.utility_summary_molotovs'),
        },
      ]"
      :key="pill.key"
      class="inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-sm bg-[hsl(var(--card)/0.5)]"
    >
      <NuxtImg
        :src="pill.icon"
        :alt="pill.key"
        class="w-4 h-4 shrink-0 opacity-80"
        aria-hidden="true"
      />
      <span
        class="font-mono text-[0.85rem] font-bold tabular-nums leading-none text-foreground"
      >
        {{ pill.count }}
      </span>
      <span
        class="font-mono text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground leading-none"
      >
        {{ pill.label }}
      </span>
      <span
        class="font-mono text-[0.65rem] tabular-nums tracking-[0.1em] text-muted-foreground/80 leading-none"
      >
        · {{ pill.pct }}%
      </span>
    </div>
  </div>
</template>
