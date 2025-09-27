<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <FiveStackToolTip>
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

    <template v-if="!server.connected">
      {{ $t("pages.dedicated_servers.detail.status.disconnected") }}
    </template>
    <template v-else-if="!server.rcon_status">
      {{ $t("pages.dedicated_servers.detail.status.no_rcon") }}
    </template>
    <template v-else-if="pluginVersionMismatch">
      {{ $t("pages.dedicated_servers.detail.status.plugin_version_mismatch") }}
      <small>
        <a
          class="text-blue-500"
          :href="`https://github.com/5stackgg/game-server/releases/tag/v${currentPluginVersion}`"
          target="_blank"
        >
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
    pluginVersionMismatch() {
      if (this.server.type !== e_server_types_enum.Ranked) {
        return false;
      }

      return this.server.plugin_version != this.currentPluginVersion;
    },
  },
};
</script>
