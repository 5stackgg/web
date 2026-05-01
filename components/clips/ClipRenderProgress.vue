<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { CheckCircle2, Loader2, AlertCircle, Download } from "lucide-vue-next";
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

// Subscribes to a clip_render_jobs row and surfaces queued / rendering
// / uploading / done / error transitions. On `done`, fetches the
// resulting match_clips row and exposes its s3 url so the user can
// download or jump straight to their library. Same subscription pattern
// as composables/useDemoPlayback.ts.
const props = defineProps<{ jobId: string }>();
const emit = defineEmits<{ (e: "close"): void }>();
// Holding nuxtApp instead of destructuring `$apollo`: vue-apollo's
// global `beforeCreate` mixin does `this.$apollo = ...`, and a
// `<script setup>` binding called `$apollo` would be read-only on the
// component proxy, making that mixin throw and unmount the component.
const nuxtApp = useNuxtApp();

const job = ref<null | {
  id: string;
  status: string;
  progress: number | null;
  error_message: string | null;
  clip_id: string | null;
}>(null);
const clip = ref<null | { id: string; download_url: string; title?: string }>(null);
const cancelling = ref(false);

let activeSub: { unsubscribe: () => void } | null = null;

function subscribe(jobId: string) {
  activeSub?.unsubscribe();
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      // Cast: clip_render_jobs is not in zeus yet (server schema lands
      // separately). Same pattern as match_demo_sessions before its
      // migration ran — see composables/useDemoPlayback.ts.
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
        cancelClipRender: [
          { job_id: job.value.id },
          { success: true },
        ],
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
      return "Queued — waiting for a render slot";
    case "rendering":
      return "Rendering on the game-streamer pod";
    case "uploading":
      return "Uploading to your library";
    case "done":
      return "Done";
    case "error":
    case "errored":
      return "Render failed";
    default:
      return "Submitting…";
  }
});
const isDone = computed(() => job.value?.status === "done");
const isError = computed(
  () => job.value?.status === "error" || job.value?.status === "errored",
);
const progressPct = computed(() => {
  if (isDone.value) return 100;
  const p = job.value?.progress;
  if (typeof p !== "number") return 0;
  return Math.max(0, Math.min(100, Math.round(p * 100)));
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <CheckCircle2 v-if="isDone" class="h-5 w-5 text-emerald-400" />
      <AlertCircle v-else-if="isError" class="h-5 w-5 text-destructive" />
      <Loader2 v-else class="h-5 w-5 animate-spin text-muted-foreground" />
      <span class="text-sm">{{ statusLabel }}</span>
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
        Cancel render
      </Button>
      <Button v-if="isDone && clip?.download_url" variant="outline" size="sm" as-child>
        <a :href="`${clip.download_url}&dl=1`" download>
          <Download class="h-4 w-4 mr-2" />
          Download
        </a>
      </Button>
      <Button v-if="isDone && clip?.id" size="sm" as-child>
        <NuxtLink :to="`/clips/${clip.id}`">Open clip</NuxtLink>
      </Button>
      <Button v-else-if="isDone" size="sm" as-child>
        <NuxtLink to="/clips">Open library</NuxtLink>
      </Button>
      <Button
        v-if="isDone || isError"
        variant="ghost"
        size="sm"
        @click="$emit('close')"
      >
        Close
      </Button>
    </div>
  </div>
</template>
