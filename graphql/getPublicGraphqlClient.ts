import type { ApolloClient } from "@apollo/client/core";

// The client whose socket the api answers as a guest: for data that is the
// same for every viewer, so everyone watching shares one Hasura poll.
export default function getPublicGraphqlClient() {
  // Added by plugins/apollo.client.ts, so not in the module's client types.
  const clients = useApollo().clients as
    Record<string, ApolloClient<unknown>> | undefined;

  if (!clients?.public) {
    throw Error("missing public client");
  }

  return clients.public;
}
