<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { e_game_server_node_statuses_enum } from "~/generated/zeus";
import TimeAgo from "~/components/TimeAgo.vue";
import { Activity, Cpu, ExternalLink, AlertTriangle } from "lucide-vue-next";
</script>

<template>
  <div class="flex gap-3 items-start">
    <!-- Status indicator with tooltip -->
    <FiveStackToolTip>
      <template #trigger>
        <div
          class="h-2 w-2 rounded-full relative mt-1"
          :class="{
            ['bg-red-600']:
              gameServerNode.status ===
              e_game_server_node_statuses_enum.Offline,
            ['bg-green-600']:
              gameServerNode.status === e_game_server_node_statuses_enum.Online,
            ['bg-yellow-600']:
              gameServerNode.status ===
                e_game_server_node_statuses_enum.Setup ||
              gameServerNode.status ===
                e_game_server_node_statuses_enum.NotAcceptingNewMatches,
            ['bg-orange-400']: showMaxCPUFrequencyWarning,
          }"
        >
          <span
            class="animate-ping absolute left-0 h-2 w-2 rounded-full opacity-75"
            :class="{
              ['bg-red-400']:
                gameServerNode.status ===
                e_game_server_node_statuses_enum.Offline,
              ['bg-yellow-400']:
                gameServerNode.status ===
                  e_game_server_node_statuses_enum.Setup ||
                gameServerNode.status ===
                  e_game_server_node_statuses_enum.NotAcceptingNewMatches,
            }"
            v-if="
              gameServerNode.status !== e_game_server_node_statuses_enum.Online
            "
          ></span>
        </div>
      </template>

      <div class="flex items-center gap-1 font-medium">
        <template
          v-if="
            gameServerNode.status === e_game_server_node_statuses_enum.Offline
          "
        >
          {{ $t("pages.game_server_nodes.status.offline") }}
          <template v-if="gameServerNode.offline_at">
            <TimeAgo :date="gameServerNode.offline_at" />
          </template>
        </template>
        <template
          v-else-if="
            gameServerNode.status === e_game_server_node_statuses_enum.Online
          "
        >
          {{ $t("pages.game_server_nodes.status.online") }}
        </template>
        <template
          v-else-if="
            gameServerNode.status === e_game_server_node_statuses_enum.Setup
          "
        >
          {{ $t("pages.game_server_nodes.status.setup") }}
        </template>
        <template
          v-else-if="
            gameServerNode.status ===
            e_game_server_node_statuses_enum.NotAcceptingNewMatches
          "
        >
          {{ $t("pages.game_server_nodes.status.not_accepting") }}
        </template>
      </div>
    </FiveStackToolTip>

    <div class="flex flex-col gap-2">
      <!-- Node Label and ID -->
      <div class="flex flex-col">
        <div class="font-medium text-sm">
          {{ gameServerNode.label || gameServerNode.id }}
        </div>

        <div
          class="text-muted-foreground text-xs"
          v-if="gameServerNode.lan_ip && gameServerNode.public_ip"
        >
          <a
            :href="`http://${gameServerNode.lan_ip}:8080`"
            target="_blank"
            class="hover:underline"
          >
            {{ gameServerNode.lan_ip }}
          </a>
          {{ gameServerNode.lan_ip && gameServerNode.public_ip ? "/" : "" }}
          {{ gameServerNode.public_ip }}
        </div>

        <div class="text-muted-foreground text-xs" v-if="gameServerNode.label">
          {{ gameServerNode.id }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    gameServerNode: {
      type: Object,
      required: true,
    },
    maxServers: {
      type: Number,
      default: null,
    },
    cpuPinningEnabled: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    maxFrequency() {
      return this.gameServerNode.cpu_frequency_info?.frequency;
    },
    showMaxCPUFrequencyWarning() {
      return this.maxFrequency && this.maxFrequency < 3;
    },
    cpuGovernor() {
      return this.gameServerNode.cpu_governor_info?.governor;
    },
    isCpuGovernorOptimal() {
      return this.cpuGovernor === "performance";
    },
    isCpuGovernorPowerSave() {
      return this.cpuGovernor === "powersave";
    },
    cpuGovernorClass() {
      if (this.isCpuGovernorPowerSave) {
        return "text-red-500";
      }
      return this.isCpuGovernorOptimal ? "text-green-500" : "text-yellow-500";
    },
  },
};
</script>
