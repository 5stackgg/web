import { onBeforeUnmount, onMounted, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilitySolverCalibrationQuery } from "~/graphql/utilityGraphql";
import { readUtilitySolverCalibration } from "~/types/utility";
import type { UtilityCalibrationOutput, UtilityCalibrationView } from "~/types/utility";

export const UTILITY_CALIBRATION_POLL_MS = 5000;

/**
 * The solver gate, shared by every caller that asks a practice server to work
 * out a throw. It exists as one composable because the two calibration states
 * that are not "ready" mean opposite things and each caller getting that pairing
 * right on its own is exactly how one of them ends up offering a retry button
 * that can never succeed.
 *
 * Errors are handed back rather than toasted here: the wording belongs to the
 * screen the gate is standing in front of.
 */
export function useUtilitySolverCalibration(
  sessionId: MaybeRefOrGetter<string | null>,
  options: { onError?: (error: unknown) => void } = {},
) {
  const calibration = ref<UtilityCalibrationView | null>(null);
  const checking = ref(false);

  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function refresh() {
    const id = toValue(sessionId);
    if (!id) {
      calibration.value = null;
      return;
    }
    checking.value = true;
    try {
      const { data } = await getGraphqlClient().query({
        query: utilitySolverCalibrationQuery,
        variables: { session_id: id },
        fetchPolicy: "no-cache",
      });
      calibration.value = readUtilitySolverCalibration(
        (data as any)?.utilitySolverCalibration as UtilityCalibrationOutput | undefined,
      );
    } catch (error: unknown) {
      calibration.value = null;
      options.onError?.(error);
    } finally {
      checking.value = false;
    }
  }

  // NoSample means the solver has nothing to calibrate against yet and the next
  // throw in the server fixes it, so this keeps asking. Unsupported never
  // changes, and polling it would only look like the UI is thinking.
  function poll() {
    stopPolling();
    pollTimer = setTimeout(async () => {
      await refresh().catch(() => null);
      if (calibration.value?.selfHealing) {
        poll();
      }
    }, UTILITY_CALIBRATION_POLL_MS);
  }

  async function check() {
    await refresh();
    if (calibration.value?.selfHealing) {
      poll();
    }
  }

  onMounted(() => {
    if (toValue(sessionId)) {
      void check();
    }
  });

  watch(
    () => toValue(sessionId),
    (id) => {
      stopPolling();
      calibration.value = null;
      if (id) {
        void check();
      }
    },
  );

  onBeforeUnmount(stopPolling);

  return { calibration, checking, refresh, check, stopPolling };
}
