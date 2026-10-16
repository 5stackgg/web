<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import { AlertTriangle, Box, Check, Clock, X } from "lucide-vue-next";
import ServiceLogs from "~/components/ServiceLogs.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Spinner } from "~/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import Cs2BuildStatusPanel from "~/components/game-server-nodes/Cs2BuildStatusPanel.vue";
import Cs2BuildRunButton from "~/components/game-server-nodes/Cs2BuildRunButton.vue";
import { useCs2BuildActions } from "~/composables/useCs2BuildActions";
import {
  TONE_BY_MAP_ASSETS_STATUS,
  durationSeconds,
  failedMapCount,
  formatDuration,
  mapAssetChangeRows,
  mapAssetsProgress,
  mapAssetsRunStatus,
  type Cs2BuildNode,
  type Cs2BuildTone,
  type MapAssetsRunRow,
} from "~/types/cs2Build";

const MAPS_HOST = "https://demo-dl.5stack.gg/maps";

const props = withDefaults(
  defineProps<{
    buildId: number;
    row: MapAssetsRunRow | null;
    nodes?: Array<Cs2BuildNode>;
    canRun?: boolean;
    detailed?: boolean;
    listClass?: string;
  }>(),
  {
    nodes: () => [],
    canRun: false,
    detailed: false,
    listClass: undefined,
  },
);

const { t } = useI18n();
const { rebuild } = useCs2BuildActions();
const now = useNow({ interval: 60_000 });

const status = computed(() =>
  mapAssetsRunStatus(props.row, now.value.getTime()),
);
const tone = computed(() => TONE_BY_MAP_ASSETS_STATUS[status.value]);
const rows = computed(() =>
  running.value ? [] : mapAssetChangeRows(props.row),
);
const changes = computed(() => props.row?.changes ?? null);
const running = computed(
  () => status.value === "pending" || status.value === "building",
);

// The run's job log, streamed while it is around; how far the run has got
// is read off it (`[3/27] de_mirage`).
const logService = computed(() => `map-assets:${props.buildId}`);
const logLines = ref<string[]>([]);
watch(
  [() => props.buildId, () => props.row?.started_at],
  () => (logLines.value = []),
);
const progress = computed(() =>
  running.value ? mapAssetsProgress(logLines.value) : null,
);
const progressShare = computed(() =>
  progress.value?.total
    ? Math.min(1, progress.value.done / progress.value.total)
    : 0,
);

const listTitle = computed(() => {
  if (running.value) {
    return t("pages.game_server_nodes.cs2_build.in_progress");
  }
  return changes.value?.comparable && props.row?.previous_build_id
    ? t("pages.game_server_nodes.cs2_build.vs_build", {
        build: props.row.previous_build_id,
      })
    : t("pages.game_server_nodes.cs2_build.first_run");
});

const took = computed(() =>
  formatDuration(
    durationSeconds(props.row?.started_at, props.row?.finished_at),
  ),
);

const total = computed(
  () => changes.value?.total ?? Object.keys(props.row?.maps ?? {}).length,
);

const stats = computed(() => {
  if (!props.row || running.value || status.value === "stale") {
    return [];
  }
  const changed = changes.value?.comparable
    ? changes.value.rebuilt.length +
      changes.value.added.length +
      changes.value.removed.length
    : null;
  const failed = failedMapCount(props.row);
  return [
    {
      label: t("pages.game_server_nodes.cs2_build.stats.maps"),
      value: total.value,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.changed"),
      value: changed ?? "–",
      tone: changed ? ("running" as Cs2BuildTone) : undefined,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.unchanged"),
      value: changes.value?.comparable ? changes.value.unchanged : "–",
      tone: "idle" as Cs2BuildTone,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.failed"),
      value: failed,
      tone: failed ? ("destructive" as Cs2BuildTone) : undefined,
    },
  ];
});

const chips = computed(() => {
  if (!changes.value?.comparable || running.value) {
    return [];
  }
  return [
    {
      key: "rebuilt",
      tone: "running" as Cs2BuildTone,
      count: changes.value.rebuilt.length,
    },
    {
      key: "added",
      tone: "success" as Cs2BuildTone,
      count: changes.value.added.length,
    },
    {
      key: "removed",
      tone: "warning" as Cs2BuildTone,
      count: changes.value.removed.length,
    },
  ];
});

const CHIP_TONES: Record<Cs2BuildTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  destructive: "bg-destructive/10 text-destructive",
  running: "bg-info/10 text-info",
  idle: "bg-muted/40 text-muted-foreground",
};

const TEXT_TONES: Record<Cs2BuildTone, string> = {
  success: "text-success",
  warning: "text-[hsl(var(--tac-amber))]",
  destructive: "text-destructive",
  running: "text-info",
  idle: "text-muted-foreground",
};

const chipClass = (chip: { tone: Cs2BuildTone; count: number }) =>
  chip.count ? CHIP_TONES[chip.tone] : CHIP_TONES.idle;

const runLabel = computed(() => {
  if (status.value === "none") {
    return t("pages.game_server_nodes.cs2_build.build");
  }
  if (status.value === "partial") {
    return t("pages.game_server_nodes.cs2_build.retry_failed");
  }
  return t("pages.game_server_nodes.cs2_build.rebuild");
});

const blocked = computed(() =>
  running.value
    ? t("pages.game_server_nodes.cs2_build.blocked.building")
    : null,
);

const forceNode = ref<string | null>(null);
const forceOpen = ref(false);
const forcing = ref(false);

function run(gameServerNodeId: string | null) {
  if (status.value === "published") {
    forceNode.value = gameServerNodeId;
    forceOpen.value = true;
    return;
  }
  return rebuild(gameServerNodeId);
}

async function confirmForce() {
  if (forcing.value) {
    return;
  }
  forcing.value = true;
  try {
    forceOpen.value = false;
    await rebuild(forceNode.value, true);
  } finally {
    forcing.value = false;
  }
}

const startedAt = computed(() =>
  status.value === "building"
    ? (props.row?.started_at ?? null)
    : (props.row?.updated_at ?? props.row?.created_at ?? null),
);

const node = computed(
  () =>
    props.row?.game_server_node?.label || props.row?.game_server_node?.id || null,
);

const manifestUrl = computed(() =>
  props.row?.manifest ? `${MAPS_HOST}/${props.row.manifest}` : null,
);

const error = computed(() =>
  status.value === "failed" || status.value === "partial"
    ? (props.row?.error ?? null)
    : null,
);
</script>

<template>
  <Cs2BuildStatusPanel
    :title="$t('pages.game_server_nodes.cs2_build.map_assets')"
    :subtitle="$t('pages.game_server_nodes.cs2_build.map_assets_description')"
    :tone="tone"
    :status="
      $t(`pages.game_server_nodes.cs2_build.map_assets_status.${status}`)
    "
    :running="running"
    :stats="stats"
    :list-class="listClass"
  >
    <template #icon><Box /></template>
    <template #status-icon>
      <Spinner v-if="running" class="text-[0.8rem]" />
      <Check v-else-if="status === 'published'" class="h-3.5 w-3.5" />
      <X v-else-if="status === 'failed'" class="h-3.5 w-3.5" />
      <Clock v-else-if="status === 'none'" class="h-3.5 w-3.5" />
      <AlertTriangle v-else class="h-3.5 w-3.5" />
    </template>

    <template #meta>
      <template v-if="row">
        <template v-if="running || status === 'stale'">
          <span>{{ $t("pages.game_server_nodes.cs2_build.started") }}</span>
          <TimeAgo
            v-if="startedAt"
            :date="startedAt"
            hide-icon
          />
        </template>
        <template v-else>
          <span>{{ $t("pages.game_server_nodes.cs2_build.finished") }}</span>
          <TimeAgo
            v-if="row.finished_at"
            :date="row.finished_at"
            hide-icon
          />
          <template v-if="took">
            <span>·</span>
            <span>{{
              $t("pages.game_server_nodes.cs2_build.took", { duration: took })
            }}</span>
          </template>
        </template>
        <template v-if="row.trigger">
          <span>·</span>
          <span>{{
            $t(`pages.game_server_nodes.cs2_build.trigger.${row.trigger}`)
          }}</span>
          <NuxtLink
            v-if="row.requested_by"
            :to="{
              name: 'players-id',
              params: { id: row.requested_by.steam_id },
            }"
            class="underline-offset-2 hover:text-foreground hover:underline"
          >
            {{
              $t("pages.game_server_nodes.cs2_build.requested_by", {
                name: row.requested_by.name,
              })
            }}
          </NuxtLink>
        </template>
        <template v-if="node">
          <span>·</span>
          <span>{{
            $t("pages.game_server_nodes.cs2_build.ran_on", { node })
          }}</span>
        </template>
      </template>
      <span v-else>{{
        $t("pages.game_server_nodes.cs2_build.map_assets_never")
      }}</span>
    </template>

    <template #list-header>
      <span
        class="flex-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ listTitle }}
      </span>
      <span
        v-for="chip of chips"
        :key="chip.key"
        class="rounded-full px-2 py-px text-[0.68rem]"
        :class="chipClass(chip)"
      >
        {{
          $t(`pages.game_server_nodes.cs2_build.chip.${chip.key}`, {
            count: chip.count,
          })
        }}
      </span>
    </template>

    <template #list>
      <div v-if="running" class="flex flex-col gap-1.5 px-3 py-2.5 text-xs">
        <div class="flex items-center justify-between gap-3">
          <span class="min-w-0 truncate text-muted-foreground">
            <template v-if="progress?.current">
              {{
                $t("pages.game_server_nodes.cs2_build.building_map", {
                  map: progress.current,
                })
              }}
            </template>
            <template v-else-if="!progress">
              {{ $t("pages.game_server_nodes.cs2_build.waiting_for_log") }}
            </template>
          </span>
          <span
            v-if="progress"
            class="shrink-0 tabular-nums text-muted-foreground"
          >
            {{
              $t("pages.game_server_nodes.cs2_build.progress", {
                done: progress.done,
                total: progress.total,
              })
            }}
          </span>
        </div>
        <div class="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-info transition-[width] duration-500"
            :style="{ width: `${progressShare * 100}%` }"
          />
        </div>
      </div>
      <div
        v-for="change of rows"
        :key="`${change.change}:${change.map}`"
        class="flex items-center gap-3 border-b border-border/50 px-3 py-1.5 text-xs last:border-b-0"
      >
        <code
          class="w-28 shrink-0 truncate font-mono"
          :class="
            change.change === 'unchanged'
              ? 'text-muted-foreground'
              : 'text-foreground'
          "
        >
          {{ change.map }}
        </code>
        <span
          class="w-28 shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em]"
          :class="TEXT_TONES[change.tone]"
        >
          {{
            change.reason
              ? $t(`pages.game_server_nodes.cs2_build.reason.${change.reason}`)
              : $t(`pages.game_server_nodes.cs2_build.change.${change.change}`)
          }}
        </span>
        <span
          v-if="change.change === 'unchanged' && row?.previous_build_id"
          class="truncate text-muted-foreground"
        >
          {{
            $t("pages.game_server_nodes.cs2_build.reused_from", {
              build: row.previous_build_id,
            })
          }}
        </span>
        <span v-else class="flex min-w-0 flex-wrap gap-1">
          <span
            v-for="asset of change.assets"
            :key="asset"
            class="rounded border border-border px-1.5 font-mono text-[0.62rem] text-foreground/80"
          >
            {{ asset }}
          </span>
        </span>
      </div>
      <p
        v-if="row && !running && !rows.length"
        class="px-3 py-2 text-xs text-muted-foreground"
      >
        {{ $t("pages.game_server_nodes.cs2_build.no_maps") }}
      </p>
    </template>

    <template v-if="row" #details>
      <!-- Mounted while closed too: the progress above is read off it. -->
      <details class="rounded-md border border-border p-2 text-xs">
        <summary
          class="cursor-pointer font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ $t("pages.game_server_nodes.cs2_build.live_log") }}
        </summary>
        <div class="mt-2 h-72">
          <ServiceLogs
            :service="logService"
            :compact="true"
            :running="running"
            @line="(line: string) => logLines.push(line)"
          />
        </div>
      </details>
      <details
        v-if="error && (detailed || status === 'failed')"
        class="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs"
        :open="detailed"
      >
        <summary
          class="cursor-pointer font-mono text-[0.6rem] uppercase tracking-[0.14em] text-destructive"
        >
          {{ $t("pages.game_server_nodes.cs2_build.log") }}
        </summary>
        <pre
          class="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.65rem] text-muted-foreground"
          >{{ error }}</pre
        >
      </details>
    </template>

    <template #footer>
      <a
        v-if="manifestUrl"
        :href="manifestUrl"
        target="_blank"
        rel="noopener"
        class="truncate font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {{ row?.manifest }}
      </a>
      <span v-else class="max-w-[18rem] text-xs text-muted-foreground">
        {{ $t("pages.game_server_nodes.cs2_build.map_assets_hint") }}
      </span>
      <Cs2BuildRunButton
        v-if="canRun"
        :label="runLabel"
        :build-id="buildId"
        :nodes="nodes"
        :blocked="blocked"
        :primary="status === 'partial'"
        :run="run"
      />
    </template>
  </Cs2BuildStatusPanel>

  <AlertDialog :open="forceOpen" @update:open="forceOpen = $event">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.game_server_nodes.cs2_build.force.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t("pages.game_server_nodes.cs2_build.force.description", {
              build: buildId,
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="forceOpen = false">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction :disabled="forcing" @click="confirmForce">
          {{ $t("pages.game_server_nodes.cs2_build.force.confirm") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
