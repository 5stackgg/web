import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import {
  useGpuPoolStatusStore,
  type GpuWorkload,
} from "~/stores/GpuPoolStatusStore";

export function useGpuAvailability(workload?: GpuWorkload) {
  const store = useGpuPoolStatusStore();
  const { status, hasFreeGpu, busyReasonKey, hasLoaded } = storeToRefs(store);
  // `useI18n()` runs in the calling component's setup context, where
  // it always has access to the active vue-i18n instance. The store
  // itself stays i18n-free so its setup can't be half-initialised when
  // the first caller is an async callback outside a Vue setup.
  const { t } = useI18n();

  // When a workload is given, gate on that workload's own toggle/counts so
  // e.g. the watch-demo button isn't blocked by the streaming toggle.
  const availability = computed(() =>
    workload ? store.getAvailability(workload) : null,
  );
  const resolvedHasFreeGpu = computed(() =>
    workload ? availability.value!.hasFree : hasFreeGpu.value,
  );
  const resolvedBusyReasonKey = computed(() =>
    workload ? availability.value!.busyReasonKey : busyReasonKey.value,
  );
  const busyReason = computed(() =>
    resolvedBusyReasonKey.value ? t(resolvedBusyReasonKey.value) : null,
  );

  return {
    status,
    hasFreeGpu: resolvedHasFreeGpu,
    busyReason,
    hasLoaded,
  };
}
