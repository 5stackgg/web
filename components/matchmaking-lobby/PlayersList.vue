<template>
  <div class="flex flex-col gap-4 mt-4">
    <div class="px-1 flex items-center gap-2">
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
          <div class="mb-2 font-medium text-sm text-muted-foreground">
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
            <PlayerDisplay
              class="w-full cursor-pointer hover:opacity-80 hover:bg-muted/50 transition-all duration-200 p-2 rounded-md"
              :player="player"
              :showOnline="false"
              :showAddFriend="true"
              :linkable="true"
            />
          </div>
        </div>

        <Separator
          v-if="
            filteredOnlinePlayers?.length > 0 &&
            filteredOfflinePlayers?.length > 0
          "
        />

        <div class="flex flex-col gap-4">
          <div class="mb-2 font-medium text-sm text-muted-foreground">
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
      </div>
    </div>
  </div>
</template>

<script lang="ts">
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
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    friendsOnly: {
      type: Boolean,
      default: false,
    },
  },
  components: {
    PlayerDisplay,
    Separator,
    Input,
    Button,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    Search,
    Check,
    Ban,
    RefreshCw,
    FriendOptions,
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
      if (!this.friendsOnly) return [];
      return useMatchmakingStore().friends || [];
    },
    friendSteamIds() {
      if (!this.friendsOnly) return new Set();
      return new Set(this.friends.map((friend: any) => friend.steam_id));
    },
    me() {
      return useAuthStore().me;
    },
    mySteamId() {
      return this.me?.steam_id;
    },
    onlinePlayerSteamIds() {
      return useMatchmakingStore().onlinePlayerSteamIds;
    },
    onlinePlayers() {
      const onlineIds = new Set(this.onlinePlayerSteamIds);
      let players = [...this.allPlayers].filter(
        (player) =>
          player.steam_id !== this.mySteamId && onlineIds.has(player.steam_id)
      );

      // Filter to friends only if prop is set
      if (this.friendsOnly) {
        players = players.filter((player) =>
          this.friendSteamIds.has(player.steam_id)
        );
      }

      return players.sort((a: any, b: any) => {
        return a.name.localeCompare(b.name);
      });
    },
    offlinePlayers() {
      const onlineIds = new Set(this.onlinePlayerSteamIds);
      let players = [...this.allPlayers].filter(
        (player) =>
          player.steam_id !== this.mySteamId && !onlineIds.has(player.steam_id)
      );

      // Filter to friends only if prop is set
      if (this.friendsOnly) {
        players = players.filter((player) =>
          this.friendSteamIds.has(player.steam_id)
        );
      }

      return players.sort((a: any, b: any) => {
        return a.name.localeCompare(b.name);
      });
    },
    filteredOnlinePlayers() {
      if (!this.searchQuery.trim()) {
        return this.onlinePlayers;
      }
      const query = this.searchQuery.toLowerCase().trim();
      return this.onlinePlayers.filter((player: any) => {
        return (
          player.name?.toLowerCase().includes(query) ||
          player.steam_id?.includes(query)
        );
      });
    },
    filteredOfflinePlayers() {
      if (!this.searchQuery.trim()) {
        return this.offlinePlayers;
      }
      const query = this.searchQuery.toLowerCase().trim();
      return this.offlinePlayers.filter((player: any) => {
        return (
          player.name?.toLowerCase().includes(query) ||
          player.steam_id?.includes(query)
        );
      });
    },
    totalPlayersCount() {
      // Total count of all players excluding current user
      return this.onlinePlayers.length + this.offlinePlayers.length;
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
  async mounted() {
    await this.loadAllPlayers();
  },
  methods: {
    async loadAllPlayers() {
      this.loading = true;
      try {
        // Load all players using pagination, same as PlayerSearch
        const allPlayers: any[] = [];
        let page = 1;
        const perPage = 250; // Load in batches
        let hasMore = true;

        while (hasMore) {
          const response = await $fetch("/api/players-search", {
            method: "post",
            body: {
              query: "*", // Match all players
              registeredOnly: true, // Same as PlayerSearch when registeredOnly is true
              per_page: perPage,
              page: page,
              sort_by: "name:asc",
            },
          });

          const { hits, found } = response as any;

          if (hits && hits.length > 0) {
            const players = hits.map(({ document }: any) => {
              return {
                steam_id: document.steam_id,
                name: document.name,
                avatar_url: document.avatar_url,
                country: document.country,
                elo: document.elo,
                role: document.role,
                is_banned: document.is_banned,
                is_muted: document.is_muted,
                is_gagged: document.is_gagged,
              };
            });
            allPlayers.push(...players);
          }

          // Check if we've loaded all players
          // If we got fewer results than perPage, we've reached the end
          // Or if we've loaded all found players
          const loadedCount = allPlayers.length;
          hasMore =
            hits &&
            hits.length === perPage &&
            (found === undefined || loadedCount < found);
          page++;

          // Safety limit to prevent infinite loops
          if (page > 100) {
            console.warn("Reached pagination limit, stopping");
            break;
          }
        }

        this.allPlayers = allPlayers;
      } catch (error) {
        console.error("Error loading players:", error);
        // Fallback to just showing online players if API fails
        const onlinePlayers = useMatchmakingStore().playersOnline;
        this.allPlayers = onlinePlayers.map((player: any) => ({
          steam_id: player.steam_id,
          name: player.name,
          avatar_url: player.avatar_url,
          country: player.country,
          elo: player.elo,
          role: player.role,
          is_banned: player.is_banned,
          is_muted: player.is_muted,
          is_gagged: player.is_gagged,
        }));
      } finally {
        this.loading = false;
      }
    },
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
