<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Logs,
  TriangleAlert,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NodeSpark from "~/components/game-server-nodes/NodeSpark.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { formatBytes } from "~/utilities/formatResourceUsage";
import type {
  FleetSummary,
  MetricIssue,
  ServiceStat,
} from "~/components/system-metrics/metricRules";

// Leads the page: one verdict line, a row per online node or GPU over a
// limit, then one summary line each for nodes and GPUs that hands off to
// their own pages. Healthy and offline nodes are counted, never listed.
const props = defineProps<{
  issues: MetricIssue[];
  summary: FleetSummary;
  nodeName: (id: string) => string;
  logsFor: (issue: MetricIssue) => ServiceStat | null;
}>();

const emit = defineEmits<{ (e: "logs", service: ServiceStat): void }>();

const { t } = useI18n();

const critical = computed(
  () => props.issues.filter((issue) => issue.severity === "critical").length,
);
const warnings = computed(() => props.issues.length - critical.value);

const pct = (v: number | null) => `${Math.round(v ?? 0)}%`;
const gpuShort = (issue: MetricIssue) =>
  (issue.gpuName || t("charts.gpu_index", { index: issue.gpuIndex ?? 0 }))
    .replace(/^NVIDIA\s+/, "")
    .replace(/^GeForce\s+/, "");

// The Game Server Nodes tones: amber CPU, blue memory, pink GPU.
const sparkTone = (issue: MetricIssue) =>
  issue.kind === "memory"
    ? "mem"
    : issue.kind === "disk"
      ? "disk"
      : issue.gpuIndex != null
        ? "gpu"
        : "cpu";

const sparkMarks = (issue: MetricIssue) =>
  issue.refs.map((ref) => ({
    value: ref.value,
    tone: ref.severity === "critical" ? ("bad" as const) : ("warn" as const),
  }));

function aboveText(issue: MetricIssue) {
  if (issue.aboveForMs == null || issue.threshold == null) {
    return "";
  }
  const minutes = Math.round(issue.aboveForMs / 60_000);
  return minutes < 1
    ? t("pages.system_metrics.attention.above_now", {
        threshold: issue.threshold,
      })
    : t("pages.system_metrics.attention.above_for", {
        threshold: issue.threshold,
        minutes,
      });
}

function hintOf(issue: MetricIssue) {
  const usedOf = () =>
    t("pages.system_metrics.attention.used_of", {
      used: formatBytes(issue.usedBytes ?? 0),
      total: formatBytes(issue.totalBytes ?? 0),
    });
  const watts = issue.power != null ? `${Math.round(issue.power)} W` : "";
  const parts: string[] = [];
  switch (issue.kind) {
    case "cpu":
      if (issue.cores) {
        parts.push(
          t(
            "pages.system_metrics.attention.cores",
            { count: issue.cores },
            issue.cores,
          ),
        );
      }
      parts.push(aboveText(issue));
      break;
    case "memory":
      parts.push(usedOf(), aboveText(issue));
      break;
    case "disk":
      parts.push(issue.mount ?? "", usedOf());
      break;
    case "gpu_util":
      if (issue.temperature != null) {
        parts.push(`${Math.round(issue.temperature)} °C`);
      }
      parts.push(watts, aboveText(issue));
      break;
    case "gpu_vram":
      parts.push(usedOf());
      break;
    case "gpu_temp":
      parts.push(
        t("pages.system_metrics.attention.gpu_usage", {
          value: pct(issue.utilization),
        }),
        watts,
      );
      break;
    case "cpu_warning":
      parts.push(issue.warning ?? "");
      break;
  }
  return parts.filter(Boolean).join(" · ");
}

const titleKey = (issue: MetricIssue) =>
  `pages.system_metrics.attention.issue_${issue.kind}`;

const nodesLine = computed(() => {
  const s = props.summary;
  return s.fine === s.total
    ? t(
        "pages.system_metrics.attention.nodes_all_fine",
        { count: s.total },
        s.total,
      )
    : t("pages.system_metrics.attention.nodes_fine", {
        fine: s.fine,
        total: s.total,
      });
});

const gpusLine = computed(() => {
  const s = props.summary;
  if (!s.gpuOnline) {
    return t("pages.system_metrics.attention.gpus_none_online");
  }
  return s.gpuFine === s.gpuOnline
    ? t(
        "pages.system_metrics.attention.gpus_all_fine",
        { count: s.gpuOnline },
        s.gpuOnline,
      )
    : t("pages.system_metrics.attention.gpus_fine", {
        fine: s.gpuFine,
        total: s.gpuOnline,
      });
});

// The app's fold idiom (grid rows 1fr <-> 0fr), per row, so a problem that
// clears collapses out and a new one opens in place.
const rowEnter =
  "transition-[grid-template-rows,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const rowLeave =
  "transition-[grid-template-rows,opacity] [transition-duration:110ms] ease-in motion-reduce:transition-none";
</script>

<template>
  <div class="grid gap-4">
    <!-- The verdict swaps between "N problems" and "Nothing needs
         attention" with a cross-fade, not a jump. -->
    <FadeSwap aria-live="polite">
      <div
        v-if="issues.length"
        key="problems"
        class="flex flex-wrap items-center gap-x-3 gap-y-1"
      >
        <span class="text-[15px] font-semibold tabular-nums">
          {{
            $t(
              "pages.system_metrics.attention.problems",
              { count: issues.length },
              issues.length,
            )
          }}
          <span class="font-medium text-muted-foreground">
            ·
            {{
              $t(
                "pages.system_metrics.attention.nodes_ok",
                { count: summary.fine },
                summary.fine,
              )
            }}
          </span>
        </span>
        <span class="text-xs tabular-nums text-muted-foreground">
          <template v-if="critical">
            {{
              $t(
                "pages.system_metrics.attention.critical_count",
                { count: critical },
                critical,
              )
            }}
          </template>
          <template v-if="critical && warnings"> · </template>
          <template v-if="warnings">
            {{
              $t(
                "pages.system_metrics.attention.warning_count",
                { count: warnings },
                warnings,
              )
            }}
          </template>
        </span>
        <span class="grow" />
        <FiveStackToolTip as-child :delay-duration="0">
          <template #trigger>
            <span
              tabindex="0"
              class="cursor-help text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px]"
            >
              {{ $t("pages.system_metrics.attention.thresholds") }}
            </span>
          </template>
          <span class="block max-w-[18rem]">
            {{ $t("pages.system_metrics.attention.thresholds_hint") }}
          </span>
        </FiveStackToolTip>
      </div>

      <div
        v-else
        key="clear"
        class="flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 px-4 py-3.5"
      >
        <CircleCheck class="h-5 w-5 shrink-0 text-success" />
        <div class="min-w-0 grow">
          <div class="text-[15px] font-semibold">
            {{ $t("pages.system_metrics.attention.all_clear") }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ $t("pages.system_metrics.attention.all_clear_hint") }}
          </div>
        </div>
        <FiveStackToolTip as-child :delay-duration="0">
          <template #trigger>
            <span
              tabindex="0"
              class="shrink-0 cursor-help text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px]"
            >
              {{ $t("pages.system_metrics.attention.thresholds") }}
            </span>
          </template>
          <span class="block max-w-[18rem]">
            {{ $t("pages.system_metrics.attention.thresholds_hint") }}
          </span>
        </FiveStackToolTip>
      </div>
    </FadeSwap>

    <!-- Folds shut with the last problem instead of vanishing under it. -->
    <Fold :open="issues.length > 0">
      <div class="overflow-hidden rounded-lg border border-border bg-card/20">
        <TransitionGroup
          :enter-active-class="rowEnter"
          :leave-active-class="rowLeave"
          enter-from-class="!grid-rows-[0fr] opacity-0"
          leave-to-class="!grid-rows-[0fr] opacity-0"
        >
          <div
            v-for="(issue, index) in issues"
            :key="issue.key"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0 overflow-hidden">
              <div
                class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3.5 py-3 md:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem_auto] md:gap-4"
                :class="index ? 'border-t border-border/60' : ''"
              >
                <span
                  class="col-span-2 inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold md:col-span-1"
                  :class="
                    issue.severity === 'critical'
                      ? 'text-destructive'
                      : 'text-[hsl(var(--tac-amber))]'
                  "
                >
                  <CircleAlert
                    v-if="issue.severity === 'critical'"
                    class="h-4 w-4"
                  />
                  <TriangleAlert v-else class="h-4 w-4" />
                  {{
                    issue.severity === "critical"
                      ? $t("system_alerts.types.critical")
                      : $t("system_alerts.types.warning")
                  }}
                </span>

                <div class="min-w-0">
                  <i18n-t
                    :keypath="titleKey(issue)"
                    tag="div"
                    scope="global"
                    class="text-[13.5px] [overflow-wrap:anywhere]"
                  >
                    <template #node>
                      <span class="font-semibold">{{
                        nodeName(issue.nodeId)
                      }}</span>
                    </template>
                    <template #gpu>
                      <span class="font-semibold">{{ gpuShort(issue) }}</span>
                    </template>
                    <template #value>
                      <TweenNumber
                        :value="Math.round(issue.value ?? 0)"
                        :suffix="issue.kind === 'gpu_temp' ? ' °C' : '%'"
                      />
                    </template>
                  </i18n-t>
                  <div
                    class="mt-0.5 line-clamp-2 text-xs tabular-nums text-muted-foreground"
                  >
                    {{ hintOf(issue) }}
                  </div>
                </div>

                <div
                  class="order-3 col-span-2 md:order-none md:col-span-1"
                  role="img"
                  :aria-label="$t('pages.system_metrics.attention.last_30')"
                >
                  <NodeSpark
                    :points="issue.spark.points"
                    :from="issue.spark.from"
                    :to="issue.spark.to"
                    :max="issue.sparkMax ?? 100"
                    :tone="sparkTone(issue)"
                    :marks="sparkMarks(issue)"
                  />
                </div>

                <div class="flex items-center justify-end gap-1">
                  <Button as-child variant="outline" size="sm">
                    <NuxtLink
                      :to="
                        issue.gpuIndex != null
                          ? '/gpu-nodes'
                          : '/game-server-nodes'
                      "
                    >
                      {{ $t("pages.system_metrics.attention.open_node") }}
                    </NuxtLink>
                  </Button>
                  <FiveStackToolTip
                    v-if="logsFor(issue)"
                    as-child
                    :delay-duration="120"
                  >
                    <template #trigger>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        :aria-label="
                          $t('pages.system_metrics.logs_for', {
                            name: logsFor(issue)!.name,
                          })
                        "
                        @click="emit('logs', logsFor(issue)!)"
                      >
                        <Logs />
                      </Button>
                    </template>
                    {{
                      $t("pages.system_metrics.logs_for", {
                        name: logsFor(issue)!.name,
                      })
                    }}
                  </FiveStackToolTip>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Fold>

    <div class="grid gap-0.5 text-[13px] text-muted-foreground">
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5 py-1">
        <span class="w-14 shrink-0 font-semibold text-foreground">
          {{ $t("pages.system_metrics.attention.nodes") }}
        </span>
        <span class="min-w-0 tabular-nums">
          {{ nodesLine }}
          <template v-if="summary.attention">
            ·
            {{
              $t(
                "pages.system_metrics.attention.need_attention",
                { count: summary.attention },
                summary.attention,
              )
            }}
          </template>
          <template v-if="summary.offline">
            ·
            <NuxtLink
              to="/game-server-nodes"
              class="underline-offset-4 hover:text-foreground hover:underline"
            >
              {{
                $t("pages.system_metrics.attention.offline", {
                  count: summary.offline,
                })
              }}
            </NuxtLink>
          </template>
        </span>
        <NuxtLink
          to="/game-server-nodes"
          class="ml-auto inline-flex items-center gap-1 text-foreground/90 underline-offset-4 transition-colors hover:text-[hsl(var(--tac-amber))] hover:underline"
        >
          {{ $t("pages.system_metrics.attention.view_nodes") }}
          <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>

      <div
        v-if="summary.gpuTotal"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-0.5 py-1"
      >
        <span class="w-14 shrink-0 font-semibold text-foreground">
          {{ $t("pages.system_metrics.attention.gpus") }}
        </span>
        <span class="min-w-0 tabular-nums">
          {{ gpusLine }}
          <template v-if="summary.gpuOffline">
            ·
            {{
              $t(
                "pages.system_metrics.attention.gpus_offline",
                { count: summary.gpuOffline },
                summary.gpuOffline,
              )
            }}
          </template>
        </span>
        <NuxtLink
          to="/gpu-nodes"
          class="ml-auto inline-flex items-center gap-1 text-foreground/90 underline-offset-4 transition-colors hover:text-[hsl(var(--tac-amber))] hover:underline"
        >
          {{ $t("pages.system_metrics.attention.view_gpus") }}
          <ArrowRight class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
