<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import { CheckCircle2, AlertCircle, Download } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { useNuxtApp } from "#app";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { clipRenderJobFields } from "~/graphql/clipRenderJob";
import {
  clipDownloadName,
  clipDownloadUrl,
} from "~/utilities/clipDownloadName";

const props = defineProps<{ jobId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();
// Don't destructure $apollo — vue-apollo's beforeCreate mixin
// reassigns `this.$apollo`, which conflicts with a setup binding.
const nuxtApp = useNuxtApp();

const job = ref<null | {
  id: string;
  status: string;
  // Hasura serialises numeric(4,3) as a string; coerce in progressPct.
  progress: number | string | null;
  error_message: string | null;
  clip_id: string | null;
}>(null);
const clip = ref<null | { id: string; download_url: string; title?: string }>(
  null,
);
const cancelling = ref(false);

let activeSub: { unsubscribe: () => void } | null = null;

function subscribe(jobId: string) {
  activeSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Cast: clip_render_jobs lags zeus codegen.
      clip_render_jobs: [
        {
          where: { id: { _eq: jobId } },
          limit: 1,
        } as any,
        clipRenderJobFields,
      ],
    } as any),
  });
  activeSub = obs.subscribe({
    next: ({ data }: any) => {
      const row = data?.clip_render_jobs?.[0];
      job.value = row ?? null;
      if (row?.clip_id && !clip.value) void fetchClip(row.clip_id);
    },
    error: (err: any) => {
      console.error("[clip-render] subscription error:", err);
    },
  });
}

async function fetchClip(id: string) {
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      fetchPolicy: "network-only",
      query: generateQuery({
        match_clips: [
          { where: { id: { _eq: id } }, limit: 1 } as any,
          { id: true, download_url: true, title: true },
        ],
      } as any),
    });
    clip.value = (data as any)?.match_clips?.[0] ?? null;
  } catch (e) {
    console.error("[clip-render] fetch clip failed:", e);
  }
}

async function cancel() {
  if (!job.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        cancelClipRender: [{ job_id: job.value.id }, { success: true }],
      } as any),
    });
    emit("close");
  } catch (e) {
    console.error("[clip-render] cancel failed:", e);
  } finally {
    cancelling.value = false;
  }
}

watch(
  () => props.jobId,
  (id) => {
    job.value = null;
    clip.value = null;
    if (id) subscribe(id);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  activeSub?.unsubscribe();
  activeSub = null;
});

const statusLabel = computed(() => {
  switch (job.value?.status) {
    case "queued":
      return t("render_queue_status.queued_waiting");
    case "rendering":
      return t("render_queue_status.rendering_on_pod");
    case "uploading":
      return t("render_queue_status.uploading_to_library");
    case "done":
      return t("render_queue_status.done");
    case "error":
    case "errored":
      return t("render_queue_status.render_failed");
    default:
      return t("render_queue_status.submitting");
  }
});
const isDone = computed(() => job.value?.status === "done");
const isError = computed(
  () => job.value?.status === "error" || job.value?.status === "errored",
);
const progressPct = computed(() => {
  if (isDone.value) return 100;
  const raw = job.value?.progress;
  const p =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseFloat(raw)
        : NaN;
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p * 100)));
});

// Render = 0–50%, upload = 50–100% (matches inline-clip-render.sh).
const phaseStatus = computed<{
  render: "pending" | "active" | "done";
  upload: "pending" | "active" | "done";
}>(() => {
  const s = job.value?.status;
  if (isDone.value) return { render: "done", upload: "done" };
  if (s === "uploading") return { render: "done", upload: "active" };
  if (s === "rendering" || s === "queued") {
    return { render: "active", upload: "pending" };
  }
  return { render: "pending", upload: "pending" };
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <CheckCircle2 v-if="isDone" class="h-5 w-5 text-emerald-400" />
      <AlertCircle v-else-if="isError" class="h-5 w-5 text-destructive" />
      <Spinner v-else class="h-5 w-5 text-muted-foreground" />
      <span class="text-sm">{{ statusLabel }}</span>
    </div>

    <div
      v-if="!isError"
      class="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <span
        :class="[
          'flex items-center gap-1.5',
          phaseStatus.render === 'done' && 'text-emerald-400',
          phaseStatus.render === 'active' && 'text-foreground',
        ]"
      >
        <span
          :class="[
            'inline-block h-1.5 w-1.5 rounded-full',
            phaseStatus.render === 'done' && 'bg-emerald-400',
            phaseStatus.render === 'active' && 'bg-[hsl(var(--tac-amber))]',
            phaseStatus.render === 'pending' && 'bg-muted-foreground/40',
          ]"
        />
        {{ $t("clips.render_progress.render") }}
      </span>
      <span class="h-px flex-1 bg-border/60" />
      <span
        :class="[
          'flex items-center gap-1.5',
          phaseStatus.upload === 'done' && 'text-emerald-400',
          phaseStatus.upload === 'active' && 'text-foreground',
        ]"
      >
        <span
          :class="[
            'inline-block h-1.5 w-1.5 rounded-full',
            phaseStatus.upload === 'done' && 'bg-emerald-400',
            phaseStatus.upload === 'active' && 'bg-[hsl(var(--tac-amber))]',
            phaseStatus.upload === 'pending' && 'bg-muted-foreground/40',
          ]"
        />
        {{ $t("clips.render_progress.upload") }}
      </span>
    </div>

    <Progress v-if="!isError" :model-value="progressPct" class="h-2" />

    <p
      v-if="isError && job?.error_message"
      class="text-xs text-destructive font-mono"
    >
      {{ job.error_message }}
    </p>

    <div class="flex items-center justify-end gap-2 pt-2">
      <Button
        v-if="!isDone && !isError"
        variant="ghost"
        size="sm"
        :disabled="cancelling"
        @click="cancel"
      >
        {{ $t("clips.render_progress.cancel_render") }}
      </Button>
      <Button
        v-if="isDone && clip?.download_url"
        variant="outline"
        size="sm"
        as-child
      >
        <a
          :href="clipDownloadUrl(clip.download_url)"
          :download="
            clipDownloadName({
              id: clip.id,
              title: clip.title ?? null,
              download_url: clip.download_url,
            })
          "
        >
          <Download class="h-4 w-4 mr-2" />
          {{ $t("clips.render_progress.download") }}
        </a>
      </Button>
      <Button v-if="isDone && clip?.id" size="sm" as-child>
        <NuxtLink :to="`/clips/${clip.id}`">{{
          $t("clips.render_progress.open_clip")
        }}</NuxtLink>
      </Button>
      <Button v-else-if="isDone" size="sm" as-child>
        <NuxtLink to="/highlights">{{
          $t("clips.render_progress.open_library")
        }}</NuxtLink>
      </Button>
      <Button
        v-if="isDone || isError"
        variant="ghost"
        size="sm"
        @click="$emit('close')"
      >
        {{ $t("clips.render_progress.close") }}
      </Button>
    </div>
  </div>
</template>
