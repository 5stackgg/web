<script lang="ts" setup>
import { computed, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { useToast } from "~/components/ui/toast/use-toast";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  nodeModeFields,
  setNodeFields,
} from "~/components/game-server-nodes/nodeActions";
import { Switch } from "~/components/ui/switch";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import type { GpuWorkload } from "~/components/gpu-nodes/gpuSessions";
import { useWorkloadToggle } from "~/components/gpu-nodes/useWorkloadToggle";
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import {
  SlidersHorizontal,
  Power,
  CalendarCheck,
  Radio,
  Play,
  Clapperboard,
  ServerOff,
  TriangleAlert,
} from "lucide-vue-next";

interface ControlledNode {
  id: string;
  status: string;
  enabled: boolean;
  enabled_for_match_making?: boolean;
  accepting_new_matches: boolean;
  region?: string | null;
  start_port_range?: number | null;
  end_port_range?: number | null;
  gpu?: boolean;
  gpu_streaming_enabled?: boolean;
  gpu_demos_enabled?: boolean;
  gpu_rendering_enabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    node: ControlledNode;
    align?: "start" | "center" | "end";
    /**
     * Leaves out Enabled and Accepting matches, where the panel has its own
     * (GPU only and the workload switches stay).
     */
    workloadsOnly?: boolean;
    /** What the node is running under each workload right now. */
    activity?: Partial<Record<GpuWorkload, string>>;
  }>(),
  {
    align: "end",
    workloadsOnly: false,
    activity: () => ({}),
  },
);

const { t } = useI18n();
const { toast } = useToast();
const { client } = useApolloClient();
const workloadToggle = useWorkloadToggle();

const hasPorts = computed(() =>
  Boolean(props.node.start_port_range && props.node.end_port_range),
);

// The table and inspector chips share these writes, so a toggle in flight
// shows here too.
const workloads = computed(() =>
  [
    { key: "streaming" as const, icon: Radio },
    { key: "demos" as const, icon: Play },
    { key: "rendering" as const, icon: Clapperboard },
  ].map((workload) => {
    const saved = !!props.node[`gpu_${workload.key}_enabled`];
    return {
      ...workload,
      on: workloadToggle.shown(props.node.id, workload.key, saved),
      pending: workloadToggle.isPending(props.node.id, workload.key, saved),
    };
  }),
);

const workloadsOn = computed(
  () => workloads.value.filter((workload) => workload.on).length,
);

const allWorkloadsOn = computed(
  () => workloadsOn.value === workloads.value.length,
);

const summary = computed(() =>
  t("pages.gpu_nodes.workload.summary", {
    on: workloadsOn.value,
    total: workloads.value.length,
  }),
);

const triggerLabel = computed(() => {
  const title = props.workloadsOnly
    ? t("pages.gpu_nodes.workload.section")
    : t("pages.gpu_nodes.control.title");
  return props.node.gpu ? `${title} · ${summary.value}` : title;
});

const acceptingNewMatches = computed(
  () =>
    props.node.accepting_new_matches ??
    props.node.status === e_game_server_node_statuses_enum.Online,
);

const inSetup = computed(
  () => props.node.status === e_game_server_node_statuses_enum.Setup,
);

const schedulingHint = computed(() => {
  if (inSetup.value) {
    return t("pages.gpu_nodes.scheduling_setup_hint");
  }
  if (
    acceptingNewMatches.value &&
    props.node.status === e_game_server_node_statuses_enum.Offline
  ) {
    return t("pages.gpu_nodes.scheduling_offline_hint");
  }
  return null;
});

const gpuOnly = computed(
  () => !!props.node.gpu && !props.node.enabled_for_match_making,
);

const flagged = computed(
  () => props.node.gpu && props.node.enabled && !allWorkloadsOn.value,
);

async function setEnabled(enabled: boolean) {
  try {
    await client.mutate({
      mutation: generateMutation({
        update_game_server_nodes_by_pk: [
          { pk_columns: { id: props.node.id }, _set: { enabled } },
          { id: true },
        ],
      }),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.toggle_enabled_failed"),
      description: error?.message,
    });
  }
}

async function setScheduling(accepting: boolean) {
  try {
    const { data } = await client.mutate({
      mutation: generateMutation({
        setGameNodeSchedulingState: [
          { game_server_node_id: props.node.id, enabled: accepting },
          { success: true },
        ],
      }),
    });
    if (!data?.setGameNodeSchedulingState?.success) {
      toast({
        variant: "destructive",
        title: t("pages.gpu_nodes.toggle_scheduling_failed"),
      });
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.toggle_scheduling_failed"),
      description: error?.message,
    });
  }
}

// Same fields and words as the inspector's old mode button: GPU only drops
// the region and ports with matchmaking.
// Turning GPU only on drops the region and ports, so it asks first when there
// is something to lose; turning it back off needs no confirm.
const confirmingGpuOnly = ref(false);
function requestGpuOnly(on: boolean) {
  const loses =
    !!props.node.region ||
    !!props.node.start_port_range ||
    !!props.node.end_port_range;
  if (on && loses) {
    confirmingGpuOnly.value = true;
    return;
  }
  void setGpuOnly(on);
}

async function setGpuOnly(on: boolean) {
  confirmingGpuOnly.value = false;
  try {
    await setNodeFields(
      client,
      props.node.id,
      nodeModeFields(on ? "gpu" : "match"),
    );
    toast({
      title: on
        ? t("game_server.toast.made_gpu_only")
        : t("game_server.toast.made_match_node"),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.game_server_nodes.toast.save_failed"),
      description: error?.message,
    });
  }
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <button
        type="button"
        class="ncm-trigger"
        :data-flagged="flagged"
        :aria-label="triggerLabel"
      >
        <SlidersHorizontal class="h-3.5 w-3.5" />
        <span
          v-if="flagged"
          class="ncm-dot"
          data-testid="workloads-off-dot"
          aria-hidden="true"
        ></span>
      </button>
    </PopoverTrigger>
    <PopoverContent :align="align" class="w-[320px] overflow-hidden p-0">
      <div v-if="!workloadsOnly || node.gpu" class="ncm-list">
        <label v-if="!workloadsOnly" class="ncm-row" :data-on="node.enabled">
          <span class="ncm-ico"><Power class="h-4 w-4" /></span>
          <span class="ncm-text">
            <span class="ncm-name">{{ t("pages.gpu_nodes.enabled") }}</span>
            <span class="ncm-desc">{{
              t("pages.gpu_nodes.toggle_enabled_help")
            }}</span>
          </span>
          <Switch
            :model-value="node.enabled"
            @update:model-value="(v) => setEnabled(!!v)"
          />
        </label>

        <label
          v-if="node.gpu"
          class="ncm-row"
          data-testid="gpu-only-row"
          :data-on="gpuOnly"
        >
          <span class="ncm-ico"><ServerOff class="h-4 w-4" /></span>
          <span class="ncm-text">
            <span class="ncm-name">{{
              t("pages.game_server_nodes.gpu_only")
            }}</span>
            <span class="ncm-desc">{{
              t("pages.gpu_nodes.toggle_gpu_only_help")
            }}</span>
          </span>
          <Switch
            :model-value="gpuOnly || confirmingGpuOnly"
            @update:model-value="(v) => requestGpuOnly(!!v)"
          />
        </label>
        <div
          v-if="confirmingGpuOnly"
          class="flex items-center justify-end gap-2 px-2 pb-2"
          data-testid="gpu-only-confirm"
        >
          <button
            type="button"
            class="h-7 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="confirmingGpuOnly = false"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            type="button"
            class="h-7 rounded-md border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.1)] px-2.5 text-xs font-medium text-[hsl(var(--warning))] transition-colors hover:bg-[hsl(var(--warning)/0.18)]"
            @click="setGpuOnly(true)"
          >
            {{ t("common.confirm") }}
          </button>
        </div>

        <label
          v-if="!workloadsOnly && hasPorts && node.enabled_for_match_making"
          class="ncm-row"
          data-testid="scheduling-row"
          :data-on="acceptingNewMatches"
          :data-disabled="!node.enabled || inSetup"
        >
          <span class="ncm-ico"><CalendarCheck class="h-4 w-4" /></span>
          <span class="ncm-text">
            <span class="ncm-name">
              {{ t("pages.gpu_nodes.accepting_matches") }}
              <FiveStackToolTip
                v-if="schedulingHint"
                as-child
                :delay-duration="120"
              >
                <template #trigger>
                  <span
                    class="ncm-hint"
                    tabindex="0"
                    role="img"
                    :aria-label="schedulingHint"
                    data-testid="scheduling-hint"
                    @click.prevent
                  >
                    <TriangleAlert class="h-3 w-3" />
                  </span>
                </template>
                <p class="max-w-[16rem]">{{ schedulingHint }}</p>
              </FiveStackToolTip>
            </span>
            <span class="ncm-desc">{{
              t("pages.gpu_nodes.toggle_scheduling_help")
            }}</span>
          </span>
          <Switch
            :model-value="acceptingNewMatches"
            :disabled="!node.enabled || inSetup"
            @update:model-value="(v) => setScheduling(!!v)"
          />
        </label>
      </div>

      <template v-if="node.gpu">
        <div class="ncm-section">
          <span>{{ t("pages.gpu_nodes.workload.section") }}</span>
          <span class="tabular-nums">{{ summary }}</span>
        </div>
        <p
          v-if="workloadsOnly && !node.enabled"
          class="ncm-note"
          data-testid="workloads-node-disabled"
        >
          {{ t("pages.gpu_nodes.workload.node_disabled") }}
        </p>
        <div class="ncm-list" :data-disabled="!node.enabled">
          <label
            v-for="workload of workloads"
            :key="workload.key"
            class="ncm-row"
            :data-on="workload.on"
            :data-testid="`workload-${workload.key}`"
          >
            <span class="ncm-ico"
              ><component :is="workload.icon" class="h-4 w-4"
            /></span>
            <span class="ncm-text">
              <span class="ncm-name">{{
                t(`pages.gpu_nodes.workload.${workload.key}`)
              }}</span>
              <span class="ncm-desc">{{
                t(`pages.gpu_nodes.workload.${workload.key}_desc`)
              }}</span>
              <span
                v-if="activity[workload.key]"
                class="ncm-live"
                data-testid="workload-live"
                :title="activity[workload.key]"
              >
                <StatusDot tone="ok" live />
                <span class="truncate">{{ activity[workload.key] }}</span>
              </span>
            </span>
            <Switch
              :model-value="workload.on"
              :disabled="!node.enabled || workload.pending"
              @update:model-value="
                (v) => workloadToggle.setWorkload(node.id, workload.key, !!v)
              "
            />
          </label>
        </div>
      </template>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.ncm-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 0.375rem;
  background: hsl(var(--card) / 0.4);
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}
.ncm-trigger:hover {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
}
.ncm-trigger[data-flagged="true"],
.ncm-trigger[data-state="open"] {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
}
.ncm-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: hsl(var(--tac-amber));
  border: 1px solid hsl(var(--background));
}
.ncm-list {
  display: flex;
  flex-direction: column;
}
.ncm-list[data-disabled="true"] {
  opacity: 0.45;
}
.ncm-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.6rem 0.85rem;
  cursor: pointer;
  transition: background-color 0.15s;
}
.ncm-row:hover {
  background: hsl(var(--card) / 0.5);
}
.ncm-row + .ncm-row {
  border-top: 1px solid hsl(var(--border) / 0.4);
}
.ncm-row[data-disabled="true"] {
  opacity: 0.5;
}
.ncm-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 0.375rem;
  background: hsl(var(--card) / 0.5);
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s,
    border-color 0.15s,
    background-color 0.15s;
}
.ncm-row[data-on="true"] .ncm-ico {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.1);
}
.ncm-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1 1 auto;
}
.ncm-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}
.ncm-hint {
  display: inline-flex;
  vertical-align: -0.1em;
  color: hsl(var(--warning));
  cursor: help;
}
.ncm-row[data-on="false"] .ncm-name {
  color: hsl(var(--muted-foreground));
}
.ncm-desc {
  font-size: 0.7rem;
  line-height: 1.3;
  color: hsl(var(--muted-foreground));
}
.ncm-live {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  line-height: 1.3;
  color: hsl(var(--foreground) / 0.9);
}
.ncm-section {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem 0.35rem;
  border-top: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.3);
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}
.ncm-note {
  padding: 0.1rem 0.85rem 0.5rem;
  background: hsl(var(--card) / 0.3);
  font-size: 0.7rem;
  line-height: 1.3;
  color: hsl(var(--muted-foreground));
}
</style>
