<script setup lang="ts">
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Search, Check, Ban, RefreshCw } from "lucide-vue-next";
import FriendOptions from "~/components/matchmaking-lobby/FriendOptions.vue";
</script>

<template>
  <div class="flex flex-col gap-4 p-2">
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="pl-8"
        />
      </div>
      <Tooltip v-if="friendsOnly">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9 transition-opacity"
            :class="{ 'opacity-50': syncing }"
            @click="syncSteamFriends"
          >
            <RefreshCw
              class="h-4 w-4 transition-transform"
              :class="{ 'animate-spin-smooth': syncing }"
            />
            <span class="sr-only">{{ $t("matchmaking.friends.sync") }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ $t("matchmaking.friends.sync") }}
        </TooltipContent>
      </Tooltip>
    </div>
    <div class="overflow-auto">
      <div class="flex flex-col gap-4">
        <div v-if="friendsOnly && pendingFriends?.length > 0">
          <div class="mb-2 font-medium text-sm">
            {{ $t("matchmaking.friends.pending_requests") }}
          </div>
          <template v-for="player in pendingFriends" :key="player.steam_id">
            <template v-if="player.invited_by_steam_id === me.steam_id">
              <FriendOptions :player="player" :displayStatus="false">
                <div class="flex items-center justify-between">
                  <PlayerDisplay
                    class="w-full cursor-pointer opacity-50 hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                    :player="player"
                    :showOnline="false"
                    :showAddFriend="false"
                    :linkable="true"
                  />
                  <div class="flex flex-col gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      @click="denyFriend(player.steam_id)"
                    >
                      <Ban class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </FriendOptions>
            </template>
            <div class="flex items-center justify-between" v-else>
              <PlayerDisplay
                :player="player"
                :showOnline="false"
                :showAddFriend="false"
                :linkable="true"
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

        <div v-if="filteredOnlinePlayers?.length > 0">
          <div class="mb-2 font-medium text-sm">
            {{ $t("matchmaking.friends.online") }}
            <span class="text-muted-foreground">
              ({{ filteredOnlinePlayers.length }})
            </span>
          </div>
          <div v-for="player in filteredOnlinePlayers" :key="player.steam_id">
            <FriendOptions :player="player">
              <div class="flex items-center justify-between">
                <PlayerDisplay
                  class="w-full cursor-pointer hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                  :player="player"
                  :showOnline="false"
                  :showAddFriend="true"
                  :linkable="true"
                />
              </div>
            </FriendOptions>
          </div>
        </div>

        <template v-if="friendsOnly">
          <Separator v-if="filteredOnlinePlayers?.length > 0" />

          <div>
            <div class="mb-2 font-medium text-sm">
              {{ $t("matchmaking.friends.offline") }}
              <span class="text-muted-foreground">
                ({{ filteredOfflinePlayers.length }})
              </span>
            </div>
            <template
              v-for="player in filteredOfflinePlayers"
              :key="player.steam_id"
            >
              <PlayerDisplay
                class="opacity-50 cursor-pointer hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
                :player="player"
                :showOnline="false"
                :showAddFriend="true"
                :linkable="true"
              />
            </template>
          </div>

          <div
            v-if="
              filteredOnlinePlayers?.length === 0 &&
              filteredOfflinePlayers?.length === 0
            "
            class="text-sm text-muted-foreground text-center py-8"
          >
            {{
              searchQuery
                ? $t("player.search.no_players_found")
                : $t("matchmaking.players.no_players")
            }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    friendsOnly: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      allPlayers: [] as any[],
      loading: false,
      searchQuery: "",
      syncing: false,
    };
  },
  computed: {
    friends() {
      return useMatchmakingStore().friends;
    },
    me() {
      return useAuthStore().me;
    },
    onlinePlayers() {
      return useMatchmakingStore().playersOnline;
    },
    onlineFriends() {
      return useMatchmakingStore().onlineFriends;
    },
    offlineFriends() {
      return useMatchmakingStore().offlineFriends;
    },
    filteredOnlinePlayers() {
      if (this.friendsOnly) {
        return this.onlineFriends.filter((player: any) => {
          return (
            player.name
              ?.toLowerCase()
              .includes(this.searchQuery.toLowerCase()) ||
            player.steam_id?.includes(this.searchQuery)
          );
        });
      }

      return this.onlinePlayers.filter((player: any) => {
        const notFriend = !this.friends
          ?.map((f: any) => f.steam_id)
          .includes(player.steam_id);
        const matchesQuery =
          player.name?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          player.steam_id?.includes(this.searchQuery);
        return notFriend && matchesQuery;
      });
    },
    filteredOfflinePlayers() {
      if (this.friendsOnly) {
        return this.offlineFriends.filter((player: any) => {
          return (
            player.name
              ?.toLowerCase()
              .includes(this.searchQuery.toLowerCase()) ||
            player.steam_id?.includes(this.searchQuery)
          );
        });
      }

      return [];
    },
    searchPlaceholder() {
      return this.friendsOnly
        ? this.$t("matchmaking.friends.search_placeholder")
        : this.$t("player.search.placeholder");
    },
    pendingFriends(): any[] {
      if (!this.friendsOnly) return [];
      return this.friends.filter((friend: any) => {
        return friend.status === "Pending";
      });
    },
  },
  methods: {
    async acceptFriend(steam_id: string) {
      await (this as any).$apollo.mutate({
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
      await (this as any).$apollo.mutate({
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
      this.syncing = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: typedGql("mutation")({
            syncSteamFriends: {
              success: true,
            },
          }),
        });
      } finally {
        // Keep animation for a bit longer for visual feedback
        setTimeout(() => {
          this.syncing = false;
        }, 500);
      }
    },
  },
};
</script>
