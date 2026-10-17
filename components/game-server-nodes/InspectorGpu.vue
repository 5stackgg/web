<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import { SlidersHorizontal } from "lucide-vue-next";
import {
  isGpuOnly,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  GPU_WORKLOADS,
  workloadsOff,
} from "~/components/game-server-nodes/nodeInspector";
import { videoPresetOf } from "~/components/game-server-nodes/cs2VideoPresets";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// GPU: the workloads (the same popover as the GPU nodes page), the video
// settings it captures with, and whether it hosts matches at all.
const props = defineProps<{
  node: NodeLike & Record<string, any>;
  stats?: any;
}>();

const emit = defineEmits<{ mode: [mode: "match" | "gpu"]; editVideo: [] }>();

const { t } = useI18n();

const gpuOnly = computed(() => isGpuOnly(props.node));
const on = computed(
  () => GPU_WORKLOADS.length - workloadsOff(props.node).length,
);

// Each GPU's newest reading: load, video memory, temperature and power.
const devices = computed(() => {
  const last = Array.isArray(props.stats?.gpu) ? props.stats.gpu.at(-1) : null;
  return (last?.devices ?? [])
    .filter((device: any) => device)
    .map((device: any) => ({
      key: device.index ?? device.name,
      name: String(device.name ?? "GPU").replace(/^NVIDIA (GeForce )?/, ""),
      load:
        typeof device.utilization_percent === "number"
          ? `${Math.round(device.utilization_percent)}%`
          : null,
      vram:
        device.memory_mb && device.memory_used_mb != null
          ? `${(device.memory_used_mb / 1024).toFixed(1)} / ${(device.memory_mb / 1024).toFixed(0)} GB`
          : null,
      temperature:
        typeof device.temperature_c === "number"
          ? `${Math.round(device.temperature_c)} °C`
          : null,
      power:
        typeof device.power_w === "number"
          ? `${Math.round(device.power_w)} W`
          : null,
    }));
});

const names = computed(() =>
  (Array.isArray(props.node.gpu_info) ? props.node.gpu_info : [])
    .map((device: any) =>
      typeof device?.name === "string"
        ? device.name.replace(/^NVIDIA (GeForce )?/, "")
        : "",
    )
    .filter(Boolean)
    .join(", "),
);

const preset = computed(() => {
  const name = videoPresetOf(props.node.cs2_video_settings);
  return name
    ? t(`game_server.cs2_options.preset.${name}`)
    : t(`${INSPECTOR}.gpu.custom`);
});
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <h3 class="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
      GPU
      <span
        v-if="names"
        class="ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground"
        >{{ names }}</span
      >
    </h3>

    <div
      class="flex min-h-10 items-center gap-3"
      :class="!node.enabled && 'opacity-60'"
    >
      <span
        class="inline-grid h-7 w-7 shrink-0 place-items-center rounded-md border"
        :class="
          on > 0
            ? 'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border text-muted-foreground'
        "
        ><SlidersHorizontal class="h-3.5 w-3.5"
      /></span>
      <span class="min-w-0 flex-1">
        <span class="block text-[13px]">{{
          t("pages.gpu_nodes.workload.section")
        }}</span>
        <span class="block text-xs tabular-nums text-muted-foreground">{{
          t("pages.gpu_nodes.workload.summary", {
            on,
            total: GPU_WORKLOADS.length,
          })
        }}</span>
      </span>
      <NodeControlMenu :node="node as any" workloads-only align="end" />
    </div>

    <ul v-if="devices.length" class="grid gap-1 text-xs">
      <li
        v-for="device of devices"
        :key="device.key"
        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5"
      >
        <span class="min-w-0 truncate font-medium">{{ device.name }}</span>
        <span class="grow"></span>
        <span v-if="device.load" class="tabular-nums">
          <span class="text-muted-foreground">{{
            t("pages.gpu_nodes.col.load")
          }}</span>
          {{ device.load }}
        </span>
        <span v-if="device.vram" class="tabular-nums">
          <span class="text-muted-foreground">{{
            t("pages.gpu_nodes.col.vram")
          }}</span>
          {{ device.vram }}
        </span>
        <span v-if="device.temperature" class="tabular-nums">{{
          device.temperature
        }}</span>
        <span v-if="device.power" class="tabular-nums">{{ device.power }}</span>
      </li>
    </ul>

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

      <span class="gsn-k">{{ t("pages.game_server_nodes.detail.mode") }}</span>
      <div class="gsn-v">
        <span>{{
          gpuOnly
            ? t("pages.game_server_nodes.gpu_only")
            : t(`${INSPECTOR}.gpu.match_server`)
        }}</span>
        <Button
          size="xs"
          variant="outline"
          class="h-6 text-xs"
          @click="emit('mode', gpuOnly ? 'match' : 'gpu')"
        >
          {{
            gpuOnly
              ? t(`${INSPECTOR}.gpu.use_as_match`)
              : t(`${INSPECTOR}.gpu.use_as_gpu`)
          }}
        </Button>
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
