import { ref, watch } from "vue";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { schemaHasType } from "~/utilities/schemaHasType";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "~/stores/AuthStore";

// "Too few starters" is ignorable per team: a short roster can be on purpose
// (a wingman duo). A dismissal holds the starter count at the time; the
// reminder comes back only if the roster shrinks below it. Kept per player in
// player_dismissals so it follows them to every device; against an API that
// does not serve that table yet it stays in this browser, as before.

const STORAGE_KEY = "team-roster-need-dismissed";
const KEY_PREFIX = "team_roster_need:";
const SUBSCRIPTION_KEY = "notifications:player_dismissals";

// Raw documents: player_dismissals is newer than the generated Zeus types.
const ROSTER_NEED_DISMISSALS = gql`
  subscription RosterNeedDismissals($prefix: String!) {
    player_dismissals(where: { key: { _like: $prefix } }) {
      key
      value
    }
  }
`;

const UPSERT_DISMISSAL = gql`
  mutation UpsertPlayerDismissal(
    $key: String!
    $value: jsonb!
    $dismissed_at: timestamptz!
  ) {
    insert_player_dismissals_one(
      object: { key: $key, value: $value, dismissed_at: $dismissed_at }
      on_conflict: {
        constraint: player_dismissals_pkey
        update_columns: [value, dismissed_at]
      }
    ) {
      key
    }
  }
`;

function readLocal(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

// This browser's dismissals, keyed by player + team.
const local = ref<Record<string, number>>(readLocal());

// The signed-in player's dismissals by team, once the API serves them; null
// while unknown or unsupported, which falls back to `local`.
const server = ref<Record<string, number> | null>(null);

watch(
  local,
  (value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // A blocked store only means the choice lasts for this visit.
    }
  },
  { deep: true },
);

function localKey(teamId: string, steamId = useAuthStore().me?.steam_id) {
  return `${steamId ?? ""}:${teamId}`;
}

function upsert(teamId: string, starters: number) {
  return getGraphqlClient().mutate({
    mutation: UPSERT_DISMISSAL,
    variables: {
      key: `${KEY_PREFIX}${teamId}`,
      value: { starters },
      dismissed_at: new Date().toISOString(),
    },
  });
}

export function isRosterNeedDismissed(teamId: string, starters: number) {
  const at = server.value
    ? server.value[teamId]
    : local.value[localKey(teamId)];
  return at !== undefined && starters >= at;
}

export function dismissRosterNeed(teamId: string, starters: number) {
  if (server.value) {
    server.value = { ...server.value, [teamId]: starters };
    void upsert(teamId, starters);
    return;
  }
  local.value = { ...local.value, [localKey(teamId)]: starters };
}

// Started by the notification store on sign-in. Follows the player's
// dismissals live, then moves any this browser kept on to their account.
export async function syncRosterNeedDismissals(steamId: string) {
  const client = getGraphqlClient();
  if (!(await schemaHasType(client, "player_dismissals"))) return;
  if (String(useAuthStore().me?.steam_id ?? "") !== String(steamId)) return;

  useSubscriptionManager().subscribe(
    SUBSCRIPTION_KEY,
    client
      .subscribe({
        query: ROSTER_NEED_DISMISSALS,
        variables: { prefix: `${KEY_PREFIX}%` },
      })
      .subscribe({
        next: ({ data }) => {
          const rows: Array<{ key: string; value: any }> =
            (data as any)?.player_dismissals ?? [];
          const byTeam: Record<string, number> = {};
          for (const row of rows) {
            const starters = Number(row.value?.starters);
            if (Number.isFinite(starters)) {
              byTeam[row.key.slice(KEY_PREFIX.length)] = starters;
            }
          }
          server.value = byTeam;
        },
      }),
  );

  const mine = localKey("", steamId);
  const moving = Object.entries(local.value).filter(([key]) =>
    key.startsWith(mine),
  );
  if (!moving.length) return;
  try {
    await Promise.all(
      moving.map(([key, starters]) => upsert(key.slice(mine.length), starters)),
    );
  } catch {
    // Left in this browser; the next sign-in tries again.
    return;
  }
  local.value = Object.fromEntries(
    Object.entries(local.value).filter(([key]) => !key.startsWith(mine)),
  );
}

export function resetRosterNeedDismissals() {
  useSubscriptionManager().unsubscribe(SUBSCRIPTION_KEY);
  server.value = null;
}
