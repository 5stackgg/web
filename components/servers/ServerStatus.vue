<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <FiveStackToolTip interactive>
    <template #trigger>
      <div
        class="h-2 w-2 rounded-full relative"
        :class="{
          'bg-red-600': !server.connected,
          'bg-yellow-600':
            server.connected && (!server.rcon_status || pluginVersionMismatch),
          'bg-green-600':
            server.connected && server.rcon_status && !pluginVersionMismatch,
        }"
      >
        <span
          class="animate-ping absolute left-0 h-2 w-2 rounded-full opacity-75"
          :class="{
            'bg-red-600': !server.connected,
            'bg-yellow-600':
              server.connected &&
              (!server.rcon_status || pluginVersionMismatch),
          }"
          v-if="
            !server.connected || !server.rcon_status || !pluginVersionMismatch
          "
        ></span>
      </div>
    </template>

    <div v-if="!server.connected" class="flex items-center gap-1">
      {{ $t("pages.dedicated_servers.detail.status.disconnected") }}
      <template v-if="server.offline_at">
        <TimeAgo :date="server.offline_at" />
      </template>
    </div>
    <template v-else-if="!server.rcon_status">
      {{ $t("pages.dedicated_servers.detail.status.no_rcon") }}
    </template>
    <template v-else-if="pluginVersionMismatch">
      {{ $t("pages.dedicated_servers.detail.status.plugin_version_mismatch") }}
      <small>
        <a class="text-blue-500" :href="pluginReleaseLink" target="_blank">
          (v{{ currentPluginVersion }})
        </a>
      </small>
    </template>
    <template v-else>
      {{ $t("pages.dedicated_servers.detail.status.connected") }}
    </template>
  </FiveStackToolTip>
</template>

<script lang="ts">
import { e_server_types_enum } from "~/generated/zeus";
import { effectivePluginRuntime } from "~/constants/rconCommands";

// both plugins release out of the one repo, so the tag carries the framework
const PLUGIN_RELEASE_TAG_PREFIXES: Record<string, string> = {
  counterstrikesharp: "css",
  swiftlys2: "sw",
};

export default {
  props: {
    server: {
      type: Object,
      required: true,
    },
  },
  computed: {
    currentPluginVersion() {
      return useApplicationSettingsStore().currentPluginVersion;
    },
    gameServerPluginRuntime() {
      return useApplicationSettingsStore().gameServerPluginRuntime;
    },
    pluginReleaseLink() {
      const prefix =
        PLUGIN_RELEASE_TAG_PREFIXES[
          effectivePluginRuntime(
            this.server.plugin_runtime,
            this.gameServerPluginRuntime,
          )
        ];

      return `https://github.com/5stackgg/game-server/releases/tag/${prefix}-v${this.currentPluginVersion}`;
    },
    pluginVersionMismatch() {
      if (this.server.type !== e_server_types_enum.Ranked) {
        return false;
      }

      // A server on another framework is waiting to be recycled onto the
      // selected runtime; its version is from a lineage we can't compare against.
      if (
        this.server.plugin_runtime &&
        this.server.plugin_runtime !== this.gameServerPluginRuntime
      ) {
        return false;
      }

      return this.server.plugin_version != this.currentPluginVersion;
    },
  },
};
</script>
