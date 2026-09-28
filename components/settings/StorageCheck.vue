<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Play,
  XCircle,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { generateMutation } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { checkBackblazeWorker } from "~/utilities/backblazeWorkerHealth";

type StageId = "write" | "read" | "edge";
type StageState = "idle" | "running" | "ok" | "fail" | "manual" | "skipped";
type Stage = { state: StageState; detail?: string; link?: string };

const { client } = useApolloClient();
const { t, locale } = useI18n();
const key = (name: string) => `pages.settings.application.demo_settings.${name}`;

const workerUrl = computed(
  () =>
    useApplicationSettingsStore().settings.find(
      (setting) => setting.name === "cloudflare_worker_url",
    )?.value || "",
);

const order = computed<StageId[]>(() =>
  workerUrl.value ? ["write", "read", "edge"] : ["write", "read"],
);

const stages = ref<Record<StageId, Stage>>({
  write: { state: "idle" },
  read: { state: "idle" },
  edge: { state: "idle" },
});
const running = ref(false);
const lastRun = ref<Date | null>(null);

const took = (start: number) =>
  t(key("storage_check_ms"), { ms: Math.round(performance.now() - start) });

async function write(): Promise<boolean> {
  stages.value.write = { state: "running" };
  const start = performance.now();
  try {
    const { data } = await client.mutate({
      mutation: generateMutation({ testUpload: { error: true } }),
    });
    const error = data?.testUpload?.error;
    stages.value.write = error
      ? { state: "fail", detail: error }
      : { state: "ok", detail: took(start) };
    return !error;
  } catch (error) {
    stages.value.write = { state: "fail", detail: (error as Error).message };
    return false;
  }
}

// Read back in this browser, the way players' downloads are, rather than by the
// panel. A bucket without CORS for this site can't be read by fetch at all, so
// that case hands over the link to check by hand instead of failing.
async function read() {
  stages.value.read = { state: "running" };
  const start = performance.now();
  let link: string;
  try {
    const { data } = await client.mutate({
      mutation: generateMutation({
        getTestUploadLink: { link: true, error: true },
      }),
    });
    if (data?.getTestUploadLink?.error || !data?.getTestUploadLink?.link) {
      stages.value.read = {
        state: "fail",
        detail: data?.getTestUploadLink?.error || "",
      };
      return;
    }
    link = data.getTestUploadLink.link;
  } catch (error) {
    stages.value.read = { state: "fail", detail: (error as Error).message };
    return;
  }

  try {
    const response = await fetch(link, { cache: "no-store" });
    if (!response.ok) {
      stages.value.read = { state: "fail", detail: `HTTP ${response.status}` };
      return;
    }
    const body = await response.text();
    stages.value.read = body.startsWith("world")
      ? { state: "ok", detail: took(start) }
      : { state: "fail", detail: t(key("storage_check_unexpected")) };
  } catch {
    stages.value.read = {
      state: "manual",
      detail: t(key("storage_check_read_blocked")),
      link,
    };
  }
}

async function edge() {
  stages.value.edge = { state: "running" };
  const start = performance.now();
  const health = await checkBackblazeWorker(workerUrl.value);
  if (!health.answering) {
    stages.value.edge = {
      state: "fail",
      detail: t(key("cloudflare_worker_unreachable")),
    };
  } else if (!health.current) {
    stages.value.edge = {
      state: "manual",
      detail: t(key("cloudflare_worker_outdated")),
    };
  } else if (health.bucket === "ok") {
    stages.value.edge = { state: "ok", detail: took(start) };
  } else if (health.bucket === "rejected") {
    stages.value.edge = {
      state: "fail",
      detail: t(key("cloudflare_worker_bucket_rejected"), {
        code: health.code ?? "?",
      }),
    };
  } else if (health.bucket === "misconfigured") {
    stages.value.edge = {
      state: "fail",
      detail: t(key("cloudflare_worker_misconfigured")),
    };
  } else {
    stages.value.edge = {
      state: "fail",
      detail: t(key("cloudflare_worker_bucket_unreachable")),
    };
  }
}

async function run() {
  running.value = true;
  for (const id of order.value) {
    stages.value[id] = { state: "idle" };
  }
  if (await write()) {
    await read();
  } else {
    stages.value.read = { state: "skipped" };
  }
  if (workerUrl.value) {
    await edge();
  }
  lastRun.value = new Date();
  running.value = false;
}

const rows = computed(() =>
  order.value.map((id, index) => ({
    id,
    index: String(index + 1).padStart(2, "0"),
    last: index === order.value.length - 1,
    name: t(key(`storage_check_${id}`)),
    path:
      id === "edge"
        ? t(key("storage_check_edge_path"), {
            domain: workerUrl.value
              .replace(/^https?:\/\//, "")
              .replace(/\/+$/, ""),
          })
        : t(key(`storage_check_${id}_path`)),
    ...stages.value[id],
  })),
);

// Stages only ever show a one-line result so the three columns stay level;
// why a stage failed goes in the notes under them.
const result = (stage: Stage) => {
  switch (stage.state) {
    case "idle":
      return t(key("storage_check_idle"));
    case "running":
      return t(key("storage_check_running"));
    case "skipped":
      return t(key("storage_check_skipped"));
    case "fail":
      return t(key("storage_check_failed"));
    case "manual":
      return t(key("storage_check_unverified"));
    default:
      return stage.detail ?? "";
  }
};

const notes = computed(() =>
  rows.value.filter(
    (stage) =>
      (stage.state === "fail" || stage.state === "manual") && stage.detail,
  ),
);

const node: Record<StageState, string> = {
  idle: "border border-muted-foreground/50 bg-background",
  running: "bg-[hsl(var(--tac-amber))] motion-safe:animate-pulse",
  ok: "bg-success",
  fail: "bg-destructive",
  manual: "bg-warning",
  skipped: "bg-muted-foreground/30",
};

const track: Record<StageState, string> = {
  idle: "bg-border",
  running: "bg-border",
  ok: "bg-success/50",
  fail: "bg-destructive/50",
  manual: "bg-warning/50",
  skipped: "bg-border",
};

const text: Record<StageState, string> = {
  idle: "text-muted-foreground/60",
  running: "text-[hsl(var(--tac-amber))]",
  ok: "text-success",
  fail: "text-destructive",
  manual: "text-warning",
  skipped: "text-muted-foreground/60",
};

const lastRunTime = computed(() =>
  lastRun.value ? lastRun.value.toLocaleTimeString(locale.value) : "",
);
</script>

<template>
  <div class="grid gap-5 rounded-md border border-border/70 bg-card/40 p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <span
        class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/70"
      >
        {{
          lastRunTime
            ? $t(key("storage_check_last_run"), { time: lastRunTime })
            : $t(key("storage_check_not_run"))
        }}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        :loading="running"
        data-test="storage-check-run"
        @click="run"
      >
        <Play class="size-3.5" />
        {{
          lastRun ? $t(key("storage_check_rerun")) : $t(key("storage_check_run"))
        }}
      </Button>
    </div>

    <ol
      class="grid sm:gap-6"
      :class="rows.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
    >
      <li
        v-for="stage in rows"
        :key="stage.id"
        class="relative grid content-start gap-1 pb-6 pl-7 sm:pb-0 sm:pl-0 sm:pt-7"
        :data-test="`storage-check-${stage.id}`"
        :data-state="stage.state"
      >
        <template v-if="!stage.last">
          <span
            class="absolute bottom-0 left-[4px] top-4 w-px sm:hidden"
            :class="track[stage.state]"
          />
          <span
            class="absolute -right-6 left-5 top-[4px] hidden h-px sm:block"
            :class="track[stage.state]"
          />
          <span
            v-if="stage.state === 'running'"
            class="absolute -right-6 left-5 top-[4px] hidden h-px overflow-hidden text-[hsl(var(--tac-amber))] sm:block"
          >
            <span class="tac-scan-sweep block h-full" />
          </span>
        </template>
        <span
          class="absolute left-0 top-0 size-[9px] rotate-45"
          :class="node[stage.state]"
        />

        <span
          class="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {{ stage.index }} · {{ stage.name }}
        </span>
        <span class="text-xs text-muted-foreground/70">{{ stage.path }}</span>
        <span
          class="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm"
          :class="text[stage.state]"
          data-test="storage-check-result"
        >
          <CheckCircle2
            v-if="stage.state === 'ok'"
            class="size-3.5 shrink-0"
          />
          <XCircle
            v-else-if="stage.state === 'fail'"
            class="size-3.5 shrink-0"
          />
          <AlertTriangle
            v-else-if="stage.state === 'manual'"
            class="size-3.5 shrink-0"
          />
          <span class="truncate">{{ result(stage) }}</span>
        </span>
      </li>
    </ol>

    <ul
      v-if="notes.length"
      class="grid gap-1.5 border-t border-dashed border-border/70 pt-3 text-sm"
    >
      <li
        v-for="note in notes"
        :key="note.id"
        class="flex items-start gap-2"
        :data-test="`storage-check-note-${note.id}`"
      >
        <span
          class="mt-[0.2rem] shrink-0 font-mono text-[0.64rem] uppercase tracking-[0.2em]"
          :class="text[note.state]"
        >
          {{ note.index }}
        </span>
        <span class="text-muted-foreground">
          {{ note.detail }}
          <a
            v-if="note.link"
            :href="note.link"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 inline-flex items-center gap-1 whitespace-nowrap text-primary transition-colors hover:text-primary/80"
          >
            {{ $t(key("storage_check_open_file")) }}
            <ExternalLink class="size-3.5" />
          </a>
        </span>
      </li>
    </ul>
  </div>
</template>
