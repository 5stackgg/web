<script setup lang="ts">
import { computed } from "vue";
import {
  CalendarClock,
  GitBranch,
  RadioTower,
  TicketCheck,
  Trophy,
  UsersRound,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import MiniMapDisplay from "~/components/MinIMapDisplay.vue";
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";

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

const tournamentPath = computed(() => `/tournaments/${props.tournament.id}`);

const tournamentMaps = computed(
  () => props.tournament?.options?.map_pool?.maps || [],
);
const visibleTournamentMaps = computed(() => tournamentMaps.value.slice(0, 6));
const hiddenMapCount = computed(() =>
  Math.max(tournamentMaps.value.length - visibleTournamentMaps.value.length, 0),
);
const sortedStages = computed(() => {
  return [...(props.tournament?.stages || [])].sort((a: any, b: any) => {
    return (a.order || 0) - (b.order || 0);
  });
});
const primaryStage = computed(() => sortedStages.value[0]);
const firstPlaceTrophyConfig = computed(() => {
  return (props.tournament?.trophy_configs || []).find((config: any) => {
    return config.placement === 1;
  });
});
const stageCount = computed(() => props.tournament?.stages?.length || 0);
const teamsCount = computed(
  () => props.tournament?.teams_aggregate?.aggregate?.count || 0,
);
const isLive = computed(() => props.statusVariant === "live");

const statusIcon = computed(() => {
  if (props.statusVariant === "registration") {
    return TicketCheck;
  }

  if (props.statusVariant === "live") {
    return RadioTower;
  }

  return Trophy;
});

const statusText = computed(() => {
  return (
    props.statusLabel ||
    props.tournament?.e_tournament_status?.description ||
    "Tournament"
  );
});

const statusChipClasses = computed(() => {
  if (props.statusVariant === "live") {
    return "border-destructive/35 bg-destructive/10 text-destructive";
  }

  return "border-border/70 bg-muted/35 text-muted-foreground";
});

const timeLabel = computed(() => {
  return props.statusVariant === "live" || props.statusVariant === "finished"
    ? "Started"
    : "Starts";
});

const stageLabel = computed(() => {
  const stage = primaryStage.value;
  const stageType =
    stage?.e_tournament_stage_type?.description || stage?.type || "Bracket";
  const bestOf =
    stage?.options?.best_of ||
    stage?.default_best_of ||
    props.tournament?.options?.best_of;

  return bestOf ? `${stageType} - BO${bestOf}` : stageType;
});

const cardChromeClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber)/0.36)] bg-[linear-gradient(135deg,hsl(var(--card)/0.72)_0%,hsl(var(--card)/0.42)_52%,hsl(var(--tac-amber)/0.08)_100%)] hover:border-[hsl(var(--tac-amber)/0.62)] hover:bg-[linear-gradient(135deg,hsl(var(--card)/0.82)_0%,hsl(var(--card)/0.5)_48%,hsl(var(--tac-amber)/0.14)_100%)] hover:shadow-[0_0_28px_hsl(var(--tac-amber)/0.12)]";
  }

  return "border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)/0.68)_0%,hsl(var(--card)/0.44)_54%,hsl(var(--muted)/0.16)_100%)] hover:border-border hover:bg-[linear-gradient(135deg,hsl(var(--card)/0.78)_0%,hsl(var(--card)/0.5)_50%,hsl(var(--muted)/0.24)_100%)] hover:shadow-[0_0_24px_hsl(var(--muted-foreground)/0.08)]";
});

const accentRailClasses = computed(() => {
  if (isLive.value) {
    return "bg-[hsl(var(--tac-amber))] shadow-[0_0_18px_hsl(var(--tac-amber)/0.55)]";
  }

  return "bg-muted-foreground/35 shadow-[0_0_14px_hsl(var(--muted-foreground)/0.14)]";
});

const bracketTextureClasses = computed(() => {
  if (isLive.value) {
    return "[background-image:linear-gradient(135deg,transparent_0,transparent_47%,hsl(var(--tac-amber)/0.12)_48%,transparent_50%,transparent_100%)]";
  }

  return "[background-image:linear-gradient(135deg,transparent_0,transparent_47%,hsl(var(--muted-foreground)/0.08)_48%,transparent_50%,transparent_100%)]";
});

const cornerClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber))] opacity-80";
  }

  return "border-muted-foreground/35 opacity-55";
});

const trophyFrameClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber)/0.36)] bg-[radial-gradient(ellipse_at_center,hsl(var(--tac-amber)/0.18)_0%,hsl(var(--background)/0.12)_70%)]";
  }

  return "border-border/70 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted-foreground)/0.1)_0%,hsl(var(--background)/0.12)_70%)]";
});

const trophyBadgeClasses = computed(() => {
  return isLive.value ? "" : "grayscale opacity-70";
});

const eyebrowClasses = computed(() => {
  return isLive.value
    ? "text-[hsl(var(--tac-amber))]"
    : "text-muted-foreground";
});

const stageChipClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber)/0.38)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]";
  }

  return "border-border/70 bg-muted/35 text-muted-foreground";
});

const stagePanelClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.08)]";
  }

  return "border-border/70 bg-muted/25";
});

const stagePanelLabelClasses = computed(() => {
  return isLive.value
    ? "text-[hsl(var(--tac-amber))]"
    : "text-muted-foreground";
});
</script>

<template>
  <NuxtLink
    :to="tournamentPath"
    class="group/tournament relative isolate block overflow-hidden rounded-md border shadow-[inset_0_1px_0_hsl(0_0%_100%/0.05)] transition-[border-color,background,box-shadow,transform] duration-200 hover:-translate-y-px"
    :class="cardChromeClasses"
  >
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-0 w-1"
      :class="accentRailClasses"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-y-0 right-0 w-[38%] opacity-40 [background-size:26px_26px]"
      :class="bracketTextureClasses"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2"
      :class="cornerClasses"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2"
      :class="cornerClasses"
    ></span>

    <div
      class="relative grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5"
    >
      <div class="min-w-0 space-y-4">
        <div class="flex items-start gap-4">
          <div
            class="relative grid h-16 w-16 shrink-0 place-items-center rounded-md border"
            :class="trophyFrameClasses"
          >
            <TrophyBadge
              :tournament-id="tournament.id"
              :placement="1"
              :tournament-name="tournament.name"
              :tournament-start="tournament.start"
              :tournament-type="primaryStage?.type"
              :custom-name="firstPlaceTrophyConfig?.custom_name"
              :silhouette-override="firstPlaceTrophyConfig?.silhouette"
              :image-url="firstPlaceTrophyConfig?.image_url"
              size="sm"
              :interactive="false"
              :class="trophyBadgeClasses"
            />
            <span
              v-if="isLive"
              aria-hidden="true"
              class="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-background bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.8)]"
            ></span>
          </div>

          <div class="min-w-0 flex-1">
            <div
              class="mb-2 flex flex-wrap items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
              :class="eyebrowClasses"
            >
              <span class="inline-flex items-center gap-1.5">
                <component :is="statusIcon" class="h-3.5 w-3.5" />
                Tournament
              </span>
              <span
                class="inline-flex max-w-[14rem] items-center rounded border px-1.5 py-0.5"
                :class="statusChipClasses"
              >
                <span class="truncate">{{ statusText }}</span>
              </span>
            </div>

            <h3
              class="truncate font-sans text-xl font-bold leading-tight text-foreground"
            >
              {{ tournament.name }}
            </h3>
            <p
              v-if="tournament.description"
              class="mt-2 line-clamp-2 text-sm text-muted-foreground"
            >
              {{ tournament.description }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex items-center rounded-md border border-border/70 bg-muted/35 px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            {{ tournament.options.type }}
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em]"
            :class="stageChipClasses"
          >
            <GitBranch class="h-3.5 w-3.5" />
            {{ stageLabel }}
          </span>
        </div>

        <div
          v-if="visibleTournamentMaps.length > 0"
          class="flex flex-wrap items-center gap-2"
        >
          <span
            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Maps
          </span>
          <MiniMapDisplay
            v-for="map in visibleTournamentMaps"
            :key="map.id"
            :map="map"
          />
          <span
            v-if="hiddenMapCount > 0"
            class="inline-flex h-8 items-center rounded-md border border-border/70 bg-muted/35 px-2.5 font-mono text-[0.65rem] font-bold text-muted-foreground"
          >
            +{{ hiddenMapCount }}
          </span>
        </div>
      </div>

      <div
        :class="[
          'grid min-w-[13rem] gap-2 sm:flex sm:flex-col sm:items-stretch sm:justify-between',
          isLive ? 'grid-cols-1' : 'grid-cols-2',
        ]"
      >
        <div
          v-if="!isLive"
          class="rounded-md border border-border/70 bg-background/35 px-3 py-2"
        >
          <div
            class="mb-1 flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
          >
            <CalendarClock class="h-3 w-3" />
            {{ timeLabel }}
          </div>
          <div class="text-sm font-semibold text-foreground">
            <TimeAgo :date="tournament.start" />
          </div>
        </div>

        <div
          class="rounded-md border border-border/70 bg-background/35 px-3 py-2"
        >
          <div
            class="mb-1 flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-muted-foreground"
          >
            <UsersRound class="h-3 w-3" />
            Teams
          </div>
          <div class="text-sm font-semibold text-foreground">
            {{ teamsCount }}
          </div>
        </div>

        <div
          class="col-span-2 rounded-md border px-3 py-2"
          :class="stagePanelClasses"
        >
          <div
            class="mb-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em]"
            :class="stagePanelLabelClasses"
          >
            Stages
          </div>
          <div class="text-sm font-semibold text-foreground">
            {{ stageCount || 1 }}
          </div>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
