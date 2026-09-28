<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import EdgeStatusPanel, {
  type EdgeStatusRow,
  type EdgeStatusState,
} from "~/components/settings/EdgeStatusPanel.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  checkBackblazeWorker,
  type BackblazeWorkerHealth,
} from "~/utilities/backblazeWorkerHealth";

const { t } = useI18n();
const key = (name: string) => `pages.settings.application.demo_settings.${name}`;

const workerUrl = computed(
  () =>
    useApplicationSettingsStore().settings.find(
      (setting) => setting.name === "cloudflare_worker_url",
    )?.value || "",
);

const endpoint = computed(() =>
  workerUrl.value.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
);

const checking = ref(false);
const health = ref<BackblazeWorkerHealth | null>(null);
const checkedAt = ref<Date | null>(null);
let latestCheck = 0;

async function check() {
  const thisCheck = ++latestCheck;
  if (!workerUrl.value) {
    health.value = null;
    checking.value = false;
    return;
  }
  checking.value = true;
  const result = await checkBackblazeWorker(workerUrl.value);
  if (thisCheck !== latestCheck) {
    return;
  }
  health.value = result;
  checkedAt.value = new Date();
  checking.value = false;
}

watch(workerUrl, check, { immediate: true });

const state = computed<EdgeStatusState>(() => {
  if (!workerUrl.value) {
    return "idle";
  }
  if (checking.value || !health.value) {
    return "checking";
  }
  if (!health.value.answering) {
    return "offline";
  }
  if (!health.value.current) {
    return "attention";
  }
  return health.value.bucket === "ok" ? "online" : "offline";
});

const summary = computed(() => {
  const current = health.value;
  switch (state.value) {
    case "idle":
      return t(key("cloudflare_worker_not_set"));
    case "checking":
      return t(key("cloudflare_worker_checking"));
    case "online":
      return t(key("cloudflare_worker_online"));
    case "attention":
      return t(key("cloudflare_worker_outdated"));
  }
  if (!current?.answering) {
    return t(key("cloudflare_worker_unreachable"));
  }
  if (current.current && current.bucket === "rejected") {
    return t(key("cloudflare_worker_keys_rejected"));
  }
  if (current.current && current.bucket === "misconfigured") {
    return t(key("cloudflare_worker_misconfigured"));
  }
  return t(key("cloudflare_worker_bucket_unreachable"));
});

const rows = computed<EdgeStatusRow[]>(() => {
  const current = health.value;
  if (state.value === "checking" || !current?.answering || !current.current) {
    return [];
  }
  const label = t(key("cloudflare_worker_row_bucket"));
  if (current.bucket === "ok") {
    return [{ label, value: t(key("cloudflare_worker_bucket_ok")), tone: "good" }];
  }
  if (current.bucket === "rejected") {
    return [
      {
        label,
        value: t(key("cloudflare_worker_bucket_rejected"), {
          code: current.code ?? "?",
        }),
        tone: "bad",
      },
    ];
  }
  return [];
});
</script>

<template>
  <EdgeStatusPanel
    :state="state"
    :endpoint="endpoint || undefined"
    :summary="summary"
    :rows="rows"
    :checked-at="checkedAt"
    docs-url="https://docs.5stack.gg/advanced/s3/backblaze"
    @check="check"
  />
</template>
