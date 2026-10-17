<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import { CircleAlert, FolderOpen, TriangleAlert } from "lucide-vue-next";
import {
  isOffline,
  type DiskThresholds,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  diskLevel,
  diskSize,
} from "~/components/game-server-nodes/nodeInspector";
import {
  diskTrend,
  diskUsedSeries,
  formatGb,
  type MetricRangeKey,
} from "~/components/game-server-nodes/nodeMetrics";
import { INSPECTOR, TONE_TEXT } from "~/components/game-server-nodes/nodeCopy";

// Disk, with room of its own under Live: the used figure, the fill against
// its thresholds, free space and (when the hour really moved) a trend, then
// each mount on a node with several.
const props = defineProps<{
  node: NodeLike;
  stats: any;
  range: MetricRangeKey;
  diskThresholds: DiskThresholds;
}>();

const emit = defineEmits<{ files: [] }>();

const { t } = useI18n();

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 15_000);
});
onBeforeUnmount(() => clock && clearInterval(clock));
watch(
  () => props.stats,
  () => (now.value = Date.now()),
);

const offline = computed(() => isOffline(props.node));
const disk = computed(() =>
  props.node.status === "Setup" ? null : diskSize(props.node),
);
const tone = computed(() =>
  diskLevel(disk.value?.percent, props.diskThresholds),
);

// A node with several disks lists each from its newest sample (sizes in KiB).
const mounts = computed(() => {
  const last = Array.isArray(props.stats?.disks)
    ? (props.stats.disks.at(-1)?.disks ?? [])
    : [];
  return last.length > 1
    ? last
        .filter((entry: any) => entry?.size)
        .map((entry: any) => {
          const size = Number(entry.size) / 1024 ** 2;
          const used = Number(entry.used || 0) / 1024 ** 2;
          const percent = size ? Math.round((used / size) * 100) : 0;
          return {
            mount: entry.mountpoint || entry.filesystem,
            used,
            size,
            percent,
            tone: diskLevel(percent, props.diskThresholds),
          };
        })
    : [];
});

const trend = computed(() => {
  const size = disk.value;
  if (!size) {
    return null;
  }
  const result = diskTrend(
    diskUsedSeries(props.stats),
    size.freeGb,
    size.totalGb,
    now.value,
    60,
  );
  if (!result || (result.kind === "flat" && props.range === "live")) {
    return null;
  }
  if (result.kind === "flat") {
    return { text: t(`${INSPECTOR}.disk.flat`), soon: false };
  }
  let text = t(`${INSPECTOR}.disk.${result.kind}`, {
    amount: formatGb(result.deltaGb),
  });
  if (result.fullInHours != null) {
    const hours = result.fullInHours;
    text += ` · ${
      hours < 36
        ? t(`${INSPECTOR}.disk.full_hours`, {
            count: Math.max(1, Math.round(hours)),
          })
        : t(
            `${INSPECTOR}.disk.full_days`,
            { count: Math.round(hours / 24) },
            Math.round(hours / 24),
          )
    }`;
  }
  return { text, soon: result.soon };
});
</script>

<template>
  <section
    v-if="disk"
    class="mx-4 grid gap-2 border-t border-border/60 pb-4 pt-4"
  >
    <div class="flex min-h-6 min-w-0 items-center gap-2">
      <h3 class="whitespace-nowrap text-[13px] font-semibold">
        {{
          offline
            ? t(`${INSPECTOR}.disk.last_report`)
            : t(`${INSPECTOR}.load.disk`)
        }}
      </h3>
      <span
        v-if="tone"
        class="inline-flex items-center gap-1 text-xs font-semibold"
        :class="TONE_TEXT[tone]"
      >
        <CircleAlert v-if="tone === 'bad'" class="h-3 w-3" />
        <TriangleAlert v-else class="h-3 w-3" />
        {{
          tone === "bad"
            ? t(`${INSPECTOR}.disk.almost_full`)
            : t(`${INSPECTOR}.disk.filling_up`)
        }}
      </span>
      <span class="grow"></span>
      <Button
        v-if="tone"
        size="xs"
        variant="outline"
        class="h-6 gap-1 text-xs"
        @click="emit('files')"
      >
        <FolderOpen class="h-3 w-3" />
        {{ t(`${INSPECTOR}.step.open_files`) }}
      </Button>
    </div>

    <div class="flex min-w-0 items-baseline gap-1.5 tabular-nums">
      <b
        v-if="disk.usedGb != null"
        class="text-xl font-bold leading-tight tracking-tight"
        >{{ formatGb(disk.usedGb) }}</b
      >
      <span
        v-if="disk.totalGb != null"
        class="whitespace-nowrap text-[12.5px] text-muted-foreground"
        >{{
          t(`${INSPECTOR}.disk.of_used`, { total: formatGb(disk.totalGb) })
        }}</span
      >
      <span class="grow"></span>
      <span class="text-sm font-semibold" :class="tone ? TONE_TEXT[tone] : ''"
        >{{ Math.round(disk.percent) }}%</span
      >
    </div>

    <FiveStackToolTip as-child :delay-duration="120">
      <template #trigger>
        <div class="gsn-dk-bar" tabindex="-1">
          <NodeMeter
            :value="disk.percent"
            :tone="tone ?? 'ok'"
            :notches="[diskThresholds.warning, diskThresholds.critical]"
          />
        </div>
      </template>
      {{
        t(`${INSPECTOR}.disk.thresholds`, {
          warning: diskThresholds.warning,
          critical: diskThresholds.critical,
        })
      }}
    </FiveStackToolTip>

    <div
      class="flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground"
    >
      <span v-if="disk.freeGb != null" class="tabular-nums">{{
        t(`${INSPECTOR}.disk.free`, { free: formatGb(disk.freeGb) })
      }}</span>
      <span
        v-if="trend"
        class="ml-auto min-w-0 text-right tabular-nums"
        :class="trend.soon && TONE_TEXT.warn"
        >{{ trend.text }}</span
      >
    </div>

    <ul
      v-if="mounts.length"
      class="mt-0.5 grid gap-1.5 border-t border-border/60 pt-2 text-xs"
    >
      <li v-for="entry of mounts" :key="entry.mount" class="gsn-dk-mount">
        <span class="min-w-0 truncate font-mono text-muted-foreground">{{
          entry.mount
        }}</span>
        <span class="whitespace-nowrap tabular-nums">{{
          t(`${INSPECTOR}.disk.used_of`, {
            used: formatGb(entry.used),
            total: formatGb(entry.size),
          })
        }}</span>
        <span
          class="text-right tabular-nums"
          :class="entry.tone ? TONE_TEXT[entry.tone] : 'text-muted-foreground'"
          >{{ entry.percent }}%</span
        >
      </li>
    </ul>
  </section>
</template>

<style scoped>
.gsn-dk-bar :deep(.gsn-meter) {
  height: 8px;
}
.gsn-dk-mount {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 38px;
  align-items: center;
  gap: 10px;
}
</style>
