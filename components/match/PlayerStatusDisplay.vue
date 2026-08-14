<script lang="ts" setup>
import { computed, getCurrentInstance } from "vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "../FiveStackToolTip.vue";
import {
  canWatchMatchCameras,
  useMatchCameraStatus,
} from "~/composables/useMatchCameraStatus";
import {
  e_check_in_settings_enum,
  e_match_status_enum,
} from "~/generated/zeus";
import { useSidebar } from "../ui/sidebar";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import { Crown } from "lucide-vue-next";
import PartyBadge from "~/components/match/PartyBadge.vue";
import {
  partyIndexOf,
  partyMemberNames,
  partyRingShadow,
} from "~/utilities/matchParties";

const { isMobile } = useSidebar();

// Props are declared in the Options block below; re-declaring them with
// defineProps here would shadow it and break every `this.*` computed. Reading
// them off the instance is the one way to reach them from this half of the
// hybrid without touching the other.
const instance = getCurrentInstance();
const ownProps = computed(
  () => (instance?.props ?? {}) as Record<string, any>,
);

const cameraEnabled = computed(() =>
  canWatchMatchCameras(ownProps.value.match),
);

const { statusFor, loaded: cameraLoaded } = useMatchCameraStatus(
  () => String(ownProps.value.match?.id ?? ""),
  cameraEnabled,
);

// Folded into the presence dot rather than shown as a second icon: one dot per
// player answers "is this person good to go", and a missing camera is one more
// way the answer is no.
const cameraMissing = computed(() => {
  if (!cameraEnabled.value || !cameraLoaded.value) {
    return false;
  }

  const steamId = ownProps.value.member?.player?.steam_id;

  if (!steamId) {
    return false;
  }

  const status = statusFor(String(steamId));

  return !status || !status.ready || status.health !== "live";
});
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
    :match-type="match?.options?.type"
    :at-elo="atElo"
    :external="isExternalMatch"
    :avatar-ring="partyRing"
  >
    <template v-slot:avatar-corner-start v-if="partyIndex !== null">
      <PartyBadge
        :index="partyIndex"
        :source="member.party_source"
        :members="partyNames"
      />
    </template>

    <template v-slot:avatar-corner v-if="member.captain">
      <span
        :title="$t('match.player.captain')"
        class="inline-flex items-center justify-center h-3.5 w-3.5 rounded-sm bg-[hsl(var(--tac-amber))] text-black ring-1 ring-background shadow"
      >
        <Crown class="h-2.5 w-2.5" />
      </span>
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
      <FiveStackToolTip side="top" as-child>
        <template #trigger>
          <span
            class="absolute h-2 w-2 z-30 cursor-default"
            :class="{
              '-left-1': !flip,
              '-right-1': flip,
              '-bottom-1': statusAtBottom,
              '-top-1': !statusAtBottom,
            }"
          >
            <span
              class="absolute inset-0 rounded-full animate-ping"
              :class="{
                ['bg-orange-500']: cameraMissing,
                ['bg-red-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? !isOnline && !isReady
                    : !isOnline && !inGame),
                ['bg-yellow-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? isOnline && !isReady
                    : isOnline && !inGame),
                ['bg-green-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? isReady
                    : inGame),
              }"
            ></span>
            <span
              class="absolute inset-0 rounded-full"
              :class="{
                ['bg-orange-500']: cameraMissing,
                ['bg-red-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? !isOnline && !isReady
                    : !isOnline && !inGame),
                ['bg-yellow-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? isOnline && !isReady
                    : isOnline && !inGame),
                ['bg-green-500']:
                  !cameraMissing &&
                  (match &&
                  match.status === e_match_status_enum.WaitingForCheckIn
                    ? isReady
                    : inGame),
              }"
            ></span>
          </span>
        </template>

        <div class="flex flex-col gap-1">
          <div class="text-center" v-if="showName">
            {{ member.player.name }}
          </div>

          <div v-if="cameraMissing" class="text-orange-400">
            {{ $t("camera.tile.offline") }}
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
    atElo: {
      type: Number,
      required: false,
      default: null,
    },
  },
  computed: {
    e_match_status_enum() {
      return e_match_status_enum;
    },
    partyIndex() {
      return partyIndexOf(this.match, this.member);
    },
    partyNames() {
      return partyMemberNames(this.match, this.member);
    },
    partyRing() {
      if (this.partyIndex === null) {
        return null;
      }
      return partyRingShadow(this.partyIndex);
    },
    // The party chip takes the avatar's top-left corner, so the ping moves down
    // to the one corner nothing else claims (the crown owns bottom-right).
    statusAtBottom() {
      return this.partyIndex !== null && !this.flip;
    },
    // Imported from outside 5stack (e.g. Valve / Faceit match history).
    isExternalMatch() {
      return !!this.match?.source && this.match.source !== "5stack";
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
      if (this.member.checked_in) return true;
      switch (this.match.options.check_in_setting) {
        case e_check_in_settings_enum.Captains:
          return !this.member.captain;
        case e_check_in_settings_enum.Admin:
          return true;
        case e_check_in_settings_enum.Players:
        default:
          return false;
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
