<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  CalendarClock,
  RadioTower,
  TicketCheck,
  Trophy,
  UsersRound,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";

const { t } = useI18n();

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

const tournamentPath = computed(() => {
  const base = `/tournaments/${props.tournament.id}`;
  return props.statusVariant === "finished" ? `${base}?tab=standings` : base;
});

const teamsCount = computed(
  () => props.tournament?.teams_aggregate?.aggregate?.count || 0,
);

const isLive = computed(() => props.statusVariant === "live");
const isFinished = computed(() => props.statusVariant === "finished");

function teamNameForTrophy(trophy: any): string | null {
  return (
    trophy?.tournament_team?.team?.name ||
    trophy?.tournament_team?.team?.short_name ||
    trophy?.tournament_team?.name ||
    null
  );
}

function teamNameForResult(row: any): string | null {
  return (
    row?.team?.team?.name ||
    row?.team?.team?.short_name ||
    row?.team?.name ||
    null
  );
}

const podium = computed(() => {
  const trophies = (props.tournament?.trophies || []) as any[];
  const byPlacement: Record<number, string | null> = {};
  for (const t of trophies) {
    if (t.placement >= 1 && t.placement <= 3) {
      byPlacement[t.placement] = teamNameForTrophy(t);
    }
  }
  if (!byPlacement[1] && !byPlacement[2] && !byPlacement[3]) {
    // Fall back to the final stage's standings when trophies were never
    // generated (organizer didn't issue them, or trophies are disabled).
    const stages = [...(props.tournament?.stages || [])].sort(
      (a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0),
    );
    const finalStage = stages[0];
    const results = (finalStage?.results || [])
      .slice()
      .sort((a: any, b: any) => (Number(a.rank) || 0) - (Number(b.rank) || 0));
    for (const row of results) {
      const rank = Number(row.rank) || 0;
      if (rank >= 1 && rank <= 3 && !byPlacement[rank]) {
        byPlacement[rank] = teamNameForResult(row);
      }
    }
  }
  return {
    gold: byPlacement[1] || null,
    silver: byPlacement[2] || null,
    bronze: byPlacement[3] || null,
  };
});

const hasPodium = computed(() => !!podium.value.gold);

const trophyConfigFor = (placement: number) => {
  return (props.tournament?.trophy_configs || []).find(
    (c: any) => c.placement === placement,
  );
};

const primaryStage = computed(() => {
  return [...(props.tournament?.stages || [])].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0),
  )[0];
});

// When the tournament organizer disabled trophies, fall back to plain
// rank boxes (1ST / 2ND / 3RD) instead of the procedural trophy art.
const trophiesEnabled = computed(
  () => props.tournament?.trophies_enabled !== false,
);

const statusIcon = computed(() => {
  if (props.statusVariant === "registration") return TicketCheck;
  if (props.statusVariant === "live") return RadioTower;
  return Trophy;
});

const statusText = computed(() => {
  return (
    props.statusLabel ||
    props.tournament?.e_tournament_status?.description ||
    t("tournament.compact_card.tournament")
  );
});

const statusChipClasses = computed(() => {
  if (isLive.value) {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (isFinished.value) {
    return "border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]";
  }
  return "border-border/70 bg-muted/35 text-muted-foreground";
});

const cardChromeClasses = computed(() => {
  if (isLive.value) {
    return "border-[hsl(var(--tac-amber)/0.36)] hover:border-[hsl(var(--tac-amber)/0.62)] hover:shadow-[0_0_20px_hsl(var(--tac-amber)/0.1)]";
  }
  if (isFinished.value) {
    return "border-[hsl(var(--tac-amber)/0.28)] hover:border-[hsl(var(--tac-amber)/0.5)] hover:shadow-[0_0_16px_hsl(var(--tac-amber)/0.08)]";
  }
  return "border-border/70 hover:border-border hover:shadow-[0_0_16px_hsl(var(--muted-foreground)/0.06)]";
});

const accentRailClasses = computed(() => {
  if (isLive.value) {
    return "bg-[hsl(var(--tac-amber))] shadow-[0_0_14px_hsl(var(--tac-amber)/0.5)]";
  }
  if (isFinished.value) return "bg-[hsl(var(--tac-amber)/0.5)]";
  return "bg-muted-foreground/35";
});

const timeLabel = computed(() => {
  if (isLive.value) return t("tournament.compact_card.live");
  if (isFinished.value) return t("tournament.compact_card.ended");
  return t("tournament.compact_card.starts");
});

const playerRank = computed<number | null>(() => {
  const teamId = props.tournament?.rosters?.[0]?.tournament_team_id;
  if (!teamId) return null;
  const stages = [...(props.tournament?.stages || [])].sort(
    (a: any, b: any) => (Number(b.order) || 0) - (Number(a.order) || 0),
  );
  for (const stage of stages) {
    const row = (stage?.results || []).find(
      (r: any) => r.tournament_team_id === teamId,
    );
    if (row?.rank) return Number(row.rank);
  }
  return null;
});

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const playerRankLabel = computed(() =>
  playerRank.value ? ordinal(playerRank.value) : null,
);

const runnerUps = computed(() => {
  const entries: Array<{
    placement: 2 | 3;
    label: string;
    name: string;
    config: any;
  }> = [];
  if (podium.value.silver) {
    entries.push({
      placement: 2,
      label: t("tournament.compact_card.second"),
      name: podium.value.silver,
      config: trophyConfigFor(2),
    });
  }
  if (podium.value.bronze) {
    entries.push({
      placement: 3,
      label: t("tournament.compact_card.third"),
      name: podium.value.bronze,
      config: trophyConfigFor(3),
    });
  }
  return entries;
});
</script>

<template>
  <NuxtLink
    :to="tournamentPath"
    class="group/tournament relative isolate flex h-full flex-col overflow-hidden rounded-md border bg-card/40 transition-[border-color,background,box-shadow,transform] duration-200 hover:-translate-y-px hover:bg-card/60"
    :class="cardChromeClasses"
  >
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-0 w-0.5"
      :class="accentRailClasses"
    ></span>

    <div
      class="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2"
    >
      <h3
        class="min-w-0 truncate text-sm font-semibold leading-tight text-foreground"
        :title="tournament.name"
      >
        {{ tournament.name }}
      </h3>
      <span
        v-if="playerRankLabel"
        class="inline-flex shrink-0 items-center gap-1 rounded border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        :title="
          t('tournament.compact_card.player_finished', {
            rank: playerRankLabel,
          })
        "
      >
        {{ playerRankLabel }}
      </span>
      <span
        v-if="!isFinished"
        class="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.18em]"
        :class="statusChipClasses"
      >
        <component :is="statusIcon" class="h-2.5 w-2.5" />
        {{ statusText }}
      </span>
      <span
        v-if="isLive"
        aria-hidden="true"
        class="relative inline-flex h-1.5 w-1.5 shrink-0"
      >
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70"
        ></span>
        <span
          class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
        ></span>
      </span>
    </div>

    <div v-if="isFinished && hasPodium" class="flex flex-1 flex-col px-3 py-3">
      <div class="flex items-center gap-3">
        <div
          class="relative grid h-14 w-14 shrink-0 place-items-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[radial-gradient(ellipse_at_center,hsl(var(--tac-amber)/0.18)_0%,transparent_70%)]"
        >
          <TrophyBadge
            v-if="trophiesEnabled"
            :tournament-id="tournament.id"
            :placement="1"
            :tournament-name="tournament.name"
            :tournament-start="tournament.start"
            :tournament-type="primaryStage?.type"
            :custom-name="trophyConfigFor(1)?.custom_name"
            :silhouette-override="trophyConfigFor(1)?.silhouette"
            :image-url="trophyConfigFor(1)?.image_url"
            size="sm"
            :interactive="false"
          />
          <span
            v-else
            class="font-mono text-base font-bold leading-none tracking-tight text-[hsl(var(--tac-amber))]"
          >
            1<span class="text-xs align-super">st</span>
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div
            class="font-mono text-[0.58rem] font-bold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]/85"
          >
            {{ $t("tournament.compact_card.champion") }}
          </div>
          <div
            class="mt-0.5 truncate text-base font-bold leading-tight text-[hsl(var(--tac-amber))]"
            :title="podium.gold ?? ''"
          >
            {{ podium.gold }}
          </div>
        </div>
      </div>

      <div
        v-if="runnerUps.length"
        class="mt-2 space-y-1 border-t border-border/40 pt-2"
      >
        <div
          v-for="entry in runnerUps"
          :key="entry.placement"
          class="flex items-center gap-2"
        >
          <TrophyBadge
            v-if="trophiesEnabled"
            :tournament-id="tournament.id"
            :placement="entry.placement"
            :tournament-name="tournament.name"
            :tournament-start="tournament.start"
            :tournament-type="primaryStage?.type"
            :custom-name="entry.config?.custom_name"
            :silhouette-override="entry.config?.silhouette"
            :image-url="entry.config?.image_url"
            size="xs"
            :interactive="false"
          />
          <span
            v-else
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 font-mono text-[0.65rem] font-bold uppercase tracking-tight text-foreground/85"
          >
            {{ entry.label }}
          </span>
          <span
            class="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85"
            :title="entry.name"
          >
            {{ entry.name }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex flex-1 items-center justify-between gap-3 px-3 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span class="inline-flex items-center gap-1.5">
        <UsersRound class="h-3 w-3" />
        <span class="text-foreground">{{ teamsCount }}</span>
        {{ $t("tournament.compact_card.teams") }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <CalendarClock class="h-3 w-3" />
        <span class="text-foreground">
          {{ timeLabel }}
          <TimeAgo :date="tournament.start" />
        </span>
      </span>
    </div>

    <div
      v-if="isFinished && hasPodium"
      class="flex items-center justify-end gap-1.5 border-t border-border/40 px-3 py-1 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <TimeAgo :date="tournament.start" />
    </div>
  </NuxtLink>
</template>
