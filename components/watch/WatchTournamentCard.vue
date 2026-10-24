<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  CalendarDays,
  Check,
  Eye,
  MapPin,
  Trophy,
  Users,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { loginLinks } from "~/utilities/loginLinks";
import { formatPrizePool } from "~/utilities/prizePool";
import { tournamentMapPosters } from "~/utilities/tournamentMapPosters";
import { tournamentRegistrationCount } from "~/utilities/tournamentRegistrationCount";
import { rememberTournaments } from "~/composables/useTournamentPreview";
import {
  matchTypeLabel,
  tournamentChampion,
  tournamentRowState,
} from "~/utilities/watchEventCard";
import { dateLocale } from "~/utilities/dateLocale";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

// `stacked` puts the banner on top from lg up, for a grid column too narrow
// to sit it beside the details; the banner then takes any extra height the
// row hands the card. `quickLook` turns the banner and the card's empty space
// into a quick-look trigger instead of a link.
// `hideChampion` drops the winner line for callers that put their own facts
// in the `facts` slot (the player profile shows that player's finish instead).
const props = defineProps<{
  tournament: any;
  stacked?: boolean;
  quickLook?: boolean;
  hideChampion?: boolean;
}>();
const emit = defineEmits<{ (e: "quick-look"): void }>();

// Its page can then draw the header straight away when this card is opened.
rememberTournaments([props.tournament]);

function onCardClick(event: MouseEvent) {
  if (!props.quickLook) return;
  if ((event.target as HTMLElement).closest("a, button")) return;
  emit("quick-look");
}

const { t } = useI18n();
const runtimeConfig = useRuntimeConfig();

const path = computed(() => `/tournaments/${props.tournament.id}`);
const state = computed(() => tournamentRowState(props.tournament.status));
// A live tournament opens on its bracket from anywhere on the card.
const wholeCardLink = computed(
  () => state.value === "live" && !props.quickLook,
);
const registrationOpen = computed(
  () => props.tournament.status === e_tournament_status_enum.RegistrationOpen,
);
const isGuest = computed(() => !useAuthStore().me?.steam_id);

// Already in: say how, instead of offering to register again.
const joinedLabel = computed(() => {
  if (state.value !== "upcoming" || !props.tournament.joined_tournament) {
    return null;
  }
  const steamId = useAuthStore().me?.steam_id;
  const freeAgent = (props.tournament.free_agents || []).find(
    (agent: any) => String(agent.player_steam_id) === String(steamId),
  );
  if (freeAgent?.status === "waitlisted") {
    return t("pages.watch.tournaments.joined_waitlisted");
  }
  return freeAgent
    ? t("pages.watch.tournaments.joined_free_agent")
    : t("pages.watch.tournaments.joined_team");
});

const bannerSrc = computed(() => {
  if (props.tournament.banner) {
    return resolveAvatarUrl(
      props.tournament.banner,
      runtimeConfig.public.apiDomain,
      1024,
    );
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
  const day = new Intl.DateTimeFormat(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat(dateLocale(), {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  return `${day} · ${time}`;
});

const registration = computed(() =>
  tournamentRegistrationCount(props.tournament),
);
const teams = computed(() => registration.value.count);
const maxTeams = computed(() => registration.value.max ?? 0);
const teamsLabel = computed(() => {
  const unitKey =
    registration.value.unit === "players"
      ? "pages.watch.events.count_players"
      : "pages.watch.events.count_teams";
  if (maxTeams.value > 0) {
    return `${t("pages.watch.tournaments.registered_count", {
      count: teams.value,
      max: maxTeams.value,
    })} ${t(unitKey, maxTeams.value)}`;
  }
  return teams.value > 0 ? `${teams.value} ${t(unitKey, teams.value)}` : null;
});
const prizePool = computed(() => formatPrizePool(props.tournament.prizes));
const champion = computed(() =>
  state.value === "finished" && !props.hideChampion
    ? tournamentChampion(props.tournament)
    : null,
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
    class="group/tour relative grid overflow-hidden rounded-lg border border-border bg-card/40 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
    :class="{
      'lg:grid-cols-1 lg:grid-rows-[1fr_auto]': stacked,
      'cursor-pointer': quickLook,
    }"
    @click="onCardClick"
  >
    <NuxtLink
      v-if="wholeCardLink"
      :to="path"
      tabindex="-1"
      aria-hidden="true"
      class="absolute inset-0 z-[1]"
    />
    <button
      v-if="quickLook"
      type="button"
      class="group/peek relative block aspect-[2/1] overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:aspect-auto sm:min-h-[10.5rem]"
      :aria-label="$t('quick_look.at', { name: tournament.name })"
      @click="emit('quick-look')"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/tour:scale-[1.03] motion-reduce:transition-none"
      />
      <span
        class="absolute bottom-2.5 left-2.5 inline-flex h-[1.625rem] items-center gap-1.5 rounded-md bg-black/70 px-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tour:opacity-100 group-focus-visible/peek:opacity-100"
      >
        <Eye class="h-3.5 w-3.5" />
        {{ $t("quick_look.title") }}
      </span>
    </button>
    <NuxtLink
      v-else
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
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"
            ></span>
          </span>
          <span
            v-if="statusLabel"
            class="font-semibold"
            :class="{
              'text-emerald-400': state === 'live',
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
              class="relative z-[2] hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <slot name="facts" />
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

      <div class="relative z-[2] mt-auto flex flex-wrap gap-2 pt-1">
        <span
          v-if="joinedLabel"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.5)] px-3 text-xs font-semibold text-[hsl(var(--tac-amber))]"
        >
          <Check class="h-3.5 w-3.5" />
          {{ joinedLabel }}
        </span>
        <template v-else-if="registrationOpen">
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
                : state === "live"
                  ? $t("tournament.page.bracket_tab")
                  : $t("pages.watch.tournaments.details")
            }}
          </NuxtLink>
        </Button>
        <slot name="actions" />
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
