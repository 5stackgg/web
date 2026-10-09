import { ref, watch } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupApproachQuery } from "~/graphql/utilityGraphql";
import { utilityRunUp } from "~/utilities/utilityThrowGuide";
import type { UtilityRunUp } from "~/utilities/utilityThrowGuide";

// Only the reading is kept, never the samples: a run-up is ~25KB and a hover
// can pass over dozens of lineups in a minute.
const known = new Map<string, UtilityRunUp | null>();
const inFlight = new Map<string, Promise<UtilityRunUp | null>>();

function loadRunUp(id: string): Promise<UtilityRunUp | null> {
  const pending = inFlight.get(id);
  if (pending) {
    return pending;
  }
  const request = getGraphqlClient()
    .query({
      query: utilityLineupApproachQuery,
      variables: { id },
      fetchPolicy: "no-cache",
    })
    .then(({ data }) => {
      const runUp = utilityRunUp(
        (data as any)?.utility_lineups_by_pk?.approach ?? null,
      );
      known.set(id, runUp);
      return runUp;
    })
    .catch((error) => {
      console.error("[utility] run-up fetch error:", error);
      return null;
    })
    .finally(() => {
      inFlight.delete(id);
    });
  inFlight.set(id, request);
  return request;
}

export function useUtilityRunUp(lineupId: () => string | null | undefined) {
  const runUp = ref<UtilityRunUp | null>(null);

  watch(
    lineupId,
    async (id) => {
      runUp.value = id ? (known.get(id) ?? null) : null;
      if (!id || known.has(id)) {
        return;
      }
      const value = await loadRunUp(id);
      if (lineupId() === id) {
        runUp.value = value;
      }
    },
    { immediate: true },
  );

  return runUp;
}
