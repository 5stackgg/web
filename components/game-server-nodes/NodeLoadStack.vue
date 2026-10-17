<script setup lang="ts">
import { computed, useSlots } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import {
  diskLevel,
  type DiskSize,
} from "~/components/game-server-nodes/nodeInspector";
import {
  DEFAULT_DISK_THRESHOLDS,
  type DiskThresholds,
} from "~/components/game-server-nodes/nodeState";
import { formatGb } from "~/components/game-server-nodes/nodeMetrics";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";

type LoadTone = "ok" | "warn" | "bad";
type LineKey = "cpu" | "memory" | "disk";

// CPU, memory and disk as compact lines (label, meter, value). Each meter
// wears its metric's chart colour; warn tints the value, critical turns the
// meter red. Off `live`, only the disk
// shows. A `<key>-tip` slot puts a tooltip on that line; the disk has one.
const props = withDefaults(
  defineProps<{
    cpu?: number | null;
    memory?: number | null;
    disk?: DiskSize | null;
    diskThresholds?: DiskThresholds;
    live?: boolean;
    cpuTone?: LoadTone;
    memoryTone?: LoadTone;
    // One decimal under 10%, for a service's small share of a node.
    precise?: boolean;
  }>(),
  {
    cpu: null,
    memory: null,
    disk: null,
    diskThresholds: () => DEFAULT_DISK_THRESHOLDS,
    live: true,
    cpuTone: undefined,
    memoryTone: undefined,
    precise: false,
  },
);

const { t } = useI18n();
const slots = useSlots();

const loadTone = (value: number | null): LoadTone =>
  value == null ? "ok" : value >= 85 ? "bad" : value >= 70 ? "warn" : "ok";

const decimals = (value: number | null) =>
  props.precise && value != null && value < 10 ? 1 : 0;

const lines = computed(() => {
  const out: Array<{
    key: LineKey;
    metric: "cpu" | "mem" | "disk";
    label: string;
    value: number | null;
    decimals: number;
    tone: LoadTone;
  }> = [];
  if (props.live) {
    out.push(
      {
        key: "cpu",
        metric: "cpu",
        label: t("pages.system_metrics.cpu_short"),
        value: props.cpu,
        decimals: decimals(props.cpu),
        tone: props.cpuTone ?? loadTone(props.cpu),
      },
      {
        key: "memory",
        metric: "mem",
        label: t(`${INSPECTOR}.load.mem`),
        value: props.memory,
        decimals: decimals(props.memory),
        tone: props.memoryTone ?? loadTone(props.memory),
      },
    );
  }
  if (props.disk) {
    out.push({
      key: "disk",
      metric: "disk",
      label: t(`${INSPECTOR}.load.disk`),
      value: props.disk.percent,
      decimals: 0,
      tone: diskLevel(props.disk.percent, props.diskThresholds) ?? "ok",
    });
  }
  return out;
});

const diskTip = computed(() =>
  props.disk
    ? t(`${INSPECTOR}.disk_tip`, {
        used: formatGb(props.disk.usedGb),
        total: formatGb(props.disk.totalGb),
        free: formatGb(props.disk.freeGb),
      })
    : "",
);

const hasTip = (key: LineKey) => key === "disk" || !!slots[`${key}-tip`];

const rounded = (value: number | null, places: number) =>
  value == null ? null : Math.round(value * 10 ** places) / 10 ** places;
</script>

<template>
  <span v-if="!lines.length" class="text-muted-foreground/60">—</span>
  <div v-else class="grid gap-[3px] text-[11px]">
    <template v-for="line of lines" :key="line.key">
      <FiveStackToolTip
        v-if="hasTip(line.key)"
        as-child
        :delay-duration="120"
        side="left"
      >
        <template #trigger>
          <div class="nls-line" :data-line="line.key" tabindex="-1">
            <span class="text-muted-foreground/70">{{ line.label }}</span>
            <NodeMeter
              :value="line.value"
              :tone="line.tone"
              :metric="line.metric"
              thin
            />
            <b
              class="text-right font-semibold"
              :class="line.tone !== 'ok' && TONE_TEXT[line.tone]"
              ><TweenNumber
                :value="rounded(line.value, line.decimals)"
                :decimals="line.decimals"
                suffix="%"
            /></b>
          </div>
        </template>
        <slot :name="`${line.key}-tip`" :tip="diskTip">
          <span class="tabular-nums">{{ diskTip }}</span>
        </slot>
      </FiveStackToolTip>
      <div v-else class="nls-line" :data-line="line.key">
        <span class="text-muted-foreground/70">{{ line.label }}</span>
        <NodeMeter
          :value="line.value"
          :tone="line.tone"
          :metric="line.metric"
          thin
        />
        <b
          class="text-right font-semibold"
          :class="line.tone !== 'ok' && TONE_TEXT[line.tone]"
          ><TweenNumber
            :value="rounded(line.value, line.decimals)"
            :decimals="line.decimals"
            suffix="%"
        /></b>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nls-line {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 6px;
  line-height: 13px;
}
</style>
