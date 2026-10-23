<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { CircleAlert, CircleArrowUp, LoaderCircle, Pin } from "lucide-vue-next";
import {
  cs2State,
  updateProgress,
} from "~/components/game-server-nodes/nodeInspector";
import type { NodeLike } from "~/components/game-server-nodes/nodeState";
import {
  INSPECTOR,
  updateTarget,
  versionLabel,
} from "~/components/game-server-nodes/nodeCopy";
import { relativeTime } from "~/components/game-server-nodes/nodeFormat";

// One word for where a node's CS2 stands, the detail in its tooltip.
const props = withDefaults(
  defineProps<{
    node: NodeLike;
    gameVersions: Array<Record<string, any>>;
    currentBuildId?: number | string | null;
    tip?: boolean;
  }>(),
  { currentBuildId: null, tip: true },
);

const { t } = useI18n();

const state = computed(() => cs2State(props.node, props.currentBuildId));
const version = computed(() =>
  versionLabel(props.gameVersions as any, props.node.build_id),
);
const target = computed(() =>
  updateTarget(props.gameVersions as any, props.node),
);
const progress = computed(() => updateProgress(props.node.update_status));

const tipText = computed(() => {
  switch (state.value) {
    case "failed":
      return t(`${INSPECTOR}.chip.failed_tip`, {
        target: target.value,
        ago: relativeTime(props.node.update_failed_at),
        version: version.value,
      });
    case "behind":
      return t(`${INSPECTOR}.chip.behind_tip`, {
        version: version.value,
        target: target.value,
      });
    case "pinned":
      return t(`${INSPECTOR}.chip.pinned_tip`, { version: version.value });
    case "current":
      return version.value;
    default:
      return "";
  }
});

const pill =
  "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[5px] border px-[7px] text-[11px] font-semibold";
</script>

<template>
  <span v-if="state === 'none'" class="text-muted-foreground/60">—</span>
  <span
    v-else-if="state === 'updating'"
    :class="[pill, 'border-info/30 bg-info/10 text-info']"
  >
    <LoaderCircle class="h-3 w-3 animate-spin motion-reduce:animate-none" />
    <span class="tabular-nums">{{
      node.update_status === "Removing"
        ? t(`${INSPECTOR}.chip.removing`)
        : progress == null
          ? t(`${INSPECTOR}.chip.updating`)
          : t(`${INSPECTOR}.chip.updating_pct`, {
              percent: Math.round(progress),
            })
    }}</span>
  </span>
  <span
    v-else-if="state === 'missing'"
    :class="[pill, 'border-border bg-muted/40 text-muted-foreground']"
    >{{ t("pages.game_server_nodes.row.not_installed") }}</span
  >
  <FiveStackToolTip v-else as-child :delay-duration="120" :disabled="!tip">
    <template #trigger>
      <span
        tabindex="-1"
        :class="[
          pill,
          state === 'failed'
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : state === 'behind'
              ? 'border-warning/30 bg-warning/10 text-warning'
              : 'border-border bg-muted/40 text-muted-foreground',
        ]"
      >
        <CircleAlert v-if="state === 'failed'" class="h-3 w-3" />
        <CircleArrowUp v-else-if="state === 'behind'" class="h-3 w-3" />
        <Pin v-else-if="state === 'pinned'" class="h-3 w-3 text-info" />
        {{
          state === "failed"
            ? t(`${INSPECTOR}.chip.failed`)
            : state === "behind"
              ? t(`${INSPECTOR}.chip.behind`)
              : state === "pinned"
                ? t(`${INSPECTOR}.chip.pinned`)
                : t("pages.game_server_nodes.builds.current")
        }}
      </span>
    </template>
    <span class="tabular-nums">{{ tipText }}</span>
  </FiveStackToolTip>
</template>
