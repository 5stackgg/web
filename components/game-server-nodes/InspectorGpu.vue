<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import GpuCardBlock from "~/components/gpu-nodes/GpuCardBlock.vue";
import WorkloadChips from "~/components/gpu-nodes/WorkloadChips.vue";
import type { NodeLike } from "~/components/game-server-nodes/nodeState";
import { videoPresetOf } from "~/components/game-server-nodes/cs2VideoPresets";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { gpuDevices, type GpuDoing } from "~/components/gpu-nodes/gpuDevices";
import {
  formatElapsed,
  workloadActivity,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";

// GPU: the workloads as chips you flip in place (the popover keeps GPU only
// and the same switches), one block per card with its temperature, power,
// load and video memory, then the video settings it captures with. The GPU
// nodes page knows the node's session, so there each block also says what it
// is doing; the Game Server Nodes inspector doesn't, so it shows the meters.
const props = defineProps<{
  node: NodeLike & Record<string, any>;
  stats?: any;
  /** The node's session, null when idle. Left out where it isn't known. */
  session?: GpuSession | null;
  bake?: GpuSession | null;
}>();

const emit = defineEmits<{ editVideo: [] }>();

const { t } = useI18n();

const devices = computed(() => gpuDevices(props.node, props.stats));

const knowsSessions = computed(() => props.session !== undefined);

const activity = computed(() => workloadActivity(props.session, t));

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  if (knowsSessions.value) {
    ticker = setInterval(() => (now.value = Date.now()), 15 * 1000);
  }
});
onBeforeUnmount(() => ticker && clearInterval(ticker));

const elapsed = (session: GpuSession) =>
  session.startedAt ? formatElapsed(now.value - session.startedAt) : null;

const doing = computed<GpuDoing | null>(() => {
  if (!knowsSessions.value) return null;
  const node = props.node;
  if (!node.enabled) {
    return {
      tone: "off",
      live: false,
      text: t("pages.gpu_nodes.workload.node_disabled"),
      quiet: true,
    };
  }
  if (node.status === "Offline" || node.status === "Setup") {
    return {
      tone: "off",
      live: false,
      text: t("pages.gpu_nodes.sheet.unavailable"),
      quiet: true,
    };
  }
  const session = props.session;
  if (session) {
    return {
      tone: "ok",
      live: true,
      text: Object.values(activity.value)[0] ?? "",
      aside: elapsed(session),
    };
  }
  if (props.bake) {
    const pct =
      typeof props.bake.progress === "number"
        ? Math.round(props.bake.progress)
        : null;
    const label = t("pages.gpu_nodes.node_state.baking");
    return {
      tone: "amber",
      live: true,
      text: pct === null ? label : `${label} · ${pct}%`,
      aside: elapsed(props.bake),
    };
  }
  return {
    tone: "ok",
    live: false,
    text: t("pages.gpu_nodes.idle"),
    quiet: true,
  };
});

// Sessions are per node, not per card: the api doesn't say which card one
// runs on, so a session or bake shows on the first card. A node-wide state
// (idle, disabled) is true of every card.
const doingFor = (index: number) =>
  index === 0 || doing.value?.quiet ? doing.value : null;

const busy = computed(
  () => (!!props.session && !props.session.booting) || !!props.bake,
);

const preset = computed(() => {
  const name = videoPresetOf(props.node.cs2_video_settings);
  return name
    ? t(`game_server.cs2_options.preset.${name}`)
    : t(`${INSPECTOR}.gpu.custom`);
});
</script>

<template>
  <section class="grid gap-3 p-4">
    <div class="flex min-h-7 min-w-0 items-center gap-2">
      <InspectorLabel>GPU</InspectorLabel>
      <span
        v-if="devices.length > 1"
        class="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground"
        >{{
          t(
            "pages.gpu_nodes.plate.cards",
            { count: devices.length },
            devices.length,
          )
        }}</span
      >
      <span v-else class="grow"></span>
      <NodeControlMenu
        :node="node as any"
        workloads-only
        align="end"
        :activity="activity"
      />
    </div>

    <WorkloadChips full :node="node as any" :activity="activity" />

    <div v-if="devices.length" class="grid gap-2">
      <GpuCardBlock
        v-for="(device, index) of devices"
        :key="device.key"
        :device="device"
        :enabled="!!node.enabled"
        :working="index === 0 && busy"
        :doing="doingFor(index)"
      />
    </div>

    <div class="gsn-kv">
      <span class="gsn-k">{{ t(`${INSPECTOR}.gpu.video`) }}</span>
      <div class="gsn-v">
        <span>{{ preset }}</span>
        <button
          type="button"
          class="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
          @click="emit('editVideo')"
        >
          {{ t("common.edit") }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gsn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  font-size: 13px;
}
.gsn-k {
  color: hsl(var(--muted-foreground));
}
.gsn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
