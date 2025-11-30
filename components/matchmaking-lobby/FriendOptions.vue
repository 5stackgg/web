<script lang="ts" setup>
import { Plus, Trash2, Users, Gamepad2 } from "lucide-vue-next";
import FiveStackToolTip from "../FiveStackToolTip.vue";
</script>

<template>
  <div @contextmenu="handleRightClick" class="flex items-center cursor-pointer">
    <div class="grow">
      <slot></slot>
      <DropdownMenu v-model:open="isOpen">
        <DropdownMenuTrigger as-child>
          <div></div>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <DropdownMenuItem @click="removeFriend" class="text-red-500">
            <Trash2 class="mr-2 h-4 w-4" />
            <span>{{ $t("matchmaking.friends.remove") }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Badge
      variant="outline"
      class="flex items-center gap-1 p-2"
      v-if="player.player?.is_in_another_match && displayStatus"
    >
      <Gamepad2 class="h-3 w-3" />
      <span>{{ $t("matchmaking.friends.in_match") }}</span>
    </Badge>

    <Badge
      variant="outline"
      class="flex items-center gap-1 p-2"
      v-else-if="player.player?.is_in_lobby && displayStatus"
    >
      <Users class="h-3 w-3" />
      <span>{{ $t("matchmaking.friends.in_lobby") }}</span>
    </Badge>

    <template v-if="canInviteToMatch || canInviteToLobby">
      <template v-if="canInviteToMatch && canInviteToLobby">
        <DropdownMenu>
          <DropdownMenuTrigger
            class="hover:bg-muted/50 transition-all duration-200 rounded-md p-4"
          >
            <Plus class="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuItem @click="inviteToLobby">
              <Plus class="mr-2 h-4 w-4" />
              <span>{{ $t("matchmaking.friends.invite_to_lobby") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              @click="inviteToMatch"
              :class="!canInviteToMatch ? 'opacity-50 pointer-events-none' : ''"
            >
              <Plus class="mr-2 h-4 w-4" />
              <span>{{ $t("matchmaking.friends.invite_to_match") }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
      <template v-else>
        <div
          @click="inviteToLobby"
          class="hover:bg-muted/50 transition-all duration-200 rounded-md p-4"
          v-if="canInviteToLobby"
        >
          <FiveStackToolTip>
            {{ $t("matchmaking.friends.invite_to_lobby") }}
            <template #trigger>
              <Plus class="h-4 w-4" />
            </template>
          </FiveStackToolTip>
        </div>
        <div
          @click="inviteToMatch"
          class="hover:bg-muted/50 transition-all duration-200 rounded-md p-4"
          v-if="canInviteToMatch"
        >
          <FiveStackToolTip>
            {{ $t("matchmaking.friends.invite_to_match") }}
            <template #trigger>
              <Plus class="h-4 w-4" />
            </template>
          </FiveStackToolTip>
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_lobby_access_enum } from "~/generated/zeus";

export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
    displayStatus: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      isOpen: false,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    currentMatch() {
      return useMatchLobbyStore().currentMatch;
    },
    currentLobby() {
      return useMatchmakingStore().lobbies?.find((lobby: any) => {
        return lobby.id === this.me?.current_lobby_id;
      });
    },
    canInviteToLobby() {
      return (
        !this.currentLobby ||
        (this.currentLobby &&
          !this.currentLobby.players.find(
            (player: any) => player.player.steam_id === this.player.steam_id,
          ))
      );
    },
    canInviteToMatch() {
      if (!this.canInviteToLobby) {
        return false;
      }

      if (!this.currentMatch) {
        return false;
      }

      if (this.invitedToMatch) {
        return false;
      }

      if (
        this.currentMatch.organizer_steam_id !== this.me.steam_id &&
        ![
          e_lobby_access_enum.Open,
          e_lobby_access_enum.Friends,
          e_lobby_access_enum.Invite,
        ].includes(this.currentMatch.options.lobby_access)
      ) {
        return false;
      }

      if (
        this.currentMatch.lineup_counts.lineup_1_count <
          this.currentMatch.max_players_per_lineup ||
        this.currentMatch.lineup_counts.lineup_2_count <
          this.currentMatch.max_players_per_lineup
      ) {
        return true;
      }

      return false;
    },
    invitedToMatch() {
      if (!this.currentMatch) {
        return false;
      }

      return this.currentMatch.invites.find(
        (invite) => invite.steam_id === this.player.steam_id,
      );
    },
  },
  methods: {
    handleRightClick(event) {
      event.preventDefault();
      event.stopPropagation();
      this.isOpen = !this.isOpen;
    },
    async inviteToLobby() {
      await useMatchmakingStore().inviteToLobby(this.player.steam_id);
    },
    async inviteToMatch() {
      if (!this.currentMatch) {
        return;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_invites_one: [
            {
              object: {
                steam_id: this.player.steam_id,
                match_id: this.currentMatch.id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async removeFriend() {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          delete_my_friends: [
            {
              where: {
                steam_id: {
                  _eq: this.player.steam_id,
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
