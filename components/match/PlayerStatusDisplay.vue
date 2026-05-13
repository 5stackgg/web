<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
import {
  e_check_in_settings_enum,
  e_match_status_enum,
} from "~/generated/zeus";
import { useSidebar } from "../ui/sidebar";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";

const { isMobile } = useSidebar();
</script>

<template>
  <PlayerDisplay
    :player="member.player"
    :avatar-override="teamRosterAvatar"
    :show-online="showStatus"
    :show-flag="showDetails"
    :show-name="showDetails"
    :ping-status="showDetails"
    :show-role="showDetails"
    :linkable="linkable"
    :show-elo="true"
    :compact="isMobile"
  >
    <template v-slot:avatar-sub v-if="showDetails">
      <Badge
        variant="outline"
        class="hidden md:inline-flex text-[10px] px-1 py-0"
        v-if="member.captain"
      >
        {{ $t("match.player.captain") }}
      </Badge>
    </template>

    <template v-if="$slots['name-postfix']" #name-postfix>
      <slot name="name-postfix"></slot>
    </template>

    <template v-if="$slots['elo-postfix']" #elo-postfix>
      <slot name="elo-postfix"></slot>
    </template>

    <template v-if="$slots['avatar-badge']" #avatar-badge>
      <slot name="avatar-badge"></slot>
    </template>

    <template v-slot:status v-if="showStatus">
      <FiveStackToolTip side="bottom" :delay-duration="300">
        <template #trigger>
          <div class="h-full w-full absolute top-0 left-0 right-0 bottom-0">
            <span
              class="absolute -top-1 h-2 w-2 rounded-full animate-ping"
              :class="{
                'left-0': !flip,
                '-right-1': flip,
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
              class="absolute -top-1 h-2 w-2 rounded-full"
              :class="{
                'left-0': !flip,
                '-right-1': flip,
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
          </div>
        </template>

        <div class="flex flex-col gap-1">
          <div class="text-center" v-if="showName">
            {{ member.player.name }}
          </div>

          <div v-if="match">
            <template
              v-if="match.status === e_match_status_enum.WaitingForCheckIn"
            >
              <template v-if="!isOnline && !isReady">
                {{ $t("match.player.status.offline_not_ready") }}
              </template>
              <template v-else-if="isOnline && !isReady">
                {{ $t("match.player.status.online_not_ready") }}
              </template>
              <template v-else>
                {{ $t("match.player.status.ready") }}
              </template>
            </template>
            <template v-else>
              <template v-if="!isOnline && !inGame">
                {{ $t("common.offline") }}
              </template>
              <template v-else-if="isOnline && !inGame">
                {{ $t("match.player.status.online_not_in_game") }}
              </template>
              <template v-else>
                {{ $t("match.player.status.in_game") }}
              </template>
            </template>
          </div>
        </div>
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
    linkable: {
      default: true,
      type: Boolean,
    },
    flip: {
      default: false,
      type: Boolean,
    },
    showName: {
      default: false,
      type: Boolean,
    },
  },
  computed: {
    e_match_status_enum() {
      return e_match_status_enum;
    },
    // Resolve a team-roster portrait for the player based on whichever
    // lineup they sit in for this match. Falls through to player's own
    // portrait when there's no match context or no team_id on the lineup.
    teamRosterAvatar() {
      const steamId = this.member?.player?.steam_id;
      if (!steamId || !this.match) return null;
      const lineups = [this.match.lineup_1, this.match.lineup_2].filter(
        Boolean,
      );
      for (const lineup of lineups) {
        const inLineup = lineup.lineup_players?.some(
          (lp: any) => String(lp.steam_id) === String(steamId),
        );
        if (!inLineup) continue;
        return buildLineupAvatarOverride(lineup)(steamId);
      }
      return null;
    },
    lobby() {
      return useMatchLobbyStore().lobbyChat[`match:${this.match?.id}`];
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
      switch (this.match.options.check_in_setting) {
        case e_check_in_settings_enum.Players:
          return this.member.checked_in;
        case e_check_in_settings_enum.Captains:
          if (this.member.captain) {
            return this.member.checked_in;
          }
          return true;
        case e_check_in_settings_enum.Admin:
          return true;
      }
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
