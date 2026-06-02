<script lang="ts" setup>
import { computed } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { useToast } from "~/components/ui/toast/use-toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { Switch } from "~/components/ui/switch";
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
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    node: any;
    align?: "start" | "center" | "end";
  }>(),
  {
    align: "end",
  },
);

const { t } = useI18n();
const { toast } = useToast();
const { client } = useApolloClient();

const hasPorts = computed(() =>
  Boolean(props.node.start_port_range && props.node.end_port_range),
);

const allWorkloadsOn = computed(() =>
  Boolean(
    props.node.gpu_streaming_enabled &&
      props.node.gpu_demos_enabled &&
      props.node.gpu_rendering_enabled,
  ),
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
    await client.mutate({
      mutation: generateMutation({
        setGameNodeSchedulingState: [
          { game_server_node_id: props.node.id, enabled: accepting },
          { success: true },
        ],
      }),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.toggle_scheduling_failed"),
      description: error?.message,
    });
  }
}

async function setWorkload(
  workload: "streaming" | "demos" | "rendering",
  enabled: boolean,
) {
  try {
    await client.mutate({
      mutation: generateMutation({
        update_game_server_nodes_by_pk: [
          {
            pk_columns: { id: props.node.id },
            _set: { [`gpu_${workload}_enabled`]: enabled } as any,
          },
          { id: true },
        ],
      }),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.toggle_workload_failed"),
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
        :aria-label="t('pages.gpu_nodes.control.title')"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        <span v-if="flagged" class="ncm-dot" aria-hidden="true"></span>
      </button>
    </PopoverTrigger>
    <PopoverContent :align="align" class="p-0 w-[300px] overflow-hidden">
      <div class="ncm-list">
        <label class="ncm-row" :data-on="node.enabled">
          <span class="ncm-ico"><Power class="w-4 h-4" /></span>
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
          v-if="hasPorts"
          class="ncm-row"
          :data-on="node.status === 'Online'"
          :data-disabled="!node.enabled"
        >
          <span class="ncm-ico"><CalendarCheck class="w-4 h-4" /></span>
          <span class="ncm-text">
            <span class="ncm-name">{{
              t("pages.gpu_nodes.accepting_matches")
            }}</span>
            <span class="ncm-desc">{{
              t("pages.gpu_nodes.toggle_scheduling_help")
            }}</span>
          </span>
          <Switch
            :model-value="node.status === 'Online'"
            :disabled="!node.enabled"
            @update:model-value="(v) => setScheduling(!!v)"
          />
        </label>
      </div>

      <template v-if="node.gpu">
        <div class="ncm-section">{{ t("pages.gpu_nodes.workload.section") }}</div>
        <div class="ncm-list" :data-disabled="!node.enabled">
          <label class="ncm-row" :data-on="node.gpu_streaming_enabled">
            <span class="ncm-ico"><Radio class="w-4 h-4" /></span>
            <span class="ncm-text">
              <span class="ncm-name">{{
                t("pages.gpu_nodes.workload.streaming")
              }}</span>
              <span class="ncm-desc">{{
                t("pages.gpu_nodes.workload.streaming_desc")
              }}</span>
            </span>
            <Switch
              :model-value="node.gpu_streaming_enabled"
              :disabled="!node.enabled"
              @update:model-value="(v) => setWorkload('streaming', !!v)"
            />
          </label>

          <label class="ncm-row" :data-on="node.gpu_demos_enabled">
            <span class="ncm-ico"><Play class="w-4 h-4" /></span>
            <span class="ncm-text">
              <span class="ncm-name">{{
                t("pages.gpu_nodes.workload.demos")
              }}</span>
              <span class="ncm-desc">{{
                t("pages.gpu_nodes.workload.demos_desc")
              }}</span>
            </span>
            <Switch
              :model-value="node.gpu_demos_enabled"
              :disabled="!node.enabled"
              @update:model-value="(v) => setWorkload('demos', !!v)"
            />
          </label>

          <label class="ncm-row" :data-on="node.gpu_rendering_enabled">
            <span class="ncm-ico"><Clapperboard class="w-4 h-4" /></span>
            <span class="ncm-text">
              <span class="ncm-name">{{
                t("pages.gpu_nodes.workload.rendering")
              }}</span>
              <span class="ncm-desc">{{
                t("pages.gpu_nodes.workload.rendering_desc")
              }}</span>
            </span>
            <Switch
              :model-value="node.gpu_rendering_enabled"
              :disabled="!node.enabled"
              @update:model-value="(v) => setWorkload('rendering', !!v)"
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
  border-radius: 0.4rem;
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
  box-shadow: 0 0 6px hsl(var(--tac-amber) / 0.85);
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
  transition: background 0.15s;
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
  border-radius: 0.4rem;
  background: hsl(var(--card) / 0.5);
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
}
.ncm-row[data-on="true"] .ncm-ico {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.1);
  box-shadow: 0 0 12px -5px hsl(var(--tac-amber) / 0.6);
}
.ncm-text {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
  flex: 1 1 auto;
}
.ncm-name {
  font-family: ui-monospace, monospace;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: hsl(var(--foreground));
}
.ncm-row[data-on="false"] .ncm-name {
  color: hsl(var(--muted-foreground));
}
.ncm-desc {
  font-size: 0.64rem;
  line-height: 1.25;
  color: hsl(var(--muted-foreground));
}
.ncm-section {
  padding: 0.55rem 0.85rem 0.4rem;
  border-top: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.3);
  font-family: ui-monospace, monospace;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground) / 0.85);
}
</style>
