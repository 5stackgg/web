<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { loginLinks } from "~/utilities/loginLinks";
import { formatPrizePool } from "~/utilities/prizePool";
import { tournamentMapPosters } from "~/utilities/tournamentMapPosters";
import {
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";

const props = defineProps<{ tournament: any }>();

const { t } = useI18n();
const runtimeConfig = useRuntimeConfig();

const path = computed(() => `/tournaments/${props.tournament.id}`);
const state = computed(() => tournamentRowState(props.tournament.status));
const registrationOpen = computed(
  () => props.tournament.status === e_tournament_status_enum.RegistrationOpen,
);
const isGuest = computed(() => !useAuthStore().me?.steam_id);

const bannerSrc = computed(() => {
  if (props.tournament.banner) {
    return `https://${runtimeConfig.public.apiDomain}/${props.tournament.banner}`;
  }
  return tournamentMapPosters(props.tournament, 1)[0] ?? null;
});

// Status and category descriptions come from the database in title case;
// keep acronyms (LAN) and lower the rest so the line reads as a sentence.
function sentenceCase(value: string) {
  return value
    .split(" ")
    .map((word, index) =>
      index === 0 || word === word.toUpperCase() ? word : word.toLowerCase(),
    )
    .join(" ");
}

const statusLabel = computed(() => {
  if (state.value === "live") return t("event.phase.live");
  const description = props.tournament.e_tournament_status?.description;
  return description ? sentenceCase(description) : null;
});

const categories = computed(() =>
  (props.tournament.categories || [])
    .map((category: any) =>
      sentenceCase(
        category.e_tournament_category?.description ?? category.category,
      ),
    )
    .slice(0, 2),
);

const sub = computed(() => {
  const parts: string[] = [];
  const organizer =
    props.tournament.organizer_teams?.[0]?.team?.name ||
    props.tournament.admin?.name;
  if (organizer)
    parts.push(t("pages.watch.tournaments.by", { name: organizer }));
  parts.push(matchTypeLabel(props.tournament.options?.type));
  if (props.tournament.options?.best_of) {
    parts.push(
      t("pages.watch.tournaments.best_of", {
        count: props.tournament.options.best_of,
      }),
    );
  }
  return parts.join(" · ");
});

const startsAt = computed(() => {
  if (!props.tournament.start) return null;
  const start = new Date(props.tournament.start);
  const day = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  return `${day} · ${time}`;
});

const teams = computed(
  () => props.tournament.teams_aggregate?.aggregate?.count ?? 0,
);
const maxTeams = computed(() => props.tournament.stages?.[0]?.max_teams ?? 0);
const teamsLabel = computed(() => {
  if (maxTeams.value > 0) {
    return `${t("pages.watch.tournaments.registered_count", {
      count: teams.value,
      max: maxTeams.value,
    })} ${t("pages.watch.events.count_teams", maxTeams.value)}`;
  }
  return teams.value > 0
    ? `${teams.value} ${t("pages.watch.events.count_teams", teams.value)}`
    : null;
});
const prizePool = computed(() => formatPrizePool(props.tournament.prizes));
const champion = computed(() =>
  state.value === "finished" ? tournamentChampion(props.tournament) : null,
);

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const primaryClasses =
  "bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]";
</script>

<template>
  <article
    class="group/tour grid overflow-hidden rounded-lg border border-border bg-card/40 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
  >
    <NuxtLink
      :to="path"
      tabindex="-1"
      aria-hidden="true"
      class="relative block aspect-[2/1] overflow-hidden bg-muted/40 sm:aspect-auto sm:min-h-[10.5rem]"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/tour:scale-[1.03] motion-reduce:transition-none"
      />
    </NuxtLink>

    <div class="flex min-w-0 flex-col gap-3 p-4">
      <div class="flex min-w-0 flex-col gap-3">
        <p
          v-if="statusLabel || categories.length"
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
        >
          <span
            v-if="state === 'live'"
            class="relative mr-0.5 inline-flex h-2 w-2 shrink-0"
          >
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
            ></span>
          </span>
          <span
            v-if="statusLabel"
            class="font-semibold"
            :class="{
              'text-destructive': state === 'live',
              'text-[hsl(var(--tac-amber))]': registrationOpen,
              'text-foreground/85': state !== 'live' && !registrationOpen,
            }"
          >
            {{ statusLabel }}
          </span>
          <template v-for="category in categories" :key="category">
            <span aria-hidden="true">·</span>
            <span>{{ category }}</span>
          </template>
        </p>

        <div class="min-w-0">
          <h3 class="m-0 text-lg font-bold leading-tight [text-wrap:balance]">
            <NuxtLink
              :to="path"
              class="hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {{ tournament.name }}
            </NuxtLink>
          </h3>
          <p class="m-0 mt-1 text-[0.8125rem] text-muted-foreground">
            {{ sub }}
          </p>
        </div>

        <ul
          class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[0.8125rem] text-foreground/85"
        >
          <li v-if="champion" class="flex items-center gap-1.5 font-semibold">
            <Trophy class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            {{ $t("pages.watch.tournaments.champion", { name: champion }) }}
          </li>
          <li
            v-else-if="startsAt && state === 'upcoming'"
            class="flex items-center gap-1.5"
          >
            <CalendarDays class="h-3.5 w-3.5 text-muted-foreground" />
            {{ startsAt }}
          </li>
          <li
            v-if="tournament.location && state !== 'finished'"
            class="flex min-w-0 items-center gap-1.5"
          >
            <MapPin class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ tournament.location }}</span>
          </li>
          <li
            v-if="teamsLabel && state !== 'finished'"
            class="flex items-center gap-1.5 tabular-nums"
          >
            <Users class="h-3.5 w-3.5 text-muted-foreground" />
            {{ teamsLabel }}
          </li>
          <li
            v-if="prizePool && state !== 'finished'"
            class="flex items-center gap-1.5"
          >
            <Trophy class="h-3.5 w-3.5 text-muted-foreground" />
            {{ $t("pages.watch.events.in_prizes", { amount: prizePool }) }}
          </li>
        </ul>

        <!-- Only once a team is in: an empty bar reads as still loading. -->
        <div
          v-if="state === 'upcoming' && maxTeams > 0 && teams > 0"
          class="h-1 overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            class="h-full bg-[hsl(var(--tac-amber))]"
            :style="{ width: `${Math.min(teams / maxTeams, 1) * 100}%` }"
          ></div>
        </div>
      </div>

      <div class="mt-auto flex flex-wrap gap-2 pt-1">
        <template v-if="registrationOpen">
          <Button
            v-if="isGuest"
            size="sm"
            class="hit h-8 border border-[hsl(var(--tac-amber)/0.55)] bg-transparent text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)]"
            @click="signIn"
          >
            {{ $t("pages.watch.tournaments.sign_in_to_register") }}
          </Button>
          <Button
            v-else
            as-child
            size="sm"
            :class="['hit h-8', primaryClasses]"
          >
            <NuxtLink :to="path">
              {{ $t("pages.watch.tournaments.register") }}
            </NuxtLink>
          </Button>
        </template>
        <Button
          as-child
          size="sm"
          variant="ghost"
          class="hit h-8 text-muted-foreground hover:text-foreground"
        >
          <NuxtLink :to="state === 'finished' ? `${path}?tab=standings` : path">
            {{
              state === "finished"
                ? $t("pages.watch.tournaments.results")
                : $t("pages.watch.tournaments.details")
            }}
          </NuxtLink>
        </Button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 2.75rem);
    height: max(100%, 2.75rem);
    transform: translate(-50%, -50%);
  }
}
</style>
