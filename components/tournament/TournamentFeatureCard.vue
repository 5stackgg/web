<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { GitBranch, Trophy, UsersRound } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { formatPrizePool } from "~/utilities/prizePool";

type TournamentStatusVariant = "default" | "finished" | "live" | "registration";

const props = withDefaults(
  defineProps<{
    statusLabel?: string;
    statusVariant?: TournamentStatusVariant;
    tournament: any;
  }>(),
  {
    statusLabel: undefined,
    statusVariant: "default",
  },
);

const { t } = useI18n();
const runtimeConfig = useRuntimeConfig();

const tournamentPath = computed(() => `/tournaments/${props.tournament.id}`);

const bannerUrl = computed(() => {
  const banner = props.tournament?.banner;
  if (!banner) {
    return null;
  }
  return `https://${runtimeConfig.public.apiDomain}/${banner}`;
});

const logoUrl = computed(() => {
  const logo = props.tournament?.logo;
  if (!logo) {
    return null;
  }
  return `https://${runtimeConfig.public.apiDomain}/${logo}`;
});

// Deterministic gradient keyed on the id so bannerless tournaments still look
// intentional (mirrors the events hero fallback).
const fallbackGradient = computed(() => {
  const id = String(props.tournament?.id ?? "");
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  const a = h;
  const b = (h + 70) % 360;
  const c = (h + 200) % 360;
  return `radial-gradient(ellipse 55% 90% at 22% 40%, hsl(${a} 60% 40% / 0.85), transparent 60%), radial-gradient(ellipse 45% 80% at 70% 60%, hsl(${b} 55% 42% / 0.7), transparent 55%), radial-gradient(ellipse 40% 70% at 90% 25%, hsl(${c} 60% 45% / 0.6), transparent 55%), repeating-linear-gradient(-35deg, rgba(0,0,0,0.32) 0 20px, transparent 20px 40px), #14171c`;
});

const isLive = computed(() => props.statusVariant === "live");

const categories = computed(() =>
  (props.tournament?.categories || []).map(
    (category: any) =>
      category.e_tournament_category?.description ?? category.category,
  ),
);

// The full pool reads as a bigger draw than "#1: $5000".
const prizePool = computed(() => formatPrizePool(props.tournament?.prizes));

const organizerTeam = computed(
  () => props.tournament?.organizer_teams?.[0]?.team || null,
);

const teamsCount = computed(
  () => props.tournament?.teams_aggregate?.aggregate?.count || 0,
);

const primaryStage = computed(() => {
  return [...(props.tournament?.stages || [])].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0),
  )[0];
});

const stageLabel = computed(() => {
  const stage = primaryStage.value;
  const stageType =
    stage?.e_tournament_stage_type?.description || stage?.type || "Bracket";
  const bestOf =
    stage?.options?.best_of ||
    stage?.default_best_of ||
    props.tournament?.options?.best_of;
  return bestOf ? `${stageType} · BO${bestOf}` : stageType;
});

const statusText = computed(() => {
  return (
    props.statusLabel ||
    props.tournament?.e_tournament_status?.description ||
    t("tournament.feature_card.default_label")
  );
});

const statusChipClasses = computed(() => {
  if (props.statusVariant === "live") {
    return "bg-destructive/25 text-[hsl(var(--destructive))]";
  }
  if (props.statusVariant === "registration") {
    return "bg-[hsl(var(--tac-amber)/0.22)] text-[hsl(var(--tac-amber))]";
  }
  if (props.statusVariant === "finished") {
    return "bg-success/20 text-success";
  }
  return "bg-black/60 text-white/90";
});
</script>

<template>
  <NuxtLink
    :to="tournamentPath"
    class="group/tournament relative block h-[220px] overflow-hidden rounded-xl border border-border/70 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)] sm:h-[250px] lg:h-[290px]"
  >
    <!-- Banners are authored at 3:1; the card runs a touch wider than that, so
         hold the image at its natural scale and let cover trim the sides only. -->
    <img
      v-if="bannerUrl"
      :src="bannerUrl"
      :alt="tournament.name"
      aria-hidden="true"
      class="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover/tournament:scale-105"
    />
    <div
      v-else
      class="absolute inset-0"
      :style="{ background: fallbackGradient }"
    ></div>

    <!-- Modest global tint tames busy / low-contrast uploads without killing a
         well-designed banner; the text zones get their own stronger scrims. -->
    <div
      v-if="bannerUrl"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-black/25"
    ></div>
    <div
      aria-hidden="true"
      class="tac-scanlines pointer-events-none absolute inset-0"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.6)_0%,transparent_100%)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.55)_45%,hsl(0_0%_0%/0.94)_100%)]"
    ></div>

    <!-- TOP: logo + categories (left) · status (right) -->
    <div
      class="absolute inset-x-0 top-0 z-[2] flex items-start justify-between gap-2 p-4 sm:p-5"
    >
      <div class="flex min-w-0 items-center gap-2">
        <img
          v-if="logoUrl"
          :src="logoUrl"
          :alt="tournament.name"
          class="h-11 w-11 shrink-0 rounded-md border border-white/20 bg-black/40 object-contain backdrop-blur-sm"
        />
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="category in categories.slice(0, 3)"
            :key="category"
            class="inline-flex items-center rounded-full bg-black/55 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm"
          >
            {{ category }}
          </span>
        </div>
      </div>

      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] backdrop-blur-sm"
        :class="statusChipClasses"
      >
        <span
          v-if="isLive"
          aria-hidden="true"
          class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--destructive))]"
        ></span>
        <span class="max-w-[10rem] truncate">{{ statusText }}</span>
      </span>
    </div>

    <!-- BOTTOM: name + meta row -->
    <div
      class="absolute inset-x-0 bottom-0 z-[2] px-4 pb-4 pt-6 sm:px-5 sm:pb-5"
    >
      <h3
        class="truncate font-sans text-2xl font-bold uppercase leading-[0.95] tracking-[0.02em] text-white [font-stretch:80%] [text-shadow:0_2px_16px_rgba(0,0,0,0.85)] sm:text-3xl"
      >
        {{ tournament.name }}
      </h3>

      <div
        class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[0.68rem] tracking-[0.04em] text-white/85"
      >
        <span class="text-white/70">
          <TimeAgo :date="tournament.start" />
        </span>
        <span class="inline-flex items-center gap-1.5">
          <UsersRound class="h-3.5 w-3.5 text-white/55" />
          <span class="font-bold text-white">{{ teamsCount }}</span>
          {{ $t("tournament.feature_card.teams") }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <GitBranch class="h-3.5 w-3.5 text-white/55" />
          {{ stageLabel }}
        </span>
        <span
          v-if="prizePool"
          class="inline-flex items-center gap-1.5 text-[hsl(var(--tac-amber))]"
        >
          <Trophy class="h-3.5 w-3.5" />
          <span class="font-bold">{{ prizePool }}</span>
          {{ $t("tournament.stats.prize_pool") }}
        </span>
        <span v-if="organizerTeam" class="text-white/65">
          {{
            $t("tournament.feature_card.organized_by", {
              team: organizerTeam.name || organizerTeam.short_name,
            })
          }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
