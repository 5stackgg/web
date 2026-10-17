<script setup lang="ts">
import { computed } from "vue";
import { CircuitBoard } from "lucide-vue-next";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import StatusDot from "~/components/admin/StatusDot.vue";
import GpuTemp from "~/components/gpu-nodes/GpuTemp.vue";
import {
  gbOf,
  loadTone,
  vramTone,
  type GpuDeviceView,
  type GpuDoing,
} from "~/components/gpu-nodes/gpuDevices";

// One card in an inspector: its name with temperature and power, load and
// video memory meters, and what it is doing now when that is known.
const props = defineProps<{
  device: GpuDeviceView;
  enabled: boolean;
  /** Something holds this card right now. */
  working?: boolean;
  doing?: GpuDoing | null;
}>();

const load = computed(() =>
  props.device.load == null ? null : Math.round(props.device.load),
);
const loadLevel = computed(() => loadTone(props.device.load));
const usedGb = computed(() =>
  props.device.vramUsedMb == null ? null : props.device.vramUsedMb / 1024,
);
const totalGb = computed(() => gbOf(props.device.memoryMb));
const hasFacts = computed(
  () => props.device.temperature != null || props.device.power != null,
);
</script>

<template>
  <div class="gcb" :data-off="!enabled" data-testid="gpu-card">
    <div class="gcb-h">
      <span class="gcb-chip" :data-work="!!working">
        <CircuitBoard class="relative size-[13px]" />
      </span>
      <b class="min-w-0 truncate font-semibold">{{
        device.name || $t("pages.gpu_nodes.gpu_unknown")
      }}</b>
      <span class="grow" />
      <span v-if="hasFacts" class="gcb-facts">
        <GpuTemp
          v-if="device.temperature != null"
          :value="device.temperature"
        />
        <span
          v-if="device.temperature != null && device.power != null"
          class="text-muted-foreground/50"
          >·</span
        >
        <TweenNumber
          v-if="device.power != null"
          :value="Math.round(device.power)"
          suffix=" W"
        />
      </span>
    </div>

    <div class="gcb-m">
      <span class="text-muted-foreground">{{
        $t("pages.gpu_nodes.col.load")
      }}</span>
      <NodeMeter :value="device.load" metric="gpu" :tone="loadLevel" />
      <b :class="loadLevel !== 'ok' && TONE_TEXT[loadLevel]"
        ><TweenNumber :value="load" suffix="%"
      /></b>
    </div>
    <div class="gcb-m">
      <span class="text-muted-foreground">{{
        $t("pages.gpu_nodes.col.vram")
      }}</span>
      <NodeMeter
        :value="device.vram"
        metric="gpu"
        :tone="vramTone(device.vram)"
      />
      <b
        ><TweenNumber :value="usedGb" :decimals="1" /><span
          v-if="totalGb"
          class="font-normal text-muted-foreground"
        >
          / {{ totalGb }} GB</span
        ></b
      >
    </div>

    <div v-if="doing" class="gcb-now" data-testid="gpu-card-doing">
      <StatusDot :tone="doing.tone" :live="doing.live" />
      <span
        class="min-w-0 truncate"
        :class="doing.quiet && 'text-muted-foreground'"
        >{{ doing.text }}</span
      >
      <template v-if="doing.aside">
        <span class="grow" />
        <span class="shrink-0 tabular-nums text-muted-foreground">{{
          doing.aside
        }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gcb {
  display: grid;
  gap: 8px;
  padding: 10px 12px 11px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(240 5% 8%);
}
.gcb-h {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.gcb[data-off="true"] .gcb-h b {
  color: hsl(var(--muted-foreground));
}
.gcb-chip {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 6px;
  border: 1px solid hsl(var(--border) / 0.6);
  background: hsl(240 4% 11%);
  color: hsl(var(--muted-foreground));
  transition: color 150ms ease;
}
.gcb-chip::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 1px solid hsl(330 75% 70% / 0.35);
  background: hsl(330 75% 70% / 0.08);
  opacity: 0;
  transition: opacity 110ms ease-in;
}
.gcb-chip[data-work="true"] {
  color: hsl(330 75% 70%);
}
.gcb-chip[data-work="true"]::before {
  opacity: 1;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gcb-facts {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.gcb-m {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.gcb-m b {
  min-width: 30px;
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.gcb-now {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid hsl(var(--border) / 0.6);
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .gcb-chip,
  .gcb-chip::before,
  .gcb-chip[data-work="true"]::before {
    transition: none;
  }
}
</style>
