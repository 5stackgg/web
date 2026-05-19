<script setup lang="ts">
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";

const { t } = useI18n();
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useToast } from "~/components/ui/toast/use-toast";
import PageHeading from "~/components/PageHeading.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import GameServerNodeDisplay from "~/components/game-server-nodes/GameServerNodeDisplay.vue";
import NodeGpuMetrics from "~/components/system-metrics/NodeGpuMetrics.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  Cpu,
  Radio,
  PlayCircle,
  Film,
  CheckCircle2,
  Square,
} from "lucide-vue-next";
import { useGpuAvailability } from "~/composables/useGpuAvailability";
import { generateMutation } from "~/graphql/graphqlGen";

definePageMeta({
  middleware: "admin",
});

const { status: poolStatus } = useGpuAvailability();
const { toast } = useToast();
const { client: apolloClient } = useApolloClient();

// Two-stage confirm so a stray click can't kill an operator's live
// match — first click flips the button into "Confirm Stop" for 5s,
// the second actually fires the mutation. `busyByNodeId` blocks
// re-entrancy while the request is in flight.
const confirmStopByNodeId = reactive<Record<string, boolean>>({});
const busyByNodeId = reactive<Record<string, boolean>>({});

async function stopGpuSession(nodeId: string) {
  if (busyByNodeId[nodeId]) return;
  if (!confirmStopByNodeId[nodeId]) {
    confirmStopByNodeId[nodeId] = true;
    setTimeout(() => {
      confirmStopByNodeId[nodeId] = false;
    }, 5000);
    return;
  }
  confirmStopByNodeId[nodeId] = false;
  busyByNodeId[nodeId] = true;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        stopGpuSession: [{ game_server_node_id: nodeId }, { success: true }],
      }),
    });
    toast({ title: t("toasts.gpu_session_stopped") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("toasts.stop_gpu_session"),
      description: error?.message ?? t("toasts.request_failed"),
    });
  } finally {
    busyByNodeId[nodeId] = false;
  }
}

const summaryTiles = computed(() => {
  const s = poolStatus.value;
  return [
    {
      key: "total",
      label: "GPU Nodes",
      value: s ? s.total_gpu_nodes : "—",
      icon: Cpu,
    },
    {
      key: "free",
      label: "Free",
      value: s ? s.free_gpu_nodes : "—",
      icon: CheckCircle2,
      tone:
        s && s.total_gpu_nodes > 0 && s.free_gpu_nodes === 0 ? "warn" : "ok",
    },
    {
      key: "live",
      label: "Live Streams",
      value: s ? (s.live_in_progress ? "Active" : "Idle") : "—",
      icon: Radio,
      tone: s?.live_in_progress ? "active" : "muted",
    },
    {
      key: "demo",
      label: "Demo Playback",
      value: s ? (s.demo_in_progress ? "Active" : "Idle") : "—",
      icon: PlayCircle,
      tone: s?.demo_in_progress ? "active" : "muted",
    },
    {
      key: "highlights",
      label: "Highlights Render",
      value: s ? (s.highlights_in_progress ? "Active" : "Idle") : "—",
      icon: Film,
      tone: s?.highlights_in_progress ? "active" : "muted",
    },
  ];
});
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{ $t("pages.gpu_nodes.title") }}</template>
      <template #description>{{ $t("pages.gpu_nodes.description") }}</template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card
        v-for="tile in summaryTiles"
        :key="tile.key"
        variant="gradient"
        class="p-4 flex items-center gap-3"
      >
        <component
          :is="tile.icon"
          class="w-5 h-5 shrink-0 text-muted-foreground"
        />
        <div class="flex flex-col">
          <span class="text-xs text-muted-foreground">{{ tile.label }}</span>
          <span
            class="text-base font-semibold"
            :class="{
              'text-yellow-500': tile.tone === 'warn',
              'text-green-500': tile.tone === 'ok' || tile.tone === 'active',
              'text-muted-foreground': tile.tone === 'muted',
            }"
          >
            {{ tile.value }}
          </span>
        </div>
      </Card>
    </div>
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <div v-if="gpuNodes.length > 0" class="space-y-4">
      <Card
        v-for="node in gpuNodes"
        :key="node.id"
        variant="gradient"
        class="p-5 space-y-4"
      >
        <div class="flex flex-wrap items-start gap-4 justify-between">
          <div class="min-w-0 flex-1">
            <GameServerNodeDisplay :game-server-node="node" />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              class="font-mono uppercase tracking-wider text-xs"
            >
              {{ node.e_region?.description || node.region || "—" }}
            </Badge>
            <Badge
              :variant="
                node.enabled && node.status === 'Online'
                  ? 'default'
                  : 'secondary'
              "
            >
              {{ node.status }}<span v-if="!node.enabled"> · Disabled</span>
            </Badge>
            <div
              v-if="busyByNode[node.id]"
              class="flex items-center gap-2 rounded-md border border-yellow-700/40 bg-yellow-500/5 px-2.5 py-1"
            >
              <component
                :is="busyByNode[node.id].icon"
                class="w-3.5 h-3.5 text-yellow-500 shrink-0"
              />
              <div class="flex flex-col leading-tight">
                <span class="text-xs font-medium">
                  {{ busyByNode[node.id].label }}
                  <span class="text-muted-foreground font-normal">
                    · {{ busyByNode[node.id].who }}
                  </span>
                </span>
                <NuxtLink
                  v-if="busyByNode[node.id].matchId"
                  :to="{
                    name: 'matches-id',
                    params: { id: busyByNode[node.id].matchId },
                  }"
                  class="text-[10px] text-muted-foreground hover:underline truncate max-w-[260px]"
                >
                  {{ busyByNode[node.id].subline }}
                </NuxtLink>
                <span
                  v-else
                  class="text-[10px] text-muted-foreground truncate max-w-[260px]"
                >
                  {{ busyByNode[node.id].subline }}
                </span>
              </div>
            </div>
            <Button
              v-if="busyByNode[node.id]"
              size="sm"
              :variant="
                confirmStopByNodeId[node.id] ? 'destructive' : 'outline'
              "
              :disabled="busyByNodeId[node.id]"
              class="h-7 px-2 text-xs"
              @click="stopGpuSession(node.id)"
            >
              <Square class="w-3.5 h-3.5 mr-1" />
              {{ confirmStopByNodeId[node.id] ? "Confirm Stop" : "Stop" }}
            </Button>
            <Badge
              v-else
              variant="outline"
              class="text-green-500 border-green-700/40"
            >
              {{ $t("pages.gpu_nodes.idle") }}
            </Badge>
          </div>
        </div>

        <div
          v-if="node.gpu_info && node.gpu_info.length"
          class="flex flex-wrap gap-2 text-xs"
        >
          <span
            v-for="(dev, i) in node.gpu_info"
            :key="`${node.id}-static-gpu-${i}`"
            class="rounded-md border border-border/60 bg-card/50 px-2 py-1"
          >
            <span class="font-medium">{{ dev.name }}</span>
            <span v-if="dev.memory_mb" class="text-muted-foreground">
              · {{ Math.round(dev.memory_mb / 1024) }} GB
            </span>
          </span>
        </div>

        <NodeGpuMetrics
          :node-id="node.id"
          :node-label="node.label || ''"
          :show-label="false"
          :show-quick-stats="true"
          :show-charts="true"
          :compact-charts="false"
        />
      </Card>
    </div>

    <Card v-else-if="!loading" variant="gradient">
      <Empty class="min-h-[200px]">
        <EmptyTitle>{{ $t("pages.gpu_nodes.empty.title") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.gpu_nodes.empty.description") }}
        </EmptyDescription>
      </Empty>
    </Card>
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { Radio, PlayCircle, Film } from "lucide-vue-next";

type BusyEntry = {
  kind: "live" | "demo" | "highlights";
  label: string;
  who: string;
  subline: string;
  matchId?: string;
  icon: any;
};

export default {
  data() {
    return {
      loading: true,
      gpuNodes: [] as any[],
      liveStreams: [] as any[],
      demoSessions: [] as any[],
      renderJobs: [] as any[],
    };
  },
  computed: {
    busyByNode(): Record<string, BusyEntry> {
      const map: Record<string, BusyEntry> = {};

      const matchupOf = (m: any) => {
        const a = m?.lineup_1?.name;
        const b = m?.lineup_2?.name;
        return a && b ? `${a} vs ${b}` : null;
      };

      for (const stream of this.liveStreams) {
        if (!stream.game_server_node_id) continue;
        map[stream.game_server_node_id] = {
          kind: "live",
          label: stream.mode === "tv" ? "Live (GOTV)" : "Live (Direct)",
          who: matchupOf(stream.match) || "Live match",
          subline: matchupOf(stream.match) || "Live match",
          matchId: stream.match_id,
          icon: Radio,
        };
      }

      for (const session of this.demoSessions) {
        if (!session.game_server_node_id) continue;
        if (map[session.game_server_node_id]) continue;
        const watcher = session.watcher?.name || "Unknown user";
        map[session.game_server_node_id] = {
          kind: "demo",
          label: "Demo Playback",
          who: watcher,
          subline: matchupOf(session.match) || "Demo playback",
          matchId: session.match_id,
          icon: PlayCircle,
        };
      }

      for (const job of this.renderJobs) {
        if (!job.game_server_node_id) continue;
        if (map[job.game_server_node_id]) continue;
        const who =
          job.user?.name || (job.user_steam_id ? "Unknown user" : "System");
        map[job.game_server_node_id] = {
          kind: "highlights",
          label: "Highlights Render",
          who,
          subline: matchupOf(job.match_map?.match) || "Highlight render",
          matchId: job.match_map?.match?.id,
          icon: Film,
        };
      }

      return map;
    },
  },
  apollo: {
    $subscribe: {
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {
              where: { gpu: { _eq: true } } as any,
              order_by: [{ label: "asc" as any }],
            },
            {
              id: true,
              label: true,
              status: true,
              enabled: true,
              region: true,
              gpu: true,
              gpu_info: true,
              public_ip: true,
              lan_ip: true,
              offline_at: true,
              e_region: { description: true },
              e_status: { description: true },
            },
          ],
        }),
        result(this: any, { data }: any) {
          this.gpuNodes = data?.game_server_nodes ?? [];
          this.loading = false;
        },
        error(this: any) {
          this.loading = false;
        },
      },
      match_streams: {
        query: typedGql("subscription")({
          match_streams: [
            {
              where: {
                is_game_streamer: { _eq: true },
                status: { _neq: "errored" },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              match_id: true,
              status: true,
              mode: true,
              is_live: true,
              game_server_node_id: true,
              match: {
                id: true,
                lineup_1: { name: true },
                lineup_2: { name: true },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.liveStreams = data?.match_streams ?? [];
        },
      },
      match_demo_sessions: {
        query: typedGql("subscription")({
          match_demo_sessions: [
            {
              where: {
                status: { _neq: "errored" },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              match_id: true,
              status: true,
              game_server_node_id: true,
              created_at: true,
              watcher: { steam_id: true, name: true },
              match: {
                id: true,
                lineup_1: { name: true },
                lineup_2: { name: true },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.demoSessions = data?.match_demo_sessions ?? [];
        },
      },
      clip_render_jobs: {
        query: typedGql("subscription")({
          clip_render_jobs: [
            {
              where: {
                status: { _in: ["queued", "rendering", "uploading"] },
                game_server_node_id: { _is_null: false },
              } as any,
            },
            {
              id: true,
              status: true,
              game_server_node_id: true,
              user_steam_id: true,
              user: { steam_id: true, name: true },
              match_map: {
                id: true,
                match: {
                  id: true,
                  lineup_1: { name: true },
                  lineup_2: { name: true },
                },
              },
            } as any,
          ],
        } as any),
        result(this: any, { data }: any) {
          this.renderJobs = data?.clip_render_jobs ?? [];
        },
      },
    },
  },
};
</script>
