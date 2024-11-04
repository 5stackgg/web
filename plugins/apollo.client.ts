import alertStore from "~/stores/AlertStore";
import { AlertStatuses } from "~/constants/AlertStatuses";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { provideApolloClient } from "@vue/apollo-composable";
import { createHttpLink, from, split } from "@apollo/client/core";

export default defineNuxtPlugin((nuxtApp) => {
  const $apollo = nuxtApp.$apollo;
  const config = useRuntimeConfig();

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

  const wsLink = new GraphQLWsLink(
    createClient({
      url: `wss://${config.public.apiDomain}/v1/graphql`,
      connectionParams: {
        credentials: "include",
      },
    }),
  );

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

  provideApolloClient($apollo.defaultClient);

  nuxtApp.hook("apollo:error", (error) => {
    if (error.graphQLErrors) {
      for (const graphqlError of error.graphQLErrors) {
        alertStore().add({
          duration: 5000,
          severity: AlertStatuses.Error,
          title: graphqlError.message,
        });
      }
    }
  });
});
