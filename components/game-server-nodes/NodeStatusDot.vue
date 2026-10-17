<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  nodeStatus,
  type NodeLike,
  type NodeStatus,
} from "~/components/game-server-nodes/nodeState";
import { clockLabel } from "~/components/game-server-nodes/nodeFormat";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

const props = withDefaults(
  defineProps<{ node: NodeLike; side?: "top" | "right" | "bottom" | "left" }>(),
  { side: "right" },
);

const { t } = useI18n();

const status = computed(() => nodeStatus(props.node));

// The ping is only for a node that is up and taking work.
const DOT: Record<NodeStatus, string> = {
  online: "bg-success",
  not_accepting: "bg-[hsl(var(--tac-amber))]",
  setup: "bg-info",
  offline: "bg-destructive",
  disabled: "bg-muted-foreground/40",
};

const label = computed(() => {
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
</script>

<template>
  <FiveStackToolTip as-child :delay-duration="120" :side="side">
    <template #trigger>
      <span
        class="relative flex h-2 w-2 shrink-0"
        role="img"
        tabindex="-1"
        :aria-label="label"
      >
        <span
          v-if="status === 'online'"
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden"
        ></span>
        <span
          class="relative inline-flex h-2 w-2 rounded-full transition-colors duration-300"
          :class="DOT[status]"
        ></span>
      </span>
    </template>
    {{ label }}
  </FiveStackToolTip>
</template>
