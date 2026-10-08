import { ref } from "vue";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { schemaHasType } from "~/utilities/schemaHasType";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { useAuthStore } from "~/stores/AuthStore";

export type FeatureSpotlight = {
  key: string;
  to: string;
  title: string;
  teaser: string;
  action: string;
};

const KEY_PREFIX = "feature_spotlight:";
const DISMISSALS_SUBSCRIPTION_KEY = "notifications:feature_spotlight_dismissals";
const MATCH_HISTORY_SUBSCRIPTION_KEY =
  "notifications:feature_spotlight_match_history";

const AUTO_HIGHLIGHTS: FeatureSpotlight = {
  key: "auto_highlights",
  to: "/settings/linked-accounts",
  title: "feature_spotlights.auto_highlights.title",
  teaser: "feature_spotlights.auto_highlights.teaser",
  action: "feature_spotlights.auto_highlights.action",
};

// Raw documents: player_dismissals is newer than the generated Zeus types.
const DISMISSALS = gql`
  subscription FeatureSpotlightDismissals($prefix: String!) {
    player_dismissals(where: { key: { _like: $prefix } }) {
      key
    }
  }
`;

const DISMISS = gql`
  mutation DismissFeatureSpotlight($key: String!, $dismissed_at: timestamptz!) {
    insert_player_dismissals_one(
      object: { key: $key, dismissed_at: $dismissed_at }
      on_conflict: {
        constraint: player_dismissals_pkey
        update_columns: [dismissed_at]
      }
    ) {
      key
    }
  }
`;

const MATCH_HISTORY_LINK = gql`
  subscription FeatureSpotlightMatchHistory($steam_id: bigint!) {
    player_steam_match_auth_by_pk(steam_id: $steam_id) {
      steam_id
    }
  }
`;

// Both stay null until the API answers. Unknown reads as "hide": a spotlight
// the player already dismissed must not flash in and fold away on every load.
const dismissed = ref<Set<string> | null>(null);
const matchHistoryLinked = ref<boolean | null>(null);

// Bumped by every sync and reset, so a sync still waiting on the schema check
// cannot subscribe after the player signed out or the feature was turned off.
let generation = 0;

export function activeFeatureSpotlight(): FeatureSpotlight | null {
  if (!dismissed.value || matchHistoryLinked.value !== false) {
    return null;
  }
  if (dismissed.value.has(AUTO_HIGHLIGHTS.key)) {
    return null;
  }
  return AUTO_HIGHLIGHTS;
}

export function dismissFeatureSpotlight(key: string) {
  dismissed.value = new Set([...(dismissed.value ?? []), key]);
  void getGraphqlClient().mutate({
    mutation: DISMISS,
    variables: {
      key: `${KEY_PREFIX}${key}`,
      dismissed_at: new Date().toISOString(),
    },
  });
}

export async function syncFeatureSpotlights(steamId: string) {
  const mine = ++generation;
  const client = getGraphqlClient();
  if (!(await schemaHasType(client, "player_dismissals"))) {
    return;
  }
  if (
    mine !== generation ||
    String(useAuthStore().me?.steam_id ?? "") !== String(steamId)
  ) {
    return;
  }

  const { subscribe } = useSubscriptionManager();

  subscribe(
    DISMISSALS_SUBSCRIPTION_KEY,
    client
      .subscribe({
        query: DISMISSALS,
        variables: { prefix: `${KEY_PREFIX}%` },
      })
      .subscribe({
        next: ({ data }) => {
          const rows: Array<{ key: string }> =
            (data as any)?.player_dismissals ?? [];
          dismissed.value = new Set(
            rows.map((row) => row.key.slice(KEY_PREFIX.length)),
          );
        },
      }),
  );

  subscribe(
    MATCH_HISTORY_SUBSCRIPTION_KEY,
    client
      .subscribe({
        query: MATCH_HISTORY_LINK,
        variables: { steam_id: steamId },
      })
      .subscribe({
        next: ({ data }) => {
          matchHistoryLinked.value = !!(data as any)
            ?.player_steam_match_auth_by_pk;
        },
      }),
  );
}

export function resetFeatureSpotlights() {
  generation++;
  const { unsubscribe } = useSubscriptionManager();
  unsubscribe(DISMISSALS_SUBSCRIPTION_KEY);
  unsubscribe(MATCH_HISTORY_SUBSCRIPTION_KEY);
  dismissed.value = null;
  matchHistoryLinked.value = null;
}
