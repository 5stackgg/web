<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Check, Minus, Play, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { generateMutation } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { checkBackblazeWorker } from "~/utilities/backblazeWorkerHealth";

type StageId = "write" | "read" | "edge";
type StageState = "idle" | "running" | "ok" | "fail" | "manual" | "skipped";
type Stage = { state: StageState; detail?: string };

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

async function read() {
  stages.value.read = { state: "running" };
  const start = performance.now();
  try {
    const { data } = await client.mutate({
      mutation: generateMutation({ testDownload: { error: true } }),
    });
    const error = data?.testDownload?.error;
    stages.value.read = error
      ? { state: "fail", detail: error }
      : { state: "ok", detail: took(start) };
  } catch (error) {
    stages.value.read = { state: "fail", detail: (error as Error).message };
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
    number: index + 1,
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
  idle: "border-border bg-background text-muted-foreground",
  running:
    "border-[hsl(var(--tac-amber))] bg-background text-[hsl(var(--tac-amber))] motion-safe:animate-pulse",
  ok: "border-success/60 bg-success/15 text-success",
  fail: "border-destructive/60 bg-destructive/15 text-destructive",
  manual: "border-warning/60 bg-warning/15 text-warning",
  skipped: "border-border bg-background text-muted-foreground/50",
};

// Painted over a plain hairline and scaled in from the step that just
// finished, so the line fills toward the next step instead of changing colour.
const fill: Record<StageState, string> = {
  idle: "",
  running: "",
  ok: "bg-success/60",
  fail: "bg-destructive/60",
  manual: "bg-warning/60",
  skipped: "",
};

const finished = (state: StageState) =>
  state === "ok" || state === "fail" || state === "manual";

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
      <Transition
        mode="out-in"
        enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
        leave-to-class="opacity-0"
      >
        <span
          :key="lastRunTime"
          class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/70"
        >
          {{
            lastRunTime
              ? $t(key("storage_check_last_run"), { time: lastRunTime })
              : $t(key("storage_check_not_run"))
          }}
        </span>
      </Transition>
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
        class="relative grid content-start gap-1 pb-6 pl-8 sm:pb-0 sm:pl-0 sm:pt-8"
        :data-test="`storage-check-${stage.id}`"
        :data-state="stage.state"
      >
        <template v-if="!stage.last">
          <span
            class="absolute bottom-1 left-[10px] top-6 w-px bg-border sm:hidden"
          >
            <span
              class="absolute inset-0 origin-top transition-transform duration-500 ease-out motion-reduce:transition-none"
              :class="[
                fill[stage.state],
                finished(stage.state) ? 'scale-y-100' : 'scale-y-0',
              ]"
            />
          </span>
          <span
            class="absolute -right-5 left-6 top-[10px] hidden h-px bg-border sm:block"
          >
            <span
              class="absolute inset-0 origin-left transition-transform duration-500 ease-out motion-reduce:transition-none"
              :class="[
                fill[stage.state],
                finished(stage.state) ? 'scale-x-100' : 'scale-x-0',
              ]"
            />
            <span
              v-if="stage.state === 'running'"
              class="absolute inset-0 overflow-hidden text-[hsl(var(--tac-amber))]"
            >
              <span class="tac-scan-sweep block h-full" />
            </span>
          </span>
        </template>
        <span
          class="absolute left-0 top-0 flex size-5 items-center justify-center rounded-full border font-mono text-[0.62rem] transition-[color,background-color,border-color] duration-300 motion-reduce:transition-none"
          :class="node[stage.state]"
          data-test="storage-check-step"
        >
          <Transition
            mode="out-in"
            enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
            enter-from-class="scale-50 opacity-0"
            leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
            leave-to-class="scale-50 opacity-0"
          >
            <Check
              v-if="stage.state === 'ok'"
              key="ok"
              class="size-3"
              stroke-width="3"
            />
            <X
              v-else-if="stage.state === 'fail'"
              key="fail"
              class="size-3"
              stroke-width="3"
            />
            <span
              v-else-if="stage.state === 'manual'"
              key="manual"
              class="font-bold"
            >
              !
            </span>
            <Minus
              v-else-if="stage.state === 'skipped'"
              key="skipped"
              class="size-3"
            />
            <span v-else key="number">{{ stage.number }}</span>
          </Transition>
        </span>

        <span
          class="font-mono text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          {{ stage.name }}
        </span>
        <span class="text-xs text-muted-foreground/70">{{ stage.path }}</span>
        <Transition
          mode="out-in"
          enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
          enter-from-class="translate-y-1 opacity-0"
          leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
          leave-to-class="opacity-0"
        >
          <span
            :key="`${stage.state}:${result(stage)}`"
            class="mt-1.5 truncate text-sm"
            :class="text[stage.state]"
            data-test="storage-check-result"
          >
            {{ result(stage) }}
          </span>
        </Transition>
      </li>
    </ol>

    <Transition
      enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0"
    >
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
            {{ note.name }}
          </span>
          <span class="text-muted-foreground">{{ note.detail }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>
