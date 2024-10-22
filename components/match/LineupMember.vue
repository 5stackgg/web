<script lang="ts" setup>
import FiveStackToolTip from "../FiveStackToolTip.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <template v-if="member.player">
    <div @click="viewPlayer" class="cursor-pointer text-left">
      <PlayerDisplay :player="member.player" :show-online="showStatus">
        <template v-slot:avatar-sub>
          <Badge variant="outline" v-if="member.captain"> Captain </Badge>
        </template>

        <template v-slot:status v-if="showStatus">
          <FiveStackToolTip>
            <template #trigger>
              <span
                class="absolute -top-1 left-0 h-2 w-2 rounded-full animate-ping"
                :class="{
                  ['bg-red-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? !isOnline && !isReady
                      : !isOnline && !inGame,
                  ['bg-yellow-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? isOnline && !isReady
                      : isOnline && !inGame,
                  ['bg-green-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? isReady
                      : inGame,
                }"
              ></span>
              <span
                class="absolute -top-1 left-0 h-2 w-2 rounded-full"
                :class="{
                  ['bg-red-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? !isOnline && !isReady
                      : !isOnline && !inGame,
                  ['bg-yellow-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? isOnline && !isReady
                      : isOnline && !inGame,
                  ['bg-green-500']:
                    match &&
                    match.status === e_match_status_enum.WaitingForCheckIn
                      ? isReady
                      : inGame,
                }"
              ></span>
            </template>

            <template v-if="match && match.status === e_match_status_enum.WaitingForCheckIn">
              <template v-if="!isOnline && !isReady">
                Offline and not ready
              </template>
              <template v-else-if="isOnline && !isReady">
                Online but not ready
              </template>
              <template v-else>
                Ready
              </template>
            </template>
            <template v-else>
              <template v-if="!isOnline && !inGame">
                Offline
              </template>
              <template v-else-if="isOnline && !inGame">
                Online but not in game
              </template>
              <template v-else>
                In game
              </template>
            </template>
          </FiveStackToolTip>
        </template>
      </PlayerDisplay>
    </div>
  </template>
  <template v-else>
    <div class="ml-1 flex gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <NuxtImg
              src="/img/logos/discord.svg"
              alt="Discord"
              class="w-5 h-5"
            />
          </TooltipTrigger>
          <TooltipContent>
            This is a Discord user, register your discord id to enable stat
            tracking by typing <Badge variant="secondary">/link</Badge> in the
            officla discord channel.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {{ member.placeholder_name }}
    </div>
  </template>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";

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
  },
  methods: {
    viewPlayer() {
      this.$router.push(`/players/${this.member.steam_id}`);
    },
  },
  computed: {
    e_match_status_enum() {
      return e_match_status_enum;
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[this.$route.params.id];
    },
    isOnline() {
      return !!this.lobby?.get(this.member.player.steam_id);
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
