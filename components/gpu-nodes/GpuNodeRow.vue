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
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import NodeLoadStack from "~/components/game-server-nodes/NodeLoadStack.vue";
import { diskSize } from "~/components/game-server-nodes/nodeInspector";
import {
  cpuSeries,
  latest,
  memorySeries,
} from "~/components/game-server-nodes/nodeMetrics";
import { nodeSettings } from "~/components/game-server-nodes/nodeState";
import { TONE_TEXT } from "~/components/admin/tone";
import GpuPlate from "~/components/gpu-nodes/GpuPlate.vue";
import WorkloadChips from "~/components/gpu-nodes/WorkloadChips.vue";
import { gpuDevices } from "~/components/gpu-nodes/gpuDevices";
import {
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

// The plate carries the GPU's own load; the chips flip its workloads in
// place, and the menu in front of it keeps Enabled, Matchmaking, accepting
// matches and the same workload switches.
const activity = computed(() => workloadActivity(props.session, t));

const reachable = computed(
  () =>
    props.node.enabled &&
    props.node.status !== "Offline" &&
    props.node.status !== "Setup",
);

// A disabled node that is still online keeps reporting its load; only an
// offline or unset node has nothing to show.
const reporting = computed(
  () => props.node.status !== "Offline" && props.node.status !== "Setup",
);

// The node's GPU devices plus its CPU and memory, uncached so the row and the
// sheet's charts never overwrite each other's copy.
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
    enabled: reporting.value,
    pollInterval: 15 * 1000,
    fetchPolicy: "no-cache",
  }),
);

const stats = computed(() => (result.value as any)?.getNodeStats ?? null);

const cpu = computed(() =>
  reporting.value ? latest(cpuSeries(stats.value)) : null,
);
const memory = computed(() =>
  reporting.value ? latest(memorySeries(stats.value)) : null,
);
const disk = computed(() => diskSize(props.node));
const diskThresholds = computed(
  () => nodeSettings(useApplicationSettingsStore().settings).disk,
);

const devices = computed(() => gpuDevices(props.node, stats.value));

const working = computed(
  () => (!!props.session && !props.session.booting) || isBaking(props.node),
);

const statusLabel = computed(() =>
  props.node.enabled
    ? props.node.e_status?.description || props.node.status
    : t("pages.gpu_nodes.disabled"),
);

function onRowClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("a, button, [role='switch']"))
    return;
  emit("open");
}
</script>

<template>
  <tr
    class="gpn-row cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
    :class="node.enabled ? '' : 'text-muted-foreground'"
    :aria-selected="selected"
    @click="onRowClick"
  >
    <td class="px-3 py-2">
      <div class="flex items-center gap-2">
        <NodeControlMenu
          :node="node"
          align="start"
          :activity="activity"
          class="shrink-0"
        />
        <GpuPlate
          :devices="devices"
          :tone="state.tone"
          :live="state.live"
          :status-label="statusLabel"
          :working="working"
          :enabled="!!node.enabled"
        />
      </div>
    </td>
    <td class="px-3 py-2">
      <WorkloadChips :node="node" :activity="activity" />
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
      :class="state.tone !== 'ok' && TONE_TEXT[state.tone]"
    >
      {{ stateLabel }}
    </td>
    <td class="px-3 py-2.5">
      <NodeLoadStack
        class="min-w-[136px]"
        :live="!!reporting"
        :cpu="cpu"
        :memory="memory"
        :disk="disk"
        :disk-thresholds="diskThresholds"
      />
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
