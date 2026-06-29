<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Search, RefreshCw } from "lucide-vue-next";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
</script>

<template>
  <div class="flex flex-col gap-3 p-2">
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

    <div class="flex flex-col gap-4">
      <!-- Incoming friend requests (friends tab) -->
      <section v-if="friendsOnly && incomingRequests.length > 0">
        <div class="friend-section-label text-[hsl(var(--tac-amber))]">
          <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
          {{ $t("matchmaking.friends.incoming_requests") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ incomingRequests.length }}
          </span>
        </div>
        <TransitionGroup name="friend-row" tag="div" class="flex flex-col">
          <FriendListItem
            v-for="player in incomingRequests"
            :key="player.steam_id"
            :player="player"
          />
        </TransitionGroup>
      </section>

      <!-- Online -->
      <section v-if="filteredOnlinePlayers.length > 0">
        <div class="friend-section-label">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full rounded-full bg-green-500/60 animate-ping"
            />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          {{ $t("common.online") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ filteredOnlinePlayers.length }}
          </span>
        </div>
        <TransitionGroup name="friend-row" tag="div" class="flex flex-col">
          <FriendListItem
            v-for="player in filteredOnlinePlayers"
            :key="player.steam_id"
            :player="player"
          />
        </TransitionGroup>
      </section>

      <!-- Offline (friends tab only) -->
      <section v-if="friendsOnly && filteredOfflinePlayers.length > 0">
        <div class="friend-section-label">
          <span class="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {{ $t("common.offline") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ filteredOfflinePlayers.length }}
          </span>
        </div>
        <TransitionGroup name="friend-row" tag="div" class="flex flex-col">
          <FriendListItem
            v-for="player in filteredOfflinePlayers"
            :key="player.steam_id"
            :player="player"
            :muted="true"
          />
        </TransitionGroup>
      </section>

      <!-- Sent requests (friends tab only) -->
      <section v-if="friendsOnly && outgoingRequests.length > 0">
        <div class="friend-section-label">
          <span class="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {{ $t("matchmaking.friends.sent_requests") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ outgoingRequests.length }}
          </span>
        </div>
        <TransitionGroup name="friend-row" tag="div" class="flex flex-col">
          <FriendListItem
            v-for="player in outgoingRequests"
            :key="player.steam_id"
            :player="player"
            :muted="true"
          />
        </TransitionGroup>
      </section>

      <div
        v-if="isEmpty"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("player.search.no_players_found") }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

function matchesSearch(player: any, query: string) {
  const q = query.toLowerCase();
  return (
    player.name?.toLowerCase().includes(q) ||
    String(player.steam_id ?? "").includes(query)
  );
}

export default {
  props: {
    friendsOnly: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      searchQuery: "",
      syncing: false,
    };
  },
  computed: {
    friends() {
      return useMatchmakingStore().friends as any[];
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
    incomingRequests(): any[] {
      if (!this.friendsOnly) return [];
      return this.friends.filter(
        (f: any) =>
          f.status === "Pending" &&
          String(f.invited_by_steam_id) !== String(this.me?.steam_id) &&
          matchesSearch(f, this.searchQuery),
      );
    },
    outgoingRequests(): any[] {
      if (!this.friendsOnly) return [];
      return this.friends.filter(
        (f: any) =>
          f.status === "Pending" &&
          String(f.invited_by_steam_id) === String(this.me?.steam_id) &&
          matchesSearch(f, this.searchQuery),
      );
    },
    filteredOnlinePlayers() {
      if (this.friendsOnly) {
        return this.onlineFriends.filter((p: any) =>
          matchesSearch(p, this.searchQuery),
        );
      }

      // Others tab: online players who aren't me and aren't an accepted friend
      // or an incoming request. Outgoing requests STAY here so adding someone
      // doesn't make them jump out of the list mid-action.
      return this.onlinePlayers.filter((player: any) => {
        if (String(player.steam_id) === String(this.me?.steam_id)) return false;

        const entry = this.friends?.find(
          (f: any) => String(f.steam_id) === String(player.steam_id),
        );
        if (entry) {
          if (entry.status !== "Pending") return false;
          const outgoing =
            String(entry.invited_by_steam_id) === String(this.me?.steam_id);
          if (!outgoing) return false;
        }

        return matchesSearch(player, this.searchQuery);
      });
    },
    filteredOfflinePlayers() {
      if (!this.friendsOnly) return [];
      return this.offlineFriends.filter((p: any) =>
        matchesSearch(p, this.searchQuery),
      );
    },
    isEmpty(): boolean {
      if (this.friendsOnly) {
        return (
          this.incomingRequests.length === 0 &&
          this.filteredOnlinePlayers.length === 0 &&
          this.filteredOfflinePlayers.length === 0 &&
          this.outgoingRequests.length === 0
        );
      }
      return this.filteredOnlinePlayers.length === 0;
    },
    searchPlaceholder() {
      return this.friendsOnly
        ? this.$t("matchmaking.friends.search_placeholder")
        : this.$t("player.search.placeholder");
    },
  },
  methods: {
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

<style scoped>
.friend-section-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

/* Animated list rows */
.friend-row-move,
.friend-row-enter-active,
.friend-row-leave-active {
  transition: all 0.25s ease;
}
.friend-row-enter-from {
  opacity: 0;
  transform: translateX(0.5rem);
}
.friend-row-leave-to {
  opacity: 0;
  transform: translateX(0.5rem);
}
.friend-row-leave-active {
  position: absolute;
  width: 100%;
}
</style>
