import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { $, order_by } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import {
  scrimMyTeamFields,
  scrimPlayedFields,
  scrimPostingFields,
  scrimRequestFields,
} from "~/graphql/scrimFields";
import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "~/components/ui/toast";

const PLAYED = ["Finished", "Tie", "Forfeit", "Surrendered"];
const OVER = [...PLAYED, "Canceled"];
const ACTIVE_TEAM_KEY = "scrims.team";

const managedTeamsQuery = generateSubscription({
  teams: [
    {
      where: {
        _or: [
          { owner_steam_id: { _eq: $("steamId", "bigint!") } },
          {
            roster: {
              _and: [
                { role: { _eq: "Admin" } },
                { player_steam_id: { _eq: $("steamId", "bigint!") } },
              ],
            },
          },
        ],
      },
      order_by: [{ name: order_by.asc }],
    },
    scrimMyTeamFields,
  ],
} as any);

const memberTeamsQuery = generateSubscription({
  teams: [
    { where: { roster: { player_steam_id: { _eq: $("steamId", "bigint!") } } } },
    { id: true },
  ],
} as any);

const openRequestsQuery = generateSubscription({
  team_scrim_requests: [
    {
      where: {
        _and: [
          {
            _or: [
              { from_team_id: { _eq: $("teamId", "uuid!") } },
              { to_team_id: { _eq: $("teamId", "uuid!") } },
            ],
          },
          {
            _or: [
              { status: { _in: ["Pending", "Countered"] } },
              {
                status: { _eq: "Matched" },
                match: { status: { _nin: OVER } },
              },
            ],
          },
        ],
      },
      order_by: [{ proposed_scheduled_at: order_by.asc }],
    },
    scrimRequestFields,
  ],
} as any);

const playedQuery = generateSubscription({
  team_scrim_requests: [
    {
      where: {
        _or: [
          { from_team_id: { _eq: $("teamId", "uuid!") } },
          { to_team_id: { _eq: $("teamId", "uuid!") } },
        ],
        status: { _eq: "Matched" },
        match: { status: { _in: PLAYED } },
      },
      order_by: [{ proposed_scheduled_at: order_by.desc }],
      limit: 5,
    },
    scrimPlayedFields,
  ],
} as any);

const postingsQuery = generateSubscription({
  team_scrim_settings: [
    {
      where: { enabled: { _eq: true } },
      order_by: [{ updated_at: order_by.desc }],
    },
    scrimPostingFields,
  ],
} as any);

function useFollow() {
  const { client } = useApolloClient();
  const subs: Array<{ unsubscribe: () => void }> = [];
  function follow(query: any, variables: any, into: Ref<any[]>, done?: Ref<boolean>) {
    subs.push(
      client.subscribe({ query, variables }).subscribe({
        next: ({ data }: any) => {
          into.value = (Object.values(data ?? {})[0] as any[]) ?? [];
          if (done) done.value = true;
        },
        error: (error: any) => {
          console.error("[scrims] subscription error", error);
        },
      }),
    );
  }
  function stop() {
    while (subs.length) subs.pop()!.unsubscribe();
  }
  onBeforeUnmount(stop);
  return { follow, stop };
}

// Every team open to scrims, for guests too.
export function useScrimPostings() {
  const { follow } = useFollow();
  const postings = ref<any[]>([]);
  const loaded = ref(false);
  onMounted(() => follow(postingsQuery, {}, postings, loaded));
  return { postings, loaded };
}

export function useScrimMaps() {
  const { client } = useApolloClient();
  const mapsById = ref<Record<string, any>>({});
  const maps = ref<any[]>([]);
  onMounted(async () => {
    const { data } = await client.query({
      query: generateQuery({
        maps: [
          {
            where: {
              type: { _eq: "Competitive" },
              deleted_at: { _is_null: true },
            },
            order_by: [{ name: order_by.asc }],
          },
          {
            id: true,
            name: true,
            label: true,
            patch: true,
            active_pool: true,
            workshop_map_id: true,
          },
        ],
      } as any),
    });
    maps.value = (data as any)?.maps ?? [];
    mapsById.value = Object.fromEntries(maps.value.map((map) => [map.id, map]));
  });
  return { maps, mapsById };
}

// The teams you run (owner or admin), and every team you're on.
export function useMyScrimTeams() {
  const auth = useAuthStore();
  const { follow, stop } = useFollow();
  const teams = ref<any[]>([]);
  const memberTeamIds = ref<string[]>([]);
  const members = ref<any[]>([]);
  const loaded = ref(false);
  const activeTeamId = ref<string | null>(null);

  watch(
    () => auth.me?.steam_id ?? null,
    (steamId) => {
      stop();
      teams.value = [];
      members.value = [];
      loaded.value = !steamId;
      if (!steamId || typeof window === "undefined") return;
      follow(managedTeamsQuery, { steamId }, teams, loaded);
      follow(memberTeamsQuery, { steamId }, members);
    },
    { immediate: true },
  );
  watch(members, (list) => {
    memberTeamIds.value = list.map((team) => team.id);
  });

  onMounted(() => {
    try {
      activeTeamId.value = localStorage.getItem(ACTIVE_TEAM_KEY);
    } catch {}
  });

  const activeTeam = computed(
    () =>
      teams.value.find((team) => team.id === activeTeamId.value) ??
      teams.value[0] ??
      null,
  );

  function setActiveTeam(id: string) {
    activeTeamId.value = id;
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, id);
    } catch {}
  }

  return { teams, memberTeamIds, loaded, activeTeam, setActiveTeam };
}

// A team's open requests (pending, countered, booked) and its last results.
export function useScrimTeamRequests(
  teamId: MaybeRefOrGetter<string | null | undefined>,
  { played: withPlayed = false }: { played?: boolean } = {},
) {
  const auth = useAuthStore();
  const { follow, stop } = useFollow();
  const requests = ref<any[]>([]);
  const played = ref<any[]>([]);
  const loaded = ref(false);

  watch(
    [() => toValue(teamId) ?? null, () => auth.me?.steam_id ?? null],
    ([id, steamId]) => {
      stop();
      requests.value = [];
      played.value = [];
      loaded.value = false;
      if (!id || !steamId || typeof window === "undefined") return;
      follow(openRequestsQuery, { teamId: id }, requests, loaded);
      if (withPlayed) follow(playedQuery, { teamId: id }, played);
    },
    { immediate: true },
  );

  const booked = computed(
    () => requests.value.find((request) => request.status === "Matched") ?? null,
  );

  return { requests, played, loaded, booked };
}

export function useScrimActions() {
  const { t } = useI18n();
  const { client } = useApolloClient();

  async function run(mutation: any, success: string) {
    try {
      await client.mutate({ mutation });
      toast({ title: success });
      return true;
    } catch (error) {
      toast({
        title: t("scrims.toast.failed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
      return false;
    }
  }

  return {
    send(params: {
      fromTeamId: string;
      toTeamId: string;
      at: number;
      bestOf: number;
      teamName: string;
    }) {
      return run(
        generateMutation({
          sendScrimRequest: [
            {
              from_team_id: params.fromTeamId,
              to_team_id: params.toTeamId,
              proposed_scheduled_at: new Date(params.at).toISOString(),
              best_of: params.bestOf,
            },
            { success: true },
          ],
        }),
        t("scrims.toast.sent", { team: params.teamName }),
      );
    },
    respond(requestId: string, accept: boolean, teamName: string) {
      return run(
        generateMutation({
          respondToScrimRequest: [
            { request_id: requestId, accept },
            { success: true },
          ],
        }),
        accept
          ? t("scrims.toast.booked", { team: teamName })
          : t("scrims.toast.declined", { team: teamName }),
      );
    },
    counter(requestId: string, at: number, teamName: string) {
      return run(
        generateMutation({
          counterScrimRequest: [
            {
              request_id: requestId,
              proposed_scheduled_at: new Date(at).toISOString(),
            },
            { success: true },
          ],
        }),
        t("scrims.toast.countered", { team: teamName }),
      );
    },
    cancel(requestId: string, booked: boolean, teamName: string) {
      return run(
        generateMutation({
          cancelScrimRequest: [{ request_id: requestId }, { success: true }],
        }),
        booked
          ? t("scrims.toast.cancelled_booked", { team: teamName })
          : t("scrims.toast.cancelled", { team: teamName }),
      );
    },
  };
}

// The minute, ticking; the finder's "now".
export function useScrimClock() {
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date();
    }, 60_000);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });
  return now;
}

export function scrimOpponent(request: any, teamId: string) {
  return request.from_team_id === teamId ? request.to_team : request.from_team;
}

export function awaitingTeam(request: any, teamId: string): boolean {
  return request.status !== "Matched" && request.awaiting_team_id === teamId;
}
