import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";

export function useGpuAvailability() {
  const store = useGpuPoolStatusStore();
  const { status, hasFreeGpu, busyReasonKey, hasLoaded } = storeToRefs(store);
  // `useI18n()` runs in the calling component's setup context, where
  // it always has access to the active vue-i18n instance. The store
  // itself stays i18n-free so its setup can't be half-initialised when
  // the first caller is an async callback outside a Vue setup.
  const { t } = useI18n();
  const busyReason = computed(() =>
    busyReasonKey.value ? t(busyReasonKey.value) : null,
  );
  return { status, hasFreeGpu, busyReason, hasLoaded };
}
