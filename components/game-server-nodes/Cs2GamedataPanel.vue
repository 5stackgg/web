<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import {
  AlertTriangle,
  Check,
  Clock,
  ShieldCheck,
  X,
} from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { Spinner } from "~/components/ui/spinner";
import Cs2BuildStatusPanel from "~/components/game-server-nodes/Cs2BuildStatusPanel.vue";
import Cs2BuildRunButton from "~/components/game-server-nodes/Cs2BuildRunButton.vue";
import { useCs2BuildActions } from "~/composables/useCs2BuildActions";
import {
  TONE_BY_GAMEDATA_STATUS,
  durationSeconds,
  formatDuration,
  gamedataChangeRows,
  gamedataErrorReason,
  gamedataRunStatus,
  type Cs2BuildNode,
  type Cs2BuildTone,
  type GamedataRunRow,
} from "~/types/cs2Build";

const props = withDefaults(
  defineProps<{
    buildId: number;
    row: GamedataRunRow | null;
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
const { revalidate } = useCs2BuildActions();
const now = useNow({ interval: 60_000 });

const status = computed(() =>
  gamedataRunStatus(props.row, now.value.getTime()),
);
const tone = computed(() => TONE_BY_GAMEDATA_STATUS[status.value]);
const rows = computed(() =>
  running.value ? [] : gamedataChangeRows(props.row),
);
const changes = computed(() => props.row?.changes ?? null);
const counts = computed(() => changes.value?.counts ?? null);

const took = computed(() =>
  formatDuration(
    durationSeconds(props.row?.started_at, props.row?.validated_at),
  ),
);

const stats = computed(() => {
  if (!counts.value || running.value) {
    return [];
  }
  return [
    {
      label: t("pages.game_server_nodes.cs2_build.stats.checked"),
      value: counts.value.checked,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.broken"),
      value: counts.value.broken,
      tone: counts.value.broken ? ("destructive" as Cs2BuildTone) : undefined,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.warnings"),
      value: counts.value.warnings,
      tone: counts.value.warnings ? ("warning" as Cs2BuildTone) : undefined,
    },
    {
      label: t("pages.game_server_nodes.cs2_build.stats.skipped"),
      value: counts.value.skipped,
      tone: "idle" as Cs2BuildTone,
    },
  ];
});

const chips = computed(() => {
  if (!changes.value?.comparable || running.value) {
    return [];
  }
  return [
    {
      key: "newly_broken",
      tone: "destructive" as Cs2BuildTone,
      count: changes.value.newly_broken.length,
    },
    {
      key: "fixed",
      tone: "success" as Cs2BuildTone,
      count: changes.value.fixed.length,
    },
    {
      key: "new_warnings",
      tone: "warning" as Cs2BuildTone,
      count: changes.value.new_warnings.length,
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

const RUNTIME_LABELS: Record<string, string> = {
  swiftlys2: "Swiftly",
  counterstrikesharp: "CounterStrikeSharp",
};

const runtimeLabel = (runtimes: Array<string>) =>
  runtimes.map((runtime) => RUNTIME_LABELS[runtime] ?? runtime).join(", ");

const countLabel = (row: { previousCount: number | null; count: number | null }) => {
  if (row.previousCount === null && row.count === null) {
    return "";
  }
  return `${row.previousCount ?? "–"} → ${row.count ?? "–"}`;
};

const running = computed(() => status.value === "running");

const blocked = computed(() =>
  running.value ? t("pages.game_server_nodes.cs2_build.blocked.running") : null,
);

const skipped = computed(() => props.row?.results?.skipped ?? []);
const error = computed(() =>
  status.value === "error" ? gamedataErrorReason(props.row) : null,
);

const node = computed(
  () =>
    props.row?.game_server_node?.label || props.row?.game_server_node?.id || null,
);
</script>

<template>
  <Cs2BuildStatusPanel
    :title="$t('pages.game_server_nodes.cs2_build.gamedata')"
    :subtitle="$t('pages.game_server_nodes.cs2_build.gamedata_description')"
    :tone="tone"
    :status="$t(`pages.game_server_nodes.cs2_build.gamedata_status.${status}`)"
    :running="running"
    :stats="stats"
    :list-class="listClass"
  >
    <template #icon><ShieldCheck /></template>
    <template #status-icon>
      <Spinner v-if="running" class="text-[0.8rem]" />
      <Check v-else-if="status === 'passed'" class="h-3.5 w-3.5" />
      <X v-else-if="status === 'failed'" class="h-3.5 w-3.5" />
      <Clock v-else-if="status === 'none'" class="h-3.5 w-3.5" />
      <AlertTriangle v-else class="h-3.5 w-3.5" />
    </template>

    <template #meta>
      <template v-if="row">
        <template v-if="running || status === 'stale'">
          <span>{{ $t("pages.game_server_nodes.cs2_build.started") }}</span>
          <TimeAgo
            v-if="row.started_at"
            :date="row.started_at"
            hide-icon
          />
        </template>
        <template v-else>
          <span>{{ $t("pages.game_server_nodes.cs2_build.validated") }}</span>
          <TimeAgo
            v-if="row.validated_at"
            :date="row.validated_at"
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
        $t("pages.game_server_nodes.cs2_build.gamedata_never")
      }}</span>
    </template>

    <template #list-header>
      <span
        class="flex-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{
          changes?.comparable && row?.previous_build_id
            ? $t("pages.game_server_nodes.cs2_build.vs_build", {
                build: row.previous_build_id,
              })
            : $t("pages.game_server_nodes.cs2_build.first_run")
        }}
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
      <p
        v-if="error"
        class="whitespace-pre-wrap break-words px-3 py-2 text-xs text-destructive"
      >
        {{ error }}
      </p>
      <div
        v-for="change of rows"
        :key="change.key"
        class="flex items-center gap-3 border-b border-border/50 px-3 py-1.5 text-xs last:border-b-0"
      >
        <span
          class="w-24 shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.06em]"
          :class="TEXT_TONES[change.tone]"
        >
          {{ $t(`pages.game_server_nodes.cs2_build.change.${change.change}`) }}
        </span>
        <code class="min-w-0 truncate font-mono">{{ change.signature }}</code>
        <span class="min-w-0 flex-1 truncate text-muted-foreground">
          {{ change.set }}
          <template v-if="change.kind !== 'signature'">
            · {{ change.kind }}</template
          >
          <template v-if="change.runtimes.length">
            · {{ runtimeLabel(change.runtimes) }}</template
          >
        </span>
        <span class="shrink-0 font-mono tabular-nums text-muted-foreground">
          {{ countLabel(change) }}
        </span>
      </div>
      <p
        v-if="row && !running && !rows.length && !error"
        class="px-3 py-2 text-xs text-muted-foreground"
      >
        {{
          changes?.comparable && row.previous_build_id
            ? $t("pages.game_server_nodes.cs2_build.no_changes", {
                build: row.previous_build_id,
              })
            : $t("pages.game_server_nodes.cs2_build.nothing_broken")
        }}
      </p>
    </template>

    <template v-if="detailed && skipped.length" #details>
      <details class="rounded-md border border-border p-2 text-xs">
        <summary
          class="cursor-pointer font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            $t("pages.game_server_nodes.cs2_build.skipped_entries", {
              count: skipped.length,
            })
          }}
        </summary>
        <ul class="mt-2 space-y-1 text-muted-foreground">
          <li
            v-for="entry of skipped"
            :key="`${entry.set}:${entry.kind}:${entry.signature}`"
          >
            <code class="font-mono text-foreground">{{ entry.signature }}</code>
            · {{ entry.set }}
            <template v-if="entry.reason"> · {{ entry.reason }}</template>
          </li>
        </ul>
      </details>
    </template>

    <template #footer>
      <span class="max-w-[18rem] text-xs text-muted-foreground">
        {{ $t("pages.game_server_nodes.cs2_build.auto_hint") }}
      </span>
      <Cs2BuildRunButton
        v-if="canRun"
        :label="$t('pages.game_server_nodes.cs2_build.revalidate')"
        :build-id="buildId"
        :nodes="nodes"
        :blocked="blocked"
        :run="revalidate"
      />
    </template>
  </Cs2BuildStatusPanel>
</template>
