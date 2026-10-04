<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import {
  ArrowRight,
  Clock,
  Gauge,
  Lock,
  Users,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { loginLinks } from "~/utilities/loginLinks";
import { matchTypeLabel } from "~/utilities/watchEventCard";
import cleanMapName from "~/utilities/cleanMapName";
import { ordinal } from "~/utilities/tournamentPlayerRank";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";
import TournamentBracketPreview from "~/components/tournament/TournamentBracketPreview.vue";
import TournamentFactList from "~/components/tournament/TournamentFactList.vue";
import TournamentPrizeSplit from "~/components/tournament/TournamentPrizeSplit.vue";

const props = defineProps<{ tournament: any }>();

const { t } = useI18n();
const {
  state,
  paused,
  registrationOpen,
  bannerSrc,
  statusLabel,
  categories,
  sub,
  teams,
  maxTeams,
  teamsLabel,
  spotsLeft,
} = useTournamentDisplay(() => props.tournament);

const { result } = useQuery(
  typedGql("query")({
    tournaments_by_pk: [
      { id: $("id", "uuid!") },
      {
        id: true,
        registration_type: true,
        invite_only: true,
        min_elo: true,
        max_elo: true,
        check_in_required: true,
        check_in_setting: true,
        check_in_opens_before_minutes: true,
        prizes: [
          { order_by: [{ order: order_by.asc }] },
          { place: true, prize: true },
        ],
        options: {
          map_pool: {
            maps: [{}, { id: true, name: true, label: true, poster: true }],
          },
        },
      },
    ],
    event_tournaments: [
      { where: { tournament_id: { _eq: $("id", "uuid!") } }, limit: 1 },
      { event: { id: true, name: true } },
    ],
  } as any),
  () => ({ id: props.tournament.id }),
);

const details = computed(() => (result.value as any)?.tournaments_by_pk);
const event = computed(() =>
  useApplicationSettingsStore().eventsEnabled
    ? ((result.value as any)?.event_tournaments?.[0]?.event ?? null)
    : null,
);

const path = computed(() => `/tournaments/${props.tournament.id}`);
const isGuest = computed(() => !useAuthStore().me?.steam_id);
const inviteOnly = computed(() => !!details.value?.invite_only);
const takesFreeAgents = computed(() =>
  ["both", "free_agents"].includes(details.value?.registration_type),
);

const requirements = computed(() => {
  const d = details.value;
  if (!d) return [];
  const list: Array<{ icon: any; text: string }> = [];
  const type = d.registration_type ?? "teams";
  list.push({
    icon: inviteOnly.value ? Lock : Users,
    text: inviteOnly.value
      ? t("quick_look.join.invite")
      : t(`quick_look.join.${type}`, {
          type: matchTypeLabel(props.tournament.options?.type),
        }),
  });
  if (d.min_elo || d.max_elo) {
    const min = d.min_elo?.toLocaleString();
    const max = d.max_elo?.toLocaleString();
    list.push({
      icon: Gauge,
      text:
        min && max
          ? t("quick_look.elo.range", { min, max })
          : min
            ? t("quick_look.elo.min", { min })
            : t("quick_look.elo.max", { max }),
    });
  }
  if (d.check_in_required) {
    const who =
      d.check_in_setting === "Admin"
        ? "admin"
        : d.check_in_setting === "Players"
          ? "players"
          : "captains";
    const minutes = d.check_in_opens_before_minutes;
    list.push({
      icon: Clock,
      text: [
        t(`quick_look.check_in.${who}`),
        minutes ? t("quick_look.check_in.opens", { minutes }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return list;
});

// Final stage's standings, best first.
const podium = computed(() => {
  const stages = [...(props.tournament.stages || [])].sort(
    (a: any, b: any) => (b.order ?? 0) - (a.order ?? 0),
  );
  const results = stages.find((stage: any) => stage.results?.length)?.results;
  return [...(results || [])]
    .sort((a: any, b: any) => a.rank - b.rank)
    .slice(0, 3)
    .map((row: any) => ({
      rank: row.rank,
      name: row.team?.team?.name || row.team?.name,
    }));
});

const cancelledReason = computed(() => {
  if (props.tournament.status === "CancelledMinTeams") {
    return t("quick_look.cancelled_min_teams");
  }
  if (props.tournament.status === "Cancelled") {
    return t("quick_look.cancelled");
  }
  return null;
});

const maps = computed(() => details.value?.options?.map_pool?.maps ?? []);

const seatFill = computed(() =>
  maxTeams.value > 0 ? Math.min(teams.value / maxTeams.value, 1) * 100 : 0,
);

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const sectionTitle = "m-0 text-xs font-medium text-muted-foreground";
const section = "grid gap-2.5 border-t border-border/65 pt-4";
</script>

<template>
  <div class="relative aspect-[3/1] overflow-hidden bg-muted/40">
    <img
      v-if="bannerSrc"
      :src="bannerSrc"
      alt=""
      class="h-full w-full object-cover"
      :class="{ 'brightness-[0.6] grayscale': cancelledReason }"
    />
  </div>

  <div class="grid gap-5 px-5 pb-6 pt-4">
    <div class="grid gap-1.5">
      <p
        class="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
      >
        <span
          v-if="state === 'live' && !paused"
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
          class="font-semibold"
          :class="{
            'text-destructive': state === 'live' && !paused,
            'text-[hsl(var(--tac-amber))]': registrationOpen,
            'text-foreground/85':
              (state !== 'live' || paused) && !registrationOpen,
          }"
        >
          {{ statusLabel }}
        </span>
        <template v-for="category in categories" :key="category">
          <span aria-hidden="true">·</span>
          <span>{{ category }}</span>
        </template>
      </p>
      <h2 class="m-0 text-2xl font-extrabold leading-tight [text-wrap:balance]">
        {{ tournament.name }}
      </h2>
      <p class="m-0 text-[0.8125rem] text-muted-foreground">{{ sub }}</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button
        v-if="state === 'live' && !paused"
        as-child
        size="sm"
        class="h-8 border border-destructive/55 bg-destructive/10 text-destructive hover:bg-destructive/20"
      >
        <NuxtLink :to="path">{{ $t("pages.tournaments.watch_live") }}</NuxtLink>
      </Button>
      <template v-if="registrationOpen && details && !inviteOnly">
        <Button
          v-if="isGuest"
          size="sm"
          class="h-8 border border-[hsl(var(--tac-amber)/0.55)] bg-transparent text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)]"
          @click="signIn"
        >
          {{ $t("pages.watch.tournaments.sign_in_to_register") }}
        </Button>
        <template v-else>
          <Button
            v-if="details.registration_type !== 'free_agents'"
            as-child
            size="sm"
            class="h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
          >
            <NuxtLink :to="path">
              {{ $t("pages.watch.tournaments.register") }}
            </NuxtLink>
          </Button>
          <Button
            v-if="takesFreeAgents"
            as-child
            size="sm"
            variant="outline"
            class="h-8"
          >
            <NuxtLink :to="path">{{ $t("quick_look.join_free_agent") }}</NuxtLink>
          </Button>
        </template>
      </template>
      <Button
        as-child
        size="sm"
        variant="ghost"
        class="h-8 text-muted-foreground hover:text-foreground"
      >
        <NuxtLink
          :to="state === 'finished' ? `${path}?tab=standings` : path"
        >
          {{
            state === "finished"
              ? $t("pages.watch.tournaments.results")
              : $t("quick_look.open_tournament")
          }}
          <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </Button>
    </div>

    <TournamentFactList :tournament="tournament" :event="event" />

    <div v-if="state === 'live'" :class="section">
      <p :class="sectionTitle">
        {{
          paused
            ? $t("pages.tournaments.bracket_paused")
            : $t("pages.tournaments.bracket")
        }}
      </p>
      <TournamentBracketPreview :tournament-id="tournament.id" :height="300" />
    </div>

    <div v-else-if="state === 'upcoming'" :class="section">
      <p :class="sectionTitle">{{ $t("quick_look.registration") }}</p>
      <div class="flex justify-between gap-3 text-[0.8125rem]">
        <span class="tabular-nums">{{ teamsLabel }}</span>
        <span v-if="registrationOpen && maxTeams > 0" class="text-muted-foreground">
          {{ $t("pages.tournaments.spots_left", { count: spotsLeft }, spotsLeft) }}
        </span>
        <span v-else-if="!registrationOpen" class="text-muted-foreground">
          {{ statusLabel }}
        </span>
      </div>
      <div
        v-if="maxTeams > 0"
        class="h-1 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        <div
          class="h-full bg-[hsl(var(--tac-amber))]"
          :style="{ width: `${seatFill}%` }"
        ></div>
      </div>
      <ul
        v-if="requirements.length"
        class="m-0 mt-1.5 grid list-none gap-2 p-0 text-[0.8125rem] text-foreground/85"
      >
        <li
          v-for="requirement in requirements"
          :key="requirement.text"
          class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2"
        >
          <component
            :is="requirement.icon"
            class="mt-0.5 h-3.5 w-3.5 text-muted-foreground"
          />
          <span>{{ requirement.text }}</span>
        </li>
      </ul>
    </div>

    <div v-else-if="cancelledReason" :class="section">
      <p :class="sectionTitle">{{ statusLabel }}</p>
      <p class="m-0 text-[0.8125rem] text-muted-foreground">
        {{ cancelledReason }}
      </p>
    </div>

    <div v-else-if="podium.length" :class="section">
      <p :class="sectionTitle">{{ $t("quick_look.final_standings") }}</p>
      <ol class="m-0 grid list-none gap-1 p-0">
        <li
          v-for="row in podium"
          :key="row.rank"
          class="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 py-1 text-sm"
        >
          <span
            class="text-xs font-bold tabular-nums"
            :class="
              row.rank === 1
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground'
            "
          >
            {{ ordinal(row.rank) }}
          </span>
          <span class="truncate font-semibold">{{ row.name }}</span>
        </li>
      </ol>
    </div>

    <div
      v-if="state !== 'finished' && details?.prizes?.length"
      :class="section"
    >
      <TournamentPrizeSplit :prizes="details.prizes" />
    </div>

    <div v-if="registrationOpen && maps.length" :class="section">
      <p :class="sectionTitle">{{ $t("quick_look.map_pool") }}</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="map in maps"
          :key="map.id"
          class="inline-flex h-[1.625rem] items-center gap-1.5 rounded-md bg-muted/45 pl-[3px] pr-2 text-xs font-semibold"
        >
          <img
            v-if="map.poster"
            :src="map.poster"
            alt=""
            class="h-5 w-5 rounded object-cover"
          />
          {{ map.label || cleanMapName(map.name) }}
        </span>
      </div>
    </div>
  </div>
</template>
