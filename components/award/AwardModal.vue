<script setup lang="ts">
import { computed } from "vue";
import AwardBadge from "./AwardBadge.vue";
import { resolveAwardTier } from "~/utilities/awardSeed";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

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
  open: boolean;
  award: AwardGrant;
}

const props = defineProps<Props>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const TIER_COLORS: Record<string, string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
  special: "hsl(258 90% 74%)",
};

const tier = computed(() =>
  resolveAwardTier(props.award.placement, props.award.award?.tier),
);

const hasPlacement = computed(
  () => props.award.placement !== null && props.award.placement !== undefined,
);

const placementLabelKey = computed(() => {
  if (props.award.placement === 0) return "awards.mvp";
  if (props.award.placement === 1) return "awards.first_place";
  if (props.award.placement === 2) return "awards.second_place";
  if (props.award.placement === 3) return "awards.third_place";
  return "awards.granted";
});

const tierColor = computed(() => TIER_COLORS[tier.value]);

const formattedDate = computed(() => {
  const iso = props.award.tournament?.start || props.award.created_at;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
});

const tournamentName = computed(() => props.award.tournament?.name || "");
const tournamentType = computed(
  () => props.award.tournament?.stages?.[0]?.type || null,
);

const title = computed(
  () =>
    props.award.tournament_award?.custom_name ||
    tournamentName.value ||
    props.award.award?.name ||
    "",
);

const awardTeam = computed(() => {
  const team = props.award.team || props.award.tournament_team?.team || null;
  const id =
    props.award.team_id || team?.id || props.award.tournament_team?.team_id;
  if (!id) return null;

  return {
    id,
    name:
      team?.name ||
      team?.short_name ||
      props.award.tournament_team?.name ||
      "Team",
  };
});
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader class="gap-1">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span
            class="inline-block h-[2px] w-[10px]"
            :style="{ background: tierColor }"
          ></span>
          {{ $t("awards.title") }}
          <span class="text-muted-foreground/50">·</span>
          <span :style="{ color: tierColor }">{{ $t(placementLabelKey) }}</span>
        </div>
        <DialogTitle
          class="text-xl font-bold uppercase tracking-[0.04em] sm:text-2xl"
        >
          {{ title }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ title }} — {{ $t(placementLabelKey) }}
        </DialogDescription>
      </DialogHeader>

      <NuxtLink
        v-if="awardTeam"
        :to="`/teams/${awardTeam.id}`"
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
            {{ awardTeam.name }}
          </span>
        </span>
        <span
          class="relative shrink-0 text-[0.72rem] text-[hsl(var(--tac-amber))] transition-transform duration-150 group-hover/team:translate-x-0.5"
          aria-hidden="true"
          >◢</span
        >
      </NuxtLink>

      <!-- Award hero with uplight + scanlines -->
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
          <AwardBadge
            :award="award.award"
            :seed-key="award.tournament_id || award.award?.id"
            :placement="award.placement"
            :tournament-name="tournamentName"
            :tournament-start="award.tournament?.start"
            :tournament-type="tournamentType"
            :custom-name="award.tournament_award?.custom_name"
            :silhouette-override="award.tournament_award?.silhouette"
            :image-url="award.tournament_award?.image_url"
            size="lg"
            :interactive="false"
          />
        </div>
      </div>

      <p
        v-if="award.note || award.award?.description"
        class="text-sm text-muted-foreground"
      >
        {{ award.note || award.award?.description }}
      </p>

      <!-- Metadata strip -->
      <dl
        class="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 text-xs"
      >
        <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("awards.placement") }}
          </dt>
          <dd
            class="font-semibold uppercase tracking-wide"
            :style="{ color: tierColor }"
          >
            <template v-if="!hasPlacement || award.placement === 0"
              >★ {{ $t(placementLabelKey) }}</template
            >
            <template v-else>
              #{{ String(award.placement).padStart(2, "0") }} ·
              {{ $t(placementLabelKey) }}
            </template>
          </dd>
        </div>
        <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
          <dt
            class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("awards.tournament") }}
          </dt>
          <dd class="font-semibold">
            {{ tournamentType || award.award?.name || "—" }}
          </dd>
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
        v-if="award.tournament_id"
        :to="`/tournaments/${award.tournament_id}`"
        class="group/link inline-flex items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]"
      >
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[-2px]"
          >▚</span
        >
        {{ $t("awards_modal.view_tournament") }}
        <span
          class="transition-transform duration-150 group-hover/link:translate-x-[2px]"
          >◢</span
        >
      </NuxtLink>
    </DialogContent>
  </Dialog>
</template>
