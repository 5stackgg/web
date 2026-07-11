import { computed, ref, watch, type Ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";

const PAGE_SIZE = 20;

// event_match_links is the trigger-maintained materialization of the shared
// event->match derivation (see api hasura/triggers/event_match_links.sql) —
// an indexed table, so the page can paginate instead of pulling every match
// with full lineups in one round trip.
const EVENT_MATCHES_QUERY = typedGql("query")({
  event_match_links: [
    {
      where: { event_id: { _eq: $("eventId", "uuid!") } },
      order_by: [{ match: { created_at: order_by.desc } }],
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    {
      match_id: true,
      match: simpleMatchFields,
    },
  ],
  event_match_links_aggregate: [
    { where: { event_id: { _eq: $("eventId", "uuid!") } } },
    { aggregate: { count: true } },
  ],
});

// The viewer's own matches for the "For you" band: a tiny separate query so
// they surface even when they are deep in the paginated list.
const MY_EVENT_MATCHES_QUERY = typedGql("query")({
  event_match_links: [
    {
      where: {
        event_id: { _eq: $("eventId", "uuid!") },
        match: {
          _or: [
            {
              lineup_1: {
                _or: [
                  {
                    lineup_players: {
                      steam_id: { _eq: $("steamId", "bigint!") },
                    },
                  },
                  { coach_steam_id: { _eq: $("steamId", "bigint!") } },
                ],
              },
            },
            {
              lineup_2: {
                _or: [
                  {
                    lineup_players: {
                      steam_id: { _eq: $("steamId", "bigint!") },
                    },
                  },
                  { coach_steam_id: { _eq: $("steamId", "bigint!") } },
                ],
              },
            },
          ],
        },
      },
      order_by: [{ match: { created_at: order_by.desc } }],
      limit: 5,
    },
    {
      match_id: true,
      match: simpleMatchFields,
    },
  ],
});

export type EventMatch = Record<string, any> & {
  id: string;
};

function rowsToMatches(rows: any[]): EventMatch[] {
  // A match the viewer cannot read resolves its nested `match` to null.
  return (rows || []).map((row: any) => row.match).filter(Boolean);
}

export function useEventMatches(eventId: Ref<string | null>) {
  const { client: apolloClient } = useApolloClient();

  const matches = ref<EventMatch[]>([]);
  const myMatches = ref<EventMatch[]>([]);
  const total = ref(0);
  const loading = ref(true);
  const loadingMore = ref(false);

  let generation = 0;

  async function fetchPage(offset: number): Promise<boolean> {
    if (!eventId.value) return false;
    const { data } = await apolloClient.query({
      query: EVENT_MATCHES_QUERY,
      variables: { eventId: eventId.value, limit: PAGE_SIZE, offset },
      fetchPolicy: "network-only",
    });
    const page = rowsToMatches((data as any)?.event_match_links);
    total.value =
      Number((data as any)?.event_match_links_aggregate?.aggregate?.count) || 0;
    if (offset === 0) {
      matches.value = page;
    } else {
      const seen = new Set(matches.value.map((match) => match.id));
      matches.value = [
        ...matches.value,
        ...page.filter((match) => !seen.has(match.id)),
      ];
    }
    return page.length === PAGE_SIZE;
  }

  async function fetchMine() {
    const steamId = useAuthStore().me?.steam_id;
    if (!eventId.value || !steamId) {
      myMatches.value = [];
      return;
    }
    const { data } = await apolloClient.query({
      query: MY_EVENT_MATCHES_QUERY,
      variables: { eventId: eventId.value, steamId },
      fetchPolicy: "network-only",
    });
    myMatches.value = rowsToMatches((data as any)?.event_match_links);
  }

  async function refetch() {
    if (!eventId.value) {
      matches.value = [];
      myMatches.value = [];
      total.value = 0;
      loading.value = false;
      return;
    }
    const gen = ++generation;
    loading.value = true;
    try {
      await Promise.all([fetchPage(0), fetchMine()]);
    } catch (error) {
      if (gen !== generation) return;
      console.error("Error fetching event matches:", error);
      matches.value = [];
      myMatches.value = [];
      total.value = 0;
    } finally {
      if (gen === generation) {
        loading.value = false;
      }
    }
  }

  async function loadMore() {
    if (loadingMore.value || matches.value.length >= total.value) return;
    const gen = generation;
    loadingMore.value = true;
    try {
      await fetchPage(matches.value.length);
    } catch (error) {
      if (gen === generation) {
        console.error("Error fetching more event matches:", error);
      }
    } finally {
      loadingMore.value = false;
    }
  }

  watch(eventId, refetch, { immediate: true });

  const hasMore = computed(() => matches.value.length < total.value);

  return {
    matches,
    myMatches,
    total,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    refetch,
  };
}
