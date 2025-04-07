<script setup lang="ts">
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { CheckIcon, XIcon } from "lucide-vue-next";
import FriendsList from "./FriendsList.vue";
import { Mail } from "lucide-vue-next";
import MatchmakingLobbyAccess from "~/components/matchmaking-lobby/MatchmakingLobbyAccess.vue";
</script>

<template>
  <div class="flex flex-col gap-4 overflow-auto">
    <template v-if="currentLobby">
      <div class="flex flex-row justify-between items-center" v-if="!mini">
        <div class="flex flex-row items-center gap-2">
          <h3 class="text-lg font-medium">Lobby</h3>
          <MatchmakingLobbyAccess :lobby="currentLobby" />
        </div>
        <Button
          variant="outline"
          @click="removeFromLobby(currentLobby.id, me?.steam_id)"
        >
          Leave
        </Button>
      </div>

      <player-search
        label="Invite Player to Lobby"
        :self="false"
        @selected="(player) => inviteToLobby(player.steam_id)"
        v-if="!mini"
      ></player-search>

      <template v-for="player of currentLobby?.players">
        <div
          :class="{
            'flex flex-row justify-between items-center': !mini,
            'animate-pulse border-2 border-dashed border-white/50 p-1':
              player.status === 'Invited',
          }"
        >
          <PlayerDisplay
            :player="player.player"
            :showOnline="false"
            :showSteamId="!mini"
            :showName="!mini"
            :showFlag="!mini"
          />
          <Button
            variant="destructive"
            size="icon"
            @click="removeFromLobby(currentLobby.id, player.player.steam_id)"
            v-if="
              !mini &&
              (player.status === 'Invited' || player.status === 'Accepted') &&
              player.player.steam_id !== me?.steam_id
            "
          >
            <XIcon class="h-4 w-4" />
          </Button>
        </div>
      </template>
    </template>

    <div class="grid gap-4" v-if="invitedLobbies?.length > 0">
      <template v-if="mini">
        <div class="flex items-center justify-center">
          <Button variant="outline" size="icon" class="relative">
            <Mail class="h-4 w-4" />
            <div
              class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500"
            ></div>
          </Button>
        </div>
      </template>

      <div class="flex flex-col gap-4" v-else>
        <h3 class="text-lg font-medium">Lobby invites</h3>
        <div class="flex flex-col gap-2" v-for="lobby of invitedLobbies">
          <div class="flex items-center justify-between">
            <PlayerDisplay
              v-for="{ player } of lobby.players.filter(
                (p) => p.player.steam_id !== me?.steam_id,
              )"
              :key="player.steam_id"
              :player="player"
              :showOnline="false"
              class="w-fit"
            />

            <div class="flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                @click="joinLobby(lobby.id)"
              >
                <CheckIcon class="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                @click="removeFromLobby(lobby.id, me?.steam_id)"
              >
                <XIcon class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="!currentLobby">
      <Separator class="my-4" v-if="invitedLobbies?.length > 0" />

      <FriendsList :mini="mini" />
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { playerFields } from "~/graphql/playerFields";
import { $ } from "~/generated/zeus";

export default {
  props: {
    mini: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      lobbies: null,
    };
  },
  apollo: {
    $subscribe: {
      lobbies: {
        query: typedGql("subscription")({
          lobbies: [
            {
              where: {
                players: {
                  steam_id: {
                    _eq: $("steam_id", "bigint!"),
                  },
                },
              },
            },
            {
              id: true,
              access: true,
              players: [
                {},
                {
                  status: true,
                  captain: true,
                  player: playerFields,
                },
              ],
            },
          ],
        }),
        variables() {
          return {
            steam_id: this.me?.steam_id,
          };
        },
        result({ data }: { data: any }) {
          this.lobbies = data.lobbies;
        },
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    currentLobby() {
      return this.lobbies?.find((lobby: any) => {
        return lobby.id === this.me?.current_lobby_id;
      });
    },
    invitedLobbies() {
      return this.lobbies?.filter((lobby: any) => {
        return lobby.id !== this.me?.current_lobby_id;
      });
    },
  },
  methods: {
    async removeFromLobby(lobby_id: string, steam_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          delete_lobby_players_by_pk: [
            {
              lobby_id,
              steam_id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async joinLobby(lobby_id: string) {
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
    async inviteToLobby(steam_id: string) {
      await useMatchmakingStore().inviteToLobby(steam_id);
    },
  },
};
</script>
