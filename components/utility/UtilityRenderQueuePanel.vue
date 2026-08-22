<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import {
  AlertCircle,
  CheckCircle2,
  CircleSlash,
  Clock,
  Film,
  Loader2,
  MinusCircle,
  RotateCw,
  Server,
  Upload,
  X,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  RENDER_IN_FLIGHT_STATUSES,
  RENDER_TERMINAL_STATUSES,
  cancelUtilityLineupRenderMutation,
  clearFinishedUtilityLineupRendersMutation,
  renderUtilityLineupPreviewMutation,
  utilityRendersFinishedSubscription,
  utilityRendersInFlightSubscription,
} from "~/graphql/utilityRenderGraphql";
import BootSequence from "~/components/match/BootSequence.vue";
import SnapshotQuickView from "~/components/match/SnapshotQuickView.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { useBootStages } from "~/composables/useBootStages";
import { useAuthStore } from "~/stores/AuthStore";
import cleanMapName from "~/utilities/cleanMapName";
import { toast } from "~/components/ui/toast";
import type { UtilityLineupRender } from "~/types/utility";

const FINISHED_LIMIT = 200;

// A render that has said nothing for this long is not progressing, whatever its
// status column still claims. The pod posts on every segment poll, so silence
// well past that is the signal -- not a status that never got overwritten.
const STALE_AFTER_MS = 90_000;

// Same recency the highlights queue uses: a boot tick older than this means the
// pod stopped talking, and the stepper comes down rather than spinning forever.
const BOOT_RECENCY_MS = 5 * 60 * 1000;

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const isAdmin = computed(() => useAuthStore().isAdmin);

const inFlight = shallowRef<UtilityLineupRender[]>([]);
const finished = shallowRef<UtilityLineupRender[]>([]);
const loading = ref(true);
const busy = ref<Record<string, boolean>>({});

// Elapsed is the whole point of this panel -- "queued" tells you nothing,
// "queued for 9 minutes with no pod" tells you the dispatch is broken. One
// ticker for the panel rather than a timer per row.
const now = ref(Date.now());
const ticker = import.meta.client
  ? window.setInterval(() => {
      now.value = Date.now();
    }, 1000)
  : null;

let inFlightSub: { unsubscribe: () => void } | null = null;
let finishedSub: { unsubscribe: () => void } | null = null;

// Split the same way the clip queue splits: the finished list is history and
// wants a limit, the in-flight list is state and must not have one.
inFlightSub = getGraphqlClient()
  .subscribe({
    query: utilityRendersInFlightSubscription,
    variables: {
      statuses: [...RENDER_IN_FLIGHT_STATUSES],
      mapOrder: "asc",
      sortOrder: "asc",
      createdOrder: "asc",
    },
  })
  .subscribe({
    next: ({ data }: any) => {
      inFlight.value = data?.utility_lineup_renders ?? [];
      loading.value = false;
    },
    error: (error: any) => {
      console.error("[utility-render-queue] in-flight subscription:", error);
      loading.value = false;
    },
  });

finishedSub = getGraphqlClient()
  .subscribe({
    query: utilityRendersFinishedSubscription,
    variables: {
      statuses: [...RENDER_TERMINAL_STATUSES],
      order: "desc",
      limit: FINISHED_LIMIT,
    },
  })
  .subscribe({
    next: ({ data }: any) => {
      finished.value = data?.utility_lineup_renders ?? [];
    },
    error: (error: any) => {
      console.error("[utility-render-queue] finished subscription:", error);
    },
  });

onBeforeUnmount(() => {
  inFlightSub?.unsubscribe();
  finishedSub?.unsubscribe();
  if (ticker !== null) window.clearInterval(ticker);
});

type BootInfo = {
  stage: string;
  // "server_starting:WaitingForPing" -> the api's readout of the practice
  // server pod, folded in as a substage the way highlights folds
  // "downloading_cs2:Validating".
  stageSub: string | null;
  progress: number | null;
};

type Batch = {
  mapName: string;
  renders: UtilityLineupRender[];
  active: UtilityLineupRender | null;
  dispatched: boolean;
  progress: number;
  // Where the pod is in its boot, read off every row's history the way the
  // highlights queue reads its batch -- the pod boots once but each queued
  // row carries its own copy of the ticks.
  bootInfo: BootInfo | null;
  // The row whose snapshot to show: whichever is filming, else the head of
  // the queue (it is the one the pod will film first).
  sample: UtilityLineupRender | null;
};

// One pod films one map, so the map IS the batch — the same grouping the
// dispatcher uses on the other side.
const batches = computed<Batch[]>(() => {
  const byMap = new Map<string, UtilityLineupRender[]>();
  for (const render of inFlight.value) {
    const list = byMap.get(render.map_name) ?? [];
    list.push(render);
    byMap.set(render.map_name, list);
  }
  return [...byMap.entries()].map(([mapName, renders]) => {
    const active = renders.find((render) => render.status !== "queued") ?? null;
    return {
      mapName,
      renders,
      active,
      // A batch with no pod name anywhere is a batch nothing was dispatched for.
      // That is the difference between "waiting its turn" and "silently dropped",
      // and it is the one thing the status column cannot say.
      dispatched: renders.some((render) => Boolean(render.k8s_job_name)),
      progress:
        renders.reduce(
          (total, render) =>
            total +
            (render.status === "queued" ? 0 : Number(render.progress ?? 0)),
          0,
        ) / Math.max(1, renders.length),
      bootInfo: active ? null : bootInfoFor(renders),
      sample: active ?? renders[0] ?? null,
    };
  });
});

// The latest boot tick across the batch, as long as the pod is still talking.
// Staleness is judged on last_status_at (bumped every tick), not the history
// `at` (frozen at stage start) -- else a long shader compile would read dead.
function bootInfoFor(renders: UtilityLineupRender[]): BootInfo | null {
  let latest:
    | { stage: string; stageSub: string | null; progress: number | null; at: number }
    | null = null;
  let freshest = 0;

  for (const render of renders) {
    const heard = Date.parse(render.last_status_at ?? render.created_at ?? "");
    if (Number.isFinite(heard) && heard > freshest) freshest = heard;

    for (const entry of render.status_history ?? []) {
      if (entry?.status !== "booting" || !entry.boot_stage) continue;
      const at = Date.parse(entry.at);
      if (!Number.isFinite(at)) continue;
      if (!latest || at > latest.at) {
        const [stage, stageSub = null] = entry.boot_stage.split(":");
        latest = {
          stage,
          stageSub: stageSub && stageSub.length > 0 ? stageSub : null,
          progress:
            typeof entry.boot_progress === "number"
              ? Math.max(0, Math.min(1, entry.boot_progress))
              : null,
          at,
        };
      }
    }
  }

  if (!latest || now.value - freshest > BOOT_RECENCY_MS) return null;
  return {
    stage: latest.stage,
    stageSub: latest.stageSub,
    progress: latest.progress,
  };
}

const { stagesFor } = useBootStages();
const bootStageLabels = computed(() => {
  const labels = new Map<string, string>();
  for (const stage of stagesFor("nades")) {
    if (stage.label) labels.set(stage.key, stage.label);
  }
  return labels;
});

const STATUS_TONE: Record<string, string> = {
  queued: "text-muted-foreground",
  rendering: "text-[hsl(var(--tac-amber))]",
  uploading: "text-[hsl(var(--tac-amber))]",
  done: "text-success",
  error: "text-destructive",
  // Not a failure: the lineup cannot be filmed exactly, and saying so is the
  // whole answer. Tone it apart from the red so a reviewer can tell at a glance
  // which rows are worth retrying.
  skipped: "text-muted-foreground",
  cancelled: "text-muted-foreground",
};

function statusIcon(status: string) {
  switch (status) {
    case "queued":
      return Clock;
    case "rendering":
      return Loader2;
    case "uploading":
      return Upload;
    case "done":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    case "skipped":
      return MinusCircle;
    default:
      return CircleSlash;
  }
}

// The icon carries the tone, the word carries the fact. A queue read at a
// glance needs both — an amber spinner alone doesn't say render vs upload.
function statusLabel(status: string) {
  return t(`pages.utility.render_queue.statuses.${status}`);
}

// Every row reads "queued" for the whole boot -- the api leaves row.status
// alone for boot ticks so the batch job can still find it. Say what the pod is
// actually doing instead, the way the highlights queue does.
function rowStatusLabel(batch: Batch, render: UtilityLineupRender): string {
  if (render.status !== "queued" || !batch.bootInfo) {
    return statusLabel(render.status);
  }
  const label = bootStageLabels.value.get(batch.bootInfo.stage);
  if (!label) return statusLabel(render.status);
  const sub = batch.bootInfo.stageSub ? ` · ${batch.bootInfo.stageSub}` : "";
  return batch.bootInfo.progress === null
    ? `${label}${sub}`
    : `${label}${sub} ${Math.round(batch.bootInfo.progress * 100)}%`;
}

function progressPct(render: UtilityLineupRender) {
  return Math.round(Number(render.progress ?? 0) * 100);
}

// Compact and mono so it sits in a column of numbers: 45S, 6M, 1H04.
function since(iso: string | null | undefined): string {
  if (!iso) return "";
  const started = Date.parse(iso);
  if (!Number.isFinite(started)) return "";

  const seconds = Math.max(0, Math.round((now.value - started) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function lastHeardMs(render: UtilityLineupRender): number {
  const at = Date.parse(render.last_status_at ?? render.created_at ?? "");
  return Number.isFinite(at) ? now.value - at : 0;
}

// Queued rows are legitimately silent — nothing is filming them yet. Only a row
// that claims to be working earns a stale flag.
function isStale(render: UtilityLineupRender): boolean {
  return render.status !== "queued" && lastHeardMs(render) > STALE_AFTER_MS;
}

/**
 * The status column says where a render is; this says how it got there and how
 * long each leg took. Boot ticks are folded into one "booting" leg -- the
 * stepper above already shows them stage by stage.
 */
function timeline(
  render: UtilityLineupRender,
): Array<{ status: string; held: string }> {
  const history = Array.isArray(render.status_history)
    ? render.status_history
    : [];

  const stamped = history
    .map((entry) => ({
      status: String(entry?.status ?? ""),
      at: Date.parse(String(entry?.at ?? "")),
    }))
    .filter((entry) => entry.status && Number.isFinite(entry.at))
    .filter(
      (entry, index, all) =>
        index === 0 || entry.status !== all[index - 1].status,
    );

  return stamped.map((entry, index) => {
    // The last leg is still running, so it is measured against the clock.
    const until = stamped[index + 1]?.at ?? now.value;
    const seconds = Math.max(0, Math.round((until - entry.at) / 1000));
    return {
      status: entry.status,
      held: seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`,
    };
  });
}

function legLabel(status: string): string {
  return status === "booting"
    ? t("pages.utility.render_queue.render_pod_booting")
    : statusLabel(status);
}

async function rerender(render: UtilityLineupRender) {
  busy.value = { ...busy.value, [render.id]: true };
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.mutate({
      mutation: renderUtilityLineupPreviewMutation,
      variables: { utility_lineup_id: render.utility_lineup_id },
    });
    const result = (data as any)?.renderUtilityLineupPreview;
    toast({
      title: result?.success
        ? t("pages.utility.render_queue.requeued")
        : t("pages.utility.render_queue.not_requeued"),
      description: result?.reason ?? undefined,
      variant: result?.success ? undefined : "destructive",
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.render_queue.not_requeued"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    busy.value = { ...busy.value, [render.id]: false };
  }
}

async function cancel(render: UtilityLineupRender) {
  busy.value = { ...busy.value, [render.id]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: cancelUtilityLineupRenderMutation,
      variables: { render_id: render.id },
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.render_queue.cancel_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    busy.value = { ...busy.value, [render.id]: false };
  }
}

const clearing = ref(false);

async function clearFinished() {
  clearing.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: clearFinishedUtilityLineupRendersMutation,
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.render_queue.clear_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    clearing.value = false;
  }
}
</script>

<template>
  <section>
    <header class="flex items-center justify-between gap-2">
      <h2 :class="tacticalSectionLabelClasses" class="mb-0">
        <span aria-hidden="true" :class="tacticalSectionTickClasses"></span>
        <Film class="h-3.5 w-3.5" />
        {{ $t("pages.utility.render_queue.title") }}
      </h2>
      <Button
        v-if="isAdmin && finished.length"
        size="sm"
        variant="ghost"
        class="h-7 font-mono text-[0.62rem] uppercase tracking-[0.14em]"
        :loading="clearing"
        @click="clearFinished()"
      >
        {{ $t("pages.utility.render_queue.clear_finished") }}
      </Button>
    </header>

    <div v-if="loading" class="mt-3 space-y-2">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-16 w-full" />
    </div>

    <p
      v-else-if="!batches.length && !finished.length"
      class="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      {{ $t("pages.utility.render_queue.empty") }}
    </p>

    <div
      v-for="batch of batches"
      :key="batch.mapName"
      class="relative mt-3 overflow-hidden rounded-md border border-border bg-card/40"
    >
      <!-- The sweep is what says a pod is on this map right now -- filming or
           booting. A batch with neither holds still, so it reads as waiting
           rather than as running slowly. -->
      <span
        v-if="batch.active || batch.bootInfo"
        aria-hidden="true"
        class="pointer-events-none absolute left-0 right-0 top-0 h-[2px] overflow-hidden"
      >
        <span
          class="tac-scan-sweep block h-full text-[hsl(var(--tac-amber))]"
        ></span>
      </span>

      <div class="p-3">
        <div class="flex items-baseline justify-between gap-2">
          <span
            class="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-foreground"
          >
            {{ cleanMapName(batch.mapName) }}
          </span>
          <span
            class="font-mono text-[0.62rem] uppercase tabular-nums tracking-[0.14em] text-muted-foreground"
          >
            {{
              $t("pages.utility.render_queue.lineups", {
                count: batch.renders.length,
              })
            }}
            <span aria-hidden="true" class="mx-1 text-border">/</span>
            <span class="text-[hsl(var(--tac-amber))]">
              {{ Math.round(batch.progress * 100) }}%
            </span>
          </span>
        </div>

        <div class="mt-2 h-[2px] overflow-hidden bg-muted">
          <div
            class="h-full bg-[hsl(var(--tac-amber))] transition-[width] [transition-duration:240ms]"
            :style="{ width: `${Math.round(batch.progress * 100)}%` }"
          />
        </div>

        <!-- A batch nobody dispatched looks exactly like a batch waiting its
             turn until you say so. Only while nothing is booting either --
             the api's own booking phases stamp boot ticks before a pod exists,
             and those are the answer to "what is it doing". -->
        <p
          v-if="!batch.dispatched && !batch.bootInfo"
          class="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-warning"
        >
          {{ $t("pages.utility.render_queue.no_pod") }}
        </p>
      </div>

      <!-- The pod's boot, stage by stage, beside what its screen shows. Same
           BootSequence the highlights queue mounts; the "nades" mode adds the
           three api-side phases that happen before any pod exists. -->
      <div
        v-if="batch.bootInfo || batch.active"
        class="border-t border-border/40 bg-primary/[0.03] px-3 py-3"
      >
        <div class="mb-2 flex items-center gap-2">
          <span
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)]"
          >
            <Server class="h-3 w-3 text-[hsl(var(--tac-amber))]" />
          </span>
          <span
            class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-foreground"
          >
            {{
              batch.active
                ? $t("pages.utility.render_queue.statuses.rendering")
                : $t("pages.utility.render_queue.render_pod_booting")
            }}
          </span>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <BootSequence
            v-if="batch.bootInfo"
            mode="nades"
            :histories="batch.renders.map((render) => render.status_history)"
            :card="false"
            class="flex-1"
          />
          <div
            v-if="batch.sample"
            class="w-full shrink-0 overflow-hidden rounded-md border border-border/50 sm:w-64 lg:w-80"
          >
            <SnapshotQuickView kind="nades" :id="batch.sample.id" />
          </div>
        </div>
      </div>

      <ul class="divide-y divide-border/40 border-t border-border/40 px-3">
        <li v-for="render of batch.renders" :key="render.id" class="py-1.5">
          <div class="flex items-center gap-2">
            <component
              :is="statusIcon(render.status)"
              class="h-3.5 w-3.5 shrink-0"
              :class="[
                STATUS_TONE[render.status],
                render.status === 'rendering' ? 'animate-spin' : '',
              ]"
            />
            <span class="min-w-0 flex-1 truncate text-xs">
              {{ render.lineup?.name ?? render.utility_lineup_id }}
            </span>
            <span
              class="shrink-0 font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.14em]"
              :class="STATUS_TONE[render.status]"
            >
              {{ rowStatusLabel(batch, render) }}
              <template v-if="render.status !== 'queued'">
                <span aria-hidden="true" class="mx-1 text-border">/</span>
                {{ progressPct(render) }}%
              </template>
              <span aria-hidden="true" class="mx-1 text-border">/</span>
              <span class="text-muted-foreground">
                {{ since(render.created_at) }}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              class="h-6 shrink-0 px-1.5"
              :loading="busy[render.id]"
              :title="$t('pages.utility.render_queue.cancel')"
              @click="cancel(render)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>

          <!-- Second line: how it got here, where it is running, and whether it
               is still talking. All of it is already on the row. -->
          <div
            class="mt-0.5 flex flex-wrap items-center gap-x-1.5 pl-[1.375rem] font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/80"
          >
            <template v-for="(leg, index) of timeline(render)" :key="index">
              <span v-if="index > 0" aria-hidden="true" class="text-border">
                →
              </span>
              <span>
                {{ legLabel(leg.status) }}
                <span class="tabular-nums text-muted-foreground/60">
                  {{ leg.held }}
                </span>
              </span>
            </template>

            <template v-if="render.k8s_job_name">
              <span aria-hidden="true" class="text-border">/</span>
              <span class="truncate normal-case tracking-normal">
                {{ render.k8s_job_name }}
              </span>
            </template>

            <template v-if="isStale(render)">
              <span aria-hidden="true" class="text-border">/</span>
              <span class="text-warning">
                {{
                  $t("pages.utility.render_queue.stale", {
                    since: since(render.last_status_at),
                  })
                }}
              </span>
            </template>
          </div>

          <!-- The pod's own words while the render is still queued: the batch
               job captures the log of a silent boot two minutes in. This is
               the line that replaces guessing. -->
          <p
            v-if="render.error_message"
            class="mt-0.5 break-words pl-[1.375rem] font-mono text-[0.6rem] text-warning"
          >
            {{ render.error_message }}
          </p>
        </li>
      </ul>
    </div>

    <div v-if="finished.length" class="mt-3 rounded-md border border-border">
      <ul class="divide-y divide-border">
        <li
          v-for="render of finished"
          :key="render.id"
          class="flex items-start gap-2 px-3 py-2"
        >
          <component
            :is="statusIcon(render.status)"
            class="mt-0.5 h-3.5 w-3.5 shrink-0"
            :class="STATUS_TONE[render.status]"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-xs">
                {{ render.lineup?.name ?? render.utility_lineup_id }}
              </span>
              <span
                class="shrink-0 font-mono text-[0.6rem] uppercase tabular-nums tracking-[0.14em] text-muted-foreground"
              >
                {{ cleanMapName(render.map_name) }}
                <span aria-hidden="true" class="mx-1 text-border">/</span>
                <span :class="STATUS_TONE[render.status]">
                  {{ statusLabel(render.status) }}
                </span>
                <template v-if="render.duration_ms">
                  <span aria-hidden="true" class="mx-1 text-border">/</span>
                  {{ Math.round(Number(render.duration_ms) / 1000) }}s
                </template>
              </span>
            </div>
            <p
              v-if="render.skip_reason || render.error_message"
              class="mt-0.5 break-words font-mono text-[0.62rem]"
              :class="
                render.skip_reason ? 'text-muted-foreground' : 'text-destructive'
              "
            >
              {{ render.skip_reason ?? render.error_message }}
            </p>
          </div>
          <Button
            v-if="render.status !== 'done'"
            size="sm"
            variant="ghost"
            class="h-6 shrink-0 px-1.5"
            :loading="busy[render.id]"
            :title="$t('pages.utility.render_queue.retry')"
            @click="rerender(render)"
          >
            <RotateCw class="h-3.5 w-3.5" />
          </Button>
        </li>
      </ul>
    </div>
  </section>
</template>
