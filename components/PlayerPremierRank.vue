<script lang="ts" setup>
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

// Same boxed pill as ELO / RANK / FACEIT, tinted with the tier color.
const wrapperClasses = [
  "inline-flex items-center gap-1.5 select-none leading-none font-sans",
  "h-[26px] px-[0.6rem] rounded border",
  "[backdrop-filter:blur(6px)]",
].join(" ");

const wrapperStyle = computed(() => ({
  borderColor: `color-mix(in srgb, ${tier.value.bgFrom} 40%, transparent)`,
  backgroundColor: "hsl(var(--card) / 0.55)",
}));

const barStyle = computed(() => ({
  background: `linear-gradient(135deg, ${tier.value.bgFrom} 0%, ${tier.value.bgTo} 100%)`,
  boxShadow: `0 0 8px ${tier.value.bgFrom}`,
}));

const sepClasses = "h-3 w-px bg-border/70 shrink-0";

const numberStyle = computed(() => ({
  color: tier.value.bgFrom,
  textShadow: `0 0 10px ${tier.value.bgTo}`,
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
    :class="wrapperClasses"
    :style="wrapperStyle"
    :title="titleText"
  >
    <span class="inline-flex items-center gap-[3px]" aria-hidden="true">
      <span
        class="block h-[15px] w-[5px] [transform:skewX(-18deg)] rounded-[1px]"
        :style="barStyle"
      ></span>
      <span
        class="block h-[15px] w-[5px] [transform:skewX(-18deg)] rounded-[1px]"
        :style="barStyle"
      ></span>
    </span>
    <span :class="sepClasses" aria-hidden="true"></span>
    <span
      class="font-mono text-[0.75rem] font-bold tabular-nums tracking-[0.04em]"
      :style="numberStyle"
      >{{ premierRank!.toLocaleString() }}</span
    >
  </span>
</template>
