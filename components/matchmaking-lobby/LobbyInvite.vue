<script lang="ts" setup>
import TimeAgo from "../TimeAgo.vue";
import PlayerDisplay from "../PlayerDisplay.vue";
import { Check, XIcon } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
</script>

<template>
  <div class="flex flex-row gap-2 justify-between" v-if="invite">
    <div class="flex flex-row gap-2 items-center overflow-scroll">
      <div class="flex flex-row gap-2 items-center overflow-scroll">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <PlayerDisplay
                :player="invitedBy"
                :showOnline="false"
                :showFlag="false"
                :showName="false"
                :showRole="false"
              />
            </TooltipTrigger>
            <TooltipContent> {{ invitedBy?.name }} </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <template v-for="player in players">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <PlayerDisplay
                  :player="player.player"
                  :showOnline="false"
                  :showFlag="false"
                  :showName="false"
                  :showRole="false"
                />
              </TooltipTrigger>
              <TooltipContent> {{ player.player.name }} </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>
      </div>

      <div
        class="border border-gray-200 border-dashed h-full p-4 rounded-md cursor-pointer hover:bg-green-500/20 bg-transparent transition-all duration-200"
        @click="acceptInvite(invite.id)"
      >
        <Check class="h-3 w-3" />
      </div>
    </div>

    <div
      class="h-full p-4 rounded-md cursor-pointer hover:bg-red-500/20 bg-transparent transition-all duration-200"
      @click="denyInvite(invite.id)"
    >
      <XIcon class="h-3 w-3" />
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    invite: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
  },
  methods: {
    async acceptInvite(lobby_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          update_lobby_players_by_pk: [
            {
              pk_columns: {
                lobby_id,
                steam_id: this.me?.steam_id,
              },
              _set: {
                status: "Accepted",
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async denyInvite(lobby_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          delete_lobby_players_by_pk: [
            {
              lobby_id,
              steam_id: this.me?.steam_id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    allPlayers() {
      if (!this.invite?.players) {
        return [];
      }
      return this.invite.players;
    },
    players() {
      return this.allPlayers.filter(
        (player: any) => player.player.steam_id !== this.invitedBy?.steam_id,
      );
    },
    invitedBy() {
      return this.allPlayers.find((player: any) => {
        return player.captain === true;
      })?.player;
    },
  },
};
</script>
