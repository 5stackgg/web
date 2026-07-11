<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ArrowRight } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import EventPlayerProfile from "~/components/events/EventPlayerProfile.vue";
import EventMediaRail from "~/components/events/EventMediaRail.vue";
import type { Clip } from "~/types/clip";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { matchClipFields } from "~/graphql/matchClip";
import { formatEventDate } from "~/utilities/eventDisplay";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  event: any;
  matches: any[];
  myMatches: any[];
  matchesLoading: boolean;
  leaderboardRows: any[];
  leaderboardLoading: boolean;
}>();

const emit = defineEmits<{ (e: "go", tab: string): void }>();

const me = computed(() => useAuthStore().me);
const { client: apolloClient } = useApolloClient();

const myRow = computed(() => {
  const steamId = me.value?.steam_id;
  if (!steamId) return null;
  const index = props.leaderboardRows.findIndex(
    (row) => String(row.player_steam_id) === String(steamId),
  );
  if (index === -1) return null;
  return { rank: index + 1, ...props.leaderboardRows[index] };
});

const hasForYou = computed(() => myRow.value !== null);

// The logged-in player's full event stat line for the For You banner.
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
  () => [props.event?.id, me.value?.steam_id] as const,
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

// Top public highlights for the event's matches.
const TOP_CLIPS_QUERY = typedGql("query")({
  match_clips: [
    {
      where: {
        visibility: { _eq: "public" },
        match_map: { match_id: { _in: $("matchIds", "[uuid!]!") } },
      },
      order_by: [{ views_count: order_by.desc_nulls_last }],
      limit: 6,
    },
    matchClipFields,
  ],
});

const clips = ref<Clip[]>([]);

let clipsGeneration = 0;
watch(
  () => props.matches.map((match) => match.id).join(","),
  async () => {
    const matchIds = props.matches.map((match) => match.id);
    if (matchIds.length === 0) {
      clips.value = [];
      return;
    }
    const gen = ++clipsGeneration;
    try {
      const { data } = await apolloClient.query({
        query: TOP_CLIPS_QUERY,
        variables: { matchIds },
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

// Clicking a podium card expands the same inline profile the leaderboard uses
// (Concept B), so the viewer never leaves the overview.
const expandedSteamId = ref<string | null>(null);
const collapsingSteamId = ref<string | null>(null);
function togglePodium(steamId: string) {
  if (expandedSteamId.value === steamId) {
    collapsingSteamId.value = steamId;
    window.setTimeout(() => {
      if (collapsingSteamId.value === steamId) {
        expandedSteamId.value = null;
        collapsingSteamId.value = null;
      }
    }, 150);
  } else if (expandedSteamId.value) {
    // Switch: collapse the current profile first, then open the new one.
    collapsingSteamId.value = expandedSteamId.value;
    window.setTimeout(() => {
      expandedSteamId.value = steamId;
      collapsingSteamId.value = null;
    }, 150);
  } else {
    collapsingSteamId.value = null;
    expandedSteamId.value = steamId;
  }
}
const expandedRow = computed(() =>
  topThree.value.find(
    (row) => String(row.player_steam_id) === expandedSteamId.value,
  ),
);

const tournamentEntries = computed(() =>
  (props.event.tournaments || []).filter((entry: any) => !!entry.tournament),
);

function formatDecimal(value: unknown, digits: number): string {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(digits) : "-";
}

function formatTournamentStatus(status?: string | null): string {
  if (!status) return "";
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const RANK_STYLES = [
  "border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)]",
  "border-border bg-card/50",
  "border-border bg-card/50",
];
const RANK_TEXT = [
  "text-[hsl(var(--tac-amber))]",
  "text-gray-300",
  "text-amber-600",
];
</script>

<template>
  <div class="space-y-10">
    <!-- TOP 3 -->
    <section v-if="topThree.length > 0">
      <div
        :class="[
          tacticalSectionLabelClasses,
          '!flex w-full items-center justify-between',
        ]"
      >
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("event.tabs.leaderboard") }}
        </span>
        <button
          class="inline-flex items-center gap-1 font-mono text-[0.65rem] normal-case tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
          @click="emit('go', 'leaderboard')"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <button
          v-for="(row, index) in topThree"
          :key="row.player_steam_id"
          type="button"
          class="flex items-center gap-3 rounded-md border p-3 text-left transition-[border-color,transform] duration-150 hover:-translate-y-px"
          :class="[
            RANK_STYLES[index],
            expandedSteamId === String(row.player_steam_id)
              ? '!border-[hsl(var(--tac-amber))]'
              : '',
          ]"
          @click="togglePodium(String(row.player_steam_id))"
        >
          <span
            class="font-mono text-2xl font-bold tabular-nums"
            :class="RANK_TEXT[index]"
          >
            #{{ index + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <PlayerDisplay
              :player="{
                steam_id: row.player_steam_id,
                name: row.player_name,
                avatar_url: row.player_avatar_url,
                country: row.player_country,
              }"
              size="sm"
              :show-elo="false"
              :show-online="false"
              :show-role="false"
              :linkable="false"
            />
          </div>
          <div class="flex shrink-0 items-center gap-4">
            <div class="flex flex-col items-end">
              <span class="font-mono text-sm font-bold tabular-nums">
                {{ formatDecimal(row.value, 2) }}
              </span>
              <span
                class="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {{ $t("event.overview.rating") }}
              </span>
            </div>
            <div class="flex flex-col items-end">
              <span class="font-mono text-sm font-bold tabular-nums">
                {{ row.matches_played ?? "-" }}
              </span>
              <span
                class="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {{ $t("event.overview.matches") }}
              </span>
            </div>
          </div>
        </button>
      </div>

      <div
        v-if="expandedRow"
        :key="expandedRow.player_steam_id"
        :class="[
          collapsingSteamId === expandedRow?.player_steam_id
            ? 'event-dossier-collapsing'
            : 'event-dossier-reveal',
        ]"
        class="mt-3 rounded-md border border-[hsl(var(--tac-amber)/0.3)] bg-card/40 p-4"
      >
        <EventPlayerProfile
          :event-id="event.id"
          :steam-id="expandedRow.player_steam_id"
          :name="expandedRow.player_name"
          :avatar-url="expandedRow.player_avatar_url"
          :country="expandedRow.player_country"
          :rank="
            topThree.findIndex(
              (r) => r.player_steam_id === expandedRow.player_steam_id,
            ) + 1
          "
          compact
        />
      </div>
    </section>

    <!-- FOR YOU: your event stat line + leaderboard position -->
    <section v-if="hasForYou">
      <div
        :class="[tacticalSectionLabelClasses, '!text-[hsl(var(--tac-amber))]']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.overview.for_you") }}
      </div>

      <div
        class="flex flex-wrap items-stretch gap-4 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.05)] p-4"
      >
        <button
          type="button"
          class="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] px-5 py-2 transition-colors hover:bg-[hsl(var(--tac-amber)/0.16)]"
          @click="emit('go', 'leaderboard')"
        >
          <span
            class="font-mono text-3xl font-bold leading-none tabular-nums text-[hsl(var(--tac-amber))]"
          >
            {{ myRow ? `#${myRow.rank}` : "-" }}
          </span>
          <span
            class="font-mono text-[0.56rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("event.overview.rank") }}
          </span>
        </button>

        <div
          class="grid flex-1 grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7"
        >
          <div
            v-for="tile in myTiles"
            :key="tile.key"
            class="flex flex-col gap-0.5"
          >
            <span class="font-mono text-xl font-bold tabular-nums">
              {{ tile.value }}
            </span>
            <span
              class="font-mono text-[0.56rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ $t(`event.player.${tile.key}`) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- MEDIA: the star of the show -->
    <EventMediaRail :event="event" @go="(tab) => emit('go', tab)" />

    <!-- HIGHLIGHTS -->
    <section v-if="clips.length > 0">
      <div
        :class="[
          tacticalSectionLabelClasses,
          '!flex w-full items-center justify-between',
        ]"
      >
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("event.story.highlights") }}
        </span>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HighlightCard v-for="clip in clips" :key="clip.id" :clip="clip" />
      </div>
    </section>

    <!-- TOURNAMENTS -->
    <section v-if="tournamentEntries.length > 0">
      <div :class="[tacticalSectionLabelClasses]">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.tabs.tournaments") }}
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="entry in tournamentEntries"
          :key="entry.tournament_id"
          :to="{
            name: 'tournaments-tournamentId',
            params: { tournamentId: entry.tournament.id },
          }"
          class="block rounded-md border border-border/70 bg-card/40 p-4 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-card/60"
        >
          <div class="flex items-center justify-between gap-2">
            <Badge variant="outline">
              {{ formatTournamentStatus(entry.tournament.status) }}
            </Badge>
            <span
              v-if="formatEventDate(entry.tournament.start)"
              class="text-xs text-muted-foreground"
            >
              {{ formatEventDate(entry.tournament.start) }}
            </span>
          </div>
          <h3
            class="mt-2 truncate font-sans text-base font-bold text-foreground"
          >
            {{ entry.tournament.name }}
          </h3>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.event-dossier-reveal {
  animation: dossier-reveal 0.22s ease-out;
}
@keyframes dossier-reveal {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.event-dossier-collapsing {
  animation: dossier-collapse 0.16s ease-in forwards;
}
@keyframes dossier-collapse {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .event-dossier-reveal,
  .event-dossier-collapsing {
    animation: none;
  }
}
</style>
