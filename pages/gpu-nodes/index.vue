<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";

const { t } = useI18n();
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useToast } from "~/components/ui/toast/use-toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import NodeGpuMetrics from "~/components/system-metrics/NodeGpuMetrics.vue";
import {
  Cpu,
  Square,
  Settings2,
  Trash2,
  Plus,
  KeyRound,
  ChevronDown,
  Activity,
  Flame,
  AlertTriangle,
  X,
  ScrollText,
} from "lucide-vue-next";
import ServiceLogs from "~/components/ServiceLogs.vue";
import SnapshotQuickView from "~/components/match/SnapshotQuickView.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import { Input } from "~/components/ui/input";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import {
  AlertDialog,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

definePageMeta({
  middleware: "admin",
});

const { status: poolStatus } = useGpuAvailability();
const { toast } = useToast();
const apolloClient = useNuxtApp().$apollo.defaultClient;

const steamPoolCount = ref(0);
let steamPoolSub: { unsubscribe: () => void } | undefined;
onMounted(() => {
  steamPoolSub = apolloClient
    .subscribe({
      query: typedGql("subscription")({
        v_steam_account_pool_status: [
          { limit: 1 } as any,
          { total_accounts: true },
        ],
      } as any),
    })
    .subscribe({
      next: ({ data }: any) => {
        steamPoolCount.value = Number(
          data?.v_steam_account_pool_status?.[0]?.total_accounts ?? 0,
        );
      },
    });
});
onUnmounted(() => {
  steamPoolSub?.unsubscribe();
});

const poolSteamAccountsLabel = computed(() => {
  if (!poolStatus.value) {
    return "—";
  }
  return `${steamPoolCount.value}/${poolStatus.value.registered_gpu_nodes}`;
});
const poolSteamAccountsTone = computed(() => {
  const nodes = poolStatus.value?.registered_gpu_nodes ?? 0;
  if (nodes === 0) {
    return "muted";
  }
  if (steamPoolCount.value === 0) {
    return "warn";
  }
  if (steamPoolCount.value < nodes) {
    return "warn";
  }
  return "ok";
});

// Collapsible per-node chart drawer. Default closed so the roster
// scans at a glance; expand to reveal the live GPU/VRAM history.
const expandedNodeIds = reactive<Record<string, boolean>>({});
function toggleExpanded(nodeId: string) {
  expandedNodeIds[nodeId] = !expandedNodeIds[nodeId];
}

// Shader-bake job logs (live + recent), via the shared ServiceLogs viewer.
const bakeLogsByNodeId = reactive<Record<string, boolean>>({});
const bakeLogsLoadingByNodeId = reactive<Record<string, boolean>>({});
const bakeLogsTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function toggleBakeLogs(nodeId: string) {
  const open = !bakeLogsByNodeId[nodeId];
  bakeLogsByNodeId[nodeId] = open;

  if (bakeLogsTimers[nodeId]) {
    clearTimeout(bakeLogsTimers[nodeId]);
    delete bakeLogsTimers[nodeId];
  }

  if (open) {
    bakeLogsLoadingByNodeId[nodeId] = true;
    bakeLogsTimers[nodeId] = setTimeout(() => {
      bakeLogsLoadingByNodeId[nodeId] = false;
      delete bakeLogsTimers[nodeId];
    }, 8000);
  } else {
    bakeLogsLoadingByNodeId[nodeId] = false;
  }
}
function onBakeLogsReady(nodeId: string) {
  bakeLogsLoadingByNodeId[nodeId] = false;
  if (bakeLogsTimers[nodeId]) {
    clearTimeout(bakeLogsTimers[nodeId]);
    delete bakeLogsTimers[nodeId];
  }
}

// Two-stage confirm so a stray click can't kill an operator's live
// match — first click flips the button into "Confirm Stop" for 5s,
// the second actually fires the mutation. `busyByNodeId` blocks
// re-entrancy while the request is in flight.
const confirmStopByNodeId = reactive<Record<string, boolean>>({});
const busyByNodeId = reactive<Record<string, boolean>>({});
const cs2OptionsNode = ref<any | null>(null);
const bakeBusyByNodeId = reactive<Record<string, boolean>>({});

const steamPanelOpen = ref(false);
const newSteamUsername = ref("");
const newSteamPassword = ref("");
const deleteSteamTarget = ref<{ id: string; username: string } | null>(null);

function isBaking(node: any): boolean {
  const status = node?.shader_bake_status;
  return status !== null && status !== undefined && status !== "done";
}

function isOffline(node: any): boolean {
  return node?.status === "Offline";
}

function bakeErrored(node: any): boolean {
  return node?.shader_bake_status === "errored";
}

// Hasura serializes numeric as a string ("65.62") — coerce before use.
function bakeProgress(node: any): number | null {
  const raw = node?.shader_bake_progress;
  if (raw == null) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Raw "compiled / total" pipeline count from the streamer, shown next to
// the percent so the absolute shader count is visible (game-streamer
// shader-cache.sh emits this as progress_stage).
function bakeProgressStage(node: any): string | null {
  const raw = node?.shader_bake_progress_stage;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

async function bakeShaders(node: any) {
  if (bakeBusyByNodeId[node.id]) {
    return;
  }
  bakeBusyByNodeId[node.id] = true;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        bakeShaders: [{ game_server_node_id: node.id }, { success: true }],
      }),
    });
    toast({ title: t("pages.gpu_nodes.bake.started") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.bake.failed"),
      description: error?.message,
    });
  } finally {
    bakeBusyByNodeId[node.id] = false;
  }
}

async function cancelBakeShaders(node: any) {
  if (bakeBusyByNodeId[node.id]) {
    return;
  }
  bakeBusyByNodeId[node.id] = true;
  try {
    await apolloClient.mutate({
      mutation: generateMutation({
        cancelBakeShaders: [
          { game_server_node_id: node.id },
          { success: true },
        ],
      }),
    });
    toast({ title: t("pages.gpu_nodes.bake.cancelled") });
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.gpu_nodes.bake.cancel_failed"),
      description: error?.message,
    });
  } finally {
    bakeBusyByNodeId[node.id] = false;
  }
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
            },
          },
          { id: true },
        ],
      }),
    });
    toast({ title: t("pages.gpu_nodes.steam_pool.added") });
    newSteamUsername.value = "";
    newSteamPassword.value = "";
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
</script>

<template>
  <!-- ===================== HEADER ===================== -->
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>{{ $t("pages.gpu_nodes.title") }}</template>
      <template #actions>
        <div class="gpu-stats">
          <div class="gpu-stat">
            <span class="gpu-stat-label">{{
              $t("pages.gpu_nodes.meter.compute")
            }}</span>
            <span
              class="gpu-stat-val"
              :data-tone="
                poolStatus && poolStatus.free_gpu_nodes === 0 ? 'warn' : 'ok'
              "
            >
              {{ poolStatus ? poolStatus.free_gpu_nodes : "—"
              }}<span class="gpu-stat-den"
                >/{{ poolStatus ? poolStatus.registered_gpu_nodes : "—" }}</span
              >
            </span>
            <span class="gpu-stat-sub">{{
              $t("pages.gpu_nodes.stat.available")
            }}</span>
          </div>

          <span class="gpu-stat-sep" aria-hidden="true"></span>

          <button
            type="button"
            class="gpu-stat gpu-stat-btn"
            @click="steamPanelOpen = true"
          >
            <KeyRound class="w-3.5 h-3.5" />
            <span class="gpu-stat-label">{{
              $t("pages.gpu_nodes.steam_pool.title")
            }}</span>
            <span class="gpu-stat-val" :data-tone="poolSteamAccountsTone">
              {{ poolSteamAccountsLabel }}
            </span>
          </button>
        </div>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- ===================== NODE ROSTER ===================== -->
  <PageTransition :delay="200" class="mt-5">
    <div v-if="gpuNodes.length > 0" class="space-y-3">
      <div
        v-for="node in gpuNodes"
        :key="node.id"
        class="gpu-node"
        :data-disabled="!node.enabled"
        :data-busy="!!busyByNode[node.id]"
      >
        <span
          v-if="busyByNode[node.id]"
          class="gpu-corner gpu-corner-tl"
          aria-hidden="true"
        ></span>

        <!-- Row: status + identity + controls -->
        <div class="gpu-node-row">
          <!-- Node control menu -->
          <NodeControlMenu :node="node" align="start" />

          <!-- Identity -->
          <div class="gpu-node-id">
            <div class="gpu-node-name">
              <Tooltip>
                <TooltipTrigger as-child>
                  <span
                    class="gpu-led gpu-led-status"
                    :data-tone="
                      !node.enabled
                        ? 'offline'
                        : isOffline(node)
                          ? 'bad'
                          : busyByNode[node.id]
                            ? 'operational'
                            : node.status === 'Online'
                              ? 'idle'
                              : 'degraded'
                    "
                  >
                    <span class="gpu-led-ping"></span>
                    <span class="gpu-led-core"></span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {{
                    !node.enabled
                      ? $t("pages.gpu_nodes.disabled")
                      : node.e_status?.description || node.status
                  }}
                </TooltipContent>
              </Tooltip>
              {{
                node.gpu_info?.[0]?.name || $t("pages.gpu_nodes.gpu_unknown")
              }}
              <span
                v-if="node.gpu_info?.[0]?.memory_mb"
                class="gpu-node-vram"
              >
                {{ Math.round(node.gpu_info[0].memory_mb / 1024) }} GB
              </span>
              <span class="gpu-node-region">{{
                node.e_region?.description || node.region || "—"
              }}</span>
            </div>
            <div class="gpu-node-meta">
              <span class="gpu-node-sub">{{ node.label || node.id }}</span>
              <span v-if="node.public_ip || node.lan_ip" class="gpu-node-ip">
                {{ node.lan_ip || node.public_ip }}
              </span>
            </div>
          </div>

          <!-- Current task pill -->
          <div class="gpu-node-task">
            <template v-if="busyByNode[node.id]">
              <component
                :is="busyByNode[node.id].icon"
                class="w-3.5 h-3.5 text-[hsl(var(--tac-amber))]"
              />
              <span class="gpu-node-task-label">{{
                busyByNode[node.id].label
              }}</span>
              <NuxtLink
                v-if="busyByNode[node.id].matchId"
                :to="{
                  name: 'matches-id',
                  params: { id: busyByNode[node.id].matchId },
                }"
                class="gpu-node-task-sub hover:underline"
              >
                {{ busyByNode[node.id].subline }}
              </NuxtLink>
              <span v-else class="gpu-node-task-sub">{{
                busyByNode[node.id].subline
              }}</span>
              <span
                v-if="busyByNode[node.id].progress"
                class="gpu-node-task-state"
              >
                <Spinner class="w-2.5 h-2.5" />
                {{ busyByNode[node.id].progress }}
              </span>
            </template>
            <Tooltip v-else-if="isBaking(node)">
              <TooltipTrigger as-child>
                <span class="gpu-node-task-flag">
                  <AlertTriangle
                    v-if="bakeErrored(node)"
                    class="w-3.5 h-3.5 text-[hsl(var(--destructive))]"
                  />
                  <Flame
                    v-else
                    class="w-3.5 h-3.5 text-[hsl(var(--tac-amber))]"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {{
                  bakeErrored(node)
                    ? $t("pages.gpu_nodes.bake.stages.errored")
                    : $t("pages.gpu_nodes.bake.in_progress")
                }}
              </TooltipContent>
            </Tooltip>
            <span v-else-if="!node.enabled" class="gpu-node-task-idle">
              {{ $t("pages.gpu_nodes.disabled") }}
            </span>
            <span v-else class="gpu-node-task-idle gpu-node-task-ok">
              {{ $t("pages.gpu_nodes.idle") }}
            </span>
          </div>

          <!-- Controls -->
          <div
            class="gpu-node-ctrls"
            :class="{ 'gpu-node-ctrls-offline': isOffline(node) }"
          >
            <button
              v-if="busyByNode[node.id]"
              type="button"
              class="gpu-stop"
              :data-armed="confirmStopByNodeId[node.id]"
              :disabled="busyByNodeId[node.id]"
              @click="stopGpuSession(node.id)"
            >
              <Square class="w-3.5 h-3.5" />
              {{ confirmStopByNodeId[node.id] ? "Confirm" : "Stop" }}
            </button>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="gpu-icon-btn"
                  @click="cs2OptionsNode = node"
                >
                  <Settings2 class="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("game_server.edit_cs2_options") }}
              </TooltipContent>
            </Tooltip>

            <Tooltip v-if="!isBaking(node)">
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="gpu-icon-btn"
                  :disabled="bakeBusyByNodeId[node.id]"
                  @click="bakeShaders(node)"
                >
                  <Spinner v-if="bakeBusyByNodeId[node.id]" />
                  <Flame v-else class="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("pages.gpu_nodes.bake.help") }}
              </TooltipContent>
            </Tooltip>

            <Tooltip v-else>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="gpu-icon-btn gpu-icon-btn-danger"
                  :disabled="bakeBusyByNodeId[node.id]"
                  @click="cancelBakeShaders(node)"
                >
                  <Spinner v-if="bakeBusyByNodeId[node.id]" />
                  <X v-else class="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("pages.gpu_nodes.bake.cancel_help") }}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="gpu-icon-btn"
                  :data-open="bakeLogsByNodeId[node.id]"
                  @click="toggleBakeLogs(node.id)"
                >
                  <Spinner v-if="bakeLogsLoadingByNodeId[node.id]" />
                  <ScrollText v-else class="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("pages.gpu_nodes.bake.logs_help") }}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="gpu-metrics-toggle"
                  :data-open="expandedNodeIds[node.id]"
                  @click="toggleExpanded(node.id)"
                >
                  <Activity class="w-3.5 h-3.5" />
                  <ChevronDown class="w-3 h-3 gpu-metrics-chevron" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("pages.gpu_nodes.metrics") }}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div v-if="busyByNode[node.id]" class="gpu-pod-activity">
          <BootSequence
            v-if="busyByNode[node.id].statusHistory"
            :mode="busyByNode[node.id].kind"
            :histories="[busyByNode[node.id].statusHistory]"
            :card="false"
            class="gpu-pod-boot"
          />

          <div class="gpu-bake-preview gpu-pod-preview">
            <SnapshotQuickView
              :kind="busyByNode[node.id].snapshotKind"
              :id="busyByNode[node.id].snapshotId"
              :force-empty="busyByNode[node.id].rendering"
              :empty-label="
                busyByNode[node.id].kind === 'highlights'
                  ? $t('match.stream.rendering_highlights')
                  : ''
              "
            />
          </div>
        </div>

        <!-- Shader bake pipeline (only while baking) -->
        <div
          v-if="isBaking(node)"
          class="gpu-bake"
          :class="{ 'is-errored': bakeErrored(node) }"
        >
          <div class="gpu-bake-activity">
            <BootSequence
              mode="bake"
              :histories="[node.shader_bake_status_history]"
              :status="node.shader_bake_status"
              :progress="bakeProgress(node)"
              :progress-stage="bakeProgressStage(node)"
              :card="false"
              class="gpu-bake-steps"
            />

            <div class="gpu-bake-preview">
              <SnapshotQuickView kind="bake" :id="node.id" />
            </div>
          </div>
        </div>

        <!-- Shader-bake job logs (toggle) -->
        <div
          v-if="bakeLogsByNodeId[node.id]"
          class="flex h-72 flex-col overflow-hidden rounded border border-border/60 bg-background/40"
        >
          <ServiceLogs
            class="min-h-0 flex-1"
            :service="`shader-bake:${node.id}`"
            :compact="true"
            :disable-retry="!isBaking(node)"
            @has-logs="onBakeLogsReady(node.id)"
          />
        </div>

        <!-- Inline live bars (always visible) -->
        <NodeGpuMetrics
          :node-id="node.id"
          :node-label="node.label || ''"
          :show-label="false"
          :show-quick-stats="true"
          :show-charts="!!expandedNodeIds[node.id]"
          :compact-charts="false"
          class="gpu-node-metrics"
        />
      </div>
    </div>

    <div v-else-if="!loading" class="gpu-empty">
      <Cpu class="w-9 h-9 text-muted-foreground/50" />
      <div class="gpu-empty-title">{{ $t("pages.gpu_nodes.empty.title") }}</div>
      <p class="gpu-empty-sub">{{ $t("pages.gpu_nodes.empty.description") }}</p>
    </div>
  </PageTransition>

  <EditCs2Options
    v-if="cs2OptionsNode"
    :game-server-node="cs2OptionsNode"
    :open="cs2OptionsNode !== null"
    @close="cs2OptionsNode = null"
  />

  <Sheet v-model:open="steamPanelOpen">
    <SheetContent side="right" class="sm:max-w-md w-full overflow-y-auto">
      <SheetHeader>
        <SheetTitle>
          {{ $t("pages.gpu_nodes.steam_pool.title") }}
        </SheetTitle>
        <SheetDescription>
          {{ $t("pages.gpu_nodes.steam_pool.description") }}
        </SheetDescription>
      </SheetHeader>

      <div class="space-y-5 py-4">
        <div class="space-y-2">
          <div class="text-xs uppercase tracking-wider text-muted-foreground">
            {{ $t("pages.gpu_nodes.steam_pool.add_title") }}
          </div>
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
          <Button
            class="w-full"
            :disabled="!newSteamUsername || !newSteamPassword"
            @click="submitAddSteamAccount"
          >
            <Plus class="w-4 h-4 mr-1" />
            {{ $t("pages.gpu_nodes.steam_pool.add") }}
          </Button>
          <p class="text-[0.7rem] text-muted-foreground">
            {{ $t("pages.gpu_nodes.steam_pool.add_description") }}
          </p>
        </div>

        <div class="space-y-2">
          <div
            class="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground"
          >
            <span>{{ $t("pages.gpu_nodes.steam_pool.accounts_label") }}</span>
            <span class="font-mono">
              {{ steamAccounts.length }}/{{ gpuNodes.length }}
            </span>
          </div>
          <div
            v-if="steamAccounts.length === 0"
            class="rounded-md border border-border/60 bg-card/40 px-3 py-6 text-center text-sm text-muted-foreground"
          >
            {{ $t("pages.gpu_nodes.steam_pool.empty") }}
          </div>
          <div
            v-else
            class="overflow-hidden rounded-md border border-border/60"
          >
            <table class="w-full text-sm">
              <tbody>
                <tr
                  v-for="account in steamAccounts"
                  :key="account.id"
                  class="border-b border-border/30 last:border-b-0"
                >
                  <td class="p-2 font-mono">
                    <div>{{ account.username }}</div>
                    <div
                      v-if="steamAccountClaim(account)"
                      class="mt-0.5 flex items-center gap-1 text-[10px] font-sans uppercase tracking-wider text-amber-500"
                    >
                      <Activity class="w-3 h-3" />
                      <span>{{
                        steamClaimPurposeLabel(
                          steamAccountClaim(account).purpose,
                        )
                      }}</span>
                      <span
                        v-if="steamAccountClaim(account).node_id"
                        class="text-muted-foreground normal-case"
                      >
                        · {{ steamAccountClaim(account).node_id }}
                      </span>
                    </div>
                    <div
                      v-else
                      class="mt-0.5 text-[10px] font-sans uppercase tracking-wider text-muted-foreground"
                    >
                      {{ $t("pages.gpu_nodes.steam_pool.idle") }}
                    </div>
                  </td>
                  <td class="p-2 text-right w-10">
                    <Button
                      size="sm"
                      variant="ghost"
                      @click="
                        deleteSteamTarget = {
                          id: account.id,
                          username: account.username,
                        }
                      "
                    >
                      <Trash2 class="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>

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
        <!-- Plain button — reka-ui's AlertDialogAction auto-closes (nulling
             deleteSteamTarget) before the async handler reads it. -->
        <button
          type="button"
          class="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
          @click="confirmDeleteSteamAccount"
        >
          {{ $t("common.delete") }}
        </button>
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
  snapshotKind: "live" | "demo" | "bake" | "clips";
  snapshotId: string;
  rendering?: boolean;
  // One-line state for the active (post-boot) phase only — "Rendering 42%"
  // / "Uploading". Boot progress is shown by the full BootSequence
  // checklist instead.
  progress?: string | null;
  // Raw status_history of the current item, fed to BootSequence so
  // any booting pod (render / live / demo) shows the same boot checklist.
  statusHistory?: any[];
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
        last_node_id: string | null;
        claims?: Array<{
          purpose: string;
          node_id: string | null;
          k8s_job_name: string;
          created_at: string;
        }>;
      }>,
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
          snapshotKind: "live",
          snapshotId: stream.match_id,
          statusHistory: stream.is_live ? undefined : stream.status_history,
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
          snapshotKind: "demo",
          snapshotId: session.id,
          statusHistory:
            session.status === "playing" ? undefined : session.status_history,
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
          snapshotKind: "clips",
          snapshotId: job.id,
          rendering: job.status === "rendering" || job.status === "uploading",
          progress: this.renderJobState(job),
          statusHistory:
            job.status === "queued" ? job.status_history : undefined,
          icon: Film,
        };
      }

      return map;
    },
  },
  methods: {
    // Compact header chip for the active (post-boot) render phase only —
    // "Rendering 42%" / "Uploading". The booting phase is shown in full by
    // the BootSequence checklist, so nothing is returned there.
    renderJobState(this: any, job: any): string | null {
      if (job.status === "rendering") {
        const n = Number(job.progress);
        return Number.isFinite(n)
          ? `${this.$t("render_queue_status.rendering")} ${Math.round(n * 100)}%`
          : this.$t("render_queue_status.rendering");
      }
      if (job.status === "uploading") {
        return this.$t("render_queue_status.uploading");
      }
      return null;
    },
    steamAccountClaim(this: any, account: any) {
      return account?.claims?.[0] ?? null;
    },
    steamClaimPurposeLabel(this: any, purpose: string): string {
      const key = `pages.gpu_nodes.steam_pool.purpose.${purpose}`;
      const label = this.$t(key);
      return label === key ? purpose : label;
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
              gpu_streaming_enabled: true,
              gpu_demos_enabled: true,
              gpu_rendering_enabled: true,
              cs2_video_settings: true,
              public_ip: true,
              lan_ip: true,
              offline_at: true,
              start_port_range: true,
              end_port_range: true,
              shader_bake_status: true,
              shader_bake_progress: true,
              shader_bake_progress_stage: true,
              shader_bake_status_history: true,
              e_region: { description: true },
              e_status: { description: true },
            } as any,
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
              status_history: true,
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
              status_history: true,
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
              last_node_id: true,
              claims: [
                {},
                {
                  purpose: true,
                  node_id: true,
                  k8s_job_name: true,
                  created_at: true,
                },
              ],
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
              progress: true,
              status_history: true,
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

<style scoped>
/* ===== Tone tokens (HSL triplets reused by LEDs/bars/stats) ===== */
.gpu-stats,
.gpu-node {
  --t-ok: 142 71% 45%;
  --t-idle: 35 92% 55%;
  --t-warn: 38 95% 55%;
  --t-bad: 0 84% 60%;
}

/* ===== Header stat strip ===== */
.gpu-stats {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}
.gpu-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}
.gpu-stat-label {
  font-family: ui-monospace, monospace;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: hsl(var(--muted-foreground));
}
.gpu-stat-val {
  font-family: "Oxanium", ui-sans-serif;
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: hsl(var(--foreground));
}
.gpu-stat-val[data-tone="ok"] {
  color: hsl(var(--t-ok));
}
.gpu-stat-val[data-tone="warn"] {
  color: hsl(var(--t-warn));
}
.gpu-stat-val[data-tone="amber"] {
  color: hsl(var(--tac-amber));
}
.gpu-stat-den {
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}
.gpu-stat-sub {
  font-family: ui-monospace, monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--muted-foreground) / 0.7);
}
.gpu-stat-sep {
  width: 1px;
  height: 22px;
  background: hsl(var(--border) / 0.7);
}
.gpu-stat-btn {
  align-items: center;
  padding: 0.35rem 0.6rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.4rem;
  background: hsl(var(--card) / 0.5);
  color: hsl(var(--muted-foreground));
  transition:
    border-color 0.15s,
    color 0.15s;
}
.gpu-stat-btn:hover {
  border-color: hsl(var(--tac-amber) / 0.55);
}
.gpu-stat-btn .gpu-stat-val {
  font-size: 0.95rem;
}

/* ===== Corner ticks ===== */
.gpu-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.gpu-corner-tl {
  top: 8px;
  left: 8px;
  border-top: 2px solid hsl(var(--tac-amber));
  border-left: 2px solid hsl(var(--tac-amber));
}
.gpu-corner-br {
  bottom: 8px;
  right: 8px;
  border-bottom: 2px solid hsl(var(--tac-amber));
  border-right: 2px solid hsl(var(--tac-amber));
}

/* ===== Status LED ===== */
.gpu-led {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.gpu-led-core {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  z-index: 1;
}
.gpu-led-ping {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0;
}
.gpu-led[data-tone="operational"] .gpu-led-core,
.gpu-led[data-tone="ok"] .gpu-led-core {
  background: hsl(var(--t-ok));
  box-shadow: 0 0 10px hsl(var(--t-ok) / 0.8);
}
.gpu-led[data-tone="operational"] .gpu-led-ping {
  background: hsl(var(--t-ok));
  animation: gpu-ping 2.6s ease-in-out infinite;
}
.gpu-led[data-tone="idle"] .gpu-led-core {
  background: hsl(var(--t-ok));
  box-shadow: 0 0 10px hsl(var(--t-ok) / 0.7);
}
.gpu-led[data-tone="degraded"] .gpu-led-core,
.gpu-led[data-tone="warn"] .gpu-led-core {
  background: hsl(var(--t-warn));
  box-shadow: 0 0 10px hsl(var(--t-warn) / 0.7);
}
.gpu-led[data-tone="offline"] .gpu-led-core {
  background: hsl(var(--muted-foreground) / 0.5);
}
.gpu-led[data-tone="bad"] .gpu-led-core {
  background: hsl(var(--t-bad));
  box-shadow: 0 0 10px hsl(var(--t-bad) / 0.75);
}
/* Gentle breathing halo on active nodes only — no frantic expanding
   ring. Idle/degraded/offline keep a static dot like the game-server
   nodes page, so only "something is rendering" draws the eye. */
@keyframes gpu-ping {
  0%,
  100% {
    transform: scale(1.4);
    opacity: 0.25;
  }
  50% {
    transform: scale(1.9);
    opacity: 0;
  }
}

/* ===== Node card ===== */
.gpu-node {
  position: relative;
  border: 1px solid hsl(var(--border));
  border-radius: 0.6rem;
  padding: 1rem 1.1rem;
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.55) 0%,
    hsl(var(--card) / 0.2) 100%
  );
  backdrop-filter: blur(6px);
  transition:
    border-color 0.15s,
    transform 0.15s;
}
.gpu-node[data-busy="true"] {
  border-color: hsl(var(--tac-amber) / 0.4);
}
.gpu-node[data-disabled="true"] {
  opacity: 0.6;
}
.gpu-node-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex-wrap: wrap;
}
.gpu-node-id {
  min-width: 0;
  flex: 1 1 200px;
}
.gpu-node-name {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: "Oxanium", ui-sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gpu-node-region {
  font-family: ui-monospace, monospace;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--tac-amber));
  border: 1px solid hsl(var(--tac-amber) / 0.35);
  border-radius: 0.25rem;
  padding: 0.1rem 0.35rem;
  flex-shrink: 0;
}
.gpu-node-vram {
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}
.gpu-node-meta {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: hsl(var(--muted-foreground));
}
.gpu-node-sub {
  font-family: ui-monospace, monospace;
}
.gpu-node-ip {
  font-family: ui-monospace, monospace;
  font-size: 0.66rem;
  opacity: 0.7;
}
.gpu-node-task {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 1 auto;
  min-width: 0;
}
.gpu-node-task-flag {
  display: inline-flex;
  align-items: center;
}
.gpu-node-task-label {
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: hsl(var(--tac-amber));
}
.gpu-node-task-sub {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.gpu-pod-activity {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.gpu-pod-boot {
  flex: 1 1 18rem;
  min-width: 0;
  padding: 0.75rem;
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 0.5rem;
  background: hsl(var(--primary) / 0.03);
}
/* Snapshot sits on the right beside the boot checklist; the compound
   selector outranks the later .gpu-bake-preview rule so its top margin
   resets (the flex parent owns the spacing). */
.gpu-pod-activity .gpu-pod-preview {
  flex: 0 1 22rem;
  min-width: 0;
  margin-top: 0;
}
.gpu-node-task-state {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  padding: 0.05rem 0.4rem;
  border: 1px solid hsl(var(--tac-amber) / 0.4);
  border-radius: 9999px;
  background: hsl(var(--tac-amber) / 0.12);
  font-family: ui-monospace, monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: hsl(var(--tac-amber));
}
.gpu-node-task-idle {
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--muted-foreground));
}
.gpu-node-task-ok {
  color: hsl(var(--t-ok));
}
.gpu-node-ctrls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.gpu-node-ctrls-offline {
  pointer-events: none;
  opacity: 0.4;
}
.gpu-led-status {
  cursor: pointer;
  transition: transform 0.15s;
}
.gpu-led-status:hover {
  transform: scale(1.25);
}
.gpu-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 0.4rem;
  background: hsl(var(--card) / 0.4);
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s,
    border-color 0.15s,
    transform 0.2s;
}
.gpu-icon-btn:hover {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
}
.gpu-metrics-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 28px;
  padding: 0 0.6rem;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 0.4rem;
  background: hsl(var(--card) / 0.4);
  font-family: ui-monospace, monospace;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s,
    border-color 0.15s;
}
.gpu-metrics-toggle:hover {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
}
.gpu-metrics-toggle[data-open="true"] {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
  background: hsl(var(--tac-amber) / 0.08);
}
.gpu-metrics-chevron {
  transition: transform 0.2s;
}
.gpu-metrics-toggle[data-open="true"] .gpu-metrics-chevron {
  transform: rotate(180deg);
}
.gpu-stop {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid hsl(var(--t-bad) / 0.5);
  border-radius: 0.4rem;
  background: transparent;
  font-family: ui-monospace, monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: hsl(var(--t-bad));
  transition: background 0.15s;
}
.gpu-stop:hover {
  background: hsl(var(--t-bad) / 0.15);
}
.gpu-stop[data-armed="true"] {
  background: hsl(var(--t-bad));
  color: hsl(0 0% 100%);
  box-shadow: 0 0 18px hsl(var(--t-bad) / 0.5);
}
.gpu-node-metrics {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px solid hsl(var(--border) / 0.4);
}

/* ===== Shader bake pipeline ===== */
.gpu-bake {
  --bake-accent: var(--tac-amber);
  position: relative;
  margin-top: 0.9rem;
  padding: 0.85rem 0.95rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  border: 1px solid hsl(var(--bake-accent) / 0.22);
  border-radius: 0.5rem;
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      hsl(var(--bake-accent) / 0.07),
      transparent 55%
    ),
    hsl(var(--background) / 0.4);
  overflow: hidden;
}
/* Tactical corner tick (echoes the page header brackets). */
.gpu-bake::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  height: 14px;
  border-top: 1px solid hsl(var(--bake-accent) / 0.7);
  border-left: 1px solid hsl(var(--bake-accent) / 0.7);
  border-top-left-radius: 0.5rem;
}
/* Hairline runner along the top edge. */
.gpu-bake::after {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    hsl(var(--bake-accent) / 0.55),
    transparent 70%
  );
}

/* Steps on the left, snapshot preview on the right (wraps on narrow). */
.gpu-bake-activity {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.85rem;
}
.gpu-bake-steps {
  flex: 1 1 18rem;
  min-width: 0;
}
.gpu-bake-preview {
  flex: 0 1 22rem;
  min-width: 0;
  max-width: 22rem;
  border-radius: 0.375rem;
  overflow: hidden;
  border: 1px solid hsl(var(--border) / 0.6);
}
/* Errored bake — swing the whole panel to destructive. */
.gpu-bake.is-errored {
  --bake-accent: var(--destructive);
}

/* ===== Empty state ===== */
.gpu-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 4rem 1rem;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.6rem;
  text-align: center;
}
.gpu-empty-title {
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: hsl(var(--muted-foreground));
}
.gpu-empty-sub {
  max-width: 28rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground) / 0.8);
}
</style>
