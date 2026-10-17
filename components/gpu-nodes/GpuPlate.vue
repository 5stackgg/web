<script setup lang="ts">
import { computed } from "vue";
import { CircuitBoard } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import GpuTemp from "~/components/gpu-nodes/GpuTemp.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  GPU_TEMP_CRIT,
  GPU_TEMP_HOT,
  gbOf,
  loadTone,
  tempTone,
  vramTone,
  type GpuDeviceView,
} from "~/components/gpu-nodes/gpuDevices";
import type { GpuNodeState } from "~/components/gpu-nodes/gpuSessions";

// A GPU node's cards in the table: a chip tile wearing the status dot, then
// per card its name, capacity and temperature with a two-bar gauge (load,
// video memory). The exact numbers are in each card's tooltip.
const props = defineProps<{
  devices: GpuDeviceView[];
  tone: GpuNodeState["tone"];
  live: boolean;
  statusLabel: string;
  /** Something holds the GPU right now. */
  working: boolean;
  enabled: boolean;
}>();

const { t } = useI18n();

const multi = computed(() => props.devices.length > 1);

const scale = (value: number | null) =>
  Math.min(1, Math.max(0, (value ?? 0) / 100)).toFixed(3);

const hasReading = (device: GpuDeviceView) =>
  device.load != null || device.vramUsedMb != null;

function readout(device: GpuDeviceView) {
  const total = gbOf(device.memoryMb);
  const tone = tempTone(device.temperature);
  return {
    rows: [
      {
        key: "load",
        label: t("pages.gpu_nodes.col.load"),
        value: device.load == null ? "—" : `${Math.round(device.load)}%`,
        tone: loadTone(device.load),
      },
      {
        key: "vram",
        label: t("pages.gpu_nodes.col.vram"),
        value:
          device.vramUsedMb == null
            ? total
              ? `${total} GB`
              : "—"
            : t("pages.gpu_nodes.plate.vram_of", {
                used: (device.vramUsedMb / 1024).toFixed(1),
                total: total ?? "—",
              }),
        tone: vramTone(device.vram),
      },
      {
        key: "temp",
        label: t("pages.gpu_nodes.plate.temperature"),
        value:
          device.temperature == null
            ? "—"
            : `${Math.round(device.temperature)} °C`,
        tone,
      },
      {
        key: "power",
        label: t("pages.gpu_nodes.plate.power"),
        value: device.power == null ? "—" : `${Math.round(device.power)} W`,
        tone: "ok" as const,
      },
    ],
    warning:
      tone === "ok"
        ? null
        : {
            tone,
            text:
              tone === "bad"
                ? t("pages.gpu_nodes.plate.too_hot", { limit: GPU_TEMP_CRIT })
                : t("pages.gpu_nodes.plate.hot", { limit: GPU_TEMP_HOT }),
          },
    missing: !hasReading(device),
  };
}

const cards = computed(() =>
  props.devices.map((device) => ({ device, info: readout(device) })),
);
</script>

<template>
  <div
    class="gpl"
    :data-off="!enabled"
    :data-multi="multi"
    data-testid="gpu-plate"
  >
    <FiveStackToolTip as-child :delay-duration="120">
      <template #trigger>
        <span
          class="gpl-chip"
          :data-work="working"
          :style="{ gridRow: `1 / span ${Math.max(1, devices.length)}` }"
          tabindex="0"
          role="img"
          :aria-label="statusLabel"
        >
          <CircuitBoard class="relative size-4" />
          <span class="gpl-dot"><StatusDot :tone="tone" :live="live" /></span>
          <span v-if="multi" class="gpl-count tabular-nums" aria-hidden="true">
            {{ devices.length }}
          </span>
        </span>
      </template>
      {{ statusLabel }}
    </FiveStackToolTip>

    <span v-if="!devices.length" class="gpl-card">
      <span class="gpl-id">
        <b class="gpl-name truncate">{{ $t("pages.gpu_nodes.gpu_unknown") }}</b>
      </span>
    </span>

    <FiveStackToolTip
      v-for="{ device, info } of cards"
      :key="device.key"
      as-child
      :delay-duration="120"
      align="end"
    >
      <template #trigger>
        <span class="gpl-card" tabindex="0" data-testid="gpu-plate-card">
          <span v-if="!multi" class="gpl-id">
            <b class="gpl-name truncate">{{
              device.name || $t("pages.gpu_nodes.gpu_unknown")
            }}</b>
            <span class="gpl-sub">
              <span v-if="gbOf(device.memoryMb)" class="tabular-nums"
                >{{ gbOf(device.memoryMb) }} GB</span
              >
              <template
                v-if="gbOf(device.memoryMb) && device.temperature != null"
              >
                <span class="text-muted-foreground/50">·</span>
              </template>
              <GpuTemp
                v-if="device.temperature != null"
                :value="device.temperature"
                :tip="false"
              />
            </span>
          </span>
          <span v-else class="gpl-line">
            <b class="gpl-name truncate">{{
              device.name || $t("pages.gpu_nodes.gpu_unknown")
            }}</b>
            <small
              v-if="gbOf(device.memoryMb)"
              class="shrink-0 tabular-nums text-muted-foreground"
              >{{ gbOf(device.memoryMb) }} GB</small
            >
            <GpuTemp
              v-if="tempTone(device.temperature) !== 'ok'"
              class="shrink-0 text-[11.5px]"
              :value="device.temperature"
              :tip="false"
            />
          </span>
          <span
            class="gpl-gauge"
            :data-small="multi"
            :data-empty="!hasReading(device)"
            aria-hidden="true"
          >
            <span class="gpl-bar">
              <i
                :data-tone="loadTone(device.load)"
                :style="{ transform: `scaleY(${scale(device.load)})` }"
              />
            </span>
            <span class="gpl-bar" data-vram>
              <i
                :data-tone="vramTone(device.vram)"
                :style="{ transform: `scaleY(${scale(device.vram)})` }"
              />
            </span>
          </span>
        </span>
      </template>
      <div class="grid gap-1 text-xs" data-testid="gpu-plate-readout">
        <b v-if="multi && device.name" class="font-semibold">{{
          device.name
        }}</b>
        <span v-if="info.missing" class="text-muted-foreground">{{
          $t("pages.gpu_nodes.plate.no_reading")
        }}</span>
        <dl class="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
          <template v-for="row of info.rows" :key="row.key">
            <dt class="text-muted-foreground">{{ row.label }}</dt>
            <dd
              class="text-right font-semibold"
              :class="row.tone !== 'ok' && TONE_TEXT[row.tone]"
            >
              {{ row.value }}
            </dd>
          </template>
        </dl>
        <span v-if="info.warning" :class="TONE_TEXT[info.warning.tone]">{{
          info.warning.text
        }}</span>
      </div>
    </FiveStackToolTip>
  </div>
</template>

<style scoped>
.gpl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  row-gap: 3px;
  width: 224px;
  padding: 6px 8px 6px 6px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(240 5% 8%);
}
.gpl-chip {
  position: relative;
  grid-column: 1;
  display: inline-grid;
  place-items: center;
  align-self: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid hsl(var(--border) / 0.6);
  background: hsl(240 4% 11%);
  color: hsl(var(--muted-foreground));
  transition: color 150ms ease;
}
/* Working: a pink wash that fades in over the tile. */
.gpl-chip::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  border: 1px solid hsl(330 75% 70% / 0.35);
  background: hsl(330 75% 70% / 0.08);
  opacity: 0;
  transition: opacity 110ms ease-in;
}
.gpl-chip[data-work="true"] {
  color: hsl(330 75% 70%);
}
.gpl-chip[data-work="true"]::before {
  opacity: 1;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gpl-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  display: inline-flex;
  border-radius: 999px;
  box-shadow: 0 0 0 2px hsl(240 5% 8%);
}
.gpl-count {
  position: absolute;
  bottom: -5px;
  right: -6px;
  display: grid;
  place-items: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: hsl(240 4% 18%);
  box-shadow: 0 0 0 2px hsl(240 5% 8%);
  color: hsl(var(--foreground));
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1;
}
.gpl-card {
  grid-column: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border-radius: 4px;
  outline: none;
}
.gpl-card:focus-visible {
  box-shadow: 0 0 0 2px hsl(var(--tac-amber) / 0.5);
}
.gpl-id {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.gpl-name {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  color: hsl(var(--foreground));
}
.gpl[data-off="true"] .gpl-name {
  color: hsl(var(--muted-foreground));
}
.gpl-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 11.5px;
  line-height: 15px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.gpl-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}
.gpl-line .gpl-name {
  font-size: 12.5px;
  line-height: 16px;
}
.gpl-line small {
  font-size: 11px;
}
.gpl-gauge {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  padding: 2px;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gpl[data-off="true"] .gpl-gauge,
.gpl-gauge[data-empty="true"] {
  opacity: 0.5;
}
.gpl-bar {
  position: relative;
  display: block;
  width: 5px;
  height: 22px;
  overflow: hidden;
  border-radius: 2px;
  background: hsl(240 4% 16%);
}
.gpl-gauge[data-small="true"] .gpl-bar {
  height: 13px;
}
.gpl-bar > i {
  position: absolute;
  inset: 0;
  background: hsl(330 75% 70%);
  transform-origin: bottom;
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.gpl-bar[data-vram] > i {
  background: hsl(330 75% 70% / 0.55);
}
.gpl-bar > i[data-tone="bad"] {
  background: hsl(var(--destructive));
}
@media (prefers-reduced-motion: reduce) {
  .gpl-chip,
  .gpl-chip::before,
  .gpl-chip[data-work="true"]::before,
  .gpl-gauge,
  .gpl-bar > i {
    transition: none;
  }
}
</style>
