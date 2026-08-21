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
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuthStore } from "~/stores/AuthStore";
import cleanMapName from "~/utilities/cleanMapName";
import { toast } from "~/components/ui/toast";
import type { UtilityLineupRender } from "~/types/utility";

const FINISHED_LIMIT = 200;

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const isAdmin = computed(() => useAuthStore().isAdmin);

const inFlight = shallowRef<UtilityLineupRender[]>([]);
const finished = shallowRef<UtilityLineupRender[]>([]);
const loading = ref(true);
const busy = ref<Record<string, boolean>>({});

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
});

// One pod films one map, so the map IS the batch — the same grouping the
// dispatcher uses on the other side.
const batches = computed(() => {
  const byMap = new Map<string, UtilityLineupRender[]>();
  for (const render of inFlight.value) {
    const list = byMap.get(render.map_name) ?? [];
    list.push(render);
    byMap.set(render.map_name, list);
  }
  return [...byMap.entries()].map(([mapName, renders]) => ({
    mapName,
    renders,
    active: renders.find((render) => render.status !== "queued") ?? null,
    progress:
      renders.reduce(
        (total, render) =>
          total +
          (render.status === "queued" ? 0 : Number(render.progress ?? 0)),
        0,
      ) / Math.max(1, renders.length),
  }));
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

function progressPct(render: UtilityLineupRender) {
  return Math.round(Number(render.progress ?? 0) * 100);
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
  <section class="space-y-4">
    <header class="flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold">
        <Film class="h-4 w-4 text-muted-foreground" />
        {{ $t("pages.utility.render_queue.title") }}
      </h2>
      <Button
        v-if="isAdmin && finished.length"
        size="sm"
        variant="ghost"
        :loading="clearing"
        @click="clearFinished()"
      >
        {{ $t("pages.utility.render_queue.clear_finished") }}
      </Button>
    </header>

    <div v-if="loading" class="space-y-2">
      <Skeleton class="h-16 w-full" />
      <Skeleton class="h-16 w-full" />
    </div>

    <p
      v-else-if="!batches.length && !finished.length"
      class="text-xs text-muted-foreground"
    >
      {{ $t("pages.utility.render_queue.empty") }}
    </p>

    <div
      v-for="batch of batches"
      :key="batch.mapName"
      class="rounded-md border border-border bg-card/40 p-3"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold">
          {{ cleanMapName(batch.mapName) }}
        </span>
        <span class="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
          {{
            $t("pages.utility.render_queue.lineups", {
              count: batch.renders.length,
            })
          }}
        </span>
      </div>

      <div class="mt-2 h-1 overflow-hidden rounded bg-muted">
        <div
          class="h-full bg-[hsl(var(--tac-amber))] transition-[width] [transition-duration:240ms]"
          :style="{ width: `${Math.round(batch.progress * 100)}%` }"
        />
      </div>

      <ul class="mt-2 space-y-1">
        <li
          v-for="render of batch.renders"
          :key="render.id"
          class="flex items-center gap-2 text-xs"
        >
          <component
            :is="statusIcon(render.status)"
            class="h-3.5 w-3.5 shrink-0"
            :class="[
              STATUS_TONE[render.status],
              render.status === 'rendering' ? 'animate-spin' : '',
            ]"
          />
          <span class="min-w-0 flex-1 truncate">
            {{ render.lineup?.name ?? render.utility_lineup_id }}
          </span>
          <span
            v-if="render.status !== 'queued'"
            class="font-mono text-[0.62rem] tabular-nums text-muted-foreground"
          >
            {{ progressPct(render) }}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            class="h-6 px-1.5"
            :loading="busy[render.id]"
            :title="$t('pages.utility.render_queue.cancel')"
            @click="cancel(render)"
          >
            <X class="h-3.5 w-3.5" />
          </Button>
        </li>
      </ul>
    </div>

    <div v-if="finished.length" class="rounded-md border border-border">
      <ul class="divide-y divide-border">
        <li
          v-for="render of finished"
          :key="render.id"
          class="flex items-start gap-2 px-3 py-2 text-xs"
        >
          <component
            :is="statusIcon(render.status)"
            class="mt-0.5 h-3.5 w-3.5 shrink-0"
            :class="STATUS_TONE[render.status]"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">
                {{ render.lineup?.name ?? render.utility_lineup_id }}
              </span>
              <span
                class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {{ cleanMapName(render.map_name) }}
              </span>
            </div>
            <p
              v-if="render.skip_reason || render.error_message"
              class="mt-0.5 break-words font-mono text-[0.62rem]"
              :class="
                render.skip_reason
                  ? 'text-muted-foreground'
                  : 'text-destructive'
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

    <Spinner v-if="clearing" class="h-4 w-4" />
  </section>
</template>
