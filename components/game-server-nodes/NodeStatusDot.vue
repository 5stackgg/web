<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import StatusDot from "~/components/admin/StatusDot.vue";
import type { Tone } from "~/components/admin/tone";
import {
  nodeStatus,
  type NodeLike,
  type NodeStatus,
} from "~/components/game-server-nodes/nodeState";
import { clockLabel } from "~/components/game-server-nodes/nodeFormat";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { isBaking } from "~/components/gpu-nodes/gpuSessions";

const props = withDefaults(
  defineProps<{
    node: NodeLike & { shader_bake_status?: string | null };
    side?: "top" | "right" | "bottom" | "left";
  }>(),
  { side: "right" },
);

const { t } = useI18n();

const status = computed(() => nodeStatus(props.node));

const TONE: Record<NodeStatus, Tone> = {
  online: "ok",
  not_accepting: "warn",
  setup: "info",
  offline: "bad",
  disabled: "off",
};

// The ping is for work running on the node right now: a CS2 update or a
// shader bake. Online alone is a still dot.
const updating = computed(
  () => status.value !== "offline" && !!props.node.update_status,
);
const baking = computed(
  () => status.value !== "offline" && isBaking(props.node),
);

const statusLabel = computed(() => {
  switch (status.value) {
    case "online":
      return t("common.online");
    case "not_accepting":
      return t(`${INSPECTOR}.status.not_accepting`);
    case "setup":
      return t(`${INSPECTOR}.status.setup`);
    case "offline":
      return props.node.offline_at
        ? t(`${INSPECTOR}.status.offline_since`, {
            time: clockLabel(props.node.offline_at),
          })
        : t("common.offline");
    default:
      return t("common.disabled");
  }
});

const label = computed(() =>
  [
    statusLabel.value,
    updating.value
      ? props.node.update_status === "Removing"
        ? t(`${INSPECTOR}.chip.removing`)
        : t(`${INSPECTOR}.chip.updating`)
      : "",
    baking.value ? t("pages.gpu_nodes.node_state.baking") : "",
  ]
    .filter(Boolean)
    .join(" · "),
);
</script>

<template>
  <StatusDot
    :tone="TONE[status]"
    :live="updating || baking"
    :label="label"
    :side="side"
  />
</template>
