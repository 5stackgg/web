import { storeToRefs } from "pinia";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";

export function useGpuAvailability() {
  const store = useGpuPoolStatusStore();
  const { status, hasFreeGpu, busyReason, hasLoaded } = storeToRefs(store);
  return { status, hasFreeGpu, busyReason, hasLoaded };
}
