<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";
import {
  ArrowUpRight,
  Ellipsis,
  Flame,
  PanelRightOpen,
  ScrollText,
  Settings2,
  X,
  Clapperboard,
  Play,
  Radio,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import NodeLoadStack from "~/components/game-server-nodes/NodeLoadStack.vue";
import { diskSize } from "~/components/game-server-nodes/nodeInspector";
import {
  cpuSeries,
  latest,
  memorySeries,
} from "~/components/game-server-nodes/nodeMetrics";
import { nodeSettings } from "~/components/game-server-nodes/nodeState";
import GpuStatusDot from "~/components/gpu-nodes/GpuStatusDot.vue";
import {
  gpuShortName,
  isBaking,
  isMatchNode,
  nodeName,
  workloadActivity,
  type GpuNodeState,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";
import { useGpuNodeActions } from "~/composables/useGpuNodeActions";
import { $ } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const props = defineProps<{
  node: any;
  state: GpuNodeState;
  stateLabel: string;
  /** What is running on this GPU now, for the workload control. */
  session?: GpuSession | null;
  /** Its panel is open. */
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "logs"): void;
  (e: "video"): void;
}>();

const { t } = useI18n();
const actions = useGpuNodeActions();

const activity = computed(() => workloadActivity(props.session, t));

// Read-only at a glance: which workloads this GPU takes, and the one running
// now. The switches (with Enabled and accepting matches) live behind the
// settings icon in front of the name.
const workloadIcons = computed(() => {
  const now = activity.value;
  return [
    { key: "streaming", icon: Radio, on: !!props.node.gpu_streaming_enabled },
    { key: "demos", icon: Play, on: !!props.node.gpu_demos_enabled },
    {
      key: "rendering",
      icon: Clapperboard,
      on: !!props.node.gpu_rendering_enabled,
    },
  ].map((workload) => {
    const line = now[workload.key as keyof typeof now];
    return {
      ...workload,
      running: !!line,
      tip:
        line ||
        `${t(`pages.gpu_nodes.workload.${workload.key}`)} · ${
          workload.on ? t("common.enabled") : t("common.disabled")
        }`,
    };
  });
});

const reachable = computed(
  () =>
    props.node.enabled &&
    props.node.status !== "Offline" &&
    props.node.status !== "Setup",
);

// The GPU query NodeGpuMetrics polls plus CPU and memory, uncached so the row
// and the sheet's charts never overwrite each other's copy.
const sampleFields = { time: true, total: true, used: true };
const STATS = generateQuery({
  getNodeStats: [
    { node: $("node", "String!") },
    {
      node: true,
      cpu: [{}, sampleFields],
      memory: [{}, sampleFields],
      gpu: [
        {},
        {
          time: true,
          devices: {
            index: true,
            name: true,
            memory_mb: true,
            memory_used_mb: true,
            temperature_c: true,
            power_w: true,
            utilization_percent: true,
          },
        },
      ],
    },
  ],
});

const { result } = useQuery(
  STATS,
  () => ({ node: props.node.id }),
  () => ({
    enabled: reachable.value,
    pollInterval: 15 * 1000,
    fetchPolicy: "no-cache",
  }),
);

const stats = computed(() => (result.value as any)?.getNodeStats ?? null);

const gpuSnapshot = computed(() => {
  const list = stats.value?.gpu ?? [];
  const last = list[list.length - 1];
  return last?.devices?.length ? last : null;
});

const cpu = computed(() =>
  reachable.value ? latest(cpuSeries(stats.value)) : null,
);
const memory = computed(() =>
  reachable.value ? latest(memorySeries(stats.value)) : null,
);
const disk = computed(() => diskSize(props.node));
const diskThresholds = computed(
  () => nodeSettings(useApplicationSettingsStore().settings).disk,
);

const utilization = computed(() => {
  const values = (gpuSnapshot.value?.devices ?? [])
    .map((device: any) => device.utilization_percent)
    .filter((value: unknown) => typeof value === "number");
  if (!values.length) return null;
  return Math.round(
    values.reduce((sum: number, value: number) => sum + value, 0) /
      values.length,
  );
});

const vram = computed(() => {
  let used = 0;
  let total = 0;
  for (const device of gpuSnapshot.value?.devices ?? []) {
    if (typeof device.memory_mb === "number") total += device.memory_mb;
    if (typeof device.memory_used_mb === "number")
      used += device.memory_used_mb;
  }
  return total ? { used, total } : null;
});

const vramTotalGb = computed(() => {
  const mb = props.node.gpu_info?.[0]?.memory_mb;
  return mb ? Math.round(mb / 1024) : null;
});

function onRowClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("a, button, [role='switch']"))
    return;
  emit("open");
}
</script>

<template>
  <tr
    class="gpn-row cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-muted/30"
    :class="node.enabled ? '' : 'text-muted-foreground'"
    :aria-selected="selected"
    @click="onRowClick"
  >
    <td class="px-3 py-2.5">
      <span class="inline-flex items-center gap-2 whitespace-nowrap">
        <NodeControlMenu
          :node="node"
          align="start"
          :activity="activity"
          class="shrink-0"
        />
        <FiveStackToolTip as-child :delay-duration="120">
          <template #trigger>
            <span class="inline-flex p-1 -m-1" tabindex="0">
              <GpuStatusDot :tone="state.tone" :live="state.live" />
            </span>
          </template>
          {{
            node.enabled
              ? node.e_status?.description || node.status
              : $t("pages.gpu_nodes.disabled")
          }}
        </FiveStackToolTip>
        <span
          class="font-semibold"
          :class="node.enabled ? 'text-foreground' : ''"
        >
          {{ gpuShortName(node) || $t("pages.gpu_nodes.gpu_unknown") }}
        </span>
        <span
          v-if="vramTotalGb"
          class="rounded border border-border px-1.5 py-px font-mono text-[11px] text-muted-foreground"
        >
          {{ vramTotalGb }} GB
        </span>
      </span>
    </td>
    <td class="px-3 py-2.5">
      <span class="inline-flex items-center gap-1.5">
        <FiveStackToolTip
          v-for="workload in workloadIcons"
          :key="workload.key"
          as-child
          :delay-duration="120"
        >
          <template #trigger>
            <span
              class="inline-grid size-6 place-items-center rounded-md transition-colors duration-150"
              :class="
                workload.running
                  ? 'bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
                  : workload.on
                    ? 'text-foreground/80'
                    : 'text-muted-foreground/35'
              "
              tabindex="0"
              :aria-label="workload.tip"
            >
              <component :is="workload.icon" class="size-3.5" />
            </span>
          </template>
          {{ workload.tip }}
        </FiveStackToolTip>
      </span>
    </td>
    <td class="px-3 py-2.5">
      <div class="grid min-w-0 gap-0.5">
        <NuxtLink
          :to="{ path: '/game-server-nodes', query: { node: node.id } }"
          class="max-w-[200px] truncate underline decoration-dotted underline-offset-[3px] transition-colors hover:text-[hsl(var(--tac-amber))]"
          :class="node.label ? '' : 'font-mono text-xs'"
        >
          {{ nodeName(node) }}
        </NuxtLink>
        <span class="whitespace-nowrap text-xs text-muted-foreground">
          {{
            isMatchNode(node)
              ? $t("pages.gpu_nodes.node_kind.match")
              : $t("pages.gpu_nodes.node_kind.gpu")
          }}
          · {{ node.e_region?.description || $t("pages.gpu_nodes.no_region") }}
        </span>
      </div>
    </td>
    <td
      class="whitespace-nowrap px-3 py-2.5"
      :class="{
        'text-destructive': state.tone === 'bad',
        'text-yellow-500': state.tone === 'warn',
        'text-[hsl(var(--tac-amber))]': state.tone === 'amber',
        'text-muted-foreground': state.group === 'off' && state.tone === 'off',
      }"
    >
      {{ stateLabel }}
    </td>
    <td class="px-3 py-2.5">
      <NodeLoadStack
        class="min-w-[136px]"
        :live="!!reachable"
        :cpu="cpu"
        :memory="memory"
        :disk="disk"
        :gpu="utilization"
        :disk-thresholds="diskThresholds"
      />
    </td>
    <td class="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
      <template v-if="reachable && vram">
        {{ (vram.used / 1024).toFixed(1)
        }}<span class="text-xs text-muted-foreground">
          / {{ Math.round(vram.total / 1024) }} GB</span
        >
      </template>
      <span v-else class="text-muted-foreground/50">—</span>
    </td>
    <td class="px-3 py-2.5 text-right">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="
              $t('pages.gpu_nodes.more_for', { node: nodeName(node) })
            "
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-64">
          <DropdownMenuItem @click="emit('open')">
            <PanelRightOpen />
            <span>{{ $t("pages.gpu_nodes.open_details") }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-if="isBaking(node)"
            :disabled="actions.bakeBusy[node.id]"
            @click="actions.cancelBake(node.id)"
          >
            <X />
            <span>{{ $t("pages.gpu_nodes.bake.cancel") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-else
            :disabled="!reachable || actions.bakeBusy[node.id]"
            @click="actions.bakeShaders(node.id)"
          >
            <Flame />
            <span>{{ $t("pages.gpu_nodes.bake.action") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('logs')">
            <ScrollText />
            <span>{{ $t("pages.gpu_nodes.bake.logs") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('video')">
            <Settings2 />
            <span>{{ $t("game_server.edit_cs2_options") }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <NuxtLink
              :to="{ path: '/game-server-nodes', query: { node: node.id } }"
            >
              <ArrowUpRight />
              <span>{{ $t("pages.gpu_nodes.open_in_nodes") }}</span>
            </NuxtLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
</template>

<style scoped>
.gpn-row[aria-selected="true"] > td {
  background: hsl(240 4% 10.5%);
}
.gpn-row[aria-selected="true"] > td:first-child {
  box-shadow: inset 2px 0 0 hsl(var(--tac-amber));
}
</style>
