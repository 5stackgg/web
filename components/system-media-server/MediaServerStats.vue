<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { LucideTriangleAlert } from "lucide-vue-next";

// What the one media server is carrying right now.
//
// Game streams, player cameras, voice and video calls all share a single
// MediaMTX instance and a single muxed UDP port on this deployment, so this is
// the only place the load across all of them is visible at once. Read straight
// from the API rather than through Hasura: none of it is in Postgres.
type KindStats = { paths: number; ready: number; bytesReceived: number };

type Stats = {
  paths: number;
  ready: number;
  webrtcSessions: number | null;
  byKind: Record<string, KindStats>;
};

const stats = ref<Stats | null>(null);
const reachable = ref(true);
const loading = ref(false);

// Ordered by how much attention each deserves rather than alphabetically:
// game streams are the heaviest, talkback the rarest.
const KINDS = [
  "gameStreams",
  "playerCameras",
  "voice",
  "videoCalls",
  "cameraTalkback",
] as const;

let timer: ReturnType<typeof setTimeout> | null = null;

async function load() {
  loading.value = true;

  try {
    const response = await fetch(
      `https://${useRuntimeConfig().public.apiDomain}/mediamtx/stats`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = (await response.json()) as {
      reachable: boolean;
      stats: Stats | null;
    };

    reachable.value = data.reachable;
    stats.value = data.stats;
  } catch {
    reachable.value = false;
    stats.value = null;
  } finally {
    loading.value = false;
  }
}

function schedule() {
  timer = setTimeout(async () => {
    await load();
    schedule();
  }, 10_000);
}

onMounted(async () => {
  await load();
  schedule();
});

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer);
  }
});

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

const busiest = computed(() => {
  if (!stats.value) {
    return null;
  }

  return [...KINDS]
    .map((kind) => ({ kind, ...stats.value!.byKind[kind] }))
    .filter((row) => row.paths > 0)
    .sort((left, right) => right.bytesReceived - left.bytesReceived);
});
</script>

<template>
  <div class="space-y-4">
    <!-- An outage must not be drawn as an idle server: zeroes here would read
         as "nothing is happening" when the truth is "we cannot see". -->
    <div
      v-if="!reachable"
      class="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5"
    >
      <LucideTriangleAlert class="h-4 w-4 shrink-0 text-destructive" />
      <p class="text-xs leading-snug text-destructive">
        {{ $t("pages.system_media_server.media_server_unreachable") }}
      </p>
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border bg-card/40 px-3 py-2.5">
          <p
            class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("pages.system_media_server.media_server_live") }}
          </p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ stats.ready }}
          </p>
        </div>
        <div class="rounded-lg border bg-card/40 px-3 py-2.5">
          <p
            class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("pages.system_media_server.media_server_paths") }}
          </p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ stats.paths }}
          </p>
        </div>
        <div class="rounded-lg border bg-card/40 px-3 py-2.5">
          <p
            class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{
              $t("pages.system_media_server.media_server_sessions")
            }}
          </p>
          <p class="mt-1 text-xl font-semibold tabular-nums">
            {{ stats.webrtcSessions ?? "—" }}
          </p>
        </div>
      </div>

      <!-- The two numbers are easy to read as the same thing and are not. -->
      <p class="text-[11px] leading-relaxed text-muted-foreground/70">
        {{ $t("pages.system_media_server.legend") }}
      </p>

      <div v-if="busiest?.length" class="space-y-1.5">
        <div
          v-for="row in busiest"
          :key="row.kind"
          class="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
        >
          <span class="truncate text-xs font-medium">
            {{
              $t(`pages.system_media_server.media_kind.${row.kind}`)
            }}
          </span>
          <span
            class="shrink-0 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            {{
              $t("pages.system_media_server.media_server_row", {
                ready: row.ready,
                paths: row.paths,
                bytes: formatBytes(row.bytesReceived),
              })
            }}
          </span>
        </div>
      </div>

      <p v-else class="text-xs text-muted-foreground/70">
        {{ $t("pages.system_media_server.media_server_idle") }}
      </p>
    </template>
  </div>
</template>
