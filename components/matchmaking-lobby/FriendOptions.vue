<script lang="ts" setup>
import { Plus, Trash2, Users, Gamepad2 } from "lucide-vue-next";
import FiveStackToolTip from "../FiveStackToolTip.vue";
</script>

<template>
  <ContextMenu :open="isOpen" :modal="false" @update:open="setMenuOpen">
    <ContextMenuTrigger as-child>
      <div class="flex items-center cursor-pointer">
        <div class="grow">
          <slot></slot>
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
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent
      v-if="isFriend"
      data-right-hub-interactive
      class="w-56"
    >
      <ContextMenuItem @click="removeFriend" class="text-red-500">
        <Trash2 class="mr-2 h-4 w-4" />
        <span>{{ $t("matchmaking.friends.remove") }}</span>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

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
  watch: {
    isOpen(open: boolean, wasOpen: boolean) {
      const rightSidebar = useRightSidebar();
      if (open && !wasOpen) {
        rightSidebar.suspendHoverClose();
      } else if (!open && wasOpen) {
        rightSidebar.resumeHoverClose();
      }
    },
  },
  beforeUnmount() {
    if (this.isOpen) {
      useRightSidebar().resumeHoverClose();
    }
  },
  computed: {
    isFriend() {
      return useMatchmakingStore().friends?.some(
        (friend: any) =>
          friend.steam_id === this.player.steam_id &&
          friend.status !== "Pending",
      );
    },
    me() {
      return useAuthStore().me;
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
  },
  methods: {
    setMenuOpen(open: boolean) {
      if (open && !this.isFriend) return;
      this.isOpen = open;
    },
    async inviteToLobby() {
      await useMatchmakingStore().inviteToLobby(this.player.steam_id);
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
