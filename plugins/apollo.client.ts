import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { provideApolloClient } from "@vue/apollo-composable";
import { createHttpLink, from, split } from "@apollo/client/core";
import type { ApolloClient } from "@apollo/client/core";
import type { InMemoryCache, NormalizedCacheObject } from "@apollo/client/cache";
import { toast } from "@/components/ui/toast";

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

  provideApolloClient($apollo.defaultClient);

  nuxtApp.hook("apollo:error", (error) => {
    if (error.graphQLErrors) {
      for (const graphqlError of error.graphQLErrors) {
        if (
          [
            "Unauthorized",
            "webhook authentication request",
            "Invalid response from authorization hook",
          ].includes(graphqlError.message)
        ) {
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
