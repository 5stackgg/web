import { getCurrentInstance, type Ref } from "vue";
import { useHistoryState } from "~/composables/useScrollRestoration";

// Refs that come back with their history entry: on a back/forward onto it they
// are set to what they held when it was left, so a list returns on the same
// page, sort and filters and the scroll restore lands on the same rows. Call
// before anything watches them. True when this visit restored them.
export function useRestoredRefs(
  id: string,
  refs: Record<string, Ref<any>>,
): boolean {
  const saved = useHistoryState(id, () =>
    Object.fromEntries(
      Object.entries(refs).map(([key, value]) => [key, value.value]),
    ),
  );
  if (!saved) {
    return false;
  }
  for (const [key, value] of Object.entries(refs)) {
    if (key in saved) {
      value.value = saved[key];
    }
  }
  return true;
}

// The same for an Options API component: call it from data(), where Vue keeps
// the component current, and start those keys from what it returns (null when
// this visit is not a restore). Not from an Options setup() beside a
// <script setup>, which Vue ignores.
export function useRestoredData(
  id: string,
  keys: Array<string>,
): Record<string, any> | null {
  const instance = getCurrentInstance();
  return useHistoryState(id, () => {
    const vm = instance?.proxy as Record<string, unknown> | undefined;
    return Object.fromEntries(keys.map((key) => [key, vm?.[key]]));
  });
}
