<script lang="ts" setup>
const props = defineProps<{
  faceitSkillLevel: number | null | undefined;
  faceitElo: number | null | undefined;
  faceitUrl?: string | null;
  faceitNickname?: string | null;
}>();

// Official FACEIT skill-level color bands (level 1 grey → 10 red).
const LEVEL_COLORS: { max: number; color: string }[] = [
  { max: 1, color: "hsl(0 0% 88%)" },
  { max: 3, color: "hsl(125 90% 45%)" },
  { max: 7, color: "hsl(45 100% 50%)" },
  { max: 9, color: "hsl(22 100% 52%)" },
  { max: 10, color: "hsl(8 95% 50%)" },
];

const levelColor = computed(() => {
  const level = props.faceitSkillLevel ?? 0;
  return (
    LEVEL_COLORS.find((b) => level <= b.max)?.color ?? LEVEL_COLORS[0].color
  );
});

// Same boxed pill as ELO / RANK / Premier, border tinted with the level color.
const wrapperStyle = computed(() => ({
  borderColor: `color-mix(in srgb, ${levelColor.value} 40%, transparent)`,
  backgroundColor: "hsl(var(--card) / 0.55)",
}));

const wrapperClasses = [
  "group/faceit relative inline-flex items-center gap-1.5 select-none leading-none",
  "h-[26px] px-[0.6rem] rounded border",
  "[backdrop-filter:blur(6px)]",
  "transition-[border-color,box-shadow] duration-150",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(0_0%_100%/0.2)]",
].join(" ");

const sepClasses = "h-3 w-px bg-border/70 self-center shrink-0";

// Circular numbered badge: a conic-gradient arc (filled proportion = level/10)
// sits behind an inset disc so only the colored ring shows.
const badgeStyle = computed(() => {
  const level = props.faceitSkillLevel ?? 0;
  const deg = Math.max(0, Math.min(10, level)) * 36;
  return {
    background: `conic-gradient(${levelColor.value} ${deg}deg, color-mix(in srgb, ${levelColor.value} 22%, transparent) ${deg}deg)`,
  };
});

const badgeNumberStyle = computed(() => ({
  color: levelColor.value,
  textShadow: `0 0 8px color-mix(in srgb, ${levelColor.value} 40%, transparent)`,
}));

// `inline-grid` + columns going from `0fr` to `1fr` animates to the
// natural content width (not an estimate), so the reveal moves at a
// steady rate the whole way — `max-width` snapped because the visible
// width was capped by the content well before the transition finished.
const eloRevealClasses = [
  "self-center inline-grid grid-cols-[0fr] opacity-0",
  "transition-[grid-template-columns,opacity,margin-left] duration-300 ease-out",
  "-ml-1.5",
  "group-hover/faceit:grid-cols-[1fr] group-hover/faceit:opacity-100 group-hover/faceit:ml-0",
  "group-focus-visible/faceit:grid-cols-[1fr] group-focus-visible/faceit:opacity-100 group-focus-visible/faceit:ml-0",
].join(" ");

const eloInnerClasses =
  "min-w-0 overflow-hidden inline-flex items-center gap-1.5";

const eloClasses =
  "font-mono text-[0.6rem] font-semibold uppercase tabular-nums tracking-[0.14em] text-[hsl(28_95%_55%/0.9)] whitespace-nowrap";

const hasFaceit = computed(() => (props.faceitSkillLevel ?? null) !== null);

const titleText = computed(() => {
  const parts: string[] = ["Faceit"];
  if (props.faceitNickname) {
    parts.push(props.faceitNickname);
  }
  if ((props.faceitSkillLevel ?? null) !== null) {
    parts.push(`Level ${props.faceitSkillLevel}`);
  }
  if ((props.faceitElo ?? null) !== null) {
    parts.push(`${props.faceitElo!.toLocaleString()} ELO`);
  }
  return parts.join(" • ");
});
</script>

<template>
  <a
    v-if="hasFaceit"
    :href="faceitUrl || undefined"
    :target="faceitUrl ? '_blank' : undefined"
    :rel="faceitUrl ? 'noopener noreferrer' : undefined"
    :class="wrapperClasses"
    :style="wrapperStyle"
    :title="titleText"
    @click.stop
  >
    <template v-if="(faceitSkillLevel ?? null) !== null">
      <span
        class="relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
        :style="badgeStyle"
      >
        <span
          class="absolute inset-[2px] rounded-full bg-[hsl(240_8%_10%)]"
        ></span>
        <span
          class="relative font-mono text-[0.62rem] font-bold tabular-nums leading-none"
          :style="badgeNumberStyle"
          >{{ faceitSkillLevel }}</span
        >
      </span>
    </template>
    <span v-if="(faceitElo ?? null) !== null" :class="eloRevealClasses">
      <span :class="eloInnerClasses">
        <span :class="sepClasses" aria-hidden="true"></span>
        <span :class="eloClasses">{{ faceitElo!.toLocaleString() }} ELO</span>
      </span>
    </span>
  </a>
</template>
