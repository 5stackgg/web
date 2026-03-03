<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <div v-if="match.status === e_match_status_enum.Live && me">
    <template v-if="canWatch && !match.tv_connection_string">
      <div
        class="flex items-center gap-2 p-4 rounded-lg border bg-foreground/10 mb-2"
      >
        <Tv class="w-4 h-4" />
        {{ $t("match.server.tv_delay", { delay: match.options.tv_delay }) }}
      </div>
    </template>
    <template v-if="match.tv_connection_string && !match.connection_link">
      <div
        class="flex items-center gap-2 p-4 rounded-lg border bg-foreground/10 mb-2"
      >
        <ClipBoard
          :data="match.tv_connection_string"
          class="grow shrink-0 p-3 rounded-md h-12 w-12"
        >
          <div class="flex items-center justify-center gap-2">
            <Tv class="w-4 h-4" />
            <span>{{ $t("match.server.join_tv_stream") }}</span>
          </div>
        </ClipBoard>
      </div>
      <Separator class="my-4" label="OR" v-if="match.connection_string" />
    </template>

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
            class="shrink-0 p-3 h-12 w-12"
            :class="{
              grow: !match.connection_link,
            }"
          >
            <div
              class="flex items-center justify-center gap-2"
              v-if="!match.connection_link"
            >
              <Copy class="w-4 h-4" />
              <span>{{ $t("match.server.join_as_spectator") }}</span>
            </div>
          </ClipBoard>
          <template v-if="match.connection_link">
            <a
              :href="match.connection_link"
              class="flex items-center justify-center gap-2 rounded-md p-3 w-full transition-colors bg-background hover:bg-background/50"
              @click="handleClick"
            >
              <template v-if="!isLoading">
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
                <span>{{ $t("match.server.join_server") }}</span>
                <ExternalLink class="w-4 h-4" />
              </template>
              <Loader v-else class="w-6 h-6 animate-spin" />
            </a>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Loader, ExternalLink, Copy, Tv } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  components: {
    Loader,
    ExternalLink,
    Copy,
    Tv,
    ClipBoard,
  },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      isLoading: false,
    };
  },
  methods: {
    handleClick() {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
      }, 10000);
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canWatch() {
      if (this.match.is_in_lineup) {
        return false;
      }

      if (this.match.is_organizer) {
        return this.match.is_server_online;
      }

      return useAuthStore().isRoleAbove(this.minimumRoleToStream);
    },
    minimumRoleToStream() {
      return (
        useApplicationSettingsStore().settings.find(
          (setting) => setting.name === "public.minimum_role_to_stream",
        )?.value || e_player_roles_enum.user
      );
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[`match:${this.match?.id}`];
    },
    isInLineup() {
      return this.match.is_in_lineup;
    },
    inGame() {
      const player =
        (this.lobby?.get(this.me?.steam_id) as unknown as {
          inGame?: boolean;
        }) || undefined;
      return !!player?.inGame;
    },
  },
};
</script>
