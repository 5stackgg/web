<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowUpRight, Square, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import SnapshotQuickView from "~/components/match/SnapshotQuickView.vue";
import InspectorLive from "~/components/game-server-nodes/InspectorLive.vue";
import NodeStatsPoll from "~/components/game-server-nodes/NodeStatsPoll.vue";
import type { MetricRangeKey } from "~/components/game-server-nodes/nodeMetrics";
import NodeControlList from "~/components/game-server-nodes/NodeControlList.vue";
import InspectorGpu from "~/components/game-server-nodes/InspectorGpu.vue";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import GpuKindIcon from "~/components/gpu-nodes/GpuKindIcon.vue";
import GpuSessionState from "~/components/gpu-nodes/GpuSessionState.vue";
import GpuShaderCache from "~/components/gpu-nodes/GpuShaderCache.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import LastChangedFor from "~/components/admin/LastChangedFor.vue";
import {
  bakeFailed,
  formatElapsed,
  gpuName,
  isMatchNode,
  nodeName,
  type GpuNodeState,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// Everything about one GPU, docked beside the tables (or in a sheet when
// there's no room). Docked wide, what it is doing now and its load take a
// left column that stays in view; the node and its switches, the GPU section
// the Game Server Nodes inspector shows (workloads, cards, video settings) and
// the shader cache run on the right. Anywhere narrower it is one column.
const props = defineProps<{
  node: any;
  session: GpuSession | null;
  bake: GpuSession | null;
  state: GpuNodeState | null;
  stateLabel: string;
}>();

const logsOpen = defineModel<boolean>("logsOpen", { default: false });

// The same Live section as the Game Server Nodes inspector: one stats poll,
// tiles at Live, time charts at 1h.
const liveStats = ref<any>(null);
const liveRange = ref<MetricRangeKey>("live");

const emit = defineEmits<{
  (e: "close"): void;
  (e: "stop", session: GpuSession): void;
  (e: "video"): void;
}>();

const { t } = useI18n();

const reachable = computed(
  () =>
    !!props.node.enabled &&
    props.node.status !== "Offline" &&
    props.node.status !== "Setup",
);

const current = computed(() => props.session ?? props.bake);

const kindKey = computed(() => {
  const session = current.value;
  if (!session) return null;
  if (session.kind === "live")
    return session.liveMode === "tv" ? "live_tv" : "live_direct";
  return session.kind;
});

const kindLabel = computed(() =>
  kindKey.value ? t(`pages.gpu_nodes.kind.${kindKey.value}`) : "",
);

const nowMeta = computed(() => {
  const session = current.value;
  if (!session) {
    return "";
  }
  const who =
    session.kind === "bake"
      ? t("pages.gpu_nodes.who.warming_cache")
      : session.kind === "live"
        ? t("pages.gpu_nodes.who.spectators")
        : session.who ||
          (session.system
            ? t("common.system")
            : t("gpu_pool_status.unknown_user"));
  return session.matchup ? `${kindLabel.value} · ${who}` : who;
});

const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  ticker = setInterval(() => (now.value = Date.now()), 15 * 1000);
});
onBeforeUnmount(() => {
  if (ticker) {
    clearInterval(ticker);
  }
});

const elapsed = computed(() =>
  current.value?.startedAt
    ? formatElapsed(now.value - current.value.startedAt)
    : null,
);

const vramGb = computed(() => {
  const mb = props.node.gpu_info?.[0]?.memory_mb;
  return mb ? Math.round(mb / 1024) : null;
});

// The left column sticks under the header, whatever height it wraps to.
const header = ref<HTMLElement | null>(null);
const headerHeight = ref(64);
let headerObserver: ResizeObserver | null = null;
onMounted(() => {
  if (!header.value || typeof ResizeObserver === "undefined") return;
  headerObserver = new ResizeObserver(() => {
    headerHeight.value = header.value?.offsetHeight ?? headerHeight.value;
  });
  headerObserver.observe(header.value);
});
onBeforeUnmount(() => headerObserver?.disconnect());
</script>

<template>
  <div :style="{ '--gpn-hdr': `${headerHeight}px` }">
    <header
      ref="header"
      class="sticky top-0 z-[3] grid gap-0.5 border-b border-border bg-[hsl(240_6%_7%)] py-3 pl-4 pr-3"
    >
      <div class="flex min-w-0 items-center gap-2">
        <StatusDot v-if="state" :tone="state.tone" :live="state.live" />
        <h2 class="min-w-0 flex-1 truncate text-base font-bold">
          {{ gpuName(node) || $t("pages.gpu_nodes.gpu_unknown") }}
        </h2>
        <FiveStackToolTip as-child :delay-duration="300" side="left">
          <template #trigger>
            <Button
              variant="ghost"
              size="icon-sm"
              class="h-8 w-8 shrink-0"
              :aria-label="$t(`${INSPECTOR}.close`)"
              @click="emit('close')"
            >
              <X class="h-4 w-4" />
            </Button>
          </template>
          {{ $t(`${INSPECTOR}.close_hint`) }}
        </FiveStackToolTip>
      </div>
      <div class="min-w-0 truncate pl-4 text-xs text-muted-foreground">
        {{ stateLabel }} ·
        <span class="font-mono text-[11.5px]">{{ nodeName(node) }}</span>
        <template v-if="vramGb">
          · <span class="tabular-nums">{{ vramGb }} GB</span></template
        >
      </div>
      <LastChangedFor type="game_server_nodes" :row="node" class="pl-4" />
    </header>

    <div class="gpn-cols">
      <div class="gpn-col gpn-col-l">
        <section class="grid gap-3 p-4">
          <div class="flex min-h-7 items-center gap-2">
            <InspectorLabel>{{
              $t("pages.gpu_nodes.sheet.now")
            }}</InspectorLabel>
            <span class="grow" />
            <Button
              v-if="session"
              size="xs"
              variant="outline"
              class="h-7 gap-1.5 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="emit('stop', session)"
            >
              <Square class="h-3 w-3" />
              {{ $t("pages.gpu_nodes.stop") }}
            </Button>
          </div>

          <div v-if="current && kindKey" class="gpn-now">
            <GpuKindIcon :kind="current.kind" class="mt-px" />
            <div class="grid min-w-0 gap-0.5">
              <NuxtLink
                v-if="current.matchup && current.matchId"
                :to="{ name: 'matches-id', params: { id: current.matchId } }"
                class="gpn-now-title group/match"
              >
                <span
                  class="min-w-0 transition-colors group-hover/match:text-[hsl(var(--tac-amber))]"
                  >{{ current.matchup }}</span
                >
                <ArrowUpRight
                  class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover/match:text-[hsl(var(--tac-amber))]"
                />
              </NuxtLink>
              <div v-else class="gpn-now-title">
                {{ current.matchup || kindLabel }}
              </div>
              <div class="text-xs leading-snug text-muted-foreground">
                {{ nowMeta
                }}<span v-if="current.account" class="font-mono">
                  · {{ current.account }}</span
                >
              </div>
            </div>
            <div class="gpn-now-state">
              <GpuSessionState :session="current" />
              <span class="grow" />
              <span
                v-if="elapsed"
                class="shrink-0 text-xs tabular-nums text-muted-foreground"
                >{{ elapsed }}</span
              >
            </div>
          </div>
          <div
            v-else-if="bakeFailed(node)"
            class="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2.5 text-[13px]"
          >
            <span class="font-semibold text-destructive">{{
              $t("pages.gpu_nodes.bake.stages.errored")
            }}</span>
            <span class="text-muted-foreground">
              · {{ $t("pages.gpu_nodes.sheet.bake_failed_hint") }}</span
            >
          </div>
          <p v-else class="text-[13px] text-muted-foreground">
            {{
              reachable
                ? $t("pages.gpu_nodes.sheet.idle_ready")
                : $t("pages.gpu_nodes.sheet.unavailable")
            }}
          </p>

          <template v-if="current">
            <SnapshotQuickView
              :kind="current.snapshotKind"
              :id="current.snapshotId"
              :force-empty="current.kind === 'highlights' && !current.booting"
              :empty-label="
                current.kind === 'highlights'
                  ? $t('match.stream.rendering_highlights')
                  : ''
              "
            />
            <BootSequence
              v-if="
                (current.booting || current.kind === 'bake') &&
                current.statusHistory
              "
              :mode="current.kind"
              :histories="[current.statusHistory]"
              :status="current.kind === 'bake' ? current.status : undefined"
              :progress="current.kind === 'bake' ? current.progress : undefined"
              :progress-stage="
                current.kind === 'bake' ? current.progressStage : undefined
              "
              :card="false"
            />
          </template>
        </section>

        <div class="border-t border-border/60">
          <template v-if="reachable">
            <NodeStatsPoll
              :node-id="node.id"
              full
              @stats="(_id: string, stats: any) => (liveStats = stats)"
            />
            <InspectorLive
              :node="node"
              :stats="liveStats"
              :range="liveRange"
              @update:range="(value) => (liveRange = value)"
            />
          </template>
          <p v-else class="p-4 text-xs text-muted-foreground">
            {{ $t("pages.gpu_nodes.sheet.no_metrics") }}
          </p>
        </div>
      </div>

      <div class="gpn-col gpn-col-r divide-y divide-border/60">
        <section class="grid gap-2.5 p-4">
          <InspectorLabel>{{ $t("pages.gpu_nodes.col.node") }}</InspectorLabel>

          <NodeControlList :node="node" />

          <div class="gpn-kv">
            <span class="gpn-k">{{ $t("pages.gpu_nodes.col.node") }}</span>
            <div class="gpn-v">
              <span class="min-w-0 truncate font-mono text-xs">{{
                nodeName(node)
              }}</span>
              <NuxtLink
                :to="{ path: '/game-server-nodes', query: { node: node.id } }"
                class="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
              >
                {{ $t("pages.game_server_nodes.title") }}
                <ArrowUpRight class="h-3 w-3" />
              </NuxtLink>
            </div>

            <span class="gpn-k">{{
              $t("pages.gpu_nodes.filter.node_type")
            }}</span>
            <div class="gpn-v">
              {{
                isMatchNode(node)
                  ? $t("pages.gpu_nodes.node_kind.match")
                  : $t("pages.gpu_nodes.node_kind.gpu")
              }}
            </div>

            <span class="gpn-k">{{ $t("common.region") }}</span>
            <div class="gpn-v">
              <span
                :class="
                  !node.e_region?.description && 'text-muted-foreground/70'
                "
                >{{
                  node.e_region?.description || $t("pages.gpu_nodes.no_region")
                }}</span
              >
            </div>

            <span class="gpn-k">{{
              $t("pages.game_server_nodes.detail.addresses")
            }}</span>
            <div class="gpn-v font-mono text-xs">
              <template v-if="node.lan_ip || node.public_ip">
                <span v-if="node.lan_ip">{{ node.lan_ip }}</span>
                <span
                  v-if="node.lan_ip && node.public_ip"
                  class="text-muted-foreground/60"
                  >/</span
                >
                <span v-if="node.public_ip">{{ node.public_ip }}</span>
              </template>
              <span
                v-else
                class="font-sans text-[13px] text-muted-foreground/70"
                >{{ $t(`${INSPECTOR}.node.ips_pending`) }}</span
              >
            </div>
          </div>
        </section>

        <InspectorGpu
          :node="node"
          :stats="liveStats"
          :session="session"
          :bake="bake"
          @edit-video="emit('video')"
        />

        <GpuShaderCache
          v-model:logs-open="logsOpen"
          :node="node"
          :bake="bake"
          :reachable="reachable"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gpn-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.gpn-col {
  min-width: 0;
  container-type: inline-size;
}
.gpn-col-l {
  border-bottom: 1px solid hsl(var(--border) / 0.6);
}
/* The docked aside is the query container; a sheet never splits. */
@container gpn-insp (min-width: 560px) {
  .gpn-cols {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .gpn-col-l {
    position: sticky;
    top: var(--gpn-hdr, 64px);
    align-self: start;
    border-bottom: 0;
  }
  .gpn-col-r {
    border-left: 1px solid hsl(var(--border) / 0.6);
  }
}
.gpn-now {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 12px;
  row-gap: 10px;
  padding: 12px;
  border: 1px solid hsl(var(--tac-amber) / 0.28);
  border-radius: 0.375rem;
  background: hsl(var(--tac-amber) / 0.04);
}
.gpn-now-title {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.gpn-now-state {
  grid-column: 2;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid hsl(var(--tac-amber) / 0.16);
}
.gpn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  font-size: 13px;
}
.gpn-k {
  color: hsl(var(--muted-foreground));
}
.gpn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
