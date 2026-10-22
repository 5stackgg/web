<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import TeamCalendarButton from "~/components/team/TeamCalendarButton.vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import ScrimRequestCard from "~/components/scrims/ScrimRequestCard.vue";
import ScrimWeek from "~/components/scrims/ScrimWeek.vue";
import {
  awaitingTeam,
  scrimOpponent,
  useScrimClock,
  useScrimTeamRequests,
} from "~/composables/useScrimFinder";
import teamAvatarSrc from "~/utilities/teamAvatar";
import mapLabel from "~/utilities/mapLabel";
import { shortDateLabel } from "~/utilities/scrimFormat";
import { openIntervals } from "~/utilities/scrimSchedule";

const props = defineProps<{ team: any }>();
const emit = defineEmits<{ (e: "open", opponent: any): void }>();

const now = useScrimClock();
const { requests, played, booked } = useScrimTeamRequests(() => props.team?.id, {
  played: true,
});

const mine = computed(() => openIntervals(props.team?.scrim_availability, now.value));
const needsYou = computed(() =>
  requests.value.filter((request) => awaitingTeam(request, props.team.id)),
);
const waiting = computed(() =>
  requests.value.filter(
    (request) => request.status !== "Matched" && !awaitingTeam(request, props.team.id),
  ),
);
const lockedBy = computed(() =>
  booked.value ? scrimOpponent(booked.value, props.team.id)?.name ?? null : null,
);
const reputation = computed(() => props.team?.reputation ?? null);

// A request picked in the week scrolls to its card and rings it for a moment.
const flashed = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | undefined;
function focusRequest(id: string) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(`scrim-request-${id}`)
    ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  flashed.value = id;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (flashed.value = null), 1600);
}
onBeforeUnmount(() => clearTimeout(flashTimer));
const ring = (id: string) => [
  "transition-shadow duration-300",
  { "ring-2 ring-[hsl(var(--tac-amber)/0.5)]": flashed.value === id },
];

function ourLineup(match: any) {
  return match.lineup_1?.team_id === props.team.id ? match.lineup_1 : match.lineup_2;
}
function theirLineup(match: any) {
  return match.lineup_1?.team_id === props.team.id ? match.lineup_2 : match.lineup_1;
}
</script>

<template>
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center gap-3">
      <p class="min-w-[14rem] flex-1 text-sm text-muted-foreground">
        {{ $t("scrims.requests.intro") }}
      </p>
      <TeamCalendarButton :team-id="team.id" quiet />
    </div>

    <ScrimWeek :team="team" :requests="requests" :now="now" @focus="focusRequest" />

    <div class="flex flex-wrap items-start gap-6">
      <div class="grid min-w-0 flex-[999_1_34rem] gap-6">
        <section v-if="needsYou.length" class="grid gap-2">
          <h3 class="text-sm font-semibold">{{ $t("scrims.requests.needs_you") }}</h3>
          <ScrimRequestCard
            v-for="(request, index) in needsYou"
            :id="`scrim-request-${request.id}`"
            :key="request.id"
            :class="ring(request.id)"
            :request="request"
            :team-id="team.id"
            :team-name="team.name"
            :now="now"
            :mine="mine"
            :locked-by="lockedBy"
            :urgent="index === 0 && !lockedBy"
            show-open
            @open="(opponent) => emit('open', opponent)"
          />
        </section>

        <section v-if="booked" class="grid gap-2">
          <h3 class="text-sm font-semibold">{{ $t("scrims.requests.booked") }}</h3>
          <ScrimRequestCard
            :id="`scrim-request-${booked.id}`"
            :class="ring(booked.id)"
            :request="booked"
            :team-id="team.id"
            :team-name="team.name"
            :now="now"
            show-open
            @open="(opponent) => emit('open', opponent)"
          />
        </section>

        <section v-if="waiting.length" class="grid gap-2">
          <h3 class="text-sm font-semibold">{{ $t("scrims.requests.waiting") }}</h3>
          <ScrimRequestCard
            v-for="request in waiting"
            :id="`scrim-request-${request.id}`"
            :key="request.id"
            :class="ring(request.id)"
            :request="request"
            :team-id="team.id"
            :team-name="team.name"
            :now="now"
            show-open
            @open="(opponent) => emit('open', opponent)"
          />
        </section>

        <SectionEmpty
          v-if="!needsYou.length && !booked && !waiting.length"
          :title="$t('scrims.requests.empty_title')"
          :description="$t('scrims.requests.empty_description')"
        />
      </div>

      <section v-if="played.length" class="grid min-w-0 flex-[1_1_20rem] gap-2">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <h3 class="text-sm font-semibold">{{ $t("scrims.requests.played") }}</h3>
          <span v-if="reputation?.reliability_pct != null" class="text-xs text-muted-foreground">
            {{
              $t("scrims.requests.record", {
                pct: reputation.reliability_pct,
                played: reputation.scrims_completed ?? 0,
              })
            }}
            <template v-if="reputation.no_shows">
              · {{ $t("scrims.sheet.no_shows", { count: reputation.no_shows }, reputation.no_shows) }}
            </template>
            <template v-if="reputation.late_cancels">
              · {{ $t("scrims.sheet.late_cancels", { count: reputation.late_cancels }, reputation.late_cancels) }}
            </template>
          </span>
        </div>
        <div class="divide-y divide-border overflow-hidden rounded-lg border border-border">
          <NuxtLink
            v-for="row in played"
            :key="row.id"
            :to="`/matches/${row.match.id}`"
            class="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/20"
          >
            <span class="tabular-nums text-muted-foreground">{{ shortDateLabel(new Date(row.proposed_scheduled_at).getTime()) }}</span>
            <span class="flex min-w-0 items-center gap-2">
              <Avatar shape="square" class="h-6 w-6 shrink-0 rounded">
                <AvatarImage
                  v-if="teamAvatarSrc(scrimOpponent(row, team.id))"
                  :src="teamAvatarSrc(scrimOpponent(row, team.id))!"
                  :alt="scrimOpponent(row, team.id)?.name"
                />
                <AvatarFallback class="rounded text-[0.55rem] font-semibold uppercase">
                  {{ (scrimOpponent(row, team.id)?.name || "?").slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
              <span class="truncate">{{ scrimOpponent(row, team.id)?.name }}</span>
              <img
                v-if="row.match.match_maps?.length === 1 && row.match.match_maps[0].map?.patch"
                :src="row.match.match_maps[0].map.patch"
                :alt="mapLabel(row.match.match_maps[0].map)"
                :title="mapLabel(row.match.match_maps[0].map)"
                class="h-4 w-4 object-contain"
              />
            </span>
            <span class="flex items-center gap-1 tabular-nums">
              <MatchLineupScoreDisplay :match="row.match" :lineup="ourLineup(row.match)" :halves="false" />
              <span class="text-muted-foreground">:</span>
              <MatchLineupScoreDisplay :match="row.match" :lineup="theirLineup(row.match)" :halves="false" />
            </span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
