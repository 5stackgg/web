import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { DefaultApolloClient, provideApolloClient } from "@vue/apollo-composable";
import { createHttpLink, from, split } from "@apollo/client/core";
import type { ApolloClient } from "@apollo/client/core";
import type {
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client/cache";
import { toast } from "@/components/ui/toast";
import { isAuthErrorMessage } from "~/graphql/isAuthError";

const mergeObjectFields = (
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
) => ({
  ...existing,
  ...incoming,
});

type NuxtApollo = {
  defaultClient: ApolloClient<NormalizedCacheObject> & {
    cache: InMemoryCache;
  };
};

type NuxtI18n = {
  t: (key: string) => string;
};

export default defineNuxtPlugin((nuxtApp) => {
  const $apollo = nuxtApp.$apollo as NuxtApollo;
  const $i18n = nuxtApp.$i18n as NuxtI18n;
  const config = useRuntimeConfig();

  $apollo.defaultClient.cache.policies.addTypePolicies({
    players: {
      keyFields: (player) => {
        if (typeof player.steam_id === "string") {
          return `players:${player.steam_id}`;
        }

        return false;
      },
    },
    // Embedded object with no id of its own. Different queries select
    // different subsets of its fields (e.g. matchClipFields omits
    // lobby_access), so without a merge policy Apollo replaces the whole
    // object and warns about potential data loss. merge:true shallow-merges
    // incoming into existing, keeping fields written by earlier queries.
    match_options: {
      merge: true,
    },
    Query: {
      fields: {
        players_by_pk: {
          merge: mergeObjectFields,
        },
      },
    },
    Subscription: {
      fields: {
        players_by_pk: {
          merge: mergeObjectFields,
        },
        // RenderQueuePanel runs two subscriptions on this same root
        // field (in-flight + finished) with different where/limit args.
        // Each drives its own local ref via the next() callback and never
        // reads the array back from the cache, so the lists clobbering
        // each other in the cache is harmless — keyArgs:false keeps them
        // on one storage key and merge:false makes replacement explicit,
        // silencing the "cache data may be lost" warning.
        clip_render_jobs: {
          keyArgs: false,
          merge: false,
        },
      },
    },
  });

  const errorLink = onError((error) => {
    nuxtApp.callHook("apollo:error", error);
  });

  const retryLink = new RetryLink({
    delay: {
      initial: 300,
      max: 60000,
      jitter: true,
    },
    // eslint-disable-next-line no-unused-vars
    attempts: (count, operation, e) => {
      if (e && e.response && e.response.status === 401) return false;
      return count < 30;
    },
  });

  const httpLink = createHttpLink({
    credentials: "include",
    uri: `https://${config.public.apiDomain}/v1/graphql`,
  });

  const wsClient = createClient({
    url: `wss://${config.public.apiDomain}/v1/graphql`,
    connectionParams: {
      credentials: "include",
    },
  });

  nuxtApp.provide("wsClient", wsClient);

  const wsLink = new GraphQLWsLink(wsClient);

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    httpLink,
  );

  $apollo.defaultClient.setLink(from([errorLink, retryLink, splitLink]));
  $apollo.defaultClient.defaultOptions = {
    watchQuery: {
      fetchPolicy: "cache-and-network",
    },
    query: {
      fetchPolicy: "network-only",
    },
  };

  // Provide the client both ways: `provideApolloClient` sets the module
  // global that @vue/apollo-composable falls back to in async callbacks
  // (outside a setup/injection context), while the app-level inject makes
  // every in-setup useApolloClient/useQuery/useSubscription resolve via
  // Vue injection — which survives HMR resets of the composable's global
  // (the source of "Apollo client with id default not found").
  nuxtApp.vueApp.provide(DefaultApolloClient, $apollo.defaultClient);
  provideApolloClient($apollo.defaultClient);

  nuxtApp.hook("apollo:error", (error) => {
    if (error.graphQLErrors) {
      for (const graphqlError of error.graphQLErrors) {
        if (isAuthErrorMessage(graphqlError.message)) {
          continue;
        }

        // RCON being unreachable is an expected, transient state already
        // surfaced by the server status badge + RCON console — don't toast it.
        if (/unable to connect to rcon/i.test(graphqlError.message)) {
          continue;
        }

        toast({
          variant: "destructive",
          title: $i18n.t("common.error"),
          description: graphqlError.message,
        });
      }
    }
  });
});
