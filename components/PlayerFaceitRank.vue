<script lang="ts" setup>
const props = defineProps<{
  faceitSkillLevel: number | null | undefined;
  faceitElo: number | null | undefined;
  faceitUrl?: string | null;
  faceitNickname?: string | null;
}>();

const wrapperClasses = [
  "group/faceit relative inline-flex items-center gap-1.5 select-none leading-none",
  "px-[0.55rem] py-[0.25rem] rounded",
  "border border-[hsl(28_95%_55%/0.45)] bg-[hsl(28_95%_55%/0.08)]",
  "[backdrop-filter:blur(6px)]",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-[hsl(28_95%_55%/0.85)]",
  "hover:shadow-[0_0_0_1px_hsl(28_95%_55%/0.25),0_6px_18px_-8px_hsl(28_95%_55%/0.55)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28_95%_55%/0.5)]",
].join(" ");

const logoClasses =
  "block h-[11px] w-[11px] shrink-0 self-center object-contain";

const sepClasses = "h-2.5 w-px bg-border/70 self-center shrink-0";

const levelClasses =
  "self-center font-mono text-[0.7rem] font-bold tabular-nums tracking-[0.04em] text-[hsl(28_95%_60%)] [text-shadow:0_0_10px_hsl(28_95%_55%/0.35)]";

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
    :title="titleText"
    @click.stop
  >
    <img
      src="/img/logos/faceit-pheasant.png"
      alt="Faceit"
      :class="logoClasses"
    />
    <template v-if="(faceitSkillLevel ?? null) !== null">
      <span :class="levelClasses">Lvl {{ faceitSkillLevel }}</span>
    </template>
    <span v-if="(faceitElo ?? null) !== null" :class="eloRevealClasses">
      <span :class="eloInnerClasses">
        <span :class="sepClasses" aria-hidden="true"></span>
        <span :class="eloClasses">{{ faceitElo!.toLocaleString() }} ELO</span>
      </span>
    </span>
  </a>
</template>
