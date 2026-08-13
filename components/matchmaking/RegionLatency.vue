<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const props = defineProps<{
  region: string;
}>();

const { t } = useI18n();

const probeState = computed(() =>
  useMatchmakingStore().getRegionProbeState(props.region),
);

const isMeasuring = computed(() => probeState.value === "measuring");
const isUnreachable = computed(() => probeState.value === "unreachable");

const latency = computed(() => {
  const result = useMatchmakingStore().getRegionlatencyResult(props.region);
  if (!result) {
    return;
  }
  return Math.round(Number(result.latency));
});

const maxAcceptableLatency = computed(
  () => Number(useApplicationSettingsStore().maxAcceptableLatency) || 100,
);

// While a probe is in flight the last reading stays on screen but drops to the
// neutral tier — it is history, not a live measurement.
const tier = computed(() => {
  if (isMeasuring.value || isUnreachable.value || latency.value === undefined) {
    return "unknown";
  }
  if (latency.value < 30) {
    return "excellent";
  }
  if (latency.value < 50) {
    return "good";
  }
  if (latency.value < maxAcceptableLatency.value) {
    return "fair";
  }
  return "poor";
});

const status = computed(() => {
  if (isMeasuring.value) {
    return t("latency_status.measuring");
  }
  if (isUnreachable.value || latency.value === undefined) {
    return t("latency_status.unreachable");
  }
  return t(`latency_status.${tier.value}`);
});

const label = computed(() =>
  latency.value === undefined || isMeasuring.value
    ? status.value
    : `${latency.value}ms — ${status.value}`,
);

// One-shot flash whenever a fresh reading replaces whatever was there, so a
// refresh shows results landing one region at a time.
const hasLanded = ref(false);
let landingTimeout: ReturnType<typeof setTimeout> | undefined;

watch(latency, (value) => {
  if (value === undefined) {
    return;
  }
  clearTimeout(landingTimeout);
  hasLanded.value = true;
  landingTimeout = setTimeout(() => {
    hasLanded.value = false;
  }, 700);
});

onBeforeUnmount(() => {
  clearTimeout(landingTimeout);
});
</script>

<template>
  <div
    class="latency-readout"
    :class="[
      `latency-tier-${tier}`,
      {
        'animate-soft-pulse motion-reduce:animate-none': isMeasuring,
        'is-unreachable': isUnreachable,
        'has-landed': hasLanded,
      },
    ]"
    role="status"
    :aria-label="label"
  >
    <Transition name="latency-swap" mode="out-in">
      <span v-if="isUnreachable" key="unreachable">
        {{ $t("latency_status.unreachable") }}
      </span>
      <span
        v-else-if="latency === undefined"
        key="pending"
        class="tracking-[0.2em]"
        aria-hidden="true"
      >
        •••
      </span>
      <span v-else :key="latency">
        {{ latency }}<span class="ml-0.5 opacity-60">ms</span>
      </span>
    </Transition>
  </div>
</template>
