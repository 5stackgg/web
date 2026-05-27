<script lang="ts" setup>
import { Crosshair } from "lucide-vue-next";

const props = defineProps<{
  premierRank: number | null | undefined;
  premierRankUpdatedAt?: string | null;
}>();

type Tier = {
  min: number;
  bgFrom: string;
  bgTo: string;
  border: string;
  text: string;
};

const TIERS: Tier[] = [
  {
    min: 30000,
    bgFrom: "hsl(45 95% 58%)",
    bgTo: "hsl(38 95% 45%)",
    border: "hsl(45 90% 65%)",
    text: "hsl(48 30% 12%)",
  },
  {
    min: 25000,
    bgFrom: "hsl(0 75% 55%)",
    bgTo: "hsl(0 75% 38%)",
    border: "hsl(0 70% 65%)",
    text: "hsl(0 0% 100%)",
  },
  {
    min: 20000,
    bgFrom: "hsl(322 72% 55%)",
    bgTo: "hsl(322 72% 38%)",
    border: "hsl(322 70% 65%)",
    text: "hsl(0 0% 100%)",
  },
  {
    min: 15000,
    bgFrom: "hsl(285 65% 58%)",
    bgTo: "hsl(285 65% 40%)",
    border: "hsl(285 65% 70%)",
    text: "hsl(0 0% 100%)",
  },
  {
    min: 10000,
    bgFrom: "hsl(258 65% 60%)",
    bgTo: "hsl(258 65% 42%)",
    border: "hsl(258 65% 72%)",
    text: "hsl(0 0% 100%)",
  },
  {
    min: 5000,
    bgFrom: "hsl(215 72% 55%)",
    bgTo: "hsl(215 72% 38%)",
    border: "hsl(215 70% 68%)",
    text: "hsl(0 0% 100%)",
  },
  {
    min: 0,
    bgFrom: "hsl(0 0% 55%)",
    bgTo: "hsl(0 0% 35%)",
    border: "hsl(0 0% 65%)",
    text: "hsl(0 0% 100%)",
  },
];

const hasRank = computed(
  () => (props.premierRank ?? null) !== null && props.premierRank! > 0,
);

const tier = computed<Tier>(() => {
  const rank = props.premierRank ?? 0;
  return TIERS.find((t) => rank >= t.min) ?? TIERS[TIERS.length - 1];
});

const badgeStyle = computed(() => ({
  background: `linear-gradient(135deg, ${tier.value.bgFrom} 0%, ${tier.value.bgTo} 100%)`,
  borderColor: tier.value.border,
  color: tier.value.text,
  boxShadow: `0 0 0 1px ${tier.value.border}, 0 6px 14px -8px ${tier.value.bgTo}`,
}));

const iconStyle = computed(() => ({
  color: tier.value.text,
  opacity: 0.85,
}));

const titleText = computed(() => {
  if (!hasRank.value) {
    return "";
  }
  const parts = [`CS2 Premier ${props.premierRank!.toLocaleString()}`];
  if (props.premierRankUpdatedAt) {
    parts.push(
      `as of ${new Date(props.premierRankUpdatedAt).toLocaleString()}`,
    );
  }
  return parts.join(" • ");
});
</script>

<template>
  <span
    v-if="hasRank"
    class="inline-flex select-none items-stretch leading-none [clip-path:polygon(8%_0,100%_0,92%_100%,0_100%)] border font-sans"
    :style="badgeStyle"
    :title="titleText"
  >
    <span
      class="inline-flex items-center gap-1 px-3 py-[0.3rem] font-bold tabular-nums tracking-[0.02em] text-[0.78rem]"
    >
      <Crosshair class="h-3 w-3" :style="iconStyle" aria-hidden="true" />
      <span>{{ premierRank!.toLocaleString() }}</span>
    </span>
  </span>
</template>
