<script lang="ts" setup>
import PlayerDisplay from "./PlayerDisplay.vue";
import { Check, XIcon } from "lucide-vue-next";
</script>

<template>
  <div class="flex flex-row gap-2 justify-between" v-if="matches_by_pk">
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
            <TooltipContent> {{ invitedBy.name }} </TooltipContent>
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
        @click="acceptInvite"
      >
        <Check class="h-3 w-3" />
      </div>
    </div>

    <div
      class="h-full p-4 rounded-md cursor-pointer hover:bg-red-500/20 bg-transparent transition-all duration-200"
      @click="denyInvite"
    >
      <XIcon class="h-3 w-3" />
    </div>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";

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
  data() {
    return {
      matches_by_pk: null,
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        query: generateSubscription({
          matches_by_pk: [
            {
              id: $("id", "uuid!"),
            },
            simpleMatchFields,
          ],
        }),
        variables() {
          return {
            id: this.invite.match_id,
          };
        },
        result({ data }: { data: any }) {
          this.matches_by_pk = data.matches_by_pk;
        },
      },
    },
  },
  methods: {
    async acceptInvite() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          acceptInvite: [
            {
              type: this.type,
              invite_id: this.invite.id,
            },
            {
              success: true,
            },
          ],
        }),
      });

      this.$router.push(`/matches/${this.invite.match_id}`);
    },
    async denyInvite(inviteId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          denyInvite: [
            {
              type: this.type,
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    allPlayers() {
      if (!this.matches_by_pk) {
        return [];
      }
      return this.matches_by_pk.lineup_1.lineup_players.concat(
        this.matches_by_pk.lineup_2.lineup_players,
      );
    },
    players() {
      return this.allPlayers.filter(
        (player) => player.player.steam_id !== this.invite.invited_by.steam_id,
      );
    },
    invitedBy() {
      return this.invite.invited_by;
    },
  },
};
</script>
