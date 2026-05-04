<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  Loader2,
  CircleSlash,
  CheckCircle2,
  AlertCircle,
  ListVideo,
  X,
  Clock,
  Cpu,
} from "lucide-vue-next";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";

// Operator panel for the render queue. Shows every in-flight or
// recently-finished clip_render_jobs row across the platform (the
// streamer-rank+ Hasura permission returns all rows, not just the
// caller's), grouped by match_map. Each group has ONE Cancel button
// that cancels the whole batch — not per-row. Match highlights are
// 1-clip-per-player and the operator's mental model is "cancel this
// match's recap run", not "cancel Joe's clip but keep Bob's";
// per-clip granularity adds noise without buying anything when the
// pod processes the batch sequentially anyway.
//
// The pod's render script reads each row's status before each clip
// and skips on `cancelled`, so the cancel propagates without us
// having to coordinate with the in-flight render. The cancel action
// also tears down the pod so the in-flight clip itself dies.
type Job = {
  id: string;
  user_steam_id: string;
  match_map_id: string;
  status: string;
  progress: number | string | null;
  error_message: string | null;
  clip_id: string | null;
  created_at: string;
  last_status_at: string | null;
  spec: any;
};

const props = withDefaults(
  defineProps<{
    // Compact mode trims the visible content to just the active
    // batch (no recently-finished strip, no progress bars per row).
    // Used on the Manage Highlights summary; the dedicated queue
    // page renders the full layout.
    compact?: boolean;
  }>(),
  { compact: false },
);

const nuxtApp = useNuxtApp();
const jobs = ref<Job[]>([]);
const loading = ref(true);
const cancellingBatch = ref<Record<string, boolean>>({});

let activeSub: { unsubscribe: () => void } | null = null;
function subscribe() {
  activeSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Include recent terminal jobs so the operator can see what
      // JUST finished without bouncing into the clips grid. Cap at
      // 50 — typical workload is 1-10 in-flight.
      clip_render_jobs: [
        {
          order_by: [{ created_at: "desc" }],
          limit: 50,
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      jobs.value = data?.clip_render_jobs ?? [];
      loading.value = false;
    },
    error: (err: any) => {
      console.error("[render-queue] subscription error:", err);
      loading.value = false;
    },
  });
}
subscribe();
onBeforeUnmount(() => activeSub?.unsubscribe());

const TERMINAL = new Set(["done", "error", "cancelled"]);
const inFlight = computed(() =>
  jobs.value.filter((j) => !TERMINAL.has(j.status)),
);
const recentlyDone = computed(() =>
  jobs.value.filter((j) => TERMINAL.has(j.status)).slice(0, 12),
);

// Group in-flight by match_map. One pod per group; the operator
// cancels at this level. Inside each group, render order:
// rendering > uploading > queued so the in-progress row is visible
// at a glance.
const STATUS_ORDER: Record<string, number> = {
  rendering: 0,
  uploading: 1,
  queued: 2,
};
const groups = computed(() => {
  const map = new Map<string, Job[]>();
  for (const j of inFlight.value) {
    const list = map.get(j.match_map_id) ?? [];
    list.push(j);
    map.set(j.match_map_id, list);
  }
  return Array.from(map.entries()).map(([matchMapId, list]) => ({
    matchMapId,
    jobs: list.sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    ),
    activeJob: list.find(
      (j) => j.status === "rendering" || j.status === "uploading",
    ),
  }));
});

function progressPct(j: Job): number {
  const n = typeof j.progress === "number" ? j.progress : Number(j.progress);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

function statusLabel(s: string): string {
  switch (s) {
    case "queued":
      return "Queued";
    case "rendering":
      return "Rendering";
    case "uploading":
      return "Uploading";
    case "done":
      return "Done";
    case "error":
      return "Error";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}

function clipTitle(j: Job): string {
  const t = j.spec?.title;
  if (typeof t === "string" && t.length > 0) return t;
  return `Render ${j.id.slice(0, 8)}`;
}

async function cancelBatch(matchMapId: string) {
  if (cancellingBatch.value[matchMapId]) return;
  cancellingBatch.value = { ...cancellingBatch.value, [matchMapId]: true };
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        cancelClipRenderBatch: [
          { match_map_id: matchMapId },
          { success: true },
        ],
      } as any),
    });
    // Subscription delivers the new status flips; affected rows
    // disappear from in-flight automatically.
  } catch (e) {
    console.error("[render-queue] batch cancel failed:", e);
  } finally {
    cancellingBatch.value = { ...cancellingBatch.value, [matchMapId]: false };
  }
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
</script>

<template>
  <div
    v-if="!loading && (groups.length > 0 || (!compact && recentlyDone.length > 0))"
    class="space-y-4"
  >
    <div class="flex items-center gap-2">
      <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
      <h2 class="font-mono text-xs uppercase tracking-[0.18em] text-foreground/80">
        Render Queue
      </h2>
      <span
        v-if="inFlight.length"
        class="ml-2 inline-flex items-center gap-1 rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] px-2 py-0.5 text-[0.65rem] font-mono uppercase tracking-wider text-[hsl(var(--tac-amber))]"
      >
        <Loader2 class="h-3 w-3 animate-spin" />
        {{ inFlight.length }} in flight
      </span>
    </div>

    <!-- Per-match_map group = one batch pod, one demo, processing
         the listed jobs sequentially. Header has the Cancel button;
         the rows underneath are read-only listings of what's queued
         in this batch. -->
    <div
      v-if="groups.length"
      class="grid gap-3 grid-cols-1"
      :class="{ 'lg:grid-cols-2': !compact }"
    >
      <Card
        v-for="g in groups"
        :key="g.matchMapId"
        class="p-3 space-y-2"
      >
        <div
          class="flex items-center justify-between gap-2 pb-2 border-b border-border/40"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Cpu class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span
              class="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground truncate"
              :title="g.matchMapId"
            >
              {{ g.matchMapId.slice(0, 8) }} · {{ g.jobs.length }} job{{
                g.jobs.length === 1 ? "" : "s"
              }}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            class="h-7 text-[0.7rem] hover:border-destructive hover:text-destructive shrink-0"
            :disabled="cancellingBatch[g.matchMapId]"
            @click="cancelBatch(g.matchMapId)"
          >
            <Loader2
              v-if="cancellingBatch[g.matchMapId]"
              class="h-3 w-3 mr-1 animate-spin"
            />
            <X v-else class="h-3 w-3 mr-1" />
            Cancel batch
          </Button>
        </div>

        <!-- Active job's progress, broken into two distinct phases.
             RENDER bar fills 0→100% during status='rendering' (the
             pod's per-segment progress reports drive it). UPLOAD bar
             stays empty until status flips to 'uploading', then
             pulses indeterminate — we don't have real upload-bytes
             progress (single chunked POST, no readback). When status
             reaches 'done' both bars sit at 100%. This replaces the
             old single bar that jumped to 50% on entering upload
             phase, which read as "stuck halfway" until completion. -->
        <div
          v-if="g.activeJob && !compact"
          class="space-y-2"
        >
          <div class="flex items-center gap-2 text-xs">
            <Loader2
              class="h-3.5 w-3.5 shrink-0 animate-spin text-[hsl(var(--tac-amber))]"
            />
            <span class="truncate font-medium">
              {{ clipTitle(g.activeJob) }}
            </span>
            <span
              class="ml-auto shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground"
            >
              {{ statusLabel(g.activeJob.status) }}
              · {{ formatTimeAgo(g.activeJob.last_status_at ?? g.activeJob.created_at) }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground">
                <span>Render</span>
                <span v-if="g.activeJob.status === 'rendering'">
                  {{ progressPct(g.activeJob) }}%
                </span>
                <span v-else>100%</span>
              </div>
              <Progress
                :model-value="
                  g.activeJob.status === 'rendering'
                    ? progressPct(g.activeJob)
                    : 100
                "
                class="h-1"
              />
            </div>
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-[0.6rem] font-mono uppercase tracking-wider text-muted-foreground">
                <span>Upload</span>
                <span v-if="g.activeJob.status === 'uploading'">…</span>
                <span v-else-if="g.activeJob.status === 'done'">100%</span>
                <span v-else>—</span>
              </div>
              <!-- Indeterminate pulse during upload (no bytes-progress
                   signal — single chunked POST). Shadcn's Progress
                   doesn't support indeterminate state, so we render
                   a custom track with a sliding gradient bar. Solid
                   100% on done; empty bar otherwise. -->
              <div
                v-if="g.activeJob.status === 'uploading'"
                class="relative h-1 overflow-hidden rounded-full bg-primary/20"
              >
                <div class="upload-pulse-bar" />
              </div>
              <Progress
                v-else-if="g.activeJob.status === 'done'"
                :model-value="100"
                class="h-1"
              />
              <div
                v-else
                class="h-1 rounded-full bg-muted/40"
              />
            </div>
          </div>
        </div>

        <!-- Queued list (rows below the active one). In compact mode
             we show a one-line summary instead of the per-row list. -->
        <div
          v-if="!compact"
          class="space-y-1"
        >
          <div
            v-for="j in g.jobs.filter((x) => x !== g.activeJob)"
            :key="j.id"
            class="flex items-center gap-2 rounded border border-border/40 bg-muted/10 px-2 py-1 text-xs"
          >
            <Clock class="h-3 w-3 shrink-0 text-muted-foreground" />
            <span class="truncate">{{ clipTitle(j) }}</span>
            <span class="ml-auto shrink-0 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground">
              {{ statusLabel(j.status) }}
            </span>
          </div>
        </div>
        <div
          v-else
          class="text-[0.65rem] uppercase tracking-wider text-muted-foreground"
        >
          {{ g.jobs.length - (g.activeJob ? 1 : 0) }} queued
          {{ g.activeJob ? `· active: ${clipTitle(g.activeJob)}` : "" }}
        </div>
      </Card>
    </div>

    <!-- Recently-terminal strip — dedicated queue page only. Manage
         Highlights' compact summary doesn't need this; the clips
         grid below already shows the produced clips. -->
    <div v-if="!compact && recentlyDone.length" class="space-y-1">
      <div class="flex items-center gap-2 mb-1">
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/80"
        >
          Recently finished
        </span>
      </div>
      <div class="grid gap-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="j in recentlyDone"
          :key="j.id"
          class="flex items-center gap-2 rounded border border-border/40 bg-muted/10 px-2 py-1 text-xs"
        >
          <CheckCircle2
            v-if="j.status === 'done'"
            class="h-3 w-3 shrink-0 text-emerald-400"
          />
          <CircleSlash
            v-else-if="j.status === 'cancelled'"
            class="h-3 w-3 shrink-0 text-muted-foreground"
          />
          <AlertCircle
            v-else
            class="h-3 w-3 shrink-0 text-destructive"
          />
          <span class="truncate" :title="j.error_message ?? clipTitle(j)">
            {{ clipTitle(j) }}
          </span>
          <span class="ml-auto shrink-0 text-[0.6rem] text-muted-foreground/80">
            {{ formatTimeAgo(j.last_status_at ?? j.created_at) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Indeterminate "uploading" track. A short bright gradient slides
   left-to-right repeatedly so the user sees activity without an
   accurate percentage. ~1.4s loop is the same cadence shadcn's
   skeleton uses, so it reads as "loading happening" by familiarity. */
.upload-pulse-bar {
  position: absolute;
  inset: 0;
  width: 30%;
  border-radius: 9999px;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--primary)) 50%,
    transparent
  );
  animation: upload-pulse 1.4s linear infinite;
}
@keyframes upload-pulse {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
</style>
