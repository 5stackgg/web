<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <PlayerDisplay
    :player="member.player"
    :show-online="showStatus"
    :show-flag="showDetails"
    :show-steam-id="showDetails"
    :show-name="showDetails"
    :ping-status="showDetails"
  >
    <template v-slot:avatar-sub v-if="showDetails">
      <Badge variant="outline" v-if="member.captain">
        {{ $t("match.player.captain") }}
      </Badge>
    </template>

    <template v-slot:status v-if="showStatus">
      <FiveStackToolTip>
        <template #trigger>
          <span
            class="absolute -top-1 left-0 h-2 w-2 rounded-full animate-ping"
            :class="{
              ['bg-red-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? !isOnline && !isReady
                  : !isOnline && !inGame,
              ['bg-yellow-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? isOnline && !isReady
                  : isOnline && !inGame,
              ['bg-green-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? isReady
                  : inGame,
            }"
          ></span>
          <span
            class="absolute -top-1 left-0 h-2 w-2 rounded-full"
            :class="{
              ['bg-red-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? !isOnline && !isReady
                  : !isOnline && !inGame,
              ['bg-yellow-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? isOnline && !isReady
                  : isOnline && !inGame,
              ['bg-green-500']:
                match && match.status === e_match_status_enum.WaitingForCheckIn
                  ? isReady
                  : inGame,
            }"
          ></span>
        </template>

        <template
          v-if="match && match.status === e_match_status_enum.WaitingForCheckIn"
        >
          <template v-if="!isOnline && !isReady">
            {{ $t("match.player.status.offline_not_ready") }}
          </template>
          <template v-else-if="isOnline && !isReady">
            {{ $t("match.player.status.online_not_ready") }}
          </template>
          <template v-else> {{ $t("match.player.status.ready") }} </template>
        </template>
        <template v-else>
          <template v-if="!isOnline && !inGame">
            {{ $t("match.player.status.offline") }}
          </template>
          <template v-else-if="isOnline && !inGame">
            {{ $t("match.player.status.online_not_in_game") }}
          </template>
          <template v-else> {{ $t("match.player.status.in_game") }} </template>
        </template>
      </FiveStackToolTip>
    </template>
  </PlayerDisplay>
</template>

<script lang="ts">
export default {
  props: {
    member: {
      type: Object,
      required: true,
    },
    match: {
      type: Object,
      required: false,
    },
    showDetails: {
      default: true,
      type: Boolean,
    },
  },
  computed: {
    e_match_status_enum() {
      return e_match_status_enum;
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[this.match.id];
    },
    isOnline() {
      return useMatchmakingStore().onlinePlayerSteamIds.includes(
        this.member.player.steam_id,
      );
    },
    inGame() {
      return this.lobby?.get(this.member.player.steam_id)?.inGame;
    },
    isReady() {
      return this.member.checked_in;
    },
    showStatus() {
      if (!this.match) {
        return false;
      }

      return [
        e_match_status_enum.Veto,
        e_match_status_enum.Live,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.WaitingForCheckIn,
      ].includes(this.match.status);
    },
  },
};
</script>
