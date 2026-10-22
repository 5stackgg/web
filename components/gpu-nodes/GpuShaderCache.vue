<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  EllipsisVertical,
  Flame,
  LoaderCircle,
  RotateCw,
  ScrollText,
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
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT, type Tone } from "~/components/admin/tone";
import {
  bakeFailed,
  isBaking,
  shaderCount,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";
import { useGpuNodeActions } from "~/composables/useGpuNodeActions";

const props = defineProps<{
  node: any;
  bake: GpuSession | null;
  reachable: boolean;
}>();

const logsOpen = defineModel<boolean>("logsOpen", { default: false });

const { t } = useI18n();
const actions = useGpuNodeActions();

type CacheState = "baking" | "failed" | "warm" | "cold";

const state = computed<CacheState>(() =>
  isBaking(props.node)
    ? "baking"
    : bakeFailed(props.node)
      ? "failed"
      : props.node.shader_bake_status === "done"
        ? "warm"
        : "cold",
);

const TONE: Record<CacheState, Tone> = {
  baking: "amber",
  failed: "bad",
  warm: "ok",
  cold: "off",
};
const ICON = {
  baking: LoaderCircle,
  failed: CircleAlert,
  warm: CircleCheck,
  cold: CircleDashed,
};

const title = computed(() => {
  switch (state.value) {
    case "baking":
      return t("pages.gpu_nodes.node_state.baking");
    case "failed":
      return t("pages.gpu_nodes.bake.stages.errored");
    case "warm":
      return t("pages.gpu_nodes.sheet.cache_warm");
    default:
      return t("pages.gpu_nodes.sheet.cache_cold");
  }
});

const settledAt = computed(() => {
  if (state.value !== "warm" && state.value !== "failed") {
    return null;
  }
  const history = props.node.shader_bake_status_history;
  const last = Array.isArray(history) ? history.at(-1) : null;
  // A bake that dies before reporting is marked errored without a history
  // entry, so the last entry can belong to an earlier run.
  return last?.status === props.node.shader_bake_status
    ? (last.at ?? null)
    : null;
});

const progress = computed(() => {
  const value = props.bake?.booting ? null : props.bake?.progress;
  return typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
});

const count = computed(() => shaderCount(props.bake?.progressStage));

const busy = computed(() => !!actions.bakeBusy[props.node.id]);

const bake = () => actions.bakeShaders(props.node.id);
const cancel = () => actions.cancelBake(props.node.id);
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <div class="flex min-h-7 items-center gap-2">
      <InspectorLabel>{{
        t("pages.gpu_nodes.sheet.shader_cache")
      }}</InspectorLabel>
      <span class="grow"></span>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-7 w-7 shrink-0 text-muted-foreground"
            :aria-label="t('pages.gpu_nodes.sheet.cache_actions')"
          >
            <EllipsisVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuItem @click="logsOpen = true">
            <ScrollText />
            {{ t("pages.gpu_nodes.bake.logs") }}
          </DropdownMenuItem>
          <template v-if="state === 'baking'">
            <DropdownMenuSeparator />
            <DropdownMenuItem :disabled="busy" @click="cancel">
              <X />
              {{ t("pages.gpu_nodes.bake.cancel") }}
            </DropdownMenuItem>
          </template>
          <template v-else-if="state === 'warm'">
            <DropdownMenuSeparator />
            <DropdownMenuItem :disabled="!reachable || busy" @click="bake">
              <Flame />
              {{ t("pages.gpu_nodes.bake.action") }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="grid gap-1.5">
      <div class="gsc-st" :class="TONE_TEXT[TONE[state]]">
        <component
          :is="ICON[state]"
          class="h-3.5 w-3.5 shrink-0"
          :class="
            state === 'baking' && 'animate-spin motion-reduce:animate-none'
          "
        />
        <b class="min-w-0 truncate font-semibold">{{ title }}</b>
        <TimeAgo
          v-if="settledAt"
          :date="settledAt"
          hide-icon
          class="whitespace-nowrap text-xs text-muted-foreground"
        />
        <span class="grow"></span>
        <span
          v-if="state === 'baking' && progress != null"
          class="text-xs font-semibold tabular-nums"
          >{{ Math.round(progress) }}%</span
        >
        <Button
          v-else-if="state === 'cold' || state === 'failed'"
          size="xs"
          variant="outline"
          class="h-6 shrink-0 gap-1 text-xs"
          :class="state === 'cold' && 'gsc-st-bake'"
          :disabled="!reachable"
          :loading="busy"
          @click="bake"
        >
          <RotateCw v-if="state === 'failed'" class="h-3 w-3" />
          <Flame v-else class="h-3 w-3" />
          {{
            state === "failed"
              ? t(`${INSPECTOR}.game.retry`)
              : t("pages.gpu_nodes.bake.action")
          }}
        </Button>
      </div>

      <NodeMeter
        v-if="state === 'baking' && progress != null"
        :value="progress"
        tone="amber"
        thin
      />

      <p v-if="state !== 'warm'" class="gsc-sub">
        <span class="min-w-0" :class="state === 'baking' && 'tabular-nums'">{{
          state === "baking"
            ? count
            : state === "failed"
              ? t("pages.gpu_nodes.sheet.bake_failed_hint")
              : t("pages.gpu_nodes.sheet.cold_hint")
        }}</span>
        <span class="grow"></span>
        <button
          v-if="state === 'baking' || state === 'failed'"
          type="button"
          class="gsc-log"
          @click="logsOpen = true"
        >
          {{
            state === "baking"
              ? t(`${INSPECTOR}.game.watch_log`)
              : t(`${INSPECTOR}.game.open_log`)
          }}
        </button>
      </p>
    </div>
  </section>
</template>

<style scoped>
.gsc-st {
  display: flex;
  min-width: 0;
  min-height: 24px;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.gsc-st b {
  color: inherit;
}
.gsc-st-bake {
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}
.gsc-st-bake:hover {
  background: hsl(var(--tac-amber) / 0.2);
  color: hsl(var(--tac-amber));
}
.gsc-sub {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.gsc-log {
  flex: none;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  transition: color 150ms ease;
}
.gsc-log:hover {
  color: hsl(var(--foreground));
}
</style>
