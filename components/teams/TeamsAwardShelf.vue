<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AwardBadge from "~/components/award/AwardBadge.vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { dateLocale } from "~/utilities/dateLocale";
import type { TeamAwardEntry } from "~/components/teams/teamAwards";

const props = withDefaults(
  defineProps<{ awards: TeamAwardEntry[]; max?: number }>(),
  { max: 5 },
);

const { t } = useI18n();
const router = useRouter();

const isManual = (grant: TeamAwardEntry) => grant.source === "manual";
const linksToTournament = (grant: TeamAwardEntry) =>
  !!grant.tournament_id && !isManual(grant);

function awardName(grant: TeamAwardEntry): string {
  if (isManual(grant)) {
    return (
      grant.tournament_award?.custom_name ||
      grant.award?.name ||
      grant.tournament?.name ||
      ""
    );
  }
  return (
    grant.tournament_award?.custom_name ||
    grant.tournament?.name ||
    grant.award?.name ||
    ""
  );
}

function awardDate(grant: TeamAwardEntry): string | null {
  if (isManual(grant)) return grant.created_at || null;
  return grant.tournament?.start || grant.created_at || null;
}

function placementLabel(placement?: number | null): string {
  if (placement === null || placement === undefined) {
    return t("awards.granted");
  }
  if (placement === 0) return "MVP";
  if (placement === 1) return "1st Place";
  if (placement === 2) return "2nd Place";
  if (placement === 3) return "3rd Place";
  return `#${placement}`;
}

function placementColor(placement?: number | null): string {
  if (placement === 0) return "hsl(195 85% 60%)";
  if (placement === 1) return "hsl(45 95% 60%)";
  if (placement === 2) return "hsl(0 0% 78%)";
  if (placement === 3) return "hsl(28 70% 52%)";
  return "hsl(var(--muted-foreground))";
}

function formatAwardDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(dateLocale(), {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

const recent = computed(() =>
  [...props.awards]
    .sort(
      (a, b) =>
        new Date(awardDate(b) || 0).getTime() -
        new Date(awardDate(a) || 0).getTime(),
    )
    .slice(0, props.max),
);
const extra = computed(() => Math.max(0, props.awards.length - props.max));

function openAward(grant: TeamAwardEntry) {
  if (linksToTournament(grant)) {
    router.push(`/tournaments/${grant.tournament_id}`);
  } else if (grant.award?.id) {
    router.push(`/awards/${grant.award.id}`);
  }
}
</script>

<template>
  <span v-if="awards.length" class="inline-flex items-center gap-1">
    <TooltipProvider
      v-for="grant in recent"
      :key="grant.id"
      :delay-duration="0"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="relative rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
            :aria-label="`${placementLabel(grant.placement)} — ${awardName(grant)}`"
            @click.stop.prevent="openAward(grant)"
          >
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
              size="xs"
              :interactive="false"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[16rem]">
          <div class="flex flex-col gap-0.5">
            <div class="font-semibold leading-tight">
              {{ awardName(grant) }}
            </div>
            <div
              class="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              <span :style="{ color: placementColor(grant.placement) }">
                {{ placementLabel(grant.placement) }}
              </span>
              <template v-if="awardDate(grant)">
                <span class="opacity-50">·</span>
                <span>{{ formatAwardDate(awardDate(grant)) }}</span>
              </template>
            </div>
            <div
              class="mt-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              {{
                linksToTournament(grant)
                  ? $t("ui.click_to_view_tournament")
                  : $t("ui.click_to_view_award")
              }}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <span
      v-if="extra > 0"
      class="ml-0.5 text-xs tabular-nums text-muted-foreground"
      >+{{ extra }}</span
    >
  </span>
</template>
