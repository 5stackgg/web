<script setup lang="ts">
import { computed } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { useToast } from "~/components/ui/toast/use-toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { Switch } from "~/components/ui/switch";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { TriangleAlert } from "lucide-vue-next";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// The inspector's Enabled and Accepting matches switches, each with what it
// does. Same mutations as NodeControlMenu, the popover the GPU nodes page
// keeps.
const props = defineProps<{
  node: {
    id: string;
    status?: string | null;
    enabled?: boolean | null;
    enabled_for_match_making?: boolean | null;
    accepting_new_matches?: boolean | null;
    start_port_range?: number | null;
    end_port_range?: number | null;
    gpu?: boolean | null;
    offline_at?: string | null;
  };
}>();

const { t } = useI18n();
const { toast } = useToast();
const { client } = useApolloClient();

const inSetup = computed(() => props.node.status === "Setup");
const gpuOnly = computed(
  () => !!props.node.gpu && !props.node.enabled_for_match_making,
);
const accepting = computed(
  () => props.node.accepting_new_matches ?? props.node.status === "Online",
);
const canSchedule = computed(
  () =>
    !!props.node.start_port_range &&
    !!props.node.end_port_range &&
    !!props.node.enabled_for_match_making &&
    !inSetup.value,
);
const offline = computed(
  () => !!props.node.offline_at || props.node.status === "Offline",
);

const acceptingHelp = computed(() =>
  canSchedule.value
    ? t("pages.gpu_nodes.toggle_scheduling_help")
    : inSetup.value
      ? t(`${INSPECTOR}.node.accepting_setup`)
      : t(`${INSPECTOR}.node.accepting_no_ports`),
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

async function setScheduling(enabled: boolean) {
  try {
    const { data } = await client.mutate({
      mutation: generateMutation({
        setGameNodeSchedulingState: [
          { game_server_node_id: props.node.id, enabled },
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
</script>

<template>
  <div class="grid">
    <label class="ncl-row">
      <span class="min-w-0 flex-1">
        <span class="block text-[13px]">{{ t("common.enabled") }}</span>
        <span class="block text-xs leading-snug text-muted-foreground">{{
          t("pages.gpu_nodes.toggle_enabled_help")
        }}</span>
      </span>
      <Switch
        :model-value="!!node.enabled"
        @update:model-value="(value) => setEnabled(!!value)"
      />
    </label>

    <label
      v-if="!gpuOnly"
      class="ncl-row"
      :data-disabled="!canSchedule || !node.enabled"
    >
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-1.5 text-[13px]">
          {{ t(`${INSPECTOR}.node.accepting`) }}
          <FiveStackToolTip
            v-if="offline && accepting && canSchedule"
            as-child
            :delay-duration="120"
          >
            <template #trigger>
              <span
                class="inline-flex text-[hsl(var(--tac-amber))]"
                tabindex="0"
                role="img"
                :aria-label="t('pages.gpu_nodes.scheduling_offline_hint')"
                @click.prevent
              >
                <TriangleAlert class="h-3 w-3" />
              </span>
            </template>
            <p class="max-w-[16rem]">
              {{ t("pages.gpu_nodes.scheduling_offline_hint") }}
            </p>
          </FiveStackToolTip>
        </span>
        <span class="block text-xs leading-snug text-muted-foreground">{{
          acceptingHelp
        }}</span>
      </span>
      <Switch
        :model-value="canSchedule && accepting"
        :disabled="!canSchedule || !node.enabled"
        @update:model-value="(value) => setScheduling(!!value)"
      />
    </label>
  </div>
</template>

<style scoped>
.ncl-row {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  cursor: pointer;
}
.ncl-row[data-disabled="true"] {
  cursor: default;
}
.ncl-row[data-disabled="true"] .text-\[13px\] {
  color: hsl(var(--muted-foreground));
}
</style>
