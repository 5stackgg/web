<script setup lang="ts">
import { computed } from "vue";
import { useBootProgress } from "~/composables/useBootProgress";
import StatusDot from "~/components/admin/StatusDot.vue";
import {
  shaderCount as shaderCountOf,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";

// One line of where a GPU session is: its boot step while it starts, then
// Live / Playing / a render's percent / a bake's shader count.
const props = defineProps<{ session: GpuSession }>();

const isBake = computed(() => props.session.kind === "bake");

const { bootInfo, isErrored, visibleStages, currentStage, currentIndex, pct } =
  useBootProgress(() => ({
    mode: props.session.kind,
    histories: props.session.statusHistory ? [props.session.statusHistory] : [],
    status: isBake.value ? props.session.status : undefined,
    progress: isBake.value ? props.session.progress : undefined,
    progressStage: isBake.value ? props.session.progressStage : undefined,
  }));

const shaderCount = computed(() =>
  shaderCountOf(props.session.progressStage),
);

const bakePct = computed(() =>
  isBake.value && !props.session.booting && props.session.progress !== null
    ? Math.max(0, Math.min(100, props.session.progress))
    : null,
);

const renderPct = computed(() =>
  props.session.kind === "highlights" &&
  props.session.status === "rendering" &&
  props.session.progress !== null
    ? Math.max(0, Math.min(100, props.session.progress * 100))
    : null,
);

const step = computed(() => {
  if (!bootInfo.value || currentIndex.value < 0) return null;
  return {
    current: currentIndex.value + 1,
    total: visibleStages.value.length,
    label: currentStage.value?.label ?? "",
  };
});
</script>

<template>
  <div class="grid min-w-[120px] gap-1.5 text-xs tabular-nums">
    <template v-if="bakePct !== null">
      <span class="whitespace-nowrap text-[hsl(var(--tac-amber))]">
        {{ Math.round(bakePct) }}%<template v-if="shaderCount">
          · {{ shaderCount }}</template
        >
      </span>
      <span class="block h-1 w-[120px] overflow-hidden rounded-full bg-muted">
        <span
          class="block h-full origin-left bg-[hsl(var(--tac-amber))] transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          :style="{ transform: `scaleX(${bakePct / 100})` }"
        />
      </span>
    </template>

    <template v-else-if="session.booting">
      <span v-if="isErrored" class="whitespace-nowrap text-destructive">
        {{ $t("pages.gpu_nodes.state.failed") }}
      </span>
      <span
        v-else-if="step"
        class="whitespace-nowrap text-[hsl(var(--tac-amber))]"
      >
        {{
          $t("match.stream.step_of", {
            current: step.current,
            total: step.total,
          })
        }}
        · {{ step.label
        }}<template v-if="pct !== null"> {{ Math.round(pct) }}%</template>
      </span>
      <span v-else class="whitespace-nowrap text-[hsl(var(--tac-amber))]">
        {{ $t("pages.gpu_nodes.state.starting") }}
      </span>
    </template>

    <span
      v-else-if="session.kind === 'live' || session.kind === 'demo'"
      class="inline-flex items-center gap-1.5 whitespace-nowrap text-[hsl(var(--success))]"
    >
      <StatusDot tone="ok" live />
      {{
        session.kind === "live"
          ? $t("common.live")
          : $t("pages.gpu_nodes.state.playing")
      }}
    </span>

    <template v-else-if="session.kind === 'highlights'">
      <span class="whitespace-nowrap text-[hsl(var(--success))]">
        {{
          session.status === "uploading"
            ? $t("render_queue_status.uploading")
            : $t("render_queue_status.rendering")
        }}<template v-if="renderPct !== null">
          {{ Math.round(renderPct) }}%</template
        >
      </span>
      <span
        v-if="renderPct !== null"
        class="block h-1 w-[120px] overflow-hidden rounded-full bg-muted"
      >
        <span
          class="block h-full origin-left bg-[hsl(var(--success))] transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          :style="{ transform: `scaleX(${renderPct / 100})` }"
        />
      </span>
    </template>
  </div>
</template>
