<script lang="ts" setup>
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "~/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { PaginationEllipsis } from "~/components/ui/pagination";
import GameServerNodeDisplay from "~/components/game-server-nodes/GameServerNodeDisplay.vue";
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
import {
  ExternalLink,
  Trash2,
  RefreshCw,
  Pencil,
  Activity,
  CircleFadingArrowUp,
  AlertCircle,
  Plus,
  Power,
  PowerOff,
  CalendarX,
  CalendarCheck,
  FolderOpen,
  Pin,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-vue-next";
import UpdateGameServerLabel from "~/components/game-server-nodes/UpdateGameServerLabel.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
import NodeMetrics from "@/components/system-metrics/NodeMetrics.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { ref } from "vue";

// Mobile accordion state
const expandedSections = ref<Set<string>>(new Set());

const toggleSection = (section: string) => {
  if (expandedSections.value.has(section)) {
    expandedSections.value.delete(section);
  } else {
    expandedSections.value.add(section);
  }
};

const isSectionExpanded = (section: string) => {
  return expandedSections.value.has(section);
};
</script>

<template>
  <!-- Desktop Table Row (xl and up) -->
  <TableRow
    class="border-b-0 hidden xl:table-row"
    :class="!gameServerNode.enabled ? 'bg-muted/40 opacity-60' : ''"
  >
    <TableCell>
      <GameServerNodeDisplay
        :game-server-node="gameServerNode"
        :max-servers="maxServers"
        :cpu-pinning-enabled="cpuPinningEnabled"
      ></GameServerNodeDisplay>
    </TableCell>
    <TableCell class="hidden xl:table-cell">
      <div class="flex flex-col gap-2">
        <div class="flex gap-1 text-xs">
          <FiveStackToolTip>
            <template #trigger>
              <div
                :class="{
                  'text-red-500': showMaxCPUFrequencyWarning,
                  'text-orange-500':
                    !showMaxCPUFrequencyWarning && isCpuGovernorNotOptimal,
                  'text-muted-foreground':
                    !showMaxCPUFrequencyWarning && !isCpuGovernorNotOptimal,
                }"
              >
                <span>{{ maxFrequency ? `${maxFrequency}GHz` : "-" }}</span>
              </div>
            </template>
            <div class="space-y-2">
              <div class="font-medium">
                {{ $t("game_server.cpu_info_title") }}
              </div>

              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_speed") }}:</span
                >
                <span :class="showMaxCPUFrequencyWarning ? 'text-red-500' : ''">
                  {{ maxFrequency ? `${maxFrequency}GHz` : "-" }}
                </span>
              </div>

              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_model") }}:</span
                >
                <span>{{
                  gameServerNode.cpu_frequency_info?.model || "-"
                }}</span>
              </div>

              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_sockets") }}:</span
                >
                <span>{{ gameServerNode.cpu_sockets || "-" }}</span>
              </div>

              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_cores_per_socket") }}:</span
                >
                <span>{{ gameServerNode.cpu_cores_per_socket || "-" }}</span>
              </div>

              <div class="flex items-center justify-between gap-4 text-xs">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_threads_per_core") }}:</span
                >
                <span>{{ gameServerNode.cpu_threads_per_core || "-" }}</span>
              </div>

              <div class="pt-1 border-t border-border">
                <div class="flex items-center justify-between gap-4 text-xs">
                  <span class="text-muted-foreground"
                    >{{
                      $t("pages.game_server_nodes.table.cpu_governor")
                    }}:</span
                  >
                  <span
                    class="capitalize"
                    :class="isCpuGovernorPowerSave ? 'text-red-500' : ''"
                  >
                    {{
                      gameServerNode.cpu_governor_info?.governor || "unknown"
                    }}
                  </span>
                </div>
                <div
                  class="text-xs text-muted-foreground mt-1"
                  v-if="
                    gameServerNode.cpu_governor_info?.governor !== 'performance'
                  "
                >
                  {{ $t("game_server.governor_performance_recommended") }}
                </div>
                <a
                  href="https://docs.5stack.gg/servers/cpu-governance"
                  target="_blank"
                  class="flex items-center gap-1 text-xs hover:underline mt-1"
                >
                  {{ $t("game_server.learn_more") }}
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>

              <div class="pt-1 border-t border-border">
                <div class="flex items-center justify-between gap-4 text-xs">
                  <span class="text-muted-foreground"
                    >{{
                      $t("pages.game_server_nodes.table.supports_cpu_pinning")
                    }}:</span
                  >
                  <span
                    :class="
                      gameServerNode.supports_cpu_pinning
                        ? 'text-green-500'
                        : 'text-red-500'
                    "
                  >
                    {{
                      gameServerNode.supports_cpu_pinning
                        ? $t("common.yes")
                        : $t("common.no")
                    }}
                  </span>
                </div>
                <a
                  href="https://docs.5stack.gg/servers/cpu-pinning"
                  target="_blank"
                  class="flex items-center gap-1 text-xs hover:underline mt-1"
                >
                  {{ $t("game_server.learn_more") }}
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>

              <div
                v-if="showMaxCPUFrequencyWarning"
                class="pt-1 border-t border-border text-red-500 text-xs"
              >
                {{ $t("game_server.cpu_frequency_warning") }}
              </div>
            </div>
          </FiveStackToolTip>
        </div>

        <div class="flex gap-2">
          <FiveStackToolTip>
            <template #trigger>
              <div class="cursor-pointer">
                <Activity
                  class="h-4 w-4"
                  :class="
                    gameServerNode.supports_low_latency
                      ? 'text-green-500'
                      : 'text-muted-foreground'
                  "
                />
              </div>
            </template>
            <div class="space-y-2">
              <div class="font-medium">
                {{ $t("pages.game_server_nodes.table.supports_low_latency") }}
              </div>
              <a
                href="https://docs.5stack.gg/servers/low-latency-kernel"
                target="_blank"
                class="flex items-center gap-1 text-xs hover:underline"
              >
                {{ $t("game_server.learn_more") }}
                <ExternalLink class="h-3 w-3" />
              </a>
            </div>
          </FiveStackToolTip>

          <FiveStackToolTip>
            <template #trigger>
              <div class="cursor-pointer">
                <Cpu
                  class="h-4 w-4"
                  :class="
                    gameServerNode.supports_cpu_pinning
                      ? 'text-green-500'
                      : 'text-muted-foreground'
                  "
                />
              </div>
            </template>
            <div class="space-y-2">
              <div class="font-medium">
                {{ $t("pages.game_server_nodes.table.supports_cpu_pinning") }}
              </div>
              <a
                href="https://docs.5stack.gg/servers/cpu-pinning"
                target="_blank"
                class="flex items-center gap-1 text-xs hover:underline"
              >
                {{ $t("game_server.learn_more") }}
                <ExternalLink class="h-3 w-3" />
              </a>
            </div>
          </FiveStackToolTip>

          <FiveStackToolTip>
            <template #trigger>
              <div class="relative cursor-pointer">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-gpu-icon lucide-gpu h-4 w-4"
                  :class="
                    gameServerNode.gpu
                      ? 'text-green-500'
                      : 'text-muted-foreground'
                  "
                >
                  <path d="M2 21V3" />
                  <path d="M2 5h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2.26" />
                  <path d="M7 17v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3" />
                  <circle cx="16" cy="11" r="2" />
                  <circle cx="8" cy="11" r="2" />
                </svg>
              </div>
            </template>
            <div class="space-y-2">
              <div class="font-medium">
                {{
                  gameServerNode.gpu
                    ? $t("game_server.gpu_present")
                    : $t("game_server.gpu_not_present")
                }}
              </div>
              <div
                v-if="gameServerNode.gpu"
                class="text-xs text-muted-foreground"
              >
                {{ $t("game_server.gpu_description") }}
              </div>
            </div>
          </FiveStackToolTip>
        </div>
      </div>
    </TableCell>
    <TableCell class="hidden xl:table-cell">
      <Select
        :model-value="regionForm.region"
        @update:model-value="(value) => updateRegion(value)"
      >
        <SelectTrigger class="h-7 px-2 text-xs w-full">
          <SelectValue :placeholder="$t('game_server.select_region')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="region.value" v-for="region of server_regions">
              {{ region.description || region.value }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </TableCell>
    <TableCell class="hidden xl:table-cell">
      <div class="flex items-center justify-center gap-2">
        <FiveStackToolTip v-if="overPrevisionedServers">
          <template #trigger>
            <AlertCircle class="h-4 w-4 animate-pulse text-red-500" />
          </template>
          <div class="space-y-1">
            <div>
              <span class="font-semibold text-red-600">
                {{ $t("game_server.overprovisioned_warning") }}
              </span>
            </div>
            <div>
              {{
                $t("game_server.overprovisioned_warning_description", {
                  total_server_count: gameServerNode.total_server_count,
                  max_servers: maxServers,
                })
              }}
            </div>

            <div>
              <div
                class="flex items-center gap-4 text-xs"
                v-if="
                  gameServerNode.status !==
                  e_game_server_node_statuses_enum.Setup
                "
              >
                <div class="flex items-center gap-1">
                  <div class="font-medium">
                    {{ $t("game_server.cpu_sockets") }}:
                  </div>
                  <div class="text-muted-foreground">
                    {{ gameServerNode.cpu_sockets || "-" }}
                  </div>
                </div>
                <span class="text-muted-foreground">|</span>
                <div class="flex items-center gap-1">
                  <div class="font-medium">
                    {{ $t("game_server.cpu_cores_per_socket") }}:
                  </div>
                  <div class="text-muted-foreground">
                    {{ gameServerNode.cpu_cores_per_socket || "-" }}
                  </div>
                </div>
                <span class="text-muted-foreground">|</span>
                <div class="flex items-center gap-1">
                  <div class="font-medium">
                    {{ $t("game_server.cpu_threads_per_core") }}:
                  </div>
                  <div class="text-muted-foreground">
                    {{ gameServerNode.cpu_threads_per_core || "-" }}
                  </div>
                </div>
              </div>
              <div class="p-2 flex items-center gap-2 text-xs mt-2">
                <div class="flex items-center justify-center h-5 w-5">
                  <AlertCircle class="h-3 w-3" />
                </div>
                <div>
                  <span class="font-semibold">Note:</span>
                  The panel reserves
                  <span class="font-bold">1 CPU core</span> for Kubernetes to
                  run.
                </div>
              </div>
            </div>
          </div>
        </FiveStackToolTip>

        <div class="flex flex-col items-center gap-2">
          <div class="text-xs text-muted-foreground">
            {{ $t("game_server.max_servers") }}:
            {{
              maxServers !== null && maxServers !== undefined ? maxServers : "-"
            }}
          </div>
          <Badge
            v-if="gameServerNode.enabled"
            variant="outline"
            class="text-xs px-2 py-0.5"
            :class="
              overPrevisionedServers
                ? 'border-red-500 text-red-500'
                : 'border-muted-foreground/40 text-foreground'
            "
          >
            {{ gameServerNode.available_server_count }} /
            {{ gameServerNode.total_server_count }}
          </Badge>
          <button
            type="button"
            class="text-xs text-muted-foreground hover:text-foreground hover:underline"
            @click="showPortsDialog = true"
          >
            {{ portRangeLabel }}
          </button>
        </div>
      </div>
    </TableCell>
    <!-- CS Build Column -->
    <TableCell class="hidden xl:table-cell pr-1">
      <div class="flex items-center gap-2">
        <template v-if="gameServerNode.update_status">
          <FiveStackToolTip>
            <template #trigger>
              <div class="flex items-center gap-1">
                <span class="capitalize text-sm">
                  {{ gameServerNode.update_status }}
                </span>
                <Button variant="outline" size="sm" @click="toggleLogs">
                  <Activity class="h-2 w-2" />
                </Button>
              </div>
            </template>
            {{ $t("game_server.show_update_logs") }}
          </FiveStackToolTip>
        </template>

        <template v-else>
          <template v-if="gameServerNode.build_id">
            <Select
              :model-value="pinBuildIdForm.values.pin_build_id"
              @update:model-value="(value) => pinBuildId(value)"
              :disabled="!supportsGameServerVersionPinning"
            >
              <SelectTrigger class="h-7 px-2 text-xs w-full">
                <div class="flex items-center gap-1 min-w-0">
                  <template v-if="nodeBuildVersion">
                    <span class="truncate"
                      >{{ nodeBuildVersion?.version }} ({{
                        nodeBuildVersion?.build_id
                      }})</span
                    >
                  </template>
                  <template v-else>
                    <span class="truncate">{{ gameServerNode.build_id }}</span>
                  </template>
                  <Pin
                    v-if="gameServerNode.pin_build_id"
                    class="h-3 w-3 text-blue-500"
                  />
                  <FiveStackToolTip v-if="showBuildUpdateWarning">
                    <template #trigger>
                      <CircleFadingArrowUp class="h-3 w-3 text-yellow-500" />
                    </template>
                    {{ $t("game_server.update_cs") }}
                  </FiveStackToolTip>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="null">
                    <div class="flex flex-col gap-1">
                      <div class="text-sm font-medium">
                        {{ $t("game_server.unpin_build_id") }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ $t("game_server.use_latest_version") }}
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem
                    :value="version.build_id"
                    v-for="version of gameVersions"
                    :key="version.build_id"
                  >
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-1">
                        <span class="font-medium">{{ version.version }}</span>
                        <span class="text-muted-foreground"
                          >({{ version.build_id }})</span
                        >
                        <Pin
                          v-if="
                            gameServerNode.pin_build_id === version.build_id
                          "
                          class="h-3 w-3 text-blue-500 ml-1"
                        />
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ new Date(version.updated_at).toLocaleString() }}
                        <span v-if="version.current" class="text-green-500 ml-1"
                          >({{ $t("game_server.current") }})</span
                        >
                      </div>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </template>

          <template v-else>
            <Button
              size="xs"
              @click="updateCs"
              :disabled="
                gameServerNode.status !==
                e_game_server_node_statuses_enum.Online
              "
              v-if="gameServerNode.enabled"
            >
              {{ $t("game_server.install_cs") }}
            </Button>
          </template>

          <FiveStackToolTip
            v-if="!supportsGameServerVersionPinning && gameServerNode.build_id"
          >
            <span>
              {{ $t("game_server.version_pinning_not_supported") }}
            </span>
            <template #trigger>
              <a
                href="https://docs.5stack.gg/servers/game-server-nodes/version-pinning"
                target="_blank"
                class="text-warning"
              >
                <ExternalLink class="h-4 w-4" />
              </a>
            </template>
          </FiveStackToolTip>
        </template>
      </div>
    </TableCell>
    <!-- Plugin Version Column -->
    <TableCell class="hidden xl:table-cell pl-1">
      <div class="flex items-center gap-2" v-if="gameServerNode.build_id">
        <Select
          :model-value="pinPluginVersionForm.values.pin_plugin_version"
          @update:model-value="(value) => pinPluginVersion(value)"
        >
          <SelectTrigger class="h-7 px-2 text-xs w-full">
            <div class="flex items-center gap-1 min-w-0">
              <span v-if="gameServerNode.pin_plugin_version" class="truncate">{{
                gameServerNode.pin_plugin_version
              }}</span>
              <span v-else class="text-muted-foreground truncate">{{
                $t("game_server.auto")
              }}</span>
              <Pin
                v-if="gameServerNode.pin_plugin_version"
                class="h-3 w-3 text-blue-500"
              />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="null">
                <div class="flex flex-col gap-1">
                  <div class="text-sm font-medium">
                    {{ $t("game_server.unpin_plugin_version") }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ $t("game_server.use_latest_plugin") }}
                  </div>
                </div>
              </SelectItem>
              <SelectItem
                :value="version.version"
                v-for="version of pluginVersions"
                :key="version.version"
              >
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-1">
                    <span class="font-medium">{{ version.version }}</span>
                    <Pin
                      v-if="
                        gameServerNode.pin_plugin_version === version.version
                      "
                      class="h-3 w-3 text-blue-500 ml-1"
                    />
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <div
                      v-if="version.min_game_build_id"
                      class="text-green-500"
                    >
                      {{ $t("game_server.plugin_version_supports") }}:
                      {{ version.min_game_build_id }}+
                    </div>
                    <div>
                      {{ $t("game_server.plugin_version_published") }}:
                      {{ new Date(version.published_at).toLocaleString() }}
                    </div>
                  </div>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <template v-if="!gameServerNode.plugin_supported">
          <FiveStackToolTip>
            <template #trigger>
              <AlertCircle class="h-4 w-4 animate-pulse text-red-500" />
            </template>
            {{ $t("game_server.plugin_not_supported") }}
          </FiveStackToolTip>
        </template>
      </div>
    </TableCell>
    <TableCell class="text-right">
      <div class="flex items-center justify-end space-x-2">
        <!-- Metrics Toggle Button (Desktop) -->
        <FiveStackToolTip>
          <template #trigger>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              @click="toggleNodeMetrics"
            >
              <Activity
                class="h-4 w-4"
                :class="shouldShowMetrics ? 'text-primary' : ''"
              />
            </Button>
          </template>
          {{ shouldShowMetrics ? "Hide Metrics" : "Show Metrics" }}
        </FiveStackToolTip>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-8 w-8">
              <PaginationEllipsis class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <template
              v-if="
                gameServerNode.status ===
                e_game_server_node_statuses_enum.Online
              "
            >
              <DropdownMenuItem @click="updateCs">
                <template v-if="gameServerNode.build_id">
                  <RefreshCw class="mr-2 h-4 w-4" />
                  <span>{{ $t("game_server.update_cs") }}</span>
                </template>
                <template v-else>
                  <Plus class="mr-2 h-4 w-4" />
                  {{ $t("game_server.install_cs") }}
                </template>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </template>

            <DropdownMenuItem @click="editLabelSheet = true">
              <Pencil class="mr-2 h-4 w-4" />
              <span>{{ $t("game_server.edit_label") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              @click="
                $router.push(`/game-server-nodes/${gameServerNode.id}/files`)
              "
            >
              <FolderOpen class="mr-2 h-4 w-4" />
              <span>{{ $t("game_server.files") }}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @click="showNetworkLimiterDialog = true">
              <div class="flex flex-col items-center gap-1 w-full">
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <Activity
                    class="mr-2 h-4 w-4"
                    :class="
                      gameServerNode.demo_network_limiter
                        ? 'text-yellow-500'
                        : 'text-muted-foreground'
                    "
                  />
                  <span class="whitespace-nowrap">{{
                    $t("demo_network_limiter.title")
                  }}</span>
                </div>
                <Badge
                  variant="outline"
                  class="text-xs w-fit whitespace-nowrap"
                  :class="
                    gameServerNode.demo_network_limiter
                      ? 'border-yellow-500 text-yellow-500'
                      : 'text-muted-foreground'
                  "
                >
                  <template v-if="gameServerNode.demo_network_limiter">
                    {{ gameServerNode.demo_network_limiter }} Mbps
                  </template>
                  <template v-else>
                    {{ $t("demo_network_limiter.unlimited_short") }}
                  </template>
                </Badge>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem @click="showPortsDialog = true">
              <div class="flex items-center gap-2">
                <span>{{ $t("game_server.edit_ports") }}</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem @click="toggleEnabled">
                <template v-if="gameServerNode.enabled">
                  <PowerOff class="mr-2 h-4 w-4" />
                  <span>{{ $t("game_server.disable_node") }}</span>
                </template>
                <template v-else>
                  <Power class="mr-2 h-4 w-4" />
                  <span>{{ $t("game_server.enable_node") }}</span>
                </template>
              </DropdownMenuItem>

              <DropdownMenuItem
                v-if="gameServerNode.enabled"
                @click="toggleGameServerNodeScheduling"
              >
                <template
                  v-if="
                    gameServerNode.status ===
                    e_game_server_node_statuses_enum.NotAcceptingNewMatches
                  "
                >
                  <CalendarCheck class="mr-2 h-4 w-4" />
                  {{ $t("game_server.enable_scheduling") }}
                </template>
                <template v-else>
                  <CalendarX class="mr-2 h-4 w-4" />
                  {{ $t("game_server.disable_scheduling") }}
                </template>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              @click="removeGameNodeServer"
              class="text-red-500"
            >
              <Trash2 class="mr-2 h-4 w-4" />
              <span>{{ $t("game_server.remove_node") }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableCell>
  </TableRow>

  <!-- Mobile Card Layout (below xl) -->
  <TableRow class="xl:hidden border-b-0">
    <TableCell :colspan="8" class="p-0">
      <div
        class="p-4 space-y-3"
        :class="!gameServerNode.enabled ? 'bg-muted/40 opacity-60' : ''"
      >
        <!-- Card Header -->
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <GameServerNodeDisplay
              :game-server-node="gameServerNode"
              :max-servers="maxServers"
              :cpu-pinning-enabled="cpuPinningEnabled"
            />
          </div>

          <!-- Right Column with Region, Max Servers, and Ports -->
          <div class="flex flex-col items-end gap-2 min-w-0">
            <!-- Region Selector -->
            <Select
              :model-value="regionForm.region"
              @update:model-value="(value) => updateRegion(value)"
            >
              <SelectTrigger class="h-7 px-2 text-xs w-auto min-w-[110px]">
                <SelectValue :placeholder="$t('game_server.select_region')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    :value="region.value"
                    v-for="region of server_regions"
                    :key="region.value"
                  >
                    {{ region.description || region.value }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <!-- Info Grid -->
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <!-- Max Servers -->
              <div class="text-right text-muted-foreground whitespace-nowrap">
                Max:
              </div>
              <div class="font-medium text-foreground">
                {{
                  maxServers !== null && maxServers !== undefined
                    ? maxServers
                    : "-"
                }}
              </div>

              <!-- Ports -->
              <div class="text-right text-muted-foreground whitespace-nowrap">
                Ports:
              </div>
              <button
                type="button"
                class="text-left font-medium text-foreground hover:underline"
                @click="showPortsDialog = true"
              >
                {{ portRangeLabel }}
              </button>
            </div>

            <!-- Server Badge -->
            <Badge
              v-if="gameServerNode.enabled"
              variant="outline"
              class="text-xs px-2 py-0.5 whitespace-nowrap"
              :class="
                overPrevisionedServers
                  ? 'border-red-500 text-red-500'
                  : 'border-muted-foreground/40 text-foreground'
              "
            >
              {{ gameServerNode.available_server_count }} /
              {{ gameServerNode.total_server_count }}
            </Badge>
          </div>

          <!-- Actions Menu (top right) -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="h-8 w-8 flex-shrink-0">
                <PaginationEllipsis class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-56">
              <template
                v-if="
                  gameServerNode.status ===
                  e_game_server_node_statuses_enum.Online
                "
              >
                <DropdownMenuItem @click="updateCs">
                  <template v-if="gameServerNode.build_id">
                    <RefreshCw class="mr-2 h-4 w-4" />
                    <span>{{ $t("game_server.update_cs") }}</span>
                  </template>
                  <template v-else>
                    <Plus class="mr-2 h-4 w-4" />
                    {{ $t("game_server.install_cs") }}
                  </template>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </template>

              <DropdownMenuItem @click="editLabelSheet = true">
                <Pencil class="mr-2 h-4 w-4" />
                <span>{{ $t("game_server.edit_label") }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                @click="
                  $router.push(`/game-server-nodes/${gameServerNode.id}/files`)
                "
              >
                <FolderOpen class="mr-2 h-4 w-4" />
                <span>{{ $t("game_server.files") }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem @click="showNetworkLimiterDialog = true">
                <div class="flex flex-col items-center gap-1 w-full">
                  <div class="flex items-center gap-2 whitespace-nowrap">
                    <Activity
                      class="mr-2 h-4 w-4"
                      :class="
                        gameServerNode.demo_network_limiter
                          ? 'text-yellow-500'
                          : 'text-muted-foreground'
                      "
                    />
                    <span class="whitespace-nowrap">{{
                      $t("demo_network_limiter.title")
                    }}</span>
                  </div>
                  <Badge
                    variant="outline"
                    class="text-xs w-fit whitespace-nowrap"
                    :class="
                      gameServerNode.demo_network_limiter
                        ? 'border-yellow-500 text-yellow-500'
                        : 'text-muted-foreground'
                    "
                  >
                    <template v-if="gameServerNode.demo_network_limiter">
                      {{ gameServerNode.demo_network_limiter }} Mbps
                    </template>
                    <template v-else>
                      {{ $t("demo_network_limiter.unlimited_short") }}
                    </template>
                  </Badge>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem @click="showPortsDialog = true">
                <div class="flex items-center gap-2">
                  <span>{{ $t("game_server.edit_ports") }}</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem @click="toggleEnabled">
                  <template v-if="gameServerNode.enabled">
                    <PowerOff class="mr-2 h-4 w-4" />
                    <span>{{ $t("game_server.disable_node") }}</span>
                  </template>
                  <template v-else>
                    <Power class="mr-2 h-4 w-4" />
                    <span>{{ $t("game_server.enable_node") }}</span>
                  </template>
                </DropdownMenuItem>

                <DropdownMenuItem
                  v-if="gameServerNode.enabled"
                  @click="toggleGameServerNodeScheduling"
                >
                  <template
                    v-if="
                      gameServerNode.status ===
                      e_game_server_node_statuses_enum.NotAcceptingNewMatches
                    "
                  >
                    <CalendarCheck class="mr-2 h-4 w-4" />
                    {{ $t("game_server.enable_scheduling") }}
                  </template>
                  <template v-else>
                    <CalendarX class="mr-2 h-4 w-4" />
                    {{ $t("game_server.disable_scheduling") }}
                  </template>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                @click="removeGameNodeServer"
                class="text-red-500"
              >
                <Trash2 class="mr-2 h-4 w-4" />
                <span>{{ $t("game_server.remove_node") }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Overprovisioning Warning (if applicable) -->
        <div
          v-if="overPrevisionedServers"
          class="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg"
        >
          <AlertCircle class="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div class="text-xs space-y-1">
            <div class="font-semibold text-red-600 dark:text-red-400">
              {{ $t("game_server.overprovisioned_warning") }}
            </div>
            <div class="text-red-700 dark:text-red-300">
              {{
                $t("game_server.overprovisioned_warning_description", {
                  total_server_count: gameServerNode.total_server_count,
                  max_servers: maxServers,
                })
              }}
            </div>
          </div>
        </div>

        <!-- Accordion Sections -->
        <div class="space-y-2 border-t pt-3">
          <!-- CPU & Hardware Section -->
          <div class="border rounded-lg">
            <button
              type="button"
              class="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
              @click="toggleSection('cpu')"
            >
              <div class="flex items-center gap-2">
                <Cpu class="h-4 w-4" />
                <span class="font-medium text-sm">CPU & Hardware</span>
              </div>
              <ChevronDown
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': isSectionExpanded('cpu') }"
              />
            </button>
            <div
              v-if="isSectionExpanded('cpu')"
              class="px-3 py-2 border-t space-y-2 text-xs"
            >
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_speed") }}:</span
                >
                <span :class="showMaxCPUFrequencyWarning ? 'text-red-500' : ''">
                  {{ maxFrequency ? `${maxFrequency}GHz` : "-" }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_model") }}:</span
                >
                <span class="text-right">{{
                  gameServerNode.cpu_frequency_info?.model || "-"
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_sockets") }}:</span
                >
                <span>{{ gameServerNode.cpu_sockets || "-" }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_cores_per_socket") }}:</span
                >
                <span>{{ gameServerNode.cpu_cores_per_socket || "-" }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{{ $t("game_server.cpu_threads_per_core") }}:</span
                >
                <span>{{ gameServerNode.cpu_threads_per_core || "-" }}</span>
              </div>
              <div class="pt-2 border-t space-y-1">
                <div class="flex justify-between">
                  <span class="text-muted-foreground"
                    >{{
                      $t("pages.game_server_nodes.table.cpu_governor")
                    }}:</span
                  >
                  <span
                    class="capitalize"
                    :class="isCpuGovernorPowerSave ? 'text-red-500' : ''"
                  >
                    {{
                      gameServerNode.cpu_governor_info?.governor || "unknown"
                    }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="flex items-center gap-1">
                    <Activity
                      class="h-3 w-3"
                      :class="
                        gameServerNode.supports_low_latency
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      "
                    />
                    <span class="text-muted-foreground">Low Latency</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Cpu
                      class="h-3 w-3"
                      :class="
                        gameServerNode.supports_cpu_pinning
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      "
                    />
                    <span class="text-muted-foreground">CPU Pinning</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="h-3 w-3"
                      :class="
                        gameServerNode.gpu
                          ? 'text-green-500'
                          : 'text-muted-foreground'
                      "
                    >
                      <path d="M2 21V3" />
                      <path d="M2 5h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2.26" />
                      <path d="M7 17v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3" />
                      <circle cx="16" cy="11" r="2" />
                      <circle cx="8" cy="11" r="2" />
                    </svg>
                    <span class="text-muted-foreground">GPU</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Game Server Versions Section -->
          <div class="border rounded-lg" v-if="gameServerNode.build_id">
            <button
              type="button"
              class="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
              @click="toggleSection('versions')"
            >
              <div class="flex items-center gap-2">
                <RefreshCw class="h-4 w-4" />
                <span class="font-medium text-sm">Game Server Versions</span>
                <FiveStackToolTip v-if="showBuildUpdateWarning">
                  <template #trigger>
                    <CircleFadingArrowUp class="h-3 w-3 text-yellow-500" />
                  </template>
                  {{ $t("game_server.update_cs") }}
                </FiveStackToolTip>
              </div>
              <ChevronDown
                class="h-4 w-4 transition-transform"
                :class="{ 'rotate-180': isSectionExpanded('versions') }"
              />
            </button>
            <div
              v-if="isSectionExpanded('versions')"
              class="px-3 py-2 border-t grid grid-cols-2 gap-3"
            >
              <!-- CS Build -->
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">CS Build</label>
                <template v-if="gameServerNode.update_status">
                  <div class="flex items-center gap-2">
                    <span class="capitalize text-xs">
                      {{ gameServerNode.update_status }}
                    </span>
                    <Button variant="outline" size="sm" @click="toggleLogs">
                      <Activity class="h-3 w-3" />
                    </Button>
                  </div>
                </template>
                <template v-else>
                  <template v-if="gameServerNode.build_id">
                    <Select
                      :model-value="pinBuildIdForm.values.pin_build_id"
                      @update:model-value="(value) => pinBuildId(value)"
                      :disabled="!supportsGameServerVersionPinning"
                    >
                      <SelectTrigger class="h-8 px-2 text-xs w-full">
                        <div class="flex items-center gap-1 min-w-0">
                          <template v-if="nodeBuildVersion">
                            <span class="truncate"
                              >{{ nodeBuildVersion?.version }} ({{
                                nodeBuildVersion?.build_id
                              }})</span
                            >
                          </template>
                          <template v-else>
                            <span class="truncate">{{
                              gameServerNode.build_id
                            }}</span>
                          </template>
                          <Pin
                            v-if="gameServerNode.pin_build_id"
                            class="h-3 w-3 text-blue-500"
                          />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem :value="null">
                            <div class="flex flex-col gap-1">
                              <div class="text-sm font-medium">
                                {{ $t("game_server.unpin_build_id") }}
                              </div>
                              <div class="text-xs text-muted-foreground">
                                {{ $t("game_server.use_latest_version") }}
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem
                            :value="version.build_id"
                            v-for="version of gameVersions"
                            :key="version.build_id"
                          >
                            <div class="flex flex-col gap-1">
                              <div class="flex items-center gap-1">
                                <span class="font-medium">{{
                                  version.version
                                }}</span>
                                <span class="text-muted-foreground"
                                  >({{ version.build_id }})</span
                                >
                                <Pin
                                  v-if="
                                    gameServerNode.pin_build_id ===
                                    version.build_id
                                  "
                                  class="h-3 w-3 text-blue-500 ml-1"
                                />
                              </div>
                              <div class="text-xs text-muted-foreground">
                                {{
                                  new Date(version.updated_at).toLocaleString()
                                }}
                                <span
                                  v-if="version.current"
                                  class="text-green-500 ml-1"
                                  >({{ $t("game_server.current") }})</span
                                >
                              </div>
                            </div>
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </template>
                  <template v-else>
                    <Button
                      size="sm"
                      class="w-full"
                      @click="updateCs"
                      :disabled="
                        gameServerNode.status !==
                        e_game_server_node_statuses_enum.Online
                      "
                      v-if="gameServerNode.enabled"
                    >
                      {{ $t("game_server.install_cs") }}
                    </Button>
                  </template>
                </template>
              </div>

              <!-- Plugin Version -->
              <div class="space-y-1" v-if="gameServerNode.build_id">
                <label class="text-xs text-muted-foreground"
                  >Plugin Version</label
                >
                <Select
                  :model-value="pinPluginVersionForm.values.pin_plugin_version"
                  @update:model-value="(value) => pinPluginVersion(value)"
                >
                  <SelectTrigger class="h-8 px-2 text-xs w-full">
                    <div class="flex items-center gap-1 min-w-0">
                      <span
                        v-if="gameServerNode.pin_plugin_version"
                        class="truncate"
                        >{{ gameServerNode.pin_plugin_version }}</span
                      >
                      <span v-else class="text-muted-foreground truncate">{{
                        $t("game_server.auto")
                      }}</span>
                      <Pin
                        v-if="gameServerNode.pin_plugin_version"
                        class="h-3 w-3 text-blue-500"
                      />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem :value="null">
                        <div class="flex flex-col gap-1">
                          <div class="text-sm font-medium">
                            {{ $t("game_server.unpin_plugin_version") }}
                          </div>
                          <div class="text-xs text-muted-foreground">
                            {{ $t("game_server.use_latest_plugin") }}
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem
                        :value="version.version"
                        v-for="version of pluginVersions"
                        :key="version.version"
                      >
                        <div class="flex flex-col gap-1">
                          <div class="flex items-center gap-1">
                            <span class="font-medium">{{
                              version.version
                            }}</span>
                            <Pin
                              v-if="
                                gameServerNode.pin_plugin_version ===
                                version.version
                              "
                              class="h-3 w-3 text-blue-500 ml-1"
                            />
                          </div>
                          <div class="text-xs text-muted-foreground">
                            <div
                              v-if="version.min_game_build_id"
                              class="text-green-500"
                            >
                              {{ $t("game_server.plugin_version_supports") }}:
                              {{ version.min_game_build_id }}+
                            </div>
                            <div>
                              {{ $t("game_server.plugin_version_published") }}:
                              {{
                                new Date(version.published_at).toLocaleString()
                              }}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <div
                  v-if="!gameServerNode.plugin_supported"
                  class="flex items-center gap-2 text-red-500 text-xs"
                >
                  <AlertCircle class="h-3 w-3" />
                  <span>{{ $t("game_server.plugin_not_supported") }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Metrics Toggle Button -->
          <Button
            variant="outline"
            size="sm"
            class="w-full"
            @click="toggleNodeMetrics"
          >
            <Activity class="mr-2 h-4 w-4" />
            {{ shouldShowMetrics ? "Hide Metrics" : "Show Metrics" }}
          </Button>
        </div>
      </div>
    </TableCell>
  </TableRow>

  <!-- Mobile Metrics Row -->
  <TableRow class="xl:hidden border-t-0" v-if="shouldShowMetrics">
    <TableCell :colspan="8">
      <NodeMetrics :game-server-node="gameServerNode" />
    </TableCell>
  </TableRow>

  <!-- Logs Row (works for both desktop and mobile) -->
  <TableRow class="border-t-0" v-if="showLogs">
    <TableCell :colspan="8">
      <ServiceLogs
        :service="`cs-update:${gameServerNode.id}`"
        :compact="true"
      />
    </TableCell>
  </TableRow>

  <!-- Desktop Metrics Row (xl and up) -->
  <TableRow class="hidden xl:table-row border-t-0" v-if="shouldShowMetrics">
    <TableCell :colspan="8">
      <NodeMetrics :game-server-node="gameServerNode" />
    </TableCell>
  </TableRow>

  <!-- Ports Dialog -->
  <Dialog v-model:open="showPortsDialog">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("game_server.edit_ports") }}</DialogTitle>
        <DialogDescription>
          {{ $t("game_server.edit_ports_description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="py-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <FormField v-slot="{ value }" name="start_port_range">
            <FormItem class="space-y-1">
              <div class="text-xs text-muted-foreground">
                {{ $t("game_server.port_start") }}
              </div>
              <NumberField
                :min="30000"
                :max="32767"
                :step="2"
                :model-value="value"
                @update:model-value="
                  (val) => portForm.setFieldValue('start_port_range', val)
                "
                :format-options="{ useGrouping: false }"
              >
                <NumberFieldContent class="flex items-center">
                  <NumberFieldDecrement />
                  <FormControl>
                    <NumberFieldInput class="w-full text-center text-xs px-1" />
                  </FormControl>
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ value }" name="end_port_range">
            <FormItem class="space-y-1">
              <div class="text-xs text-muted-foreground">
                {{ $t("game_server.port_end") }}
              </div>
              <NumberField
                :min="30000"
                :max="32767"
                :step="2"
                :model-value="value"
                @update:model-value="
                  (val) => portForm.setFieldValue('end_port_range', val)
                "
                :format-options="{ useGrouping: false }"
              >
                <NumberFieldContent class="flex items-center">
                  <NumberFieldDecrement />
                  <FormControl>
                    <NumberFieldInput class="w-full text-center text-xs px-1" />
                  </FormControl>
                  <NumberFieldIncrement />
                </NumberFieldContent>
              </NumberField>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="showPortsDialog = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button @click="savePorts">
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Network Limiter Dialog -->
  <Dialog v-model:open="showNetworkLimiterDialog">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("demo_network_limiter.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("demo_network_limiter.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="py-4">
        <Select
          :model-value="selectedNetworkLimit?.toString()"
          @update:model-value="
            (value) => (selectedNetworkLimit = value ? parseInt(value) : null)
          "
        >
          <SelectTrigger class="w-full">
            <SelectValue
              :placeholder="$t('demo_network_limiter.network_limit')"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem :value="null">
                {{ $t("demo_network_limiter.unlimited") }}
              </SelectItem>
              <SelectItem value="0">0 Mbps</SelectItem>
              <SelectItem value="1">1 Mbps</SelectItem>
              <SelectItem value="2">2 Mbps</SelectItem>
              <SelectItem value="5">5 Mbps</SelectItem>
              <SelectItem value="10">10 Mbps</SelectItem>
              <SelectItem value="20">20 Mbps</SelectItem>
              <SelectItem value="50">50 Mbps</SelectItem>
              <SelectItem value="100">100 Mbps</SelectItem>
              <SelectItem value="200">200 Mbps</SelectItem>
              <SelectItem value="500">500 Mbps</SelectItem>
              <SelectItem value="1000">1000 Mbps</SelectItem>
              <SelectItem value="2000">2000 Mbps</SelectItem>
              <SelectItem value="5000">5000 Mbps</SelectItem>
              <SelectItem value="10000">10000 Mbps</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showNetworkLimiterDialog = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button @click="saveNetworkLimit">
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <UpdateGameServerLabel
    :game-server-node="gameServerNode"
    :open="editLabelSheet"
    @close="editLabelSheet = false"
  />
</template>

<script lang="ts">
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { toast } from "@/components/ui/toast";
import { defineComponent } from "vue";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

interface ServerRegion {
  value: string;
  is_lan: boolean;
  description: string;
}

interface GameServerNode {
  id: string;
  status: string;
  region: string;
  enabled: boolean;
  demo_network_limiter?: number | null;
  build_id?: string;
  pin_build_id?: string;
  pin_plugin_version?: string;
  lan_ip?: string;
  public_ip?: string;
  start_port_range: number;
  end_port_range: number;
  label?: string;
  supports_low_latency?: boolean;
  supports_cpu_pinning?: boolean;
  cpu_governor_info?: string;
  plugin_supported?: boolean;
  update_status?: string;
  e_region?: {
    description: string;
  };
  e_status?: {
    description: string;
  };
  total_server_count: number;
  available_server_count: number;
}

interface ComponentData {
  showUpdateLogs: boolean;
  showLogs: boolean;
  showNodeMetrics: boolean;
  showNetworkLimiterDialog: boolean;
  showPortsDialog: boolean;
  selectedNetworkLimit: number | null;
  gameVersions: any[];
  pluginVersions: any[];
  regionForm: {
    region: string | undefined;
  };
  editLabelSheet: boolean;
  pinBuildIdForm: ReturnType<typeof useForm>;
  pinPluginVersionForm: ReturnType<typeof useForm>;
  portForm: ReturnType<typeof useForm>;
  server_regions: ServerRegion[];
}

export default defineComponent({
  props: {
    gameServerNode: {
      type: Object as () => GameServerNode,
      required: true,
    },
    displayMetrics: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["toggle-metrics"],
  apollo: {
    server_regions: {
      query: generateQuery({
        server_regions: [
          {},
          {
            value: true,
            is_lan: true,
            description: true,
          },
        ],
      }),
    },
    $subscribe: {
      game_versions: {
        query: typedGql("subscription")({
          game_versions: [
            {
              order_by: {
                updated_at: "desc",
              },
            },
            {
              build_id: true,
              version: true,
              description: true,
              updated_at: true,
              current: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.gameVersions = data.game_versions;
        },
      },
      plugin_versions: {
        query: typedGql("subscription")({
          plugin_versions: [
            {
              order_by: {
                published_at: "desc",
              },
            },
            {
              version: true,
              min_game_build_id: true,
              published_at: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.pluginVersions = data.plugin_versions;
        },
      },
    },
    // metrics now fetched inside NodeMetrics component
  },
  data(): ComponentData {
    return {
      showUpdateLogs: false,
      showLogs: false,
      showNodeMetrics: false,
      showNetworkLimiterDialog: false,
      showPortsDialog: false,
      selectedNetworkLimit: null,
      gameVersions: [],
      pluginVersions: [],
      regionForm: {
        region: undefined,
      },
      editLabelSheet: false,
      server_regions: [],
      pinBuildIdForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            pin_build_id: z.string().nullable(),
          }),
        ),
      }),
      pinPluginVersionForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            pin_plugin_version: z.string().nullable(),
          }),
        ),
      }),
      portForm: useForm({
        validationSchema: toTypedSchema(
          z.object({
            start_port_range: z
              .number()
              .min(30000)
              .max(32767) // https://kubernetes.io/docs/reference/networking/ports-and-protocols/
              .nullable(),
            end_port_range: z
              .number()
              .min(30000)
              .max(32767)
              .nullable()
              .refine(
                () => {
                  return (
                    !this.portForm.values.start_port_range ||
                    !this.portForm.values.end_port_range ||
                    this.portForm.values.end_port_range >=
                      this.portForm.values.start_port_range + 2
                  );
                },
                {
                  message: this.$t(
                    "game_server.validation.end_port_greater_than_start",
                  ),
                },
              ),
          }),
        ),
      }),
    };
  },
  watch: {
    gameServerNode: {
      immediate: true,
      handler(gameServerNode) {
        if (!gameServerNode) {
          return;
        }

        const { region } = gameServerNode;
        this.regionForm.region = region;

        if (this.gameServerNode.pin_build_id) {
          this.pinBuildIdForm.setValues({
            pin_build_id: this.gameServerNode.pin_build_id,
          });
        }

        if (this.gameServerNode.pin_plugin_version) {
          this.pinPluginVersionForm.setValues({
            pin_plugin_version: this.gameServerNode.pin_plugin_version,
          });
        }
      },
    },
    showPortsDialog: {
      handler(isOpen) {
        if (isOpen) {
          const start = this.gameServerNode.start_port_range || 30000;
          const end =
            this.gameServerNode.end_port_range || 30000 + this.maxServers * 2;

          this.portForm.setValues({
            start_port_range: start,
            end_port_range: end,
          });
        }
      },
    },
    showNetworkLimiterDialog: {
      handler(isOpen) {
        if (isOpen) {
          this.selectedNetworkLimit =
            this.gameServerNode.demo_network_limiter ?? null;
        }
      },
    },
  },
  methods: {
    async updateCs() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          updateCs: [
            {
              game_server_node_id: this.gameServerNode.id,
            },
            {
              success: true,
            },
          ],
        }),
      });

      this.showUpdateLogs = true;
      this.showLogs = true;

      toast({
        title: this.$t("game_server.toast.cs_updating"),
      });
    },
    async pinBuildId(buildId: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                pin_build_id: buildId ? parseInt(buildId) : null,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.pinBuildIdForm.setValues({
        pin_build_id: buildId,
      });

      toast({
        title: this.$t("game_server.pinned_build_id"),
      });
    },
    async pinPluginVersion(pluginVersion: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                pin_plugin_version: pluginVersion,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      this.pinPluginVersionForm.setValues({
        pin_plugin_version: pluginVersion,
      });

      toast({
        title: this.$t("game_server.pinned_plugin_version"),
      });
    },
    async removeGameNodeServer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_game_server_nodes_by_pk: [
            {
              id: this.gameServerNode.id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async updateServerPorts() {
      const { start_port_range, end_port_range } = this.portForm.values;

      if (!start_port_range || !end_port_range) {
        return;
      }

      const { valid } = await this.portForm.validate();

      if (!valid) {
        return;
      }

      if (
        this.portForm.values.start_port_range ===
          this.gameServerNode.start_port_range &&
        this.portForm.values.end_port_range ===
          this.gameServerNode.end_port_range
      ) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                start_port_range: this.portForm.values.start_port_range,
                end_port_range: this.portForm.values.end_port_range,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("game_server.toast.ports_updated"),
      });
    },
    async savePorts() {
      const { valid } = await this.portForm.validate();
      if (!valid) {
        return;
      }
      await this.updateServerPorts();
      this.showPortsDialog = false;
    },
    async updateRegion(region: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                region,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async updateNetworkLimiter(limit: string | null) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                demo_network_limiter: limit ? parseInt(limit) : null,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async saveNetworkLimit() {
      const limit = this.selectedNetworkLimit?.toString() || null;
      await this.updateNetworkLimiter(limit);
      this.showNetworkLimiterDialog = false;
      toast({
        title: this.$t("demo_network_limiter.updated"),
      });
    },
    async toggleEnabled() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_game_server_nodes_by_pk: [
            {
              pk_columns: {
                id: this.gameServerNode.id,
              },
              _set: {
                enabled: !this.gameServerNode.enabled,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async toggleGameServerNodeScheduling() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          setGameNodeSchedulingState: [
            {
              game_server_node_id: this.gameServerNode.id,
              enabled:
                this.gameServerNode.status ===
                e_game_server_node_statuses_enum.NotAcceptingNewMatches,
            },
            {
              success: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("game_server.toast.scheduling_updated"),
      });
    },
    toggleLogs() {
      this.showLogs = !this.showLogs;
    },
    toggleNodeMetrics() {
      this.showNodeMetrics = !this.showNodeMetrics;
    },
  },
  computed: {
    shouldShowMetrics() {
      // Force show metrics if parent displayMetrics is true, otherwise use local state
      return this.displayMetrics || this.showNodeMetrics;
    },
    currentGameVersion() {
      return this.gameVersions.find((version) => {
        return version.current === true;
      });
    },
    nodeBuildVersion() {
      return (
        this.gameVersions.find((version) => {
          return version.build_id == this.gameServerNode.build_id;
        }) || null
      );
    },
    supportsGameServerVersionPinning() {
      return useApplicationSettingsStore().supportsGameServerVersionPinning;
    },
    showBuildUpdateWarning() {
      if (!this.gameServerNode.build_id) {
        return false;
      }
      return (
        (this.gameServerNode.pin_build_id &&
          this.gameServerNode.pin_build_id != this.gameServerNode?.build_id) ||
        (!this.gameServerNode.pin_build_id &&
          this.gameServerNode.build_id != this.currentGameVersion?.build_id)
      );
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    overPrevisionedServers() {
      if (!this.gameServerNode.enabled) {
        return false;
      }
      return this.maxServers < this.gameServerNode.total_server_count;
    },
    maxFrequency() {
      return this.gameServerNode.cpu_frequency_info?.frequency;
    },
    showMaxCPUFrequencyWarning() {
      return this.maxFrequency && this.maxFrequency < 3;
    },
    isCpuGovernorPowerSave() {
      return this.gameServerNode.cpu_governor_info?.governor === "powersave";
    },
    isCpuGovernorNotOptimal() {
      const governor = this.gameServerNode.cpu_governor_info?.governor;
      return governor && governor !== "performance";
    },
    portRangeLabel() {
      const start = this.gameServerNode.start_port_range;
      const end = this.gameServerNode.end_port_range;
      if (!start || !end) {
        return "-";
      }
      return `${start}-${end}`;
    },
    maxServers() {
      const virtualCPUsAvailable =
        this.gameServerNode.cpu_sockets *
          this.gameServerNode.cpu_cores_per_socket *
          this.gameServerNode.cpu_threads_per_core -
        1;

      if (
        !this.gameServerNode.supports_cpu_pinning ||
        !this.cpuPinningEnabled
      ) {
        return virtualCPUsAvailable;
      }

      return Math.floor(virtualCPUsAvailable / this.numberOfCpusPerServer);
    },
    cpuPinningEnabled() {
      return (
        this.settings.find((setting) => {
          return setting.name === "enable_cpu_pinning";
        })?.value === "true"
      );
    },
    numberOfCpusPerServer() {
      return this.settings.find((setting) => {
        return setting.name === "number_of_cpus_per_server";
      })?.value;
    },
  },
});
</script>
