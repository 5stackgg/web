<script setup lang="ts">
import { computed } from "vue";
import { CircleAlert, TriangleAlert } from "lucide-vue-next";
import { Fold } from "~/components/ui/transitions";
import DbBar from "./DbBar.vue";
import DbPidMenu from "./DbPidMenu.vue";
import DbRunning from "./DbRunning.vue";
import {
  formatMs,
  msSeverity,
  runSeverity,
  slowStats,
  thresholdLabel,
} from "./dbHealth";

// The Overview's warning band, driven by the slow-query threshold. It folds
// open when something crosses the line and shut when nothing does.
const props = defineProps<{
  queries: any[];
  active: any[];
  activeFetchedAt: number;
  threshold: number;
}>();

const emit = defineEmits<{
  (e: "open-query", queryid: string): void;
  (e: "view-slow"): void;
  (e: "go", key: string): void;
}>();

const stats = computed(() =>
  slowStats(props.queries, props.active, props.threshold),
);
const any = computed(
  () =>
    stats.value.avg.length + stats.value.max.length + stats.value.run.length >
    0,
);
const bad = computed(
  () =>
    stats.value.avg.some((q) => q.mean_exec_time > props.threshold * 10) ||
    stats.value.run.some(
      (c) => runSeverity(c.duration_seconds, props.threshold) === "bad",
    ),
);
const label = computed(() => thresholdLabel(props.threshold));
const totalTime = computed(
  () => props.queries.reduce((s, q) => s + (q.total_exec_time || 0), 0) || 1,
);
const longest = computed(() => stats.value.run[0]);
</script>

<template>
  <div>
    <Fold :open="any">
      <div
        class="grid gap-3 rounded-[10px] border px-4 py-3.5"
        :class="
          bad
            ? 'border-destructive/40 bg-destructive/[0.06]'
            : 'border-warning/35 bg-warning/[0.06]'
        "
      >
        <div class="flex items-start gap-2.5">
          <CircleAlert
            v-if="bad"
            class="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          />
          <TriangleAlert v-else class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p
            class="text-[13.5px] leading-normal [&_b]:font-bold [&_b]:tabular-nums"
          >
            <i18n-t
              v-if="stats.avg.length"
              keypath="pages.database.explorer.slow_avg"
              :plural="stats.avg.length"
              tag="span"
            >
              <template #count
                ><b>{{ stats.avg.length }}</b></template
              >
              <template #threshold>{{ label }}</template>
            </i18n-t>
            <span v-else>{{
              $t("pages.database.explorer.slow_avg_none", { threshold: label })
            }}</span>
            <template v-if="stats.max.length">
              <span aria-hidden="true"> · </span>
              <i18n-t
                keypath="pages.database.explorer.slow_max"
                :plural="stats.max.length"
                tag="span"
              >
                <template #count
                  ><b>{{ stats.max.length }}</b></template
                >
                <template #threshold>{{ label }}</template>
              </i18n-t>
            </template>
            <template v-if="longest">
              <span aria-hidden="true"> · </span>
              <i18n-t
                :keypath="
                  stats.run.length === 1
                    ? 'pages.database.explorer.slow_running_one'
                    : 'pages.database.explorer.slow_running_many'
                "
                tag="span"
              >
                <template #count
                  ><b>{{ stats.run.length }}</b></template
                >
                <template #threshold>{{ label }}</template>
                <template #duration
                  ><b
                    ><DbRunning
                      :seconds="longest.duration_seconds"
                      :fetched-at="activeFetchedAt"
                      state="active"
                      :threshold="threshold" /></b
                ></template>
              </i18n-t>
            </template>
          </p>
        </div>

        <div v-if="stats.max.length" class="grid border-t border-warning/20">
          <div
            v-for="q in stats.max.slice(0, 3)"
            :key="q.queryid"
            class="db-slow-row"
          >
            <span>
              <CircleAlert
                v-if="msSeverity(q.mean_exec_time, threshold) === 'bad'"
                class="h-3 w-3 text-destructive"
              />
              <TriangleAlert v-else class="h-3 w-3 text-warning" />
            </span>
            <code
              class="min-w-0 truncate font-mono text-[11.5px] text-foreground/85"
              :title="q.query.slice(0, 600)"
              >{{ q.query.slice(0, 220) }}</code
            >
            <span class="whitespace-nowrap text-right tabular-nums">
              {{
                $t("pages.database.explorer.avg_ms", {
                  ms: formatMs(q.mean_exec_time),
                })
              }}
              <small class="text-[11.5px] text-muted-foreground/70">{{
                $t("pages.database.explorer.max_ms_paren", {
                  ms: formatMs(q.max_exec_time),
                })
              }}</small>
            </span>
            <span
              class="db-slow-hide whitespace-nowrap text-right tabular-nums text-muted-foreground"
              >{{
                $t(
                  "pages.database.explorer.calls_count",
                  { count: q.calls.toLocaleString() },
                  q.calls,
                )
              }}</span
            >
            <span
              class="db-slow-hide whitespace-nowrap text-right tabular-nums"
            >
              <DbBar
                :value="q.total_exec_time / totalTime"
                :label="`${((q.total_exec_time / totalTime) * 100).toFixed(1)}%`"
              />
            </span>
            <button
              type="button"
              class="h-7 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="emit('open-query', q.queryid)"
            >
              {{ $t("database_extras.details") }}
            </button>
          </div>
        </div>

        <template v-if="stats.run.length">
          <div class="-mb-1.5 text-[11.5px] text-muted-foreground">
            {{ $t("pages.database.explorer.running_now") }}
          </div>
          <div class="grid border-t border-warning/20">
            <div
              v-for="c in stats.run.slice(0, 5)"
              :key="c.pid"
              class="db-slow-row"
            >
              <span>
                <CircleAlert
                  v-if="runSeverity(c.duration_seconds, threshold) === 'bad'"
                  class="h-3 w-3 text-destructive"
                />
                <TriangleAlert v-else class="h-3 w-3 text-warning" />
              </span>
              <code
                class="min-w-0 truncate font-mono text-[11.5px] text-foreground/85"
                :title="(c.query || '').slice(0, 600)"
                >{{ (c.query || "").slice(0, 220) }}</code
              >
              <span class="whitespace-nowrap text-right font-bold tabular-nums">
                <DbRunning
                  :seconds="c.duration_seconds"
                  :fetched-at="activeFetchedAt"
                  :state="c.state"
                  :threshold="threshold"
                />
              </span>
              <span
                class="db-slow-hide whitespace-nowrap text-right tabular-nums"
              >
                pid {{ c.pid }}
                <small class="text-[11.5px] text-muted-foreground/70"
                  >({{ c.application_name || "—"
                  }}<template v-if="c.wait_event_type === 'Lock'">
                    ·
                    {{
                      $t("pages.database.explorer.waiting_on_lock")
                    }}</template
                  >)</small
                >
              </span>
              <span class="db-slow-hide" />
              <DbPidMenu :pid="c.pid" :query="c.query" />
            </div>
          </div>
        </template>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="stats.max.length"
            type="button"
            class="inline-flex h-8 items-center rounded-md border border-border bg-background/40 px-3 text-xs font-medium transition-colors hover:bg-muted"
            @click="emit('view-slow')"
          >
            {{ $t("pages.database.explorer.view_all_slow") }}
          </button>
          <button
            v-if="stats.run.length"
            type="button"
            class="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="emit('go', 'connections')"
          >
            {{ $t("pages.database.explorer.open_connections") }}
          </button>
        </div>
      </div>
    </Fold>
    <Transition
      enter-active-class="db-quiet-enter"
      enter-from-class="opacity-0"
    >
      <p v-if="!any" class="py-0.5 text-xs text-muted-foreground">
        {{ $t("pages.database.explorer.slow_avg_none", { threshold: label }) }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.db-slow-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto auto 120px auto;
  gap: 12px;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  font-size: 12.5px;
}
.db-slow-row:last-child {
  border-bottom: 0;
}
.db-quiet-enter {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (max-width: 700px) {
  .db-slow-row {
    grid-template-columns: 16px minmax(0, 1fr) auto auto;
  }
  .db-slow-hide {
    display: none;
  }
}
</style>
