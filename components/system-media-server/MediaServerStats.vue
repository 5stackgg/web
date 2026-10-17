<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight, Logs, RefreshCw, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import MetricSpark from "~/components/system-metrics/MetricSpark.vue";
import { dateLocale } from "~/utilities/dateLocale";
import {
  MEDIA_KINDS,
  kindRows,
  pushHistory,
  unusedKinds,
  type MediaStats,
} from "~/components/system-media-server/mediaStats";

// What the one media server is carrying right now.
//
// Game streams, player cameras, voice and video calls all share a single
// MediaMTX instance and a single muxed UDP port on this deployment, so this is
// the only place the load across all of them is visible at once. Read straight
// from the API rather than through Hasura: none of it is in Postgres.
const POLL_MS = 10_000;

const { t } = useI18n();
const config = useRuntimeConfig();

const stats = ref<MediaStats | null>(null);
const reachable = ref<boolean | null>(null);
const updatedAt = ref<number | null>(null);
const downSince = ref<number | null>(null);
const now = ref(Date.now());
const howToOpen = ref(false);

// Kept while the page is open, for the tiles' lines. The api has no history.
const history = ref({
  ready: [] as number[],
  paths: [] as number[],
  sessions: [] as Array<number | null>,
});

let timer: ReturnType<typeof setTimeout> | null = null;
let clock: ReturnType<typeof setInterval> | null = null;
// Bumped by a manual refresh (and on unmount) so a poll already in flight
// does not schedule a second loop when it lands.
let generation = 0;
let alive = true;

async function load() {
  try {
    const response = await fetch(
      `https://${config.public.apiDomain}/mediamtx/stats`,
      { credentials: "include" },
    );

    if (!response.ok) {
      throw new Error(String(response.status));
    }

    const data = (await response.json()) as {
      reachable: boolean;
      stats: MediaStats | null;
    };

    reachable.value = data.reachable && !!data.stats;
    stats.value = data.stats;
  } catch {
    reachable.value = false;
    stats.value = null;
  }

  now.value = Date.now();
  if (reachable.value && stats.value) {
    updatedAt.value = now.value;
    downSince.value = null;
    history.value = {
      ready: pushHistory(history.value.ready, stats.value.ready),
      paths: pushHistory(history.value.paths, stats.value.paths),
      sessions: pushHistory(history.value.sessions, stats.value.webrtcSessions),
    };
  } else if (downSince.value == null) {
    downSince.value = now.value;
  }
}

function schedule() {
  if (!alive) {
    return;
  }
  const mine = ++generation;
  timer = setTimeout(async () => {
    await load();
    if (mine === generation) {
      schedule();
    }
  }, POLL_MS);
}

async function refresh() {
  if (timer) {
    clearTimeout(timer);
  }
  generation++;
  await load();
  schedule();
}

onMounted(async () => {
  clock = setInterval(() => {
    now.value = Date.now();
  }, 1_000);
  await load();
  schedule();
});

onBeforeUnmount(() => {
  alive = false;
  generation++;
  if (timer) {
    clearTimeout(timer);
  }
  if (clock) {
    clearInterval(clock);
  }
});

const hhmm = (value: number) =>
  new Date(value).toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

const statusLine = computed(() => {
  if (!reachable.value) {
    return t("pages.system_media_server.status_unreachable", {
      time: hhmm(downSince.value ?? now.value),
    });
  }
  const seconds = Math.max(
    0,
    Math.round((now.value - (updatedAt.value ?? now.value)) / 1000),
  );
  return seconds < 2
    ? t("pages.system_media_server.status_reachable_now")
    : t("pages.system_media_server.status_reachable_ago", { seconds });
});

const tiles = computed(() => {
  const s = reachable.value ? stats.value : null;
  return [
    {
      key: "ready",
      label: t("pages.system_media_server.media_server_live"),
      tip: t("pages.system_media_server.tip_publishing"),
      value: s ? s.ready : null,
      sub:
        s && s.paths
          ? t("pages.system_media_server.of_paths", { count: s.paths }, s.paths)
          : "",
      series: history.value.ready,
    },
    {
      key: "paths",
      label: t("pages.system_media_server.media_server_paths"),
      tip: t("pages.system_media_server.tip_paths"),
      value: s ? s.paths : null,
      sub: "",
      series: history.value.paths,
    },
    {
      key: "sessions",
      label: t("pages.system_media_server.media_server_sessions"),
      tip: t("pages.system_media_server.tip_sessions"),
      // Null when MediaMTX answered for paths but not for sessions.
      value: s ? s.webrtcSessions : null,
      sub: "",
      series: history.value.sessions,
    },
  ];
});

const rows = computed(() => (stats.value ? kindRows(stats.value) : []));
const unused = computed(() =>
  stats.value
    ? unusedKinds(stats.value)
        .map((kind) => t(`pages.system_media_server.media_kind.${kind}`))
        .join(", ")
    : "",
);

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

const term =
  "cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px]";
const sparkMax = (series: Array<number | null>) =>
  Math.max(1, ...series.filter((v): v is number => v != null)) * 1.15;
</script>

<template>
  <ManageSection>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        v-if="reachable !== null"
        class="inline-flex items-center gap-2 text-[13px] tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        <span v-if="reachable" class="relative flex h-2 w-2 shrink-0">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden"
          />
          <span class="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span v-else class="h-2 w-2 shrink-0 rounded-full bg-destructive" />
        {{ statusLine }}
      </span>
      <span class="grow" />
      <Button variant="ghost" size="sm" @click="refresh">
        <RefreshCw />
        {{ $t("common.refresh") }}
      </Button>
      <Button as-child variant="outline" size="sm">
        <NuxtLink :to="{ path: '/system-logs', query: { tab: 'mediamtx' } }">
          <Logs />
          {{ $t("pages.system_media_server.logs_button") }}
        </NuxtLink>
      </Button>
    </div>

    <!-- An outage must not be drawn as an idle server: zeroes here would read
         as "nothing is happening" when the truth is "we cannot see". -->
    <div
      v-if="reachable === false"
      class="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-3"
    >
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p class="text-[13px] leading-snug text-destructive">
        {{ $t("pages.system_media_server.media_server_unreachable") }}
      </p>
    </div>

    <!-- Two across on phones; an odd last tile takes the full row. -->
    <div
      v-if="reachable === null"
      class="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      <Skeleton
        v-for="i in 3"
        :key="i"
        class="h-[6.5rem] rounded-lg max-sm:odd:last:col-span-2"
      />
    </div>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div
        v-for="tile of tiles"
        :key="tile.key"
        class="grid min-w-0 gap-1.5 rounded-lg border border-border bg-card/40 px-4 py-3.5 max-sm:odd:last:col-span-2"
      >
        <FiveStackToolTip as-child :delay-duration="0">
          <template #trigger>
            <span
              tabindex="0"
              class="justify-self-start text-[12.5px] text-muted-foreground"
              :class="term"
            >
              {{ tile.label }}
            </span>
          </template>
          <span class="block max-w-[18rem]">{{ tile.tip }}</span>
        </FiveStackToolTip>
        <span class="flex items-baseline gap-2 max-sm:flex-wrap">
          <span
            v-if="tile.value == null"
            class="text-3xl font-bold leading-none text-muted-foreground"
          >
            —
          </span>
          <span v-else class="text-3xl font-bold leading-none tabular-nums">
            {{ tile.value.toLocaleString() }}
          </span>
          <small
            v-if="tile.sub"
            class="text-[13px] font-medium text-muted-foreground"
          >
            {{ tile.sub }}
          </small>
        </span>
        <span v-if="tile.value == null" class="text-xs text-muted-foreground">
          {{
            reachable
              ? $t("common.unknown")
              : $t("pages.system_media_server.unknown_while_unreachable")
          }}
        </span>
        <MetricSpark
          v-else-if="tile.series.length > 1"
          :values="tile.series"
          :max="sparkMax(tile.series)"
          :height="26"
        />
      </div>
    </div>

    <div class="grid justify-items-start">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        :aria-expanded="howToOpen"
        @click="howToOpen = !howToOpen"
      >
        <ChevronRight
          class="h-3.5 w-3.5 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          :class="howToOpen && 'rotate-90'"
        />
        {{ $t("pages.system_media_server.how_to_read") }}
      </button>
      <Fold :open="howToOpen">
        <div
          class="grid max-w-[76ch] gap-2 pt-2 text-[12.5px] leading-relaxed text-muted-foreground"
        >
          <p>{{ $t("pages.system_media_server.description") }}</p>
          <p>{{ $t("pages.system_media_server.legend") }}</p>
        </div>
      </Fold>
    </div>
  </ManageSection>

  <ManageSection :label="$t('pages.system_media_server.by_feature')">
    <FadeSwap>
      <div v-if="reachable === null" key="loading" aria-busy="true">
        <Skeleton class="h-40 w-full rounded-lg" />
      </div>

      <p
        v-else-if="!reachable"
        key="unknown"
        class="rounded-lg border border-dashed border-border px-4 py-3.5 text-[13px] text-muted-foreground"
      >
        {{ $t("pages.system_media_server.kinds_unknown") }}
      </p>

      <SectionEmpty
        v-else-if="!rows.length"
        key="idle"
        :title="$t('pages.system_media_server.idle_title')"
        :description="$t('pages.system_media_server.idle_hint')"
      />

      <div v-else key="table" class="grid gap-2.5">
        <div class="overflow-x-auto rounded-lg border border-border bg-card/20">
          <table class="w-full min-w-[520px] text-sm">
            <thead>
              <tr
                class="border-b border-border text-left text-xs text-muted-foreground"
              >
                <th class="px-3.5 py-2.5 font-medium">
                  {{ $t("pages.system_telemetry.features.feature") }}
                </th>
                <th class="px-3.5 py-2.5 text-right font-medium">
                  <FiveStackToolTip as-child :delay-duration="0">
                    <template #trigger>
                      <span tabindex="0" :class="term">
                        {{ $t("common.live") }}
                      </span>
                    </template>
                    <span class="block max-w-[18rem] text-left">
                      {{ $t("pages.system_media_server.tip_publishing") }}
                    </span>
                  </FiveStackToolTip>
                </th>
                <th class="px-3.5 py-2.5 text-right font-medium">
                  <FiveStackToolTip as-child :delay-duration="0">
                    <template #trigger>
                      <span tabindex="0" :class="term">
                        {{ $t("pages.system_media_server.received") }}
                      </span>
                    </template>
                    <span class="block max-w-[18rem] text-left">
                      {{ $t("pages.system_media_server.received_hint") }}
                    </span>
                  </FiveStackToolTip>
                </th>
                <th class="w-[34%] px-3.5 py-2.5 font-medium">
                  {{ $t("pages.system_media_server.share_received") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row of rows"
                :key="row.kind"
                class="border-b border-border/40 last:border-0"
              >
                <td class="px-3.5 py-2.5">
                  <span class="inline-flex items-center gap-2 font-semibold">
                    <span
                      class="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      :style="{ background: MEDIA_KINDS[row.kind] }"
                    />
                    {{ $t(`pages.system_media_server.media_kind.${row.kind}`) }}
                  </span>
                </td>
                <td class="px-3.5 py-2.5 text-right tabular-nums">
                  <span class="font-semibold">{{ row.ready }}</span>
                  <span class="text-muted-foreground">/{{ row.paths }}</span>
                </td>
                <td class="px-3.5 py-2.5 text-right tabular-nums">
                  {{ formatBytes(row.bytesReceived) }}
                </td>
                <td class="px-3.5 py-2.5">
                  <div class="flex items-center gap-2.5">
                    <span
                      class="block h-1 grow overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <span
                        class="block h-full origin-left rounded-full transition-transform [transition-duration:600ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                        :style="{
                          transform: `scaleX(${row.share})`,
                          background: MEDIA_KINDS[row.kind],
                        }"
                      />
                    </span>
                    <span
                      class="w-9 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {{ Math.round(row.share * 100) }}%
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="unused" class="text-[12.5px] text-muted-foreground/80">
          {{ $t("pages.system_media_server.not_in_use", { kinds: unused }) }}
        </p>
      </div>
    </FadeSwap>
  </ManageSection>
</template>
