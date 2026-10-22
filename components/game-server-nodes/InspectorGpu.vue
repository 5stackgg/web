<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import GpuCardBlock from "~/components/gpu-nodes/GpuCardBlock.vue";
import WorkloadChips from "~/components/gpu-nodes/WorkloadChips.vue";
import type { NodeLike } from "~/components/game-server-nodes/nodeState";
import { Pencil } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  PRESETS,
  videoPresetOf,
} from "~/components/game-server-nodes/cs2VideoPresets";
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

const video = computed(() => {
  const stored: Record<string, number | null> =
    props.node.cs2_video_settings ?? {};
  const name = videoPresetOf(stored);
  const preset = name
    ? t(`game_server.cs2_options.preset.${name}`)
    : t(`${INSPECTOR}.gpu.custom`);
  const msaa = stored["setting.msaa_samples"] ?? PRESETS.low.msaa_samples;
  const cmaa =
    stored["setting.r_csgo_cmaa_enable"] ?? PRESETS.low.r_csgo_cmaa_enable;
  const height = stored["setting.defaultresheight"] ?? 1080;
  return {
    auto: name === "auto",
    preset,
    resolution: `${height}p`,
    aa:
      msaa === 2 || msaa === 4 || msaa === 8
        ? t(`game_server.cs2_options.video.aa.msaa${msaa}`)
        : cmaa
          ? t("game_server.cs2_options.video.aa.cmaa")
          : t("game_server.cs2_options.video.aa.off"),
  };
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
        :doing="doingFor(index)"
      />
    </div>

    <div class="giv" data-testid="gpu-video">
      <div class="giv-h">
        <b class="min-w-0 truncate font-semibold">{{
          t(`${INSPECTOR}.gpu.video`)
        }}</b>
        <span class="grow"></span>
        <Button
          variant="ghost"
          size="icon-sm"
          class="-mr-1.5 h-6 w-6 shrink-0 text-muted-foreground"
          :aria-label="t('common.edit')"
          :title="t('common.edit')"
          @click="emit('editVideo')"
        >
          <Pencil class="h-3 w-3" />
        </Button>
      </div>
      <p v-if="video.auto" class="giv-auto">
        <span class="font-semibold text-foreground">{{ video.preset }}</span>
        · {{ t(`${INSPECTOR}.gpu.auto_hint`) }}
      </p>
      <dl v-else class="grid gap-1">
        <div class="giv-row">
          <dt>{{ t("game_server.cs2_options.preset.title") }}</dt>
          <dd>{{ video.preset }}</dd>
        </div>
        <div class="giv-row">
          <dt>{{ t("game_server.cs2_options.video.resolution") }}</dt>
          <dd class="tabular-nums">{{ video.resolution }}</dd>
        </div>
        <div class="giv-row">
          <dt>{{ t("game_server.cs2_options.video.aa.label") }}</dt>
          <dd>{{ video.aa }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.giv {
  display: grid;
  gap: 8px;
  padding: 8px 12px 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(240 5% 8%);
}
.giv-h {
  display: flex;
  min-width: 0;
  min-height: 24px;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.giv-auto {
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.giv-row {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12px;
  font-size: 12px;
}
.giv-row dt {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: hsl(var(--muted-foreground));
}
.giv-row dd {
  margin-left: auto;
  flex: none;
  font-weight: 600;
  white-space: nowrap;
}
</style>
