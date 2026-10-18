<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight, Logs, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import LiveStamp from "~/components/admin/LiveStamp.vue";
import StatTile from "~/components/admin/StatTile.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import NodeSpark from "~/components/game-server-nodes/NodeSpark.vue";
import type { StatPoint } from "~/components/game-server-nodes/nodeMetrics";
import { timeLabel } from "~/components/game-server-nodes/nodeFormat";
import { useRememberedView } from "~/composables/useRememberedView";
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
const view = useRememberedView("media-server", { howTo: false });

// Kept while the page is open, for the tiles' lines. The api has no history.
const history = ref({
  ready: [] as StatPoint[],
  paths: [] as StatPoint[],
  sessions: [] as StatPoint[],
});

let timer: ReturnType<typeof setTimeout> | null = null;
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

  const now = Date.now();
  if (reachable.value && stats.value) {
    updatedAt.value = now;
    downSince.value = null;
    const point = (v: number | null) => ({ t: now, v });
    history.value = {
      ready: pushHistory(history.value.ready, point(stats.value.ready)),
      paths: pushHistory(history.value.paths, point(stats.value.paths)),
      sessions: pushHistory(
        history.value.sessions,
        point(stats.value.webrtcSessions),
      ),
    };
  } else if (downSince.value == null) {
    downSince.value = now;
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
  await load();
  schedule();
});

onBeforeUnmount(() => {
  alive = false;
  generation++;
  if (timer) {
    clearTimeout(timer);
  }
});

// "Reachable · updated 5s ago · refreshes every 10 s", or since when it
// stopped answering. While down there is no fresh reading to date.
const status = computed(() =>
  reachable.value
    ? t("pages.system_media_server.status_reachable")
    : t("pages.system_media_server.status_unreachable_since", {
        time: timeLabel(downSince.value ?? Date.now()),
      }),
);

const tiles = computed(() => {
  const s = reachable.value ? stats.value : null;
  return [
    {
      key: "ready",
      label: t("pages.system_media_server.media_server_live"),
      tip: t("pages.system_media_server.tip_publishing"),
      value: s ? s.ready : null,
      aside:
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
      aside: "",
      series: history.value.paths,
    },
    {
      key: "sessions",
      label: t("pages.system_media_server.media_server_sessions"),
      tip: t("pages.system_media_server.tip_sessions"),
      // Null when MediaMTX answered for paths but not for sessions.
      value: s ? s.webrtcSessions : null,
      aside: "",
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
const sparkMax = (series: StatPoint[]) =>
  Math.max(1, ...series.map((p) => p.v).filter((v): v is number => v != null)) *
  1.15;
</script>

<template>
  <ManageSection>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LiveStamp
        v-if="reachable !== null"
        class="min-w-0 max-w-full"
        :at="reachable ? updatedAt : null"
        :live="!!reachable"
        :tone="reachable ? 'ok' : 'bad'"
        :status="status"
        :every="POLL_MS"
        @refresh="refresh"
      />
      <span class="grow" />
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
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" :class="TONE_TEXT.bad" />
      <p class="text-[13px] leading-snug" :class="TONE_TEXT.bad">
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
      <StatTile
        v-for="tile of tiles"
        :key="tile.key"
        :label="tile.label"
        :tip="tile.tip"
        :value="tile.value"
        class="max-sm:odd:last:col-span-2"
      >
        <template v-if="tile.aside" #aside>{{ tile.aside }}</template>
        <template #sub>
          <template v-if="tile.value == null">
            {{
              reachable
                ? $t("common.unknown")
                : $t("pages.system_media_server.unknown_while_unreachable")
            }}
          </template>
          <NodeSpark
            v-else-if="tile.series.length > 1"
            class="mt-1"
            tone="mem"
            :points="tile.series"
            :from="tile.series[0].t"
            :to="tile.series[tile.series.length - 1].t"
            :max="sparkMax(tile.series)"
          />
        </template>
      </StatTile>
    </div>

    <div class="grid justify-items-start">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        :aria-expanded="view.howTo"
        @click="view.howTo = !view.howTo"
      >
        <ChevronRight
          class="h-3.5 w-3.5 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          :class="view.howTo && 'rotate-90'"
        />
        {{ $t("pages.system_media_server.how_to_read") }}
      </button>
      <Fold :open="view.howTo">
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

      <SectionEmpty
        v-else-if="!reachable"
        key="unknown"
        :title="$t('pages.system_media_server.kinds_unknown_title')"
        :description="$t('pages.system_media_server.kinds_unknown')"
      />

      <SectionEmpty
        v-else-if="!rows.length"
        key="idle"
        :title="$t('pages.system_media_server.idle_title')"
        :description="$t('pages.system_media_server.idle_hint')"
      />

      <div v-else key="table" class="grid gap-2.5">
        <div class="overflow-x-auto rounded-lg border border-border bg-card/20">
          <!-- Phones drop the share bar; its percentage rides under the
               bytes instead, so nothing scrolls sideways. -->
          <table class="w-full text-sm md:min-w-[520px]">
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
                <th
                  class="hidden w-[34%] px-3.5 py-2.5 font-medium md:table-cell"
                >
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
                  <span class="text-xs text-muted-foreground md:hidden">
                    ({{ Math.round(row.share * 100) }}%)
                  </span>
                </td>
                <td class="hidden px-3.5 py-2.5 md:table-cell">
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
