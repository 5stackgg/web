import { ref } from "vue";
import { $, e_server_types_enum } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";

const listed = ref(false);
let started = false;

// Whether any public server is up right now. The nav hides Public Servers
// from players while there is none to join.
export function usePublicServersListed() {
  if (import.meta.client && !started) {
    started = true;
    useApolloClient()
      .client.subscribe({
        query: generateSubscription({
          servers: [
            {
              where: {
                _and: [
                  {
                    _or: [
                      {
                        type: { _neq: $("rankedType", "e_server_types_enum!") },
                      },
                      { connection_string: { _is_null: false } },
                    ],
                  },
                  { enabled: { _eq: true } },
                  { connected: { _eq: true } },
                ],
              },
              limit: 1,
            },
            { id: true },
          ],
        }),
        variables: { rankedType: e_server_types_enum.Ranked },
      })
      .subscribe({
        next: ({ data }) => {
          listed.value = ((data as any)?.servers?.length ?? 0) > 0;
        },
      });
  }
  return { listed };
}
