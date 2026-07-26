<script setup lang="ts">
import { computed, ref } from "vue";
import AwardBadge from "./AwardBadge.vue";
import AwardModal from "./AwardModal.vue";
import { resolveAwardTier, type AwardTier } from "~/utilities/awardSeed";

interface AwardGrant {
  id: string;
  placement?: number | null;
  placement_tier?: string | null;
  tournament_id?: string | null;
  team_id?: string | null;
  note?: string | null;
  created_at?: string | null;
  award?: {
    id: string;
    name?: string | null;
    description?: string | null;
    tier?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
  tournament?: {
    name: string;
    start?: string | null;
    stages?: Array<{ type: string }> | null;
  } | null;
  tournament_team?: {
    name?: string | null;
    team_id?: string | null;
    team?: {
      id: string;
      name?: string | null;
      short_name?: string | null;
    } | null;
  } | null;
  team?: {
    id: string;
    name?: string | null;
    short_name?: string | null;
  } | null;
  tournament_award?: {
    custom_name?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
}

interface Props {
  awards?: AwardGrant[] | null;
  emptyState?: boolean;
  hideMvp?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  awards: null,
  emptyState: true,
  hideMvp: false,
});

const selected = ref<AwardGrant | null>(null);
const modalOpen = ref(false);

function grantTier(grant: AwardGrant): AwardTier {
  return resolveAwardTier(grant.placement, grant.award?.tier);
}

function grantName(grant: AwardGrant): string {
  return (
    grant.tournament_award?.custom_name ||
    grant.tournament?.name ||
    grant.award?.name ||
    ""
  );
}

// Placement medals lead, ordered mvp -> bronze; standalone awards trail them
// newest-first so a long tournament history never buries a fresh grant.
const TIER_ORDER: Record<AwardTier, number> = {
  mvp: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
  special: 4,
};

const sorted = computed(() => {
  if (!props.awards) return [];
  return [...props.awards].sort((a, b) => {
    const ta = TIER_ORDER[grantTier(a)];
    const tb = TIER_ORDER[grantTier(b)];
    if (ta !== tb) return ta - tb;
    const da = new Date(a.tournament?.start || a.created_at || 0).getTime();
    const db = new Date(b.tournament?.start || b.created_at || 0).getTime();
    return db - da;
  });
});

const counts = computed(() => {
  const c: Record<AwardTier, number> = {
    mvp: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    special: 0,
  };
  for (const grant of sorted.value) {
    c[grantTier(grant)]++;
  }
  return c;
});

function openAward(grant: AwardGrant) {
  selected.value = grant;
  modalOpen.value = true;
}

function formatAwardDate(iso?: string | null) {
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

import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const eyebrowClasses = `${tacticalSectionLabelClasses} mb-0`;

const tierColors: Record<AwardTier, string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
  special: "hsl(258 90% 74%)",
};

const tierRack = computed(() => {
  const tiers = [
    { key: "mvp" as const, label: "MVP", full: "Most Valuable Player" },
    { key: "gold" as const, label: "1ST", full: "1st Place" },
    { key: "silver" as const, label: "2ND", full: "2nd Place" },
    { key: "bronze" as const, label: "3RD", full: "3rd Place" },
    { key: "special" as const, label: "AWD", full: "Awards" },
  ];
  return tiers.filter((tier) => {
    if (tier.key === "mvp" && props.hideMvp) return false;
    // The standalone counter only earns its slot once something fills it.
    if (tier.key === "special" && counts.value.special === 0) return false;
    return true;
  });
});
</script>

<template>
  <!-- Nothing to display: a bare line with the action, not a framed case
       wrapping a dashed empty box. Hidden outright when the viewer cannot act. -->
  <div
    v-if="!sorted.length"
    v-show="emptyState"
    class="flex items-center justify-between gap-3"
  >
    <div :class="eyebrowClasses">
      <span :class="tacticalSectionTickClasses"></span>
      {{ $t("awards.title") }}
    </div>
    <slot name="action" />
  </div>

  <section v-else :class="frameClasses">
    <!-- scanline overlay -->
    <div :class="scanlineClasses" aria-hidden="true"></div>

    <!-- Header: eyebrow + rack counters -->
    <header
      class="relative mb-5 flex flex-wrap items-start justify-between gap-4"
    >
      <div class="flex flex-col gap-1.5">
        <div :class="eyebrowClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("awards.title") }}
          <span
            v-if="sorted.length"
            class="rounded-sm border border-[hsl(var(--tac-amber)_/_0.35)] bg-[hsl(var(--tac-amber)_/_0.12)] px-[0.4rem] py-[0.02rem] text-[0.62rem] tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ sorted.length.toString().padStart(2, "0") }}
          </span>
        </div>
      </div>

      <!-- Tier rack, with the grant action inline beside the counts -->
      <div class="flex items-center gap-2">
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
            <span
              class="font-mono text-base font-bold leading-none tabular-nums"
            >
              {{ String(counts[tier.key]).padStart(2, "0") }}
            </span>
          </div>
        </div>

        <slot name="action" />
      </div>
    </header>

    <!-- Award grid -->
    <div
      v-if="sorted.length"
      class="relative grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      <button
        v-for="grant in sorted"
        :key="grant.id"
        type="button"
        class="group/pedestal relative flex flex-col items-center gap-2 rounded-sm px-2 pb-3 pt-4 transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        @click="openAward(grant)"
      >
        <!-- Uplight -->
        <div
          class="pointer-events-none absolute inset-x-3 bottom-8 top-2 rounded-full opacity-40 blur-2xl transition-opacity duration-300 group-hover/pedestal:opacity-80"
          :style="{
            background: `radial-gradient(ellipse at center bottom, ${tierColors[grantTier(grant)]} 0%, transparent 65%)`,
          }"
        ></div>

        <AwardBadge
          :award="grant.award"
          :seed-key="grant.tournament_id || grant.award?.id"
          :placement="grant.placement"
          :tournament-name="grant.tournament?.name"
          :tournament-start="grant.tournament?.start"
          :tournament-type="grant.tournament?.stages?.[0]?.type"
          :custom-name="grant.tournament_award?.custom_name"
          :silhouette-override="grant.tournament_award?.silhouette"
          :image-url="grant.tournament_award?.image_url"
          size="md"
          class="relative z-[1]"
        />

        <!-- Stenciled nameplate -->
        <div class="relative z-[1] mt-1 w-full">
          <div
            class="truncate text-center text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-foreground group-hover/pedestal:text-[hsl(var(--tac-amber))]"
            :title="grantName(grant)"
          >
            {{ grantName(grant) }}
          </div>
          <div
            v-if="grant.tournament?.start || grant.created_at"
            class="mt-0.5 flex items-center justify-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground/80"
          >
            <span class="h-[1px] w-2 bg-border"></span>
            {{ formatAwardDate(grant.tournament?.start || grant.created_at) }}
            <span class="h-[1px] w-2 bg-border"></span>
          </div>
        </div>
      </button>
    </div>

    <AwardModal
      v-if="selected"
      :open="modalOpen"
      :award="selected"
      @update:open="(v) => (modalOpen = v)"
    />
  </section>
</template>
