import { useRestoredRefs } from "~/composables/useRestoredState";
import { isRestoringHistory } from "~/composables/useScrollRestoration";
import { ref, watch, type Ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { matchRowFields } from "~/graphql/simpleMatchFields";

const DEFAULT_PAGE_SIZE = 10;

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
      match: matchRowFields,
    },
  ],
  event_match_links_aggregate: [
    { where: { event_id: { _eq: $("eventId", "uuid!") } } },
    { aggregate: { count: true } },
  ],
});

// The viewer's own matches for the "For you" band: a tiny separate query so
// they surface even when they are deep in the paginated list.
// A match is "mine" when the viewer played in (or coached) either lineup.
const myMatchWhere = {
  event_id: { _eq: $("eventId", "uuid!") },
  match: {
    _or: [
      {
        lineup_1: {
          _or: [
            { lineup_players: { steam_id: { _eq: $("steamId", "bigint!") } } },
            { coach_steam_id: { _eq: $("steamId", "bigint!") } },
          ],
        },
      },
      {
        lineup_2: {
          _or: [
            { lineup_players: { steam_id: { _eq: $("steamId", "bigint!") } } },
            { coach_steam_id: { _eq: $("steamId", "bigint!") } },
          ],
        },
      },
    ],
  },
};

const MY_EVENT_MATCHES_QUERY = typedGql("query")({
  event_match_links: [
    {
      where: myMatchWhere,
      order_by: [{ match: { created_at: order_by.desc } }],
      limit: 5,
    },
    {
      match_id: true,
      match: matchRowFields,
    },
  ],
});

// The Matches tab's "Mine" view: the same page shape as the full list.
const MY_EVENT_MATCHES_PAGE_QUERY = typedGql("query")({
  event_match_links: [
    {
      where: myMatchWhere,
      order_by: [{ match: { created_at: order_by.desc } }],
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    {
      match_id: true,
      match: matchRowFields,
    },
  ],
  event_match_links_aggregate: [
    { where: myMatchWhere },
    { aggregate: { count: true } },
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
  const page = ref(1);
  const perPage = ref(DEFAULT_PAGE_SIZE);
  const loading = ref(true);
  const paging = ref(false);
  const mine = ref(false);
  // Back to the event lands on the same page and filter of its matches.
  useRestoredRefs("event-matches", { page, mine });

  let generation = 0;

  async function fetchPage(targetPage: number): Promise<EventMatch[]> {
    if (!eventId.value) return [];
    const steamId = useAuthStore().me?.steam_id;
    const onlyMine = mine.value && !!steamId;
    const { data } = await apolloClient.query({
      query: onlyMine ? MY_EVENT_MATCHES_PAGE_QUERY : EVENT_MATCHES_QUERY,
      variables: {
        eventId: eventId.value,
        limit: perPage.value,
        offset: (targetPage - 1) * perPage.value,
        ...(onlyMine ? { steamId } : {}),
      },
      fetchPolicy: "network-only",
    });
    const rows = rowsToMatches((data as any)?.event_match_links);
    total.value =
      Number((data as any)?.event_match_links_aggregate?.aggregate?.count) || 0;
    matches.value = rows;
    return rows;
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
      page.value = 1;
      loading.value = false;
      return;
    }
    const gen = ++generation;
    loading.value = true;
    // Back/forward keeps the page it restored; anything else starts over.
    if (!isRestoringHistory()) {
      page.value = 1;
    }
    try {
      await Promise.all([fetchPage(page.value), fetchMine()]);
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

  async function setPage(targetPage: number) {
    if (paging.value || targetPage === page.value) return;
    const gen = generation;
    paging.value = true;
    page.value = targetPage;
    try {
      await fetchPage(targetPage);
    } catch (error) {
      if (gen === generation) {
        console.error("Error fetching event matches page:", error);
      }
    } finally {
      if (gen === generation) {
        paging.value = false;
      }
    }
  }

  async function setPerPage(size: number) {
    if (!Number.isFinite(size) || size <= 0 || size === perPage.value) return;
    const gen = generation;
    perPage.value = size;
    page.value = 1;
    paging.value = true;
    try {
      await fetchPage(1);
    } catch (error) {
      if (gen === generation) {
        console.error("Error changing event matches page size:", error);
      }
    } finally {
      if (gen === generation) {
        paging.value = false;
      }
    }
  }

  async function setMine(value: boolean) {
    if (value === mine.value) return;
    const gen = generation;
    mine.value = value;
    page.value = 1;
    paging.value = true;
    try {
      await fetchPage(1);
    } catch (error) {
      if (gen === generation) {
        console.error("Error filtering event matches:", error);
      }
    } finally {
      if (gen === generation) {
        paging.value = false;
      }
    }
  }

  watch(eventId, refetch, { immediate: true });

  return {
    matches,
    myMatches,
    total,
    page,
    perPage,
    loading,
    paging,
    mine,
    setMine,
    setPage,
    setPerPage,
    refetch,
  };
}
