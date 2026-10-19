<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import GameStatus from "~/components/game-server-nodes/GameStatus.vue";
import { Download, EllipsisVertical, ScrollText } from "lucide-vue-next";
import {
  isReachable,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import { csgoState } from "~/components/game-server-nodes/nodeInspector";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// CS:GO, only on a node that has it (or is installing it): its build against
// the latest one, its update, and its own log.
const props = defineProps<{
  node: NodeLike & Record<string, any>;
  latestBuildId: number | string | null;
}>();

const emit = defineEmits<{
  update: [];
  openLog: [];
}>();

const { t } = useI18n();

const reachable = computed(() => isReachable(props.node));
const state = computed(() => csgoState(props.node, props.latestBuildId));
const action = computed(() =>
  state.value === "failed"
    ? "retry"
    : state.value === "behind"
      ? "update"
      : null,
);
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <div class="flex min-h-7 items-center gap-2">
      <InspectorLabel>CS:GO</InspectorLabel>
      <span
        class="rounded border border-border px-1.5 text-[10.5px] font-semibold leading-[18px] text-muted-foreground"
        >{{ t(`${INSPECTOR}.csgo.legacy`) }}</span
      >
      <span class="grow"></span>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-7 w-7 shrink-0 text-muted-foreground"
            :aria-label="t(`${INSPECTOR}.csgo.actions`)"
          >
            <EllipsisVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuItem
            :disabled="!reachable || state === 'updating'"
            @click="emit('update')"
          >
            <Download />
            {{ t("game_server.update_csgo") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('openLog')">
            <ScrollText />
            {{ t(`${INSPECTOR}.cs2.update_log`) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <GameStatus
      v-if="state !== 'none'"
      :state="state"
      :build="node.csgo_build_id"
      :target="latestBuildId"
      :update-status="node.csgo_update_status"
      :failed-at="node.csgo_update_failed_at"
      :error="node.csgo_update_error"
      :action="action"
      :disabled="!reachable"
      @action="emit('update')"
      @open-log="emit('openLog')"
    />
  </section>
</template>
