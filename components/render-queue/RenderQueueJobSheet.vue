<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Play, RotateCcw, RotateCw, Trash2 } from "lucide-vue-next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import ServiceLogs from "~/components/ServiceLogs.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import SnapshotQuickView from "~/components/match/SnapshotQuickView.vue";
import UtilityRenderVersion from "~/components/utility/UtilityRenderVersion.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { useBootStages } from "~/composables/useBootStages";
import { dateLocale } from "~/utilities/dateLocale";
import cleanMapName from "~/utilities/cleanMapName";
import mapLabel from "~/utilities/mapLabel";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  CLIP_TERMINAL,
  UTILITY_TERMINAL,
  clipMatchup,
  type ClipBatchSummary,
  type LedgerRow,
} from "~/components/render-queue/renderQueueLedger";
import {
  clipDetails,
  clipDuration,
  clipTitle,
  logService,
  renderLength,
  since,
  statusToneClass,
} from "~/components/render-queue/renderQueueDisplay";
import { TONE_BG, TONE_TEXT } from "~/components/admin/tone";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  row: LedgerRow<any, any> | null;
  summary?: ClipBatchSummary | null;
  batchHistories?: Array<Array<any> | null | undefined>;
  statusLabel: string;
  stale?: boolean;
  coverageVersion?: number | null;
  live?: boolean;
  rendering?: boolean;
  busy?: boolean;
  /** The page's clock, for "Updated 4m ago". */
  now: number;
}>();

const emit = defineEmits<{
  (e: "requeue", job: any): void;
  (e: "cancel-batch", matchMapId: string): void;
  (e: "cancel-utility", render: any): void;
  (e: "rerender", render: any): void;
  (e: "remove", render: any): void;
  (e: "play-clip", job: any): void;
  (e: "play-utility", render: any): void;
}>();

const { t } = useI18n();
const { stagesFor } = useBootStages();

const sectionLabel = [tacticalSectionLabelClasses, "mb-0"];

const job = computed(() => (props.row?.kind === "clip" ? props.row.job : null));
const render = computed(() =>
  props.row?.kind === "utility" ? props.row.render : null,
);

const terminal = computed(() =>
  job.value
    ? CLIP_TERMINAL.has(job.value.status)
    : render.value
      ? UTILITY_TERMINAL.has(render.value.status)
      : false,
);

const title = computed(() => {
  if (job.value) {
    return clipTitle(job.value, t);
  }
  return render.value?.lineup?.name ?? render.value?.utility_lineup_id ?? "";
});

const subtitle = computed(() => {
  if (job.value) {
    const map = mapLabel(job.value.match_map?.map);
    const matchup = clipMatchup(job.value);
    return [matchup, map].filter(Boolean).join(" · ");
  }
  return render.value
    ? t("pages.render_queue.ledger.lineup_on", {
        map: cleanMapName(render.value.map_name),
      })
    : "";
});

const stageLabels = computed(() => {
  const labels = new Map<string, string>();
  for (const mode of ["highlights", "nades"] as const) {
    for (const stage of stagesFor(mode)) {
      if (stage.label && !labels.has(stage.key)) {
        labels.set(stage.key, stage.label);
      }
    }
  }
  return labels;
});

function legLabel(status: string, stage?: string): string {
  if (status === "booting") {
    const key = (stage ?? "").split(":")[0];
    return (
      stageLabels.value.get(key) ?? t("clips.render_queue.render_pod_booting")
    );
  }
  if (render.value) {
    return t(`pages.utility.render_queue.statuses.${status}`);
  }
  return t(`render_queue_status.${status}`);
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// How it got where it is: the row's own history, one line per leg, with a
// boot folded to the stage it reached.
const history = computed(() => {
  const target = job.value ?? render.value;
  if (!target) {
    return [];
  }
  const entries: Array<{ leg: string; label: string; at: number }> = [];
  const created = Date.parse(target.created_at);
  if (Number.isFinite(created)) {
    entries.push({ leg: "queued", label: legLabel("queued"), at: created });
  }
  for (const entry of target.status_history ?? []) {
    const at = Date.parse(entry?.at ?? "");
    if (!Number.isFinite(at) || !entry?.status) {
      continue;
    }
    const leg =
      entry.status === "booting"
        ? `booting:${(entry.boot_stage ?? "").split(":")[0]}`
        : entry.status;
    if (entries[entries.length - 1]?.leg === leg) {
      continue;
    }
    entries.push({ leg, label: legLabel(entry.status, entry.boot_stage), at });
  }
  return entries.map((entry, index) => {
    const last = index === entries.length - 1;
    let tone = "bg-muted-foreground/50";
    if (last) {
      const status = props.row?.status ?? "";
      // The step it is on now carries the accent.
      tone =
        status === "done"
          ? TONE_BG.ok
          : status === "error" || status === "missing"
            ? TONE_BG.bad
            : terminal.value
              ? "bg-muted-foreground/50"
              : TONE_BG.amber;
    }
    return { ...entry, tone, last };
  });
});

// Neither table has updated_at: the last status change is the last change.
const updatedAt = computed(() => {
  const target = job.value ?? render.value;
  const at = Date.parse(target?.last_status_at ?? target?.created_at ?? "");
  return Number.isFinite(at) ? at : 0;
});

const service = computed(() =>
  logService(job.value?.k8s_job_name ?? render.value?.k8s_job_name ?? null),
);

const details = computed(() => (job.value ? clipDetails(job.value) : []));
const duration = computed(() => (job.value ? clipDuration(job.value) : null));

const hasClip = computed(
  () => job.value?.status === "done" && !!job.value?.clip_id,
);
const hasPreview = computed(
  () => render.value?.status === "done" && !!render.value?.lineup?.preview_url,
);
const canRerender = computed(
  () => !!render.value && (render.value.status !== "done" || props.live),
);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
    >
      <template v-if="row">
        <SheetHeader class="pr-8">
          <SheetTitle class="break-words">{{ title }}</SheetTitle>
          <SheetDescription v-if="subtitle">{{ subtitle }}</SheetDescription>
          <p
            v-if="updatedAt"
            class="text-xs tabular-nums text-muted-foreground"
          >
            {{
              $t("pages.render_queue.ledger.updated_ago", {
                since: since(updatedAt, now),
              })
            }}
          </p>
        </SheetHeader>

        <div class="mt-5 grid gap-5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-flex h-6 items-center rounded-md border border-current/30 px-2 text-xs"
              :class="statusToneClass(row.status)"
            >
              {{ statusLabel }}
            </span>
            <span
              v-if="stale"
              class="inline-flex h-6 items-center rounded-md border border-warning/40 px-2 text-xs text-warning"
            >
              {{ $t("pages.render_queue.ledger.silent") }}
            </span>
            <span
              v-if="live"
              class="inline-flex h-6 items-center rounded-md bg-success/15 px-2 text-xs text-success"
            >
              {{ $t("pages.utility.render_queue.live") }}
            </span>
            <span
              v-for="detail in details"
              :key="detail.label"
              class="inline-flex h-5 items-center rounded border border-border px-1 font-mono text-[0.68rem] tabular-nums"
              :class="
                detail.tone === 'kills'
                  ? 'border-[hsl(var(--tac-amber)/0.4)] text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
            >
              {{ detail.label }}
            </span>
            <span
              v-if="duration"
              class="font-mono text-xs tabular-nums text-muted-foreground"
            >
              {{ duration }}
            </span>
            <span class="flex-1" />
            <Button
              v-if="hasClip"
              size="sm"
              variant="outline"
              class="h-7"
              @click="emit('play-clip', job)"
            >
              <Play class="h-3.5 w-3.5" />
              {{ $t("clips.render_queue.preview_clip") }}
            </Button>
            <Button
              v-if="hasPreview"
              size="sm"
              variant="outline"
              class="h-7"
              @click="emit('play-utility', render)"
            >
              <Play class="h-3.5 w-3.5" />
              {{ $t("pages.utility.preview.play") }}
            </Button>
          </div>

          <p
            v-if="job?.error_message || render?.error_message"
            class="break-words font-mono text-xs"
            :class="render && !terminal ? TONE_TEXT.warn : TONE_TEXT.bad"
          >
            {{ job?.error_message ?? render?.error_message }}
          </p>
          <p
            v-else-if="row.status === 'missing'"
            class="font-mono text-xs text-destructive"
          >
            {{ $t("pages.render_queue.ledger.missing_clip") }}
          </p>
          <p v-if="render?.skip_reason" class="text-xs text-muted-foreground">
            {{ render.skip_reason }}
          </p>

          <section class="grid gap-3">
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.render_queue.ledger.history") }}
            </div>
            <ol class="ml-1.5 grid border-l border-border">
              <li
                v-for="(entry, index) in history"
                :key="index"
                class="relative pb-3 pl-4 text-sm last:pb-0"
              >
                <span
                  class="absolute -left-[4px] top-[7px] h-[7px] w-[7px] rounded-full"
                  :class="entry.tone"
                />
                {{ entry.label }}
                <span class="text-xs tabular-nums text-muted-foreground">
                  · {{ clock(entry.at) }}
                </span>
              </li>
            </ol>
          </section>

          <section class="grid gap-3 border-t border-border/60 pt-5">
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{
                job
                  ? $t("pages.render_queue.ledger.clip")
                  : $t("pages.render_queue.ledger.col.render")
              }}
            </div>
            <dl
              class="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm"
            >
              <template v-if="job">
                <template v-if="job.user?.name">
                  <dt class="text-muted-foreground">
                    {{ $t("pages.utility.drift.requested_by") }}
                  </dt>
                  <dd class="min-w-0 truncate">{{ job.user.name }}</dd>
                </template>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.player") }}
                </dt>
                <dd>{{ job.spec?.target_name || "—" }}</dd>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.round") }}
                </dt>
                <dd class="tabular-nums">{{ job.spec?.round ?? "—" }}</dd>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.kills") }}
                </dt>
                <dd class="tabular-nums">{{ job.spec?.kills_count ?? "—" }}</dd>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.segments") }}
                </dt>
                <dd class="tabular-nums">
                  {{ job.spec?.segments?.length ?? "—" }}
                </dd>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.job_id") }}
                </dt>
                <dd class="break-all font-mono text-xs">{{ job.id }}</dd>
              </template>
              <template v-else-if="render">
                <template v-if="terminal">
                  <dt class="text-muted-foreground">
                    {{ $t("pages.render_queue.ledger.col.finished") }}
                  </dt>
                  <dd>
                    <TimeAgo
                      v-if="render.last_status_at"
                      :date="render.last_status_at"
                      hide-icon
                    />
                    <template v-else>—</template>
                  </dd>
                  <dt class="text-muted-foreground">
                    {{ $t("pages.render_queue.ledger.col.length") }}
                  </dt>
                  <dd class="tabular-nums">
                    {{ renderLength(render.duration_ms) ?? "—" }}
                  </dd>
                  <dt class="text-muted-foreground">
                    {{ $t("pages.utility.render_queue.coverage.version") }}
                  </dt>
                  <dd>
                    <UtilityRenderVersion
                      :version="render.render_version"
                      :expected="coverageVersion"
                    />
                  </dd>
                </template>
                <dt class="text-muted-foreground">
                  {{ $t("pages.render_queue.ledger.lineup_id") }}
                </dt>
                <dd class="break-all font-mono text-xs">
                  {{ render.utility_lineup_id }}
                </dd>
              </template>
              <dt class="text-muted-foreground">
                {{ $t("pages.render_queue.ledger.render_job") }}
              </dt>
              <dd class="break-all font-mono text-xs">
                {{
                  job?.k8s_job_name ??
                  render?.k8s_job_name ??
                  $t("pages.render_queue.ledger.no_job")
                }}
              </dd>
            </dl>
          </section>

          <!-- The pod's boot, stage by stage, beside what its screen shows. -->
          <section
            v-if="job && summary?.boot"
            class="grid gap-3 border-t border-border/60 pt-5"
          >
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("clips.render_queue.render_pod_booting") }}
            </div>
            <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <BootSequence
                mode="highlights"
                :histories="batchHistories ?? []"
                :card="false"
              />
              <div class="overflow-hidden rounded-md border border-border/60">
                <SnapshotQuickView kind="clips" :id="job.id" />
              </div>
            </div>
          </section>
          <section
            v-else-if="
              render &&
              !terminal &&
              (render.k8s_job_name || render.status !== 'queued')
            "
            class="grid gap-3 border-t border-border/60 pt-5"
          >
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.utility.render_queue.pod") }}
            </div>
            <div class="overflow-hidden rounded-md border border-border/60">
              <SnapshotQuickView kind="nades" :id="render.id" />
            </div>
          </section>

          <section
            v-if="service"
            class="grid gap-3 border-t border-border/60 pt-5"
          >
            <div :class="sectionLabel">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.render_queue.ledger.logs") }}
            </div>
            <div
              class="flex h-72 flex-col overflow-hidden rounded-md border border-border/60 bg-background/40"
            >
              <ServiceLogs
                :key="service"
                class="min-h-0 flex-1"
                :service="service"
                :compact="true"
                :disable-retry="terminal"
              />
            </div>
          </section>
        </div>

        <div
          class="mt-6 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4"
        >
          <template v-if="job">
            <Button
              v-if="terminal"
              size="sm"
              variant="outline"
              class="h-8"
              :loading="busy"
              @click="emit('requeue', job)"
            >
              <RotateCcw class="h-3.5 w-3.5" />
              {{ $t("clips.render_queue.requeue_clip") }}
            </Button>
            <Button
              v-else
              size="sm"
              variant="outline"
              class="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="emit('cancel-batch', job.match_map_id)"
            >
              {{ $t("pages.render_queue.ledger.cancel_batch") }}
            </Button>
          </template>
          <template v-else-if="render">
            <Button
              v-if="!terminal"
              size="sm"
              variant="outline"
              class="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              :loading="busy"
              @click="emit('cancel-utility', render)"
            >
              {{ $t("pages.utility.render_queue.cancel") }}
            </Button>
            <template v-else>
              <Button
                size="sm"
                variant="ghost"
                class="h-8 text-destructive hover:text-destructive"
                @click="emit('remove', render)"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ $t("pages.utility.render_queue.delete") }}
              </Button>
              <span class="w-2" aria-hidden="true" />
              <Button
                v-if="canRerender"
                size="sm"
                variant="outline"
                class="h-8"
                :disabled="rendering"
                :loading="busy"
                :title="
                  rendering
                    ? $t('pages.utility.render_queue.in_flight')
                    : undefined
                "
                @click="emit('rerender', render)"
              >
                <RotateCw class="h-3.5 w-3.5" />
                {{
                  render.status === "done"
                    ? $t("pages.utility.render_queue.rerender")
                    : $t("pages.utility.render_queue.retry")
                }}
              </Button>
            </template>
          </template>
          <span class="flex-1" />
          <Button size="sm" variant="ghost" class="h-8" @click="open = false">
            {{ $t("common.close") }}
          </Button>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
