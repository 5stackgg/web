<script setup lang="ts">
import { computed, ref, watch } from "vue";
import gql from "graphql-tag";
import PlayMoreWaysView from "~/components/play/PlayMoreWaysView.vue";
import { useCurrentLeagueSeason } from "~/composables/useCurrentLeagueSeason";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const settings = useApplicationSettingsStore();

// Only a season that is taking signups belongs here; the rest of the league
// lives on its own pages.
const { currentSeason } = useCurrentLeagueSeason();
const league = ref<any | null>(null);

// Raw gql, like graphql/leagues.ts: league tables may predate a codegen run.
const LEAGUE_SIGNUP_QUERY = gql`
  query GetLeagueSignup($seasonId: uuid!) {
    league_seasons_by_pk(id: $seasonId) {
      id
      name
      season_number
      signup_closes_at
      team_seasons_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

watch(
  () =>
    settings.leaguesEnabled &&
    currentSeason.value?.status === "RegistrationOpen"
      ? currentSeason.value.id
      : null,
  async (seasonId) => {
    league.value = null;
    if (!seasonId) return;
    try {
      const { data } = await getGraphqlClient().query({
        query: LEAGUE_SIGNUP_QUERY,
        variables: { seasonId },
        fetchPolicy: "network-only",
      });
      league.value = (data as any)?.league_seasons_by_pk ?? null;
    } catch (error) {
      console.error("[play] league signup error:", error);
    }
  },
  { immediate: true },
);

const practiceEnabled = computed(
  () =>
    settings.settings.find(
      (setting) => setting.name === "public.utility_practice_enabled",
    )?.value === "true",
);
</script>

<template>
  <PlayMoreWaysView
    :guest="isGuest"
    :tournaments="tournaments"
    :league="leagueCard(league)"
    :scrims="scrimsCard"
    :servers="serverTiles"
    :practice-enabled="practiceEnabled"
  />
</template>

<script lang="ts">
import {
  $,
  e_server_types_enum,
  e_tournament_status_enum,
  order_by,
} from "~/generated/zeus";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { excludeLeagueTournaments } from "~/graphql/tournamentFilters";
import { tournamentCardFields } from "~/graphql/tournamentCardFields";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import cleanMapName from "~/utilities/cleanMapName";
import { countScrimTeamsToday } from "~/utilities/playMoreWays";

// Open for registration and the viewer isn't on a roster yet: one row of
// the /watch tournament cards.
const tournamentsSubscription = typedGql("subscription")({
  tournaments: [
    {
      where: $("where", "tournaments_bool_exp!"),
      order_by: [{ start: order_by.asc }],
      limit: 2,
    },
    tournamentCardFields,
  ],
} as any);

// Same filter as /public-servers: enabled, connected, and not a ranked
// match server unless it hands out a connect string.
const serversSubscription = generateSubscription({
  servers: [
    {
      where: {
        _and: [
          {
            _or: [
              { type: { _neq: $("rankedType", "e_server_types_enum!") } },
              { connection_string: { _is_null: false } },
            ],
          },
          { enabled: { _eq: true } },
          { connected: { _eq: true } },
        ],
      },
      order_by: [{ label: "asc" as any }],
    },
    {
      id: true,
      label: true,
      region: true,
      max_players: true,
      connection_link: true,
      connection_string: true,
    },
  ],
} as any);

const scrimPostingsQuery = generateQuery({
  team_scrim_settings: [
    { where: { enabled: { _eq: true } } },
    {
      team_id: true,
      team: {
        scrim_availability: { starts_at: true, recurring_weekly: true },
      },
    },
  ],
} as any);

const myTeamsQuery = generateQuery({
  teams: [
    {
      where: {
        _or: [
          { owner_steam_id: { _eq: $("steamId", "bigint!") } },
          { roster: { player_steam_id: { _eq: $("steamId", "bigint!") } } },
        ],
      },
    },
    {
      id: true,
      owner_steam_id: true,
      roster: [
        { where: { player_steam_id: { _eq: $("steamId", "bigint!") } } },
        { role: true },
      ],
    },
  ],
} as any);

export default {
  data() {
    return {
      tournaments: [] as any[],
      servers: [] as any[],
      serverInfo: [] as any[],
      scrimPostings: null as any[] | null,
      myTeams: [] as any[],
    };
  },
  apollo: {
    serverInfo: {
      query: generateQuery({
        getDedicatedServerInfo: { id: true, map: true, players: true },
      }),
      pollInterval: 60 * 1000,
      update: (data: any) => data?.getDedicatedServerInfo ?? [],
    },
    scrimPostings: {
      query: scrimPostingsQuery,
      fetchPolicy: "network-only",
      skip() {
        return !useApplicationSettingsStore().scrimFinderEnabled;
      },
      update: (data: any) => data?.team_scrim_settings ?? [],
    },
    myTeams: {
      query: myTeamsQuery,
      fetchPolicy: "network-only",
      variables() {
        return { steamId: useAuthStore().me?.steam_id };
      },
      skip() {
        return (
          !useAuthStore().me?.steam_id ||
          !useApplicationSettingsStore().scrimFinderEnabled
        );
      },
      update: (data: any) => data?.teams ?? [],
    },
    $subscribe: {
      tournaments: {
        query: tournamentsSubscription,
        variables() {
          const steamId = useAuthStore().me?.steam_id;
          return {
            where: excludeLeagueTournaments({
              status: { _eq: e_tournament_status_enum.RegistrationOpen },
              ...(steamId
                ? {
                    _not: {
                      rosters: { player_steam_id: { _eq: steamId } },
                    },
                  }
                : {}),
            }),
          };
        },
        result(this: any, { data }: any) {
          this.tournaments = data?.tournaments ?? [];
        },
        error(error: any) {
          console.error("[play] open tournaments subscription error:", error);
        },
      },
      servers: {
        query: serversSubscription,
        variables() {
          return { rankedType: e_server_types_enum.Ranked };
        },
        result(this: any, { data }: any) {
          this.servers = data?.servers ?? [];
        },
        error(error: any) {
          console.error("[play] public servers subscription error:", error);
        },
      },
    },
  },
  computed: {
    isGuest(): boolean {
      return !useAuthStore().me?.steam_id;
    },
    scrimsCard(): any {
      if (!useApplicationSettingsStore().scrimFinderEnabled) return null;
      if (this.scrimPostings === null) return null;
      const steamId = useAuthStore().me?.steam_id;
      const memberTeamIds = this.myTeams.map((team: any) => team.id);
      const managesTeam = steamId
        ? this.myTeams.some(
            (team: any) =>
              String(team.owner_steam_id) === String(steamId) ||
              team.roster?.some((member: any) => member.role === "Admin"),
          )
        : null;
      return {
        teamsToday: countScrimTeamsToday(this.scrimPostings, memberTeamIds),
        managesTeam,
      };
    },
    serverTiles(): any[] {
      const regions = useApplicationSettingsStore().availableRegions;
      const matchmaking = useMatchmakingStore();
      return this.servers.map((server: any) => {
        const info = this.serverInfo.find((row: any) => row.id === server.id);
        const latency = matchmaking.getRegionlatencyResult(server.region);
        return {
          id: server.id,
          label: server.label,
          map: info?.map ? cleanMapName(info.map) : null,
          region:
            regions.find((region: any) => region.value === server.region)
              ?.description ??
            server.region ??
            null,
          ping: latency ? Math.round(Number(latency.latency)) : null,
          players: info?.players ?? 0,
          maxPlayers: server.max_players ?? 0,
          connectionLink: server.connection_link ?? null,
          connectionString: server.connection_string ?? null,
        };
      });
    },
  },
  methods: {
    leagueCard(league: any): any {
      if (!league) return null;
      return {
        id: league.id,
        name:
          league.name ||
          this.$t("league.schedule.season_number", {
            number: league.season_number,
          }),
        signupClosesAt: league.signup_closes_at ?? null,
        teams: league.team_seasons_aggregate?.aggregate?.count ?? 0,
      };
    },
  },
};
</script>
