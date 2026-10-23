<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import NodeMeter from "~/components/game-server-nodes/NodeMeter.vue";
import {
  CircleAlert,
  CircleArrowUp,
  CircleCheck,
  Download,
  LoaderCircle,
  Pin,
  RotateCw,
} from "lucide-vue-next";
import {
  updateProgress,
  updateStep,
} from "~/components/game-server-nodes/nodeInspector";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import { relativeTime } from "~/components/game-server-nodes/nodeFormat";
import { TONE_TEXT, type Tone } from "~/components/admin/tone";

// One game's install on a node, in a line: up to date, behind, updating with
// its progress, or failed with the last lines it printed. CS2 and CS:GO both
// read this way; the section around it holds the game's own settings.
export type GameStatusState =
  | "updating"
  | "failed"
  | "behind"
  | "pinned"
  | "current"
  | "installed"
  | "missing";

const props = defineProps<{
  state: GameStatusState;
  build?: number | string | null;
  target?: number | string | null;
  updateStatus?: string | null;
  failedAt?: string | null;
  error?: string | null;
  action?: "update" | "retry" | "install" | null;
  installLabel?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  action: [];
  openLog: [];
}>();

const { t } = useI18n();
const GAME = `${INSPECTOR}.game`;

// the api reports a running removal as "Removing", with no build to name
const removing = computed(() => props.updateStatus === "Removing");
const progress = computed(() => updateProgress(props.updateStatus));
const step = computed(() =>
  removing.value ? "" : updateStep(props.updateStatus),
);

const TONE: Record<GameStatusState, Tone> = {
  updating: "info",
  failed: "bad",
  behind: "warn",
  pinned: "info",
  current: "ok",
  installed: "off",
  missing: "off",
};
const ICON = {
  updating: LoaderCircle,
  failed: CircleAlert,
  behind: CircleArrowUp,
  pinned: Pin,
  current: CircleCheck,
  installed: CircleCheck,
  missing: Download,
};

const title = computed(() => {
  switch (props.state) {
    case "updating":
      if (removing.value) {
        return t(`${GAME}.removing`);
      }
      if (!props.target) {
        return props.build ? t(`${GAME}.updating`) : t(`${GAME}.installing`);
      }
      return props.build
        ? t(`${GAME}.updating_to`, { build: props.target })
        : t(`${GAME}.installing_to`, { build: props.target });
    case "failed":
      return t(`${INSPECTOR}.chip.failed`);
    case "behind":
      return t(`${GAME}.update_available`);
    case "pinned":
      return t(`${INSPECTOR}.chip.pinned`);
    case "current":
      return t(`${GAME}.up_to_date`);
    case "installed":
      return t(`${GAME}.installed`);
    default:
      return t("pages.game_server_nodes.row.not_installed");
  }
});

const actionLabel = computed(() =>
  props.action === "retry"
    ? t(`${GAME}.retry`)
    : props.action === "install"
      ? props.installLabel
      : t("common.update"),
);

const showsBuild = computed(
  () =>
    !!props.build &&
    (props.state === "current" ||
      props.state === "pinned" ||
      props.state === "installed"),
);
</script>

<template>
  <div class="grid gap-1.5">
    <div class="gsn-st" :class="TONE_TEXT[TONE[state]]">
      <component
        :is="ICON[state]"
        class="h-3.5 w-3.5 shrink-0"
        :class="
          state === 'updating' && 'animate-spin motion-reduce:animate-none'
        "
      />
      <b class="min-w-0 truncate font-semibold">{{ title }}</b>
      <span
        v-if="state === 'failed' && failedAt"
        class="whitespace-nowrap text-xs text-muted-foreground"
        >{{ relativeTime(failedAt) }}</span
      >
      <span class="grow"></span>
      <span
        v-if="state === 'updating' && progress != null"
        class="text-xs font-semibold tabular-nums"
        >{{ Math.round(progress) }}%</span
      >
      <Button
        v-else-if="action"
        size="xs"
        variant="outline"
        class="h-6 shrink-0 gap-1 text-xs"
        :class="action === 'update' && 'gsn-st-update'"
        :disabled="disabled"
        @click="emit('action')"
      >
        <RotateCw v-if="action === 'retry'" class="h-3 w-3" />
        <Download v-else-if="action === 'install'" class="h-3 w-3" />
        {{ actionLabel }}
      </Button>
      <i18n-t
        v-else-if="showsBuild"
        :keypath="`${GAME}.build`"
        tag="span"
        class="gsn-tag"
        scope="global"
      >
        <template #build>
          <b class="font-mono">{{ build }}</b>
        </template>
      </i18n-t>
    </div>

    <NodeMeter
      v-if="state === 'updating' && progress != null"
      :value="progress"
      tone="info"
      thin
    />

    <i18n-t
      v-if="state === 'behind' && build && target"
      :keypath="`${GAME}.on_update_to`"
      tag="p"
      class="gsn-line"
      scope="global"
    >
      <template #build>
        <span class="font-mono text-[11.5px] text-foreground">{{ build }}</span>
      </template>
      <template #target>
        <span class="font-mono text-[11.5px] text-foreground">{{
          target
        }}</span>
      </template>
    </i18n-t>
    <i18n-t
      v-else-if="state === 'failed' && build"
      :keypath="`${GAME}.still_on`"
      tag="p"
      class="gsn-line"
      scope="global"
    >
      <template #build>
        <span class="font-mono text-[11.5px] text-foreground">{{ build }}</span>
      </template>
    </i18n-t>

    <div v-if="state === 'failed' && error" class="gsn-err font-mono">
      <span v-for="(line, index) of error.split('\n')" :key="index">{{
        line
      }}</span>
    </div>

    <p v-if="state === 'updating' || state === 'failed'" class="gsn-sub">
      <span class="min-w-0 truncate">{{
        state === "updating" ? step : error ? t(`${GAME}.last_lines`) : ""
      }}</span>
      <span class="grow"></span>
      <button type="button" class="gsn-log" @click="emit('openLog')">
        {{
          state === "updating" ? t(`${GAME}.watch_log`) : t(`${GAME}.open_log`)
        }}
      </button>
    </p>
  </div>
</template>

<style scoped>
.gsn-st {
  display: flex;
  min-width: 0;
  min-height: 24px;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.gsn-st b {
  color: inherit;
}
.gsn-st-update {
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.12);
  color: hsl(var(--tac-amber));
}
.gsn-st-update:hover {
  background: hsl(var(--tac-amber) / 0.2);
  color: hsl(var(--tac-amber));
}
.gsn-tag {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background: hsl(240 5% 9%);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  color: hsl(var(--muted-foreground));
}
.gsn-tag b {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  color: hsl(var(--foreground));
}
.gsn-sub {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.gsn-line {
  min-width: 0;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.gsn-err {
  margin: 0;
  padding: 6px 8px;
  border: 1px solid hsl(var(--destructive) / 0.22);
  border-radius: 6px;
  background: hsl(var(--destructive) / 0.06);
  font-size: 11.5px;
  line-height: 1.5;
  color: hsl(var(--destructive));
  overflow-wrap: anywhere;
}
.gsn-err span {
  display: block;
  white-space: pre-wrap;
}
.gsn-err span:not(:last-child) {
  color: hsl(var(--muted-foreground));
}
.gsn-log {
  flex: none;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  transition: color 150ms ease;
}
.gsn-log:hover {
  color: hsl(var(--foreground));
}
</style>
