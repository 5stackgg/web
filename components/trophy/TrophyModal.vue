<script setup lang="ts">
import { computed } from "vue";
import TrophyBadge from "./TrophyBadge.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface Trophy {
  id: string;
  placement: number;
  placement_tier?: string | null;
  tournament_id: string;
  team_id?: string | null;
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
  trophy_config?: {
    custom_name?: string | null;
    silhouette?: number | null;
    image_url?: string | null;
  } | null;
}

interface Props {
  open: boolean;
  trophy: Trophy;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const placementLabelKey = computed(() => {
  if (props.trophy.placement === 0) return "trophies.mvp";
  if (props.trophy.placement === 1) return "trophies.first_place";
  if (props.trophy.placement === 2) return "trophies.second_place";
  return "trophies.third_place";
});

const tierColor = computed(() => {
  if (props.trophy.placement === 0) return "hsl(195 85% 60%)";
  if (props.trophy.placement === 1) return "hsl(45 95% 60%)";
  if (props.trophy.placement === 2) return "hsl(0 0% 78%)";
  return "hsl(28 70% 52%)";
});

const formattedDate = computed(() => {
  if (!props.trophy.tournament?.start) return null;
  const d = new Date(props.trophy.tournament.start);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
});

const tournamentName = computed(() => props.trophy.tournament?.name || "");
const tournamentType = computed(
  () => props.trophy.tournament?.stages?.[0]?.type || null,
);
const trophyTeam = computed(() => {
  const team = props.trophy.team || props.trophy.tournament_team?.team || null;
  const id =
    props.trophy.team_id || team?.id || props.trophy.tournament_team?.team_id;
  if (!id) return null;

  return {
    id,
    name:
      team?.name ||
      team?.short_name ||
      props.trophy.tournament_team?.name ||
      "Team",
  };
});
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader class="gap-1">
        <div
          class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span class="text-[0.7rem]" :style="{ color: tierColor }">◢</span>
          {{ $t("trophies.title") }}
          <span class="text-muted-foreground/50">·</span>
          <span :style="{ color: tierColor }">{{ $t(placementLabelKey) }}</span>
        </div>
        <DialogTitle
          class="text-xl font-bold uppercase tracking-[0.04em] sm:text-2xl"
        >
          {{ tournamentName }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ tournamentName }} — {{ $t(placementLabelKey) }}
        </DialogDescription>
      </DialogHeader>

      <NuxtLink
        v-if="trophyTeam"
        :to="`/teams/${trophyTeam.id}`"
        class="group/team relative flex items-center justify-between gap-3 overflow-hidden rounded-sm border border-[hsl(var(--tac-amber)_/_0.35)] bg-[hsl(var(--tac-amber)_/_0.07)] px-3 py-2.5 text-left transition-colors duration-150 hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.11)]"
      >
        <span
          class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(90deg,transparent_0,transparent_11px,hsl(var(--tac-amber)_/_0.04)_11px,hsl(var(--tac-amber)_/_0.04)_12px)]"
          aria-hidden="true"
        ></span>
        <span class="relative flex min-w-0 items-center gap-2">
          <span
            class="font-mono text-[0.58rem] uppercase tracking-[0.24em] text-muted-foreground"
          >
            TEAM
          </span>
          <span
            class="min-w-0 truncate text-sm font-bold uppercase tracking-[0.08em] text-foreground transition-colors duration-150 group-hover/team:text-[hsl(var(--tac-amber))]"
          >
            {{ trophyTeam.name }}
          </span>
        </span>
        <span
          class="relative shrink-0 text-[0.72rem] text-[hsl(var(--tac-amber))] transition-transform duration-150 group-hover/team:translate-x-0.5"
          aria-hidden="true"
          >◢</span
        >
      </NuxtLink>

      <!-- Trophy hero with uplight + scanlines -->
      <div
        class="relative overflow-hidden rounded-sm border border-border bg-background/40 py-6"
      >
        <div
          class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.03)_3px,hsl(var(--tac-amber)_/_0.03)_4px)]"
          aria-hidden="true"
        ></div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 blur-3xl"
          :style="{
            background: `radial-gradient(ellipse at center bottom, ${tierColor} 0%, transparent 65%)`,
            opacity: 0.35,
          }"
          aria-hidden="true"
        ></div>
        <div class="relative z-[1] flex justify-center">
          <TrophyBadge
            :tournament-id="trophy.tournament_id"
            :placement="trophy.placement"
            :tournament-name="tournamentName"
            :tournament-start="trophy.tournament?.start"
            :tournament-type="tournamentType"
            :custom-name="trophy.trophy_config?.custom_name"
            :silhouette-override="trophy.trophy_config?.silhouette"
            :image-url="trophy.trophy_config?.image_url"
            size="lg"
            :interactive="false"
          />
        </div>
      </div>

      <!-- Metadata strip -->
      <dl
        class="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 text-xs"
      >
        <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("trophies.placement") }}
          </dt>
          <dd
            class="font-semibold uppercase tracking-wide"
            :style="{ color: tierColor }"
          >
            <template v-if="trophy.placement === 0"
              >★ {{ $t(placementLabelKey) }}</template
            >
            <template v-else>
              #{{ String(trophy.placement).padStart(2, "0") }} ·
              {{ $t(placementLabelKey) }}
            </template>
          </dd>
        </div>
        <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("trophies.tournament") }}
          </dt>
          <dd class="font-semibold">{{ tournamentType || "—" }}</dd>
        </div>
        <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            DATE
          </dt>
          <dd class="font-mono text-[0.7rem] font-semibold tracking-[0.08em]">
            {{ formattedDate || "—" }}
          </dd>
        </div>
      </dl>

      <NuxtLink
        :to="`/tournaments/${trophy.tournament_id}`"
        class="group/link inline-flex items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]"
      >
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[-2px]"
          >▚</span
        >
        VIEW TOURNAMENT
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[2px]"
          >◢</span
        >
      </NuxtLink>
    </DialogContent>
  </Dialog>
</template>
