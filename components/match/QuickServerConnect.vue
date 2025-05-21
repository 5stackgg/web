<script setup lang="ts">
import { Loader, ExternalLink, Copy } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <div v-if="match.connection_string">
    <template v-if="!match.is_server_online">
      <template v-if="match.server_type === 'Dedicated'">
        {{ $t("match.server.offline") }}
      </template>
      <template v-else>
        <div class="flex">
          {{ $t("match.server.booting") }}
          <Loader class="animate-spin ml-3"></Loader>
        </div>
      </template>
    </template>
    <template v-else>
      <div
        class="flex items-center gap-2 p-4 rounded-lg border bg-foreground/10"
        v-if="match.connection_string"
      >
        <ClipBoard
          :data="match.connection_string"
          class="shrink-0 p-3 rounded-md"
          :class="{
            grow: !match.connection_link,
          }"
        >
          <div
            class="flex items-center justify-center gap-2"
            v-if="!match.connection_link"
          >
            <Copy class="w-4 h-4" />
            <span>Copy Link</span>
          </div>
        </ClipBoard>
        <template v-if="match.connection_link">
          <a
            :href="match.connection_link"
            class="flex items-center justify-center gap-2 rounded-md p-3 w-full transition-colors bg-background hover:bg-background/50"
          >
            <div class="relative flex items-center" v-if="isInLineup">
              <span
                class="absolute w-2 h-2 rounded-full animate-ping"
                :class="inGame ? 'bg-green-500' : 'bg-red-500'"
              ></span>
              <span
                class="relative w-2 h-2 rounded-full"
                :class="inGame ? 'bg-green-500' : 'bg-red-500'"
              ></span>
            </div>
            <span>Join Server</span>
            <ExternalLink class="w-4 h-4" />
          </a>
        </template>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[`match:${this.match?.id}`];
    },
    isInLineup() {
      return this.match.is_in_lineup;
    },
    inGame() {
      return this.lobby?.get(this.me?.steam_id)?.inGame || false;
    },
  },
};
</script>
