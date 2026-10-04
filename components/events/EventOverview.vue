<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { NuxtLink } from "#components";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventMatchRow from "~/components/events/EventMatchRow.vue";
import ClipTile from "~/components/clips/ClipTile.vue";
import QuickLookSheet from "~/components/common/QuickLookSheet.vue";
import EventSection from "~/components/events/EventSection.vue";
import EventPlayerProfile from "~/components/events/EventPlayerProfile.vue";
import EventMediaCard from "~/components/events/EventMediaCard.vue";
import EventMediaLightbox from "~/components/events/EventMediaLightbox.vue";
import TournamentCard from "~/components/tournament/TournamentCard.vue";
import TournamentBracketPreview from "~/components/tournament/TournamentBracketPreview.vue";
import { tournamentStatusVariant } from "~/components/tournament/tournamentCard";
import { TICKER_LIVE_STATUSES } from "~/components/watch/watchTicker";
import type { Clip } from "~/types/clip";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { matchClipFields, topPlayOrderBy } from "~/graphql/matchClip";
import {
  daysUntil,
  formatEventRange,
  type EventPhase,
} from "~/utilities/eventDisplay";

// The overview reorders itself by phase: before the event it sells the event
// (when, sign-ups, who's going), during it follows the action (live matches,
// brackets, the leaderboard so far), after it tells what happened (podium,
// your line, results, moments).
const props = defineProps<{
  event: any;
  phase: EventPhase;
  refreshKey: string;
  matches: any[];
  matchesTotal: number;
  matchesLoading: boolean;
  leaderboardRows: any[];
  leaderboardLoading: boolean;
  players: any[];
  teams: any[];
}>();

const emit = defineEmits<{ (e: "go", tab: string): void }>();

const { t } = useI18n();
const me = computed(() => useAuthStore().me);
const { client: apolloClient } = useApolloClient();
const apiDomain = useRuntimeConfig().public.apiDomain;

const myRow = computed(() => {
  const steamId = me.value?.steam_id;
  if (!steamId) return null;
  const index = props.leaderboardRows.findIndex(
    (row) => String(row.player_steam_id) === String(steamId),
  );
  if (index === -1) return null;
  return { rank: index + 1, ...props.leaderboardRows[index] };
});

// The logged-in player's full event stat line.
const MY_STATS_QUERY = typedGql("query")({
  v_event_player_stats: [
    {
      where: {
        event_id: { _eq: $("eventId", "uuid!") },
        player_steam_id: { _eq: $("steamId", "bigint!") },
      },
    },
    {
      kills: true,
      deaths: true,
      assists: true,
      matches_played: true,
      kdr: true,
      headshot_percentage: true,
    },
  ],
  get_event_leaderboard: [
    {
      args: {
        _event_id: $("eventId", "uuid!"),
        _category: "adr",
        _match_type: null,
        _min_rounds: 0,
      },
      where: { player_steam_id: { _eq: $("steamIdText", "String!") } },
    },
    { value: true },
  ],
});

const myStats = ref<any | null>(null);
const myAdr = ref<number | null>(null);

let myGen = 0;
watch(
  () => [props.event?.id, me.value?.steam_id, props.refreshKey] as const,
  async ([eventId, steamId]) => {
    myStats.value = null;
    myAdr.value = null;
    if (!eventId || !steamId) return;
    const gen = ++myGen;
    try {
      const { data } = await apolloClient.query({
        query: MY_STATS_QUERY,
        variables: { eventId, steamId, steamIdText: String(steamId) },
        fetchPolicy: "network-only",
      });
      if (gen !== myGen) return;
      myStats.value = (data as any)?.v_event_player_stats?.[0] ?? null;
      const adrRow = (data as any)?.get_event_leaderboard?.[0];
      myAdr.value = adrRow ? Number(adrRow.value) : null;
    } catch (error) {
      if (gen === myGen) {
        console.error("Error fetching your event stats:", error);
      }
    }
  },
  { immediate: true },
);

function fmt(value: unknown, digits = 0): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return digits > 0 ? n.toFixed(digits) : Math.round(n).toLocaleString();
}

const myTiles = computed(() => [
  { key: "kills", value: fmt(myStats.value?.kills) },
  { key: "deaths", value: fmt(myStats.value?.deaths) },
  { key: "assists", value: fmt(myStats.value?.assists) },
  { key: "kdr", value: fmt(myStats.value?.kdr, 2) },
  { key: "adr", value: myAdr.value !== null ? fmt(myAdr.value, 1) : "-" },
  {
    key: "hs",
    value:
      myStats.value?.headshot_percentage != null
        ? `${fmt(myStats.value.headshot_percentage, 1)}%`
        : "-",
  },
  { key: "matches", value: fmt(myStats.value?.matches_played) },
]);

const TOP_CLIPS_QUERY = typedGql("query")({
  match_clips: [
    {
      where: {
        visibility: { _eq: "public" },
        match_map: {
          match: {
            event_links: { event_id: { _eq: $("eventId", "uuid!") } },
          },
        },
      },
      order_by: topPlayOrderBy,
      limit: 4,
    },
    matchClipFields,
  ],
});

const clips = ref<Clip[]>([]);

let clipsGeneration = 0;
watch(
  [() => props.event?.id, () => props.refreshKey],
  async ([eventId]) => {
    if (!eventId) {
      clips.value = [];
      return;
    }
    const gen = ++clipsGeneration;
    try {
      const { data } = await apolloClient.query({
        query: TOP_CLIPS_QUERY,
        variables: { eventId },
        fetchPolicy: "network-only",
      });
      if (gen !== clipsGeneration) return;
      clips.value = ((data as any)?.match_clips ?? []) as Clip[];
    } catch (error) {
      if (gen !== clipsGeneration) return;
      console.error("Error fetching event highlights:", error);
      clips.value = [];
    }
  },
  { immediate: true },
);

const topThree = computed(() => props.leaderboardRows.slice(0, 3));
const topFive = computed(() => props.leaderboardRows.slice(0, 5));

const liveMatches = computed(() =>
  props.matches.filter((match) =>
    (TICKER_LIVE_STATUSES as readonly string[]).includes(match.status),
  ),
);
const finishedMatches = computed(() =>
  props.matches.filter((match) => match.status === "Finished"),
);

const tournaments = computed(() =>
  (props.event.tournaments || [])
    .map((entry: any) => entry.tournament)
    .filter(Boolean),
);
const liveTournaments = computed(() =>
  tournaments.value.filter(
    (tournament: any) => tournamentStatusVariant(tournament.status) === "live",
  ),
);
const otherTournaments = computed(() =>
  tournaments.value.filter(
    (tournament: any) => tournamentStatusVariant(tournament.status) !== "live",
  ),
);

// "Sign up" only while something is open; "Champions" only once every one
// of them has finished.
const tournamentsLabel = computed(() => {
  const statuses = otherTournaments.value.map(
    (tournament: any) => tournament.status,
  );
  if (statuses.includes("RegistrationOpen")) return t("event.overview.sign_up");
  if (
    statuses.length &&
    statuses.every((status: string) => status === "Finished")
  )
    return t("event.overview.champions");
  return t("event.tabs.tournaments");
});

const media = computed(() =>
  (props.event.media || []).filter(
    (item: any) => item.id !== props.event.banner_media_id,
  ),
);
const moments = computed(() => media.value.slice(0, 6));
const viewingMediaId = ref<string | null>(null);

const range = computed(() =>
  formatEventRange(props.event.starts_at, props.event.ends_at),
);
const startsIn = computed(() => daysUntil(props.event.starts_at));
const startDate = computed(() =>
  props.event.starts_at ? new Date(props.event.starts_at) : null,
);
const endDate = computed(() =>
  props.event.ends_at ? new Date(props.event.ends_at) : null,
);
const dateBlock = computed(() => {
  if (!startDate.value) return null;
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(
    startDate.value,
  );
  const sameMonth =
    endDate.value && endDate.value.getMonth() === startDate.value.getMonth();
  return {
    month,
    days:
      endDate.value && sameMonth
        ? `${startDate.value.getDate()}–${endDate.value.getDate()}`
        : String(startDate.value.getDate()),
  };
});
function dayTime(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : null;
}

// Podium + leaderboard rows open the player's event profile in a quick-look
// sheet that steps through the same list.
const profileRows = ref<any[]>([]);
const profileIndex = ref(0);
const profileOpen = ref(false);
const profileRow = computed(() => profileRows.value[profileIndex.value]);
function openProfile(rows: any[], index: number) {
  profileRows.value = rows;
  profileIndex.value = index;
  profileOpen.value = true;
}
function stepProfile(direction: -1 | 1) {
  profileIndex.value = Math.min(
    profileRows.value.length - 1,
    Math.max(0, profileIndex.value + direction),
  );
}

function teamAvatar(url?: string | null): string | null {
  return url ? `https://${apiDomain}/${url}` : null;
}
function teamInitials(team: { name: string; short_name?: string | null }) {
  return (team.short_name || team.name || "?").slice(0, 2).toUpperCase();
}

const cardClasses = "rounded-lg border border-border bg-card/40";
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start">
    <div class="grid min-w-0 gap-8">
      <!-- UPCOMING: when -->
      <div
        v-if="phase === 'upcoming' && dateBlock"
        :class="[
          cardClasses,
          'flex flex-wrap items-center gap-x-5 gap-y-4 border-[hsl(var(--tac-amber)/0.3)] p-4 sm:p-5',
        ]"
      >
        <div
          class="grid h-[4.75rem] w-[4.5rem] shrink-0 place-content-center justify-items-center gap-1 rounded-md bg-[hsl(var(--tac-amber)/0.12)] leading-none"
        >
          <span class="text-xs font-semibold text-[hsl(var(--tac-amber))]">{{
            dateBlock.month
          }}</span>
          <span class="text-2xl font-extrabold tabular-nums">{{
            dateBlock.days
          }}</span>
        </div>
        <div class="grid min-w-0 flex-[1_1_15rem] gap-1">
          <span class="text-xl font-bold">{{ range }}</span>
          <span
            v-if="startDate && endDate"
            class="text-[0.8125rem] text-muted-foreground"
          >
            {{
              $t("event.overview.runs", {
                starts: dayTime(startDate),
                ends: dayTime(endDate),
              })
            }}
          </span>
        </div>
        <div v-if="startsIn !== null" class="grid justify-items-end gap-0.5">
          <span
            class="text-[1.75rem] font-extrabold leading-none tabular-nums"
            >{{ startsIn }}</span
          >
          <span class="text-xs text-muted-foreground">{{
            $t("event.overview.days_to_go", startsIn)
          }}</span>
        </div>
      </div>

      <!-- LIVE: what's on right now -->
      <EventSection
        v-if="phase === 'live' && liveMatches.length"
        :label="$t('event.overview.live_now')"
      >
        <div
          class="grid divide-y divide-border/70 overflow-hidden rounded-lg border border-destructive/40 bg-card/40"
        >
          <EventMatchRow
            v-for="match in liveMatches"
            :key="match.id"
            :match="match"
          />
        </div>
      </EventSection>

      <EventSection
        v-for="tournament in phase === 'live' ? liveTournaments : []"
        :key="tournament.id"
        :label="tournament.name"
        :more="$t('event.tabs.tournaments')"
        @more="emit('go', 'tournaments')"
      >
        <TournamentBracketPreview :tournament-id="tournament.id" />
      </EventSection>

      <!-- Tournaments: champions after, sign-ups before, the rest otherwise -->
      <EventSection
        v-if="otherTournaments.length"
        :label="tournamentsLabel"
        :more="
          tournaments.length > otherTournaments.length ||
          otherTournaments.length > 2
            ? $t('common.see_all')
            : undefined
        "
        @more="emit('go', 'tournaments')"
      >
        <div class="grid gap-3 xl:grid-cols-2">
          <TournamentCard
            v-for="tournament in otherTournaments.slice(0, 4)"
            :key="tournament.id"
            :tournament="tournament"
            variant="compact"
            :status-variant="tournamentStatusVariant(tournament.status)"
          />
        </div>
      </EventSection>

      <!-- Podium (after) / leaderboard so far (during) -->
      <EventSection
        v-if="phase === 'finished' && topThree.length"
        :label="$t('event.overview.top')"
        :more="$t('event.overview.full_leaderboard')"
        @more="emit('go', 'players')"
      >
        <div class="grid gap-2.5 sm:grid-cols-3">
          <button
            v-for="(row, index) in topThree"
            :key="row.player_steam_id"
            type="button"
            class="grid min-w-0 gap-2.5 rounded-lg border p-3.5 text-left transition-[border-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="
              index === 0
                ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.08),transparent_75%)] hover:border-[hsl(var(--tac-amber)/0.7)]'
                : 'border-border bg-card/40 hover:border-[hsl(var(--tac-amber)/0.5)]'
            "
            @click="openProfile(topThree, index)"
          >
            <span class="flex min-w-0 items-center gap-2.5">
              <span
                class="w-6 shrink-0 text-[0.8125rem] font-extrabold tabular-nums"
                :class="
                  index === 0
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
                >#{{ index + 1 }}</span
              >
              <PlayerDisplay
                class="min-w-0"
                :player="{
                  steam_id: row.player_steam_id,
                  name: row.player_name,
                  avatar_url: row.player_avatar_url,
                  country: row.player_country,
                }"
                size="sm"
                :show-flag="false"
                :show-elo="false"
                :show-online="false"
                :show-role="false"
                :linkable="false"
              />
            </span>
            <span class="flex items-end justify-between gap-2.5">
              <span
                class="text-[1.625rem] font-extrabold leading-none tabular-nums"
                :class="index === 0 ? 'text-[hsl(var(--tac-amber))]' : ''"
                >{{ fmt(row.value, 2) }}</span
              >
              <span
                class="text-right text-xs leading-snug text-muted-foreground tabular-nums"
              >
                {{ $t("event.overview.rating") }}<br />
                {{ fmt(row.secondary_value) }}–{{ fmt(row.tertiary_value) }}
                ·
                {{ $t("event.header.matches", row.matches_played ?? 0) }}
              </span>
            </span>
          </button>
        </div>
      </EventSection>

      <EventSection
        v-if="phase === 'live' && topFive.length"
        :label="$t('event.overview.leaderboard_so_far')"
        :more="$t('event.overview.full_leaderboard')"
        @more="emit('go', 'players')"
      >
        <ol
          :class="[
            cardClasses,
            'm-0 grid list-none divide-y divide-border/70 overflow-hidden p-0',
          ]"
        >
          <li v-for="(row, index) in topFive" :key="row.player_steam_id">
            <button
              type="button"
              class="grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto_auto] items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              @click="openProfile(topFive, index)"
            >
              <span
                class="text-[0.8125rem] font-extrabold tabular-nums"
                :class="
                  index === 0
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
                >#{{ index + 1 }}</span
              >
              <PlayerDisplay
                class="min-w-0"
                :player="{
                  steam_id: row.player_steam_id,
                  name: row.player_name,
                  avatar_url: row.player_avatar_url,
                  country: row.player_country,
                }"
                size="xs"
                :show-flag="false"
                :show-elo="false"
                :show-online="false"
                :show-role="false"
                :linkable="false"
              />
              <span class="font-bold tabular-nums">{{
                fmt(row.value, 2)
              }}</span>
              <span
                class="min-w-[4rem] text-right text-xs text-muted-foreground tabular-nums"
                >{{ fmt(row.secondary_value) }}–{{
                  fmt(row.tertiary_value)
                }}</span
              >
            </button>
          </li>
        </ol>
      </EventSection>

      <!-- Your line -->
      <EventSection
        v-if="phase !== 'upcoming' && myRow"
        :label="
          phase === 'live'
            ? $t('event.overview.your_day')
            : $t('event.overview.your_event')
        "
      >
        <div
          class="flex flex-wrap items-center gap-x-5 gap-y-3.5 rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.05)] px-4 py-3.5"
        >
          <button
            type="button"
            class="grid min-w-[4.75rem] place-content-center justify-items-center gap-0.5 rounded-md bg-[hsl(var(--tac-amber)/0.1)] px-3 py-2 transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)/0.17)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="$t('event.overview.open_profile')"
            @click="openProfile(leaderboardRows, myRow.rank - 1)"
          >
            <span
              class="text-[1.625rem] font-extrabold leading-none text-[hsl(var(--tac-amber))] tabular-nums"
              >#{{ myRow.rank }}</span
            >
            <span class="whitespace-nowrap text-xs text-muted-foreground">{{
              $t("event.overview.of_players", {
                count: leaderboardRows.length,
              })
            }}</span>
          </button>
          <dl
            class="m-0 grid flex-[1_1_27.5rem] grid-cols-4 gap-x-3.5 gap-y-2.5 md:grid-cols-7"
          >
            <div
              v-for="tile in myTiles"
              :key="tile.key"
              class="flex min-w-0 flex-col-reverse gap-0.5"
            >
              <dt class="whitespace-nowrap text-xs text-muted-foreground">
                {{ $t(`event.player.${tile.key}`) }}
              </dt>
              <dd class="m-0 text-lg font-bold leading-tight tabular-nums">
                {{ tile.value }}
              </dd>
            </div>
          </dl>
        </div>
      </EventSection>

      <!-- Results -->
      <EventSection
        v-if="phase !== 'upcoming' && finishedMatches.length"
        :label="
          phase === 'live'
            ? $t('event.overview.results_so_far')
            : $t('event.overview.results')
        "
        :more="$t('common.see_all')"
        @more="emit('go', 'matches')"
      >
        <div
          :class="[
            cardClasses,
            'grid divide-y divide-border/70 overflow-hidden',
          ]"
        >
          <EventMatchRow
            v-for="match in finishedMatches.slice(0, phase === 'live' ? 4 : 5)"
            :key="match.id"
            :match="match"
          />
        </div>
      </EventSection>

      <!-- Highlights: public match clips -->
      <EventSection
        v-if="phase !== 'upcoming' && clips.length"
        :label="$t('event.story.highlights')"
        :more="$t('common.see_all')"
        @more="emit('go', 'media')"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <ClipTile
            v-for="clip in clips"
            :key="clip.id"
            :clip="clip"
            :queue="clips"
            :queue-scope="`event-overview:${event.id}`"
          />
        </div>
      </EventSection>

      <!-- UPCOMING: who's going -->
      <EventSection
        v-if="phase === 'upcoming' && players.length"
        :label="$t('event.overview.whos_going')"
        :more="$t('common.see_all')"
        @more="emit('go', 'players')"
      >
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="player in players.slice(0, 12)"
            :key="player.steam_id"
            class="flex min-w-0 items-center rounded-lg border px-2.5 py-2"
            :class="
              String(player.steam_id) === String(me?.steam_id)
                ? 'border-[hsl(var(--tac-amber)/0.45)] bg-card/40'
                : 'border-border bg-card/40'
            "
          >
            <PlayerDisplay
              class="min-w-0"
              :player="player"
              size="xs"
              :show-role="false"
              :show-elo="false"
              :show-online="false"
              :tooltip="false"
              linkable
            />
          </div>
        </div>
      </EventSection>

      <div
        v-if="
          phase === 'upcoming' && !players.length && !otherTournaments.length
        "
        class="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("event.overview.upcoming_empty") }}
      </div>
      <div
        v-else-if="
          phase !== 'upcoming' &&
          !leaderboardLoading &&
          !matchesLoading &&
          !leaderboardRows.length &&
          !matches.length &&
          !tournaments.length
        "
        class="rounded-lg border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("event.overview.nothing_yet") }}
      </div>
    </div>

    <aside class="grid min-w-0 gap-8">
      <EventSection
        v-if="moments.length"
        :label="
          phase === 'live'
            ? $t('event.overview.latest_uploads')
            : phase === 'upcoming'
              ? $t('event.overview.from_organizers')
              : $t('event.overview.moments')
        "
        :more="media.length > moments.length ? $t('common.see_all') : undefined"
        @more="emit('go', 'media')"
      >
        <div
          class="grid gap-2.5"
          :class="moments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'"
        >
          <EventMediaCard
            v-for="item in moments"
            :key="item.id"
            :event="event"
            :item="item"
            @view="(id: string) => (viewingMediaId = id)"
          />
        </div>
        <EventMediaLightbox
          v-model:media-id="viewingMediaId"
          :event="event"
          :items="media"
        />
      </EventSection>

      <EventSection
        v-if="teams.length"
        :label="$t('event.teams.title')"
        :more="teams.length > 4 ? $t('common.see_all') : undefined"
        @more="emit('go', 'players')"
      >
        <div class="grid gap-2">
          <component
            :is="team.id ? NuxtLink : 'div'"
            v-for="team in teams.slice(0, 4)"
            :key="team.id || team.name"
            :to="
              team.id
                ? { name: 'teams-id', params: { id: team.id } }
                : undefined
            "
            :class="[
              cardClasses,
              'flex min-w-0 items-center gap-3 p-3',
              team.id
                ? 'transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : '',
            ]"
          >
            <span
              class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-muted/40 text-xs font-bold text-muted-foreground"
            >
              <img
                v-if="teamAvatar(team.avatar_url)"
                :src="teamAvatar(team.avatar_url)!"
                alt=""
                class="h-full w-full object-cover"
              />
              <template v-else>{{ teamInitials(team) }}</template>
            </span>
            <span class="truncate text-sm font-semibold">{{ team.name }}</span>
          </component>
        </div>
      </EventSection>
    </aside>
  </div>

  <QuickLookSheet
    v-model:open="profileOpen"
    :index="profileIndex"
    :total="profileRows.length"
    :title="profileRow?.player_name ?? ''"
    @step="stepProfile"
  >
    <div v-if="profileRow" class="p-4 sm:p-5">
      <EventPlayerProfile
        :event-id="event.id"
        :steam-id="String(profileRow.player_steam_id)"
        :name="profileRow.player_name"
        :avatar-url="profileRow.player_avatar_url"
        :country="profileRow.player_country"
        :rank="
          leaderboardRows.findIndex(
            (row) => row.player_steam_id === profileRow.player_steam_id,
          ) + 1
        "
      />
    </div>
  </QuickLookSheet>
</template>
