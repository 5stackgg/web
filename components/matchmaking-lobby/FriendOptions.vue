<script lang="ts" setup>
import { Plus, Trash2 } from "lucide-vue-next";
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot></slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuItem @click="inviteToLobby">
        <Plus class="mr-2 h-4 w-4" />
        <span>{{ $t("matchmaking.friends.invite_to_lobby") }}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem @click="removeFriend" class="text-red-500">
        <Trash2 class="mr-2 h-4 w-4" />
        <span>{{ $t("matchmaking.friends.remove") }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
  methods: {
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
