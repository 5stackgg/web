<script setup lang="ts">
import { computed } from "vue";
import { Clapperboard, Loader2, Play, Radio } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useWorkloadToggle } from "~/components/gpu-nodes/useWorkloadToggle";
import type { GpuWorkload } from "~/components/gpu-nodes/gpuSessions";

// A GPU's three workloads as chips you flip in place: lit with an amber pip
// when on, amber all over while that workload runs. A flag only gates new
// work, so turning off the running one flips at once too: the session keeps
// going, as its tooltip says. `full` lays them out as three equal columns.
const props = withDefaults(
  defineProps<{
    node: {
      id: string;
      enabled: boolean;
      gpu_streaming_enabled?: boolean | null;
      gpu_demos_enabled?: boolean | null;
      gpu_rendering_enabled?: boolean | null;
    };
    /** What the node is running under each workload right now. */
    activity?: Partial<Record<GpuWorkload, string>>;
    full?: boolean;
  }>(),
  { activity: () => ({}), full: false },
);

const { t } = useI18n();
const toggle = useWorkloadToggle();

const WORKLOADS = [
  { key: "streaming", icon: Radio, short: "pages.gpu_nodes.filter.live" },
  { key: "demos", icon: Play, short: "pages.gpu_nodes.filter.demos" },
  {
    key: "rendering",
    icon: Clapperboard,
    short: "pages.gpu_nodes.filter.renders",
  },
] as const;

const chips = computed(() =>
  WORKLOADS.map((workload) => {
    const saved = !!props.node[`gpu_${workload.key}_enabled`];
    const on = toggle.shown(props.node.id, workload.key, saved);
    const line = props.activity[workload.key] ?? null;
    return {
      ...workload,
      on,
      pending: toggle.isPending(props.node.id, workload.key, saved),
      running: !!line,
      line,
      // Off leaves the running session alone; only new work stops coming.
      keeps:
        on && !!line
          ? t(`pages.gpu_nodes.chips.confirm_body.${workload.key}`)
          : null,
      tip: props.node.enabled
        ? t(
            `pages.gpu_nodes.chips.${on ? "turn_off" : "turn_on"}.${workload.key}`,
          )
        : t("pages.gpu_nodes.workload.node_disabled"),
    };
  }),
);

// Only a press counts: a click that ends a drag (across the chips, or out of
// a text selection in the row) flips nothing. Keyboard clicks have no press.
let press: { x: number; y: number } | null = null;
function onPointerDown(event: PointerEvent) {
  press = { x: event.clientX, y: event.clientY };
}
function wasDrag(event: MouseEvent) {
  const start = press;
  press = null;
  if (!start || event.detail === 0) return false;
  return Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6;
}

function onChip(key: GpuWorkload, event: MouseEvent) {
  if (wasDrag(event) || !props.node.enabled) return;
  const chip = chips.value.find((candidate) => candidate.key === key);
  if (!chip || chip.pending) return;
  void toggle.setWorkload(props.node.id, key, !chip.on);
}
</script>

<template>
  <span
    class="wlc"
    :data-full="full"
    role="group"
    :aria-label="t('pages.gpu_nodes.workload.section')"
  >
    <FiveStackToolTip
      v-for="chip of chips"
      :key="chip.key"
      as-child
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <button
          type="button"
          class="wlc-chip"
          :aria-label="t(`pages.gpu_nodes.workload.${chip.key}`)"
          :aria-pressed="chip.on"
          :aria-disabled="!node.enabled || undefined"
          :aria-busy="chip.pending || undefined"
          :data-running="chip.running"
          :data-testid="`workload-chip-${chip.key}`"
          @pointerdown="onPointerDown"
          @click.stop="onChip(chip.key, $event)"
        >
          <Loader2
            v-if="chip.pending"
            class="wlc-icon animate-spin motion-reduce:animate-none"
          />
          <component :is="chip.icon" v-else class="wlc-icon" />
          <span class="wlc-label">{{ t(chip.short) }}</span>
          <span v-if="full" class="wlc-state" aria-hidden="true">{{
            chip.running
              ? t("pages.gpu_nodes.chips.state.running")
              : chip.on
                ? t("pages.gpu_nodes.chips.state.on")
                : t("pages.gpu_nodes.chips.state.off")
          }}</span>
          <span v-else class="wlc-pip" aria-hidden="true"><i /></span>
        </button>
      </template>
      <span class="grid max-w-[16rem] gap-0.5">
        <span>{{ chip.tip }}</span>
        <span v-if="chip.line && node.enabled" class="text-muted-foreground">{{
          chip.line
        }}</span>
        <span
          v-if="chip.keeps && node.enabled"
          class="text-muted-foreground"
          data-testid="workload-keeps"
          >{{ chip.keeps }}</span
        >
      </span>
    </FiveStackToolTip>
  </span>
</template>

<style scoped>
.wlc {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
}
.wlc[data-full="true"] {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.wlc-chip {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px 0 7px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--muted-foreground) / 0.65);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    color 150ms ease,
    border-color 150ms ease,
    opacity 150ms ease,
    transform 150ms ease-out;
}
.wlc[data-full="true"] .wlc-chip {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 6px;
  row-gap: 1px;
  height: auto;
  min-width: 0;
  padding: 6px 10px 7px 9px;
  text-align: left;
}
.wlc-state {
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  color: hsl(var(--muted-foreground) / 0.8);
}
.wlc-chip[aria-pressed="true"] .wlc-state {
  color: hsl(var(--success));
}
.wlc-chip[data-running="true"] .wlc-state {
  color: hsl(var(--tac-amber));
}
/* The on surface and the running wash fade in under the label. */
.wlc-chip::before,
.wlc-chip::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 5px;
  opacity: 0;
  transition: opacity 110ms ease-in;
}
.wlc-chip::before {
  background: hsl(240 4% 12%);
}
.wlc-chip::after {
  background: hsl(var(--tac-amber) / 0.12);
}
.wlc-chip:hover {
  color: hsl(var(--muted-foreground));
  border-color: hsl(240 4% 26%);
}
.wlc-chip:active {
  transform: scale(0.97);
}
.wlc-chip:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.5);
  outline-offset: 1px;
}
.wlc-chip[aria-pressed="true"] {
  color: hsl(var(--foreground));
  border-color: hsl(240 4% 24%);
}
.wlc-chip[aria-pressed="true"]::before,
.wlc-chip[data-running="true"]::after {
  opacity: 1;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.wlc-chip[data-running="true"] {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.45);
}
.wlc-chip[aria-busy="true"] {
  cursor: progress;
}
.wlc-chip[aria-disabled="true"] {
  opacity: 0.45;
  cursor: default;
}
.wlc-chip[aria-disabled="true"]:active {
  transform: none;
}
.wlc-icon {
  width: 13px;
  height: 13px;
  flex: none;
}
.wlc-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wlc-pip {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px hsl(240 4% 36%);
}
.wlc-pip > i {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: hsl(var(--tac-amber));
  opacity: 0;
  transition: opacity 110ms ease-in;
}
.wlc-chip[aria-pressed="true"] .wlc-pip > i {
  opacity: 1;
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
/* The GPU nodes table, squeezed by a docked panel: icon-only chips. */
@container gpn-gpus (max-width: 1080px) {
  .wlc:not([data-full="true"]) .wlc-label {
    display: none;
  }
  .wlc:not([data-full="true"]) .wlc-chip {
    padding: 0 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wlc-chip,
  .wlc-chip::before,
  .wlc-chip::after,
  .wlc-pip > i {
    transition: none !important;
  }
  .wlc-chip:active {
    transform: none;
  }
}
</style>
