<script setup lang="ts">
import { computed, ref } from "vue";
import TrophyBadge from "./TrophyBadge.vue";
import TrophyModal from "./TrophyModal.vue";

interface Trophy {
  id: string;
  placement: number;
  placement_tier?: string | null;
  tournament_id: string;
  tournament_name: string;
  tournament_start?: string | null;
  tournament_type?: string | null;
  custom_name?: string | null;
  silhouette?: number | null;
  image_url?: string | null;
}

interface Props {
  trophies?: Trophy[] | null;
  emptyState?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  trophies: null,
  emptyState: true,
});

const selected = ref<Trophy | null>(null);
const modalOpen = ref(false);

const sorted = computed(() => {
  if (!props.trophies) return [];
  return [...props.trophies].sort((a, b) => {
    if (a.placement !== b.placement) return a.placement - b.placement;
    const da = a.tournament_start ? new Date(a.tournament_start).getTime() : 0;
    const db = b.tournament_start ? new Date(b.tournament_start).getTime() : 0;
    return db - da;
  });
});

const counts = computed(() => {
  const c = { mvp: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of sorted.value) {
    if (t.placement === 0) c.mvp++;
    else if (t.placement === 1) c.gold++;
    else if (t.placement === 2) c.silver++;
    else if (t.placement === 3) c.bronze++;
  }
  return c;
});

function openTrophy(trophy: Trophy) {
  selected.value = trophy;
  modalOpen.value = true;
}

function formatTrophyDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

const frameClasses =
  "relative overflow-hidden rounded-lg border border-border px-6 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.7)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";

const scanlineClasses =
  "pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.025)_3px,hsl(var(--tac-amber)_/_0.025)_4px)]";

const eyebrowClasses =
  "inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground";
const chevronClasses =
  "translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]";

const tierColors: Record<"mvp" | "gold" | "silver" | "bronze", string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
};

const tierRack = [
  { key: "mvp" as const, label: "MVP", full: "Most Valuable Player" },
  { key: "gold" as const, label: "1ST", full: "1st Place" },
  { key: "silver" as const, label: "2ND", full: "2nd Place" },
  { key: "bronze" as const, label: "3RD", full: "3rd Place" },
];

function placementUplight(placement: number) {
  if (placement === 0) return tierColors.mvp;
  if (placement === 1) return tierColors.gold;
  if (placement === 2) return tierColors.silver;
  return tierColors.bronze;
}
</script>

<template>
  <section :class="frameClasses">
    <!-- scanline overlay -->
    <div :class="scanlineClasses" aria-hidden="true"></div>

    <!-- Header: eyebrow + rack counters -->
    <header
      class="relative mb-5 flex flex-wrap items-start justify-between gap-4"
    >
      <div class="flex flex-col gap-1.5">
        <div :class="eyebrowClasses">
          <span :class="chevronClasses">◢</span>
          {{ $t("trophies.title") }}
          <span
            v-if="sorted.length"
            class="rounded-sm border border-[hsl(var(--tac-amber)_/_0.35)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.4rem] py-[0.02rem] text-[0.62rem] tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ sorted.length.toString().padStart(2, "0") }}
          </span>
        </div>
        <div
          class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
        >
          ▚ AWARDS ON FILE
        </div>
      </div>

      <!-- Tier rack -->
      <div
        class="flex items-stretch gap-0 divide-x divide-border/80 overflow-hidden rounded border border-border/80 bg-background/60 [backdrop-filter:blur(4px)]"
      >
        <div
          v-for="tier in tierRack"
          :key="tier.key"
          class="flex items-center gap-2 px-3 py-2"
          :style="{ color: tierColors[tier.key] }"
          :title="`${counts[tier.key]} × ${tier.full}`"
        >
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{
              background: tierColors[tier.key],
              boxShadow: `0 0 6px ${tierColors[tier.key]}`,
            }"
          ></span>
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ tier.label }}
          </span>
          <span class="font-mono text-base font-bold leading-none tabular-nums">
            {{ String(counts[tier.key]).padStart(2, "0") }}
          </span>
        </div>
      </div>
    </header>

    <!-- Trophy grid -->
    <div
      v-if="sorted.length"
      class="relative grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      <button
        v-for="trophy in sorted"
        :key="trophy.id"
        type="button"
        class="group/pedestal relative flex flex-col items-center gap-2 rounded-sm px-2 pb-3 pt-4 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        @click="openTrophy(trophy)"
      >
        <!-- Uplight -->
        <div
          class="pointer-events-none absolute inset-x-3 bottom-8 top-2 rounded-full opacity-40 blur-2xl transition-opacity duration-300 group-hover/pedestal:opacity-80"
          :style="{
            background: `radial-gradient(ellipse at center bottom, ${placementUplight(trophy.placement)} 0%, transparent 65%)`,
          }"
        ></div>

        <TrophyBadge
          :tournament-id="trophy.tournament_id"
          :placement="trophy.placement"
          :tournament-name="trophy.tournament_name"
          :tournament-start="trophy.tournament_start"
          :tournament-type="trophy.tournament_type"
          :custom-name="trophy.custom_name"
          :silhouette-override="trophy.silhouette"
          :image-url="trophy.image_url"
          size="md"
          class="relative z-[1]"
        />

        <!-- Stenciled nameplate -->
        <div class="relative z-[1] mt-1 w-full">
          <div
            class="truncate text-center text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-foreground group-hover/pedestal:text-[hsl(var(--tac-amber))]"
            :title="trophy.custom_name || trophy.tournament_name"
          >
            {{ trophy.custom_name || trophy.tournament_name }}
          </div>
          <div
            v-if="trophy.tournament_start"
            class="mt-0.5 flex items-center justify-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground/80"
          >
            <span class="h-[1px] w-2 bg-border"></span>
            {{ formatTrophyDate(trophy.tournament_start) }}
            <span class="h-[1px] w-2 bg-border"></span>
          </div>
        </div>
      </button>
    </div>

    <!-- Classified-stamp empty state -->
    <div
      v-else-if="emptyState"
      class="relative flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-border bg-background/30 py-8"
    >
      <div
        class="rotate-[-4deg] rounded-sm border-2 border-[hsl(var(--tac-amber)_/_0.5)] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.3em] text-[hsl(var(--tac-amber)_/_0.7)]"
      >
        ▚ NO AWARDS ON FILE
      </div>
      <div
        class="max-w-sm text-center text-[0.72rem] uppercase tracking-[0.15em] text-muted-foreground"
      >
        {{ $t("trophies.no_trophies_description") }}
      </div>
    </div>

    <TrophyModal
      v-if="selected"
      :open="modalOpen"
      :trophy="selected"
      @update:open="(v) => (modalOpen = v)"
    />
  </section>
</template>
