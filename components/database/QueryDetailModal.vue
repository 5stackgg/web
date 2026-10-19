<template>
  <Sheet :open="open" @update:open="onOpenChange">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[760px]"
    >
      <SheetHeader class="border-b border-border px-6 py-4 text-left">
        <SheetTitle>{{
          $t("pages.database.explorer.query_details")
        }}</SheetTitle>
        <SheetDescription class="font-mono text-xs">
          queryid {{ queryid }}
        </SheetDescription>
      </SheetHeader>

      <div
        v-if="$apollo.queries.queryDetail.loading && !queryDetail"
        class="p-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("common.loading") }}
      </div>

      <div v-else-if="queryDetail" class="grid gap-6 px-6 py-5">
        <section class="grid gap-2">
          <div class="flex items-center justify-between gap-3">
            <DbLabel :label="$t('pages.database.columns.query')" />
            <button
              type="button"
              class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="copy(queryDetail.query, 'query')"
            >
              <CopyIcon class="h-3 w-3" />
              {{ $t("common.copy") }}
            </button>
          </div>
          <pre class="db-pre">{{ queryDetail.query }}</pre>
        </section>

        <section class="grid gap-2.5">
          <DbLabel :label="$t('pages.database.explorer.statistics')" />
          <div
            class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5"
          >
            <StatTile
              :label="$t('pages.database.query_performance.calls')"
              :value="stats.calls.toLocaleString()"
            />
            <StatTile
              :label="$t('pages.database.explorer.avg_time')"
              :tone="msSeverity(stats.mean_exec_time, threshold) || undefined"
            >
              <DbSev :sev="msSeverity(stats.mean_exec_time, threshold)">{{
                formatMs(stats.mean_exec_time)
              }}</DbSev>
              <template #aside>ms</template>
            </StatTile>
            <StatTile
              :label="$t('pages.database.explorer.max_time')"
              :value="formatMs(stats.max_exec_time)"
            >
              <template #aside>ms</template>
            </StatTile>
            <StatTile
              :label="$t('pages.database.explorer.total_rows')"
              :value="formatBig(stats.total_rows)"
            />
          </div>
        </section>

        <section class="grid gap-2">
          <DbLabel :label="$t('pages.database.explorer.execution_times')" />
          <div class="relative mt-1 h-[26px]" aria-hidden="true">
            <span
              class="absolute inset-x-0 top-3 h-0.5 rounded bg-[hsl(240_4%_18%)]"
            />
            <span
              class="absolute top-[9px] h-2 rounded-[3px] bg-[hsl(var(--tac-amber)/0.25)]"
              :style="{ left: band.left, right: band.right }"
            />
            <span
              class="absolute left-0 top-1.5 h-3.5 w-0.5 rounded-sm bg-muted-foreground"
            />
            <span
              class="absolute top-1.5 h-3.5 w-[3px] rounded-sm bg-[hsl(var(--tac-amber))]"
              :style="{ left: band.mean }"
            />
            <span
              class="absolute right-0 top-1.5 h-3.5 w-0.5 rounded-sm bg-muted-foreground"
            />
          </div>
          <div
            class="flex justify-between gap-3 text-[11px] tabular-nums text-muted-foreground/70"
          >
            <span>{{
              $t("pages.database.explorer.min_value", {
                ms: formatMs(stats.min_exec_time),
              })
            }}</span>
            <span class="text-center">{{
              $t("pages.database.explorer.range_hint")
            }}</span>
            <span>{{
              $t("pages.database.explorer.max_value", {
                ms: formatMs(stats.max_exec_time),
              })
            }}</span>
          </div>
          <dl class="db-dl">
            <div>
              <dt>{{ $t("pages.database.query_detail.min") }}</dt>
              <dd>{{ formatMs(stats.min_exec_time) }}</dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.query_detail.mean") }}</dt>
              <dd>{{ formatMs(stats.mean_exec_time) }}</dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.query_detail.max") }}</dt>
              <dd>{{ formatMs(stats.max_exec_time) }}</dd>
            </div>
            <div v-if="stats.stddev_exec_time != null">
              <dt>{{ $t("pages.database.explorer.std_dev") }}</dt>
              <dd>{{ formatMs(stats.stddev_exec_time) }}</dd>
            </div>
          </dl>
        </section>

        <section class="grid gap-2">
          <DbLabel :label="$t('pages.database.explorer.buffer_statistics')" />
          <dl class="db-dl">
            <div>
              <dt>{{ $t("pages.database.explorer.shared_blocks_hit") }}</dt>
              <dd>{{ stats.shared_blks_hit.toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.explorer.shared_blocks_read") }}</dt>
              <dd>{{ stats.shared_blks_read.toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.explorer.cache_hit_ratio") }}</dt>
              <dd>
                <DbSev :sev="hitSeverity(stats.cache_hit_ratio)">{{
                  formatPct(stats.cache_hit_ratio) ?? $t("common.na")
                }}</DbSev>
              </dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.explorer.local_blocks_hit") }}</dt>
              <dd>{{ stats.local_blks_hit.toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t("pages.database.explorer.local_blocks_read") }}</dt>
              <dd>{{ stats.local_blks_read.toLocaleString() }}</dd>
            </div>
            <div>
              <dt>
                <DbTerm :tip="$t('pages.database.explorer.temp_blocks_tip')">{{
                  $t("pages.database.explorer.temp_blocks_written")
                }}</DbTerm>
              </dt>
              <dd>
                <DbSev :sev="stats.temp_blks_written ? 'bad' : ''">{{
                  stats.temp_blks_written.toLocaleString()
                }}</DbSev>
              </dd>
            </div>
          </dl>
        </section>

        <section class="grid gap-2">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <DbLabel :label="$t('pages.database.explorer.execution_plan')" />
              <span
                v-if="planKind"
                class="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {{ planKind }}
              </span>
            </div>
            <button
              v-if="plan"
              type="button"
              class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="copy(plan, 'plan')"
            >
              <CopyIcon class="h-3 w-3" />
              {{ $t("common.copy") }}
            </button>
          </div>
          <pre v-if="plan" class="db-pre">{{ plan }}</pre>
          <p v-else class="text-xs text-muted-foreground">
            {{ $t("pages.database.explorer.no_plan") }}
          </p>

          <div v-if="queryDetail.parameters.length" class="mt-2 grid gap-2">
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.database.explorer.parameters_hint") }}
            </p>
            <label
              v-for="parameter in queryDetail.parameters"
              :key="parameter.number"
              class="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-3"
            >
              <span class="truncate font-mono text-xs">
                ${{ parameter.number }}
                <span class="text-muted-foreground">{{ parameter.type }}</span>
              </span>
              <Input
                v-model="values[parameter.number]"
                class="h-8 font-mono text-xs"
                :placeholder="
                  parameter.list
                    ? $t('pages.database.explorer.list_placeholder')
                    : undefined
                "
              />
            </label>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              :disabled="analyzing"
              @click="analyze"
            >
              {{
                analyzing
                  ? $t("pages.database.explorer.analyzing")
                  : $t("pages.database.explorer.run_analyze")
              }}
            </Button>
            <span class="text-xs text-muted-foreground">
              {{ $t("pages.database.explorer.analyze_hint") }}
            </span>
          </div>
          <p v-if="analyzeError" class="text-xs text-destructive">
            {{ analyzeError }}
          </p>
        </section>
      </div>

      <div v-else class="p-8 text-center text-sm text-muted-foreground">
        {{ $t("pages.database.explorer.query_not_found") }}
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import gql from "graphql-tag";
import { CopyIcon } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DbLabel from "./DbLabel.vue";
import DbSev from "./DbSev.vue";
import DbTerm from "./DbTerm.vue";
import StatTile from "~/components/admin/StatTile.vue";
import { copyText } from "./dbCopy";
import {
  formatBig,
  formatMs,
  formatPct,
  hitSeverity,
  msSeverity,
} from "./dbHealth";

export default {
  components: {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Button,
    CopyIcon,
    DbLabel,
    DbSev,
    DbTerm,
    Input,
    StatTile,
  },
  props: {
    queryid: {
      type: String,
      required: true,
    },
    threshold: {
      type: Number,
      default: 1000,
    },
  },
  emits: ["close"],
  data() {
    return {
      queryDetail: null as any,
      open: true,
      values: {} as Record<number, string>,
      analysis: null as string | null,
      analyzing: false,
      analyzeError: null as string | null,
    };
  },
  computed: {
    stats(): any {
      return this.queryDetail?.stats || {};
    },
    plan(): string | null {
      return this.analysis ?? this.queryDetail?.explain_plan ?? null;
    },
    planKind(): string | null {
      switch (this.analysis ? "analyze" : this.queryDetail?.explain_kind) {
        case "analyze":
          return this.$t("pages.database.explorer.plan_analyzed");
        case "estimate":
          return this.$t("pages.database.explorer.plan_estimate");
        case "generic":
          return this.$t("pages.database.explorer.plan_generic");
        default:
          return null;
      }
    },
    // Where min, mean and max sit on a log scale, with mean ± one standard
    // deviation as the band.
    band(): { left: string; right: string; mean: string } {
      const lo = this.stats.min_exec_time || 0;
      const hi = this.stats.max_exec_time || 0;
      const mean = this.stats.mean_exec_time || 0;
      const sd = this.stats.stddev_exec_time || 0;
      const span = Math.log10(hi + 1) - Math.log10(lo + 1) || 1;
      const pos = (v: number) =>
        Math.max(
          0,
          Math.min(
            100,
            ((Math.log10(v + 1) - Math.log10(lo + 1)) / span) * 100,
          ),
        );
      return {
        left: `${pos(Math.max(lo, mean - sd))}%`,
        right: `${100 - pos(Math.min(hi, mean + sd))}%`,
        mean: `${pos(mean)}%`,
      };
    },
  },
  methods: {
    formatBig,
    formatMs,
    formatPct,
    hitSeverity,
    msSeverity,
    // Let the sheet slide out before the parent unmounts it.
    onOpenChange(value: boolean) {
      if (value) return;
      this.open = false;
      setTimeout(() => this.$emit("close"), 220);
    },
    async analyze() {
      this.analyzing = true;
      this.analyzeError = null;
      try {
        const { data } = await this.$apollo.query({
          query: gql`
            query AnalyzeQuery(
              $queryid: String!
              $parameters: [QueryParameterInput!]!
            ) {
              analyzeQuery(queryid: $queryid, parameters: $parameters) {
                explain_plan
              }
            }
          `,
          variables: {
            queryid: this.queryid,
            parameters: this.queryDetail.parameters.map(
              (parameter: { number: number; list: boolean }) => {
                const value = this.values[parameter.number] ?? "";
                return {
                  number: parameter.number,
                  values: parameter.list
                    ? value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    : value
                      ? [value]
                      : [],
                };
              },
            ),
          },
          fetchPolicy: "no-cache",
        });
        this.analysis = data.analyzeQuery.explain_plan;
      } catch (error) {
        this.analyzeError = (error as Error).message;
      } finally {
        this.analyzing = false;
      }
    },
    copy(text: string, type: "query" | "plan") {
      void copyText(
        text,
        type === "query"
          ? this.$t("pages.database.query_detail.query_copied")
          : this.$t("pages.database.query_detail.plan_copied"),
        this.$t("pages.database.query_detail.copy_failed"),
      );
    },
  },
  apollo: {
    // explain_kind and parameters are newer than the generated client, so a
    // plain document.
    queryDetail: {
      query: gql`
        query QueryDetail($queryid: String!) {
          getQueryDetail(queryid: $queryid) {
            queryid
            query
            explain_plan
            explain_kind
            parameters {
              number
              type
              list
            }
            stats {
              queryid
              query
              calls
              total_exec_time
              mean_exec_time
              stddev_exec_time
              min_exec_time
              max_exec_time
              total_rows
              shared_blks_hit
              shared_blks_read
              cache_hit_ratio
              temp_blks_written
              local_blks_hit
              local_blks_read
            }
          }
        }
      `,
      variables() {
        return { queryid: this.queryid };
      },
      update: (data: any) => data.getQueryDetail,
    },
  },
};
</script>

<style scoped>
.db-pre {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(240 6% 4%);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: hsl(0 0% 86%);
}
.db-dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  column-gap: 24px;
  margin: 0;
}
.db-dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  font-size: 12.5px;
}
.db-dl dt {
  color: hsl(var(--muted-foreground));
}
.db-dl dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
