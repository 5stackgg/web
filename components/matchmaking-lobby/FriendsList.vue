<script setup lang="ts">
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { RefreshCw, Check, Ban, Users, Mail } from "lucide-vue-next";
import FriendOptions from "~/components/matchmaking-lobby/FriendOptions.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>
<template>
  <template v-if="mini">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-center">
        <Button
          variant="outline"
          size="icon"
          class="relative"
          v-if="pendingFriends?.length"
        >
          <Mail class="h-4 w-4" />
          <div
            class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500"
          ></div>
        </Button>
      </div>
      <div
        class="flex items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Users class="h-4 w-4" />
        <span>{{ onlineFriends?.length || 0 }}</span>
      </div>
    </div>
  </template>

  <template v-else>
    <div class="flex items-center justify-between my-4">
      <h3 class="text-lg font-medium">Friends</h3>
      <Button variant="ghost" size="sm" class="h-8" @click="syncSteamFriends">
        <RefreshCw class="mr-2 h-4 w-4" />
        Sync Friends
      </Button>
    </div>

    <player-search
      label="Search For Friends"
      :self="false"
      @selected="(player) => addAsFriend(player.steam_id)"
    ></player-search>

    <div class="overflow-auto mt-4">
      <div class="flex flex-col gap-4">
        <div v-if="pendingFriends?.length > 0">
          <div class="mb-2 font-medium text-sm text-muted-foreground">
            Pending Friend Requests
          </div>
          <template v-for="player in pendingFriends">
            <template v-if="player.invited_by_steam_id === me.steam_id">
              <FriendOptions :player="player">
                <PlayerDisplay
                  class="w-full cursor-pointer opacity-50 hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                  :player="player"
                  :showOnline="false"
                  :showAddFriend="false"
                />
              </FriendOptions>
            </template>
            <div class="flex items-center justify-between" v-else>
              <PlayerDisplay
                :player="player"
                :showOnline="false"
                :showAddFriend="false"
              />

              <div class="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  @click="acceptFriend(player.steam_id)"
                >
                  <Check class="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  @click="denyFriend(player.steam_id)"
                >
                  <Ban class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </template>
        </div>
        <div>
          <template v-if="onlineFriends?.length > 0">
            <div class="mb-2 font-medium text-sm">
              Online Friends ({{ onlineFriends.length }})
            </div>
            <div v-for="player in onlineFriends">
              <FriendOptions :player="player">
                <PlayerDisplay
                  class="w-full cursor-pointer hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                  :player="player"
                  :showOnline="false"
                  :showAddFriend="false"
                />
              </FriendOptions>
              <div
                class="flex items-center bg-white/5 rounded-md p-2 mt-2"
                v-if="player.player.lobby_players?.at(0)?.lobby"
              >
                <Button
                  variant="outline"
                  size="sm"
                  class="mr-2"
                  @click="
                    joinLobby(player.player.lobby_players?.at(0)?.lobby.id)
                  "
                >
                  Join Lobby
                </Button>
                <div class="flex">
                  <template
                    v-for="{ player } in player.player.lobby_players?.at(0)
                      ?.lobby.players"
                  >
                    <PlayerDisplay
                      class="p-2"
                      :player="player"
                      :showOnline="false"
                      :showAddFriend="false"
                      :showName="false"
                      :showFlag="false"
                      :showSteamId="false"
                    />
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>

        <Separator v-if="onlineFriends?.length > 0" />

        <div class="flex flex-col gap-4">
          <div class="mb-2 font-medium text-sm text-muted-foreground">
            Offline Friends ({{ offlineFriends.length }})
          </div>
          <template v-for="player in offlineFriends">
            <FriendOptions :player="player">
              <PlayerDisplay
                class="opacity-50 cursor-pointer hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                :player="player"
                :showOnline="false"
                :showAddFriend="false"
              />
            </FriendOptions>
          </template>
        </div>
      </div>
    </div>
  </template>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    mini: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      form: {
        steam_id: "",
      },
    };
  },
  methods: {
    async addAsFriend(steam_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          insert_my_friends_one: [
            {
              object: {
                steam_id,
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });
    },
    async acceptFriend(steam_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          update_my_friends: [
            {
              where: {
                steam_id: {
                  _eq: steam_id,
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
    async denyFriend(steam_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          delete_my_friends: [
            {
              where: {
                steam_id: {
                  _eq: steam_id,
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
    async syncSteamFriends() {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          syncSteamFriends: {
            success: true,
          },
        }),
      });
    },
    async joinLobby(lobby_id: string) {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          insert_lobby_players_one: [
            {
              object: {
                lobby_id,
                steam_id: this.me?.steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });

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
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    friends() {
      return useMatchmakingStore().friends;
    },
    onlineFriends() {
      return this.friends?.filter((friend) => {
        if (friend.status === "Pending") {
          return false;
        }

        return useMatchmakingStore().onlinePlayerSteamIds.includes(
          friend.steam_id,
        );
      });
    },
    offlineFriends() {
      return this.friends?.filter((friend) => {
        if (friend.status === "Pending") {
          return false;
        }
        return !useMatchmakingStore().onlinePlayerSteamIds.includes(
          friend.steam_id,
        );
      });
    },
    pendingFriends() {
      return this.friends?.filter((friend) => {
        return (
          friend.status === "Pending" &&
          friend.invited_by_steam_id !== this.me?.steam_id
        );
      });
    },
  },
};
</script>
