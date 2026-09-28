<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import EdgeStatusPanel, {
  type EdgeStatusState,
} from "~/components/settings/EdgeStatusPanel.vue";

const { t } = useI18n();

const relayDomain = String(useRuntimeConfig().public.relayDomain || "");

const state = ref<EdgeStatusState>("checking");
const checkedAt = ref<Date | null>(null);
let latestCheck = 0;

// Only the edge relay worker answers /health on the relay domain: the panel's
// own relay has no such path, so an answer means Cloudflare is already sending
// the relay's traffic through the worker.
async function check() {
  if (!relayDomain) {
    state.value = "idle";
    return;
  }
  const thisCheck = ++latestCheck;
  state.value = "checking";
  let online = false;
  try {
    const response = await fetch(`https://${relayDomain}/health`, {
      cache: "no-store",
    });
    const health = response.ok ? await response.json() : null;
    online = health?.worker === "5stack-playcast-relay";
  } catch {
    online = false;
  }
  if (thisCheck !== latestCheck) {
    return;
  }
  state.value = online ? "online" : "idle";
  checkedAt.value = new Date();
}

const summary = computed(() => {
  switch (state.value) {
    case "checking":
      return t("pages.settings.application.streaming.relay_checking");
    case "online":
      return t("pages.settings.application.streaming.relay_active");
    default:
      return t("pages.settings.application.streaming.relay_inactive");
  }
});

onMounted(check);
</script>

<template>
  <div class="grid gap-3">
    <div class="grid gap-1">
      <h4 class="text-sm font-medium">
        {{ $t("pages.settings.application.streaming.relay_title") }}
      </h4>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.settings.application.streaming.relay_description") }}
      </p>
    </div>

    <EdgeStatusPanel
      :state="state"
      :endpoint="relayDomain || undefined"
      :summary="summary"
      :checked-at="checkedAt"
      docs-url="https://docs.5stack.gg/advanced/playcast-edge-relay"
      @check="check"
    />
  </div>
</template>
