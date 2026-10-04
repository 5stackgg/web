import {
  computed,
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { $, order_by } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import {
  teamCheckInMatchFields,
  teamPendingInviteFields,
  teamScrimRequestFields,
} from "~/graphql/teamPulseFields";
import { useAuthStore } from "~/stores/AuthStore";
import { isRosterNeedDismissed } from "~/composables/useRosterNeedDismissals";
import { toast } from "~/components/ui/toast";

// What a team needs from the person looking at it. Items are only things
// this viewer can act on; anything waiting on someone else (sent invites,
// sent scrim requests, teammates' check-ins) is "waiting", never an item.
export type TeamNeed =
  | { kind: "check_in"; key: string; match: any }
  | { kind: "scrim" | "counter"; key: string; request: any }
  | { kind: "roster"; key: string; starters: number };

export type TeamWaiting =
  | { kind: "check_in"; key: string; names: string[] }
  | { kind: "scrim"; key: string; teamName: string }
  | { kind: "invites"; key: string; names: string[] };

// The team needs id, can_manage_scrims, can_invite and roster statuses.
type NeedsTeam = {
  id: string;
  can_manage_scrims?: boolean | null;
  can_invite?: boolean | null;
  roster?: Array<{ status?: string | null; player?: any }> | null;
} | null;

const KIND_ORDER: Record<TeamNeed["kind"], number> = {
  check_in: 0,
  counter: 1,
  scrim: 2,
  roster: 3,
};

const requestsQuery = generateSubscription({
  team_scrim_requests: [
    {
      where: {
        _or: [
          { from_team_id: { _eq: $("teamId", "uuid!") } },
          { to_team_id: { _eq: $("teamId", "uuid!") } },
        ],
        status: { _in: ["Pending", "Countered"] },
      },
      order_by: [{ created_at: order_by.asc }],
    },
    teamScrimRequestFields,
  ],
} as any);

const checkInQuery = generateSubscription({
  matches: [
    {
      where: {
        status: { _eq: "WaitingForCheckIn" },
        _or: [
          { lineup_1: { team_id: { _eq: $("teamId", "uuid!") } } },
          { lineup_2: { team_id: { _eq: $("teamId", "uuid!") } } },
        ],
      },
      order_by: [{ cancels_at: order_by.asc_nulls_last }],
    },
    teamCheckInMatchFields,
  ],
} as any);

const invitesQuery = generateSubscription({
  team_invites: [
    {
      where: { team_id: { _eq: $("teamId", "uuid!") } },
      order_by: [{ created_at: order_by.asc }],
    },
    teamPendingInviteFields,
  ],
} as any);

// `followInvites: false` skips the pending-invites subscription for surfaces
// that never show the "waiting on" line.
export function useTeamNeeds(
  team: MaybeRefOrGetter<NeedsTeam>,
  { followInvites = true }: { followInvites?: boolean } = {},
) {
  const { t } = useI18n();
  const { client } = useApolloClient();
  const auth = useAuthStore();

  const requests = ref<any[]>([]);
  const checkIns = ref<any[]>([]);
  const invites = ref<any[]>([]);

  const subs: Array<{ unsubscribe: () => void }> = [];
  function stop() {
    while (subs.length) subs.pop()!.unsubscribe();
    requests.value = [];
    checkIns.value = [];
    invites.value = [];
  }

  function follow(
    query: any,
    teamId: string,
    into: typeof requests,
    label: string,
  ) {
    subs.push(
      client.subscribe({ query, variables: { teamId } }).subscribe({
        next: ({ data }: any) => {
          into.value = (Object.values(data ?? {})[0] as any[]) ?? [];
        },
        error: (error: any) => {
          console.error(`[team-needs] ${label} subscription error`, error);
        },
      }),
    );
  }

  const me = computed(() => auth.me?.steam_id ?? null);

  // Separate sources so a fresh team object from the subscription doesn't
  // resubscribe unless one of these actually changed.
  watch(
    [
      () => toValue(team)?.id ?? null,
      () => !!toValue(team)?.can_manage_scrims,
      () => !!toValue(team)?.can_invite,
      me,
    ],
    ([teamId, canManageScrims, canInvite, steamId]) => {
      stop();
      if (!teamId || !steamId || typeof window === "undefined") return;
      follow(checkInQuery, teamId, checkIns, "check-in");
      if (canManageScrims)
        follow(requestsQuery, teamId, requests, "scrim requests");
      if (canInvite && followInvites)
        follow(invitesQuery, teamId, invites, "invites");
    },
    { immediate: true },
  );
  onBeforeUnmount(stop);

  function ourLineup(match: any, teamId: string) {
    return match?.lineup_1?.team_id === teamId
      ? match.lineup_1
      : match?.lineup_2;
  }

  const items = computed<TeamNeed[]>(() => {
    const value = toValue(team);
    if (!value || !me.value) return [];
    const list: TeamNeed[] = [];

    for (const match of checkIns.value) {
      const mine = (ourLineup(match, value.id)?.lineup_players ?? []).find(
        (p: any) => String(p.steam_id) === String(me.value),
      );
      if (match.can_check_in && mine && !mine.checked_in) {
        list.push({ kind: "check_in", key: `check-in-${match.id}`, match });
      }
    }

    for (const request of requests.value) {
      if (request.awaiting_team_id !== value.id) continue;
      list.push({
        kind: request.status === "Countered" ? "counter" : "scrim",
        key: `scrim-${request.id}`,
        request,
      });
    }

    if (value.can_invite && value.roster) {
      const starters = value.roster.filter(
        (m) => m.status === "Starter",
      ).length;
      if (starters < 5 && !isRosterNeedDismissed(value.id, starters)) {
        list.push({ kind: "roster", key: "roster", starters });
      }
    }

    return list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  });

  const waiting = computed<TeamWaiting[]>(() => {
    const value = toValue(team);
    if (!value || !me.value) return [];
    const list: TeamWaiting[] = [];

    for (const match of checkIns.value) {
      // Only the players the match's check-in setting asks: captains under
      // "Captains", nobody under "Admin".
      const setting = match.options?.check_in_setting;
      if (setting === "Admin") continue;
      const names = (ourLineup(match, value.id)?.lineup_players ?? [])
        .filter(
          (p: any) =>
            !p.checked_in &&
            String(p.steam_id) !== String(me.value) &&
            (setting !== "Captains" || p.captain),
        )
        .map((p: any) => p.player?.name)
        .filter(Boolean);
      if (names.length) {
        list.push({ kind: "check_in", key: `check-in-${match.id}`, names });
      }
    }

    for (const request of requests.value) {
      if (request.awaiting_team_id === value.id) continue;
      const other =
        request.from_team_id === value.id ? request.to_team : request.from_team;
      list.push({
        kind: "scrim",
        key: `scrim-${request.id}`,
        teamName: other?.name ?? "",
      });
    }

    const inviteNames = invites.value
      .map((invite) => invite.player?.name)
      .filter(Boolean);
    if (inviteNames.length) {
      list.push({ kind: "invites", key: "invites", names: inviteNames });
    }

    return list;
  });

  async function respond(requestId: string, accept: boolean) {
    await client.mutate({
      mutation: generateMutation({
        respondToScrimRequest: [
          { request_id: requestId, accept },
          { success: true },
        ],
      }),
    });
    toast({
      title: accept ? t("scrim.scrim_accepted") : t("scrim.scrim_declined"),
    });
  }

  async function counter(requestId: string, proposedAt: Date) {
    await client.mutate({
      mutation: generateMutation({
        counterScrimRequest: [
          {
            request_id: requestId,
            proposed_scheduled_at: proposedAt.toISOString(),
          },
          { success: true },
        ],
      }),
    });
    toast({ title: t("scrim.new_time_proposed") });
  }

  return { items, waiting, respond, counter };
}
