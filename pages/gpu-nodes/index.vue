<script setup lang="ts">
import { computed, reactive, ref } from "vue";
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
  Settings2,
  AlertTriangle,
  Trash2,
  Plus,
  Eraser,
} from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { useGpuAvailability } from "~/composables/useGpuAvailability";
import { generateMutation } from "~/graphql/graphqlGen";
import EditCs2Options from "~/components/game-server-nodes/EditCs2Options.vue";

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
const cs2OptionsNode = ref<any | null>(null);

const showAddSteamAccount = ref(false);
const newSteamUsername = ref("");
const newSteamPassword = ref("");
const deleteSteamTarget = ref<{ id: string; username: string } | null>(null);
const clearCacheTarget = ref<{ id: string; label: string } | null>(null);

async function toggleSteamAccountEnabled(
  account: { id: string },
  enabled: boolean,
) {
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        update_steam_accounts_by_pk: [
          { pk_columns: { id: account.id }, _set: { enabled } },
          { id: true },
        ],
      }),
    });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.steam_pool.toggle_failed"),
      description: error?.message,
    });
  }
}

function cancelAddSteamAccount() {
  showAddSteamAccount.value = false;
  newSteamUsername.value = "";
  newSteamPassword.value = "";
}

async function submitAddSteamAccount() {
  if (!newSteamUsername.value || !newSteamPassword.value) {
    return;
  }
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        insert_steam_accounts_one: [
          {
            object: {
              username: newSteamUsername.value,
              password: newSteamPassword.value,
              enabled: true,
            },
          },
          { id: true },
        ],
      }),
    });
    toast({ title: t("pages.gpu_nodes.steam_pool.added") });
    cancelAddSteamAccount();
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.steam_pool.add_failed"),
      description: error?.message,
    });
  }
}

async function confirmDeleteSteamAccount() {
  const target = deleteSteamTarget.value;
  if (!target) {
    return;
  }
  deleteSteamTarget.value = null;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        delete_steam_accounts_by_pk: [{ id: target.id }, { id: true }],
      }),
    });
    toast({ title: t("pages.gpu_nodes.steam_pool.deleted") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.steam_pool.delete_failed"),
      description: error?.message,
    });
  }
}

async function confirmClearCache() {
  const target = clearCacheTarget.value;
  if (!target) {
    return;
  }
  clearCacheTarget.value = null;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        clearGpuNodeSteamCache: [
          { game_server_node_id: target.id },
          { success: true },
        ],
      }),
    });
    toast({ title: t("pages.gpu_nodes.steam_pool.cache_clear_dispatched") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.steam_pool.cache_clear_failed"),
      description: error?.message ?? t("toasts.request_failed"),
    });
  }
}

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

  <PageTransition :delay="150" class="mt-6">
    <Card variant="gradient" class="p-5 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">
            {{ $t("pages.gpu_nodes.steam_pool.title") }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ $t("pages.gpu_nodes.steam_pool.description") }}
          </p>
        </div>
        <Button @click="showAddSteamAccount = true">
          <Plus class="w-4 h-4 mr-1" />
          {{ $t("pages.gpu_nodes.steam_pool.add") }}
        </Button>
      </div>

      <div
        v-if="steamPoolEmpty"
        class="flex items-start gap-3 rounded-md border border-yellow-700/40 bg-yellow-500/10 px-3 py-2.5 text-sm"
      >
        <AlertTriangle class="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
        <div class="text-yellow-200">
          <div class="font-medium">
            {{ $t("pages.gpu_nodes.steam_pool.empty_warning_title") }}
          </div>
          <div class="text-yellow-200/80 text-xs mt-0.5">
            {{ $t("pages.gpu_nodes.steam_pool.empty_warning_description") }}
          </div>
        </div>
      </div>

      <div v-if="steamAccounts.length > 0" class="overflow-hidden rounded-md border border-border/40">
        <table class="w-full text-sm">
          <thead class="bg-muted/30 text-xs uppercase tracking-wider">
            <tr>
              <th class="text-left p-3">
                {{ $t("pages.gpu_nodes.steam_pool.username") }}
              </th>
              <th class="text-left p-3">
                {{ $t("pages.gpu_nodes.steam_pool.pinned_to") }}
              </th>
              <th class="text-center p-3">
                {{ $t("pages.gpu_nodes.steam_pool.enabled") }}
              </th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="account in steamAccounts"
              :key="account.id"
              class="border-t border-border/40"
            >
              <td class="p-3 font-mono">{{ account.username }}</td>
              <td class="p-3 text-muted-foreground text-xs font-mono">
                {{ account.last_node_id || "—" }}
              </td>
              <td class="p-3 text-center">
                <Switch
                  :model-value="account.enabled"
                  @update:model-value="(v) => toggleSteamAccountEnabled(account, !!v)"
                />
              </td>
              <td class="p-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  @click="deleteSteamTarget = { id: account.id, username: account.username }"
                >
                  <Trash2 class="w-4 h-4 text-red-500" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
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
            <Button
              size="icon"
              variant="outline"
              class="h-7 w-7"
              :title="$t('game_server.edit_cs2_options')"
              :aria-label="$t('game_server.edit_cs2_options')"
              @click="cs2OptionsNode = node"
            >
              <Settings2 class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span
            v-if="steamAccountByNodeId[node.id]"
            class="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/50 px-2 py-1"
          >
            <span class="text-muted-foreground uppercase tracking-wider">
              {{ $t("pages.gpu_nodes.steam_pool.pinned") }}:
            </span>
            <span class="font-mono">
              {{ steamAccountByNodeId[node.id].username }}
            </span>
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1.5 rounded-md border border-yellow-700/40 bg-yellow-500/10 px-2 py-1 text-yellow-300"
            :title="
              steamPoolEmpty
                ? $t('pages.gpu_nodes.steam_pool.empty_warning_description')
                : $t('pages.gpu_nodes.steam_pool.unassigned_warning_description')
            "
          >
            <AlertTriangle class="w-3.5 h-3.5" />
            {{
              steamPoolEmpty
                ? $t("pages.gpu_nodes.steam_pool.no_accounts_short")
                : $t("pages.gpu_nodes.steam_pool.unassigned_short")
            }}
          </span>
          <Button
            v-if="!busyByNode[node.id]"
            size="sm"
            variant="outline"
            class="h-7 px-2 text-xs"
            :title="$t('pages.gpu_nodes.steam_pool.clear_cache_title')"
            @click="clearCacheTarget = { id: node.id, label: node.label || node.id }"
          >
            <Eraser class="w-3.5 h-3.5 mr-1" />
            {{ $t("pages.gpu_nodes.steam_pool.clear_cache") }}
          </Button>
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

  <EditCs2Options
    v-if="cs2OptionsNode"
    :game-server-node="cs2OptionsNode"
    :open="cs2OptionsNode !== null"
    @close="cs2OptionsNode = null"
  />

  <Dialog v-model:open="showAddSteamAccount">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{ $t("pages.gpu_nodes.steam_pool.add_title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.gpu_nodes.steam_pool.add_description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-3">
        <Input
          v-model="newSteamUsername"
          :placeholder="$t('pages.gpu_nodes.steam_pool.username')"
          autocomplete="off"
        />
        <Input
          v-model="newSteamPassword"
          type="password"
          :placeholder="$t('pages.gpu_nodes.steam_pool.password')"
          autocomplete="new-password"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="cancelAddSteamAccount">
          {{ $t("common.cancel") }}
        </Button>
        <Button
          :disabled="!newSteamUsername || !newSteamPassword"
          @click="submitAddSteamAccount"
        >
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog
    :open="!!deleteSteamTarget"
    @update:open="(open) => !open && (deleteSteamTarget = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            $t("pages.gpu_nodes.steam_pool.delete_title", {
              username: deleteSteamTarget?.username ?? "",
            })
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.gpu_nodes.steam_pool.delete_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="deleteSteamTarget = null">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction
          class="bg-red-600 hover:bg-red-700"
          @click="confirmDeleteSteamAccount"
        >
          {{ $t("common.delete") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog
    :open="!!clearCacheTarget"
    @update:open="(open) => !open && (clearCacheTarget = null)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            $t("pages.gpu_nodes.steam_pool.clear_cache_title_node", {
              node: clearCacheTarget?.label ?? "",
            })
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.gpu_nodes.steam_pool.clear_cache_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="clearCacheTarget = null">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction
          class="bg-red-600 hover:bg-red-700"
          @click="confirmClearCache"
        >
          {{ $t("pages.gpu_nodes.steam_pool.clear_cache") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
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
      steamAccounts: [] as Array<{
        id: string;
        username: string;
        enabled: boolean;
        last_node_id: string | null;
      }>,
    };
  },
  computed: {
    steamPoolEmpty(): boolean {
      return (
        this.steamAccounts.filter((a) => a.enabled).length === 0 &&
        this.gpuNodes.length > 0
      );
    },
    steamAccountByNodeId(): Record<
      string,
      { id: string; username: string; enabled: boolean }
    > {
      const map: Record<
        string,
        { id: string; username: string; enabled: boolean }
      > = {};
      for (const a of this.steamAccounts) {
        if (a.last_node_id) {
          map[a.last_node_id] = {
            id: a.id,
            username: a.username,
            enabled: a.enabled,
          };
        }
      }
      return map;
    },
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
              cs2_video_settings: true,
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
      steam_accounts: {
        query: typedGql("subscription")({
          steam_accounts: [
            { order_by: [{ created_at: "asc" as any }] },
            {
              id: true,
              username: true,
              enabled: true,
              last_node_id: true,
            },
          ],
        } as any),
        result(this: any, { data }: any) {
          this.steamAccounts = data?.steam_accounts ?? [];
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
