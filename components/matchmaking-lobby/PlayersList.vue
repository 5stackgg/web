<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Search, RefreshCw, UserCheck, ChevronRight } from "lucide-vue-next";
import { Fold } from "~/components/ui/transitions";
import HubEmptyState from "~/components/hub/HubEmptyState.vue";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { useElementVisibility } from "@vueuse/core";

// Rows only animate once the list has been on screen for a moment. A list
// update on the frame the hub opens is measured while the panel is still
// hidden, so the move animation flew rows in from the screen's corner; while
// hidden or just shown, changes simply apply.
const listRoot = ref<HTMLElement | null>(null);
const listVisible = useElementVisibility(listRoot);
const rowsAnimate = ref(false);
let settleTimer: ReturnType<typeof setTimeout> | null = null;
watch(listVisible, (visible) => {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = null;
  if (!visible) {
    rowsAnimate.value = false;
    return;
  }
  settleTimer = setTimeout(() => {
    rowsAnimate.value = true;
  }, 300);
});
onBeforeUnmount(() => {
  if (settleTimer) clearTimeout(settleTimer);
});
const rowTransition = computed(() =>
  rowsAnimate.value ? "friend-row" : "friend-row-still",
);
</script>

<template>
  <div ref="listRoot" class="flex min-h-full flex-1 flex-col gap-3 p-2">
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="pl-8"
        />
      </div>
      <div class="flex shrink-0 items-center gap-0.5">
        <!-- Steam friends who have never signed in here are still added, so
             this hides them without changing who gets synced. -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              :aria-pressed="registeredFriendsOnly"
              class="size-9 shrink-0 transition-colors"
              :class="
                registeredFriendsOnly
                  ? 'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] hover:text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
              @click="registeredFriendsOnly = !registeredFriendsOnly"
            >
              <UserCheck class="size-4" />
              <span class="sr-only">{{ $t("search.registered_only") }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ $t("search.registered_only") }}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-9 shrink-0 text-muted-foreground transition-opacity"
              :class="{ 'opacity-50': syncing }"
              @click="syncSteamFriends"
            >
              <RefreshCw
                class="size-4 transition-transform"
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
    </div>

    <!-- No flex gap here: each section carries its own bottom spacing inside
         its clipped row, so a section folding away takes its gap with it.
         The fold wraps the whole section (label + rows): when the last row
         goes, the leaving subtree is frozen mid-fold and the row rides the
         section shut instead of being torn down before its own leave. -->
    <div class="flex flex-1 flex-col">
      <!-- Incoming friend requests -->
      <Transition
        enter-active-class="friend-section-fold"
        enter-from-class="friend-section-fold-collapsed"
        leave-active-class="friend-section-fold"
        leave-to-class="friend-section-fold-collapsed"
      >
      <section
        v-if="incomingRequests.length > 0"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
        <div class="pb-4">
        <div class="friend-section-label text-[hsl(var(--tac-amber))]">
          <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
          {{ $t("matchmaking.friends.incoming_requests") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ incomingRequests.length }}
          </span>
        </div>
        <TransitionGroup :name="rowTransition" tag="div" class="flex flex-col">
          <div
            v-for="player in incomingRequests"
            :key="player.steam_id"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0">
              <FriendListItem :player="player" />
            </div>
          </div>
        </TransitionGroup>
        </div>
        </div>
      </section>
      </Transition>

      <!-- Online -->
      <Transition
        enter-active-class="friend-section-fold"
        enter-from-class="friend-section-fold-collapsed"
        leave-active-class="friend-section-fold"
        leave-to-class="friend-section-fold-collapsed"
      >
      <section
        v-if="filteredOnlinePlayers.length > 0"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
        <div class="pb-4">
        <div class="friend-section-label">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full rounded-full bg-green-500/60 animate-ping"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-green-500"
            />
          </span>
          {{ $t("common.online") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ filteredOnlinePlayers.length }}
          </span>
        </div>
        <TransitionGroup :name="rowTransition" tag="div" class="flex flex-col">
          <div
            v-for="player in filteredOnlinePlayers"
            :key="player.steam_id"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0">
              <FriendListItem
                :player="player"
                :fresh="justOnlineIds.has(String(player.steam_id))"
              />
            </div>
          </div>
        </TransitionGroup>
        </div>
        </div>
      </section>
      </Transition>

      <!-- Offline -->
      <Transition
        enter-active-class="friend-section-fold"
        enter-from-class="friend-section-fold-collapsed"
        leave-active-class="friend-section-fold"
        leave-to-class="friend-section-fold-collapsed"
      >
      <section
        v-if="filteredOfflinePlayers.length > 0"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
        <div class="pb-4">
        <div class="friend-section-label">
          <span class="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {{ $t("common.offline") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ filteredOfflinePlayers.length }}
          </span>
        </div>
        <TransitionGroup :name="rowTransition" tag="div" class="flex flex-col">
          <div
            v-for="player in filteredOfflinePlayers"
            :key="player.steam_id"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0">
              <FriendListItem :player="player" :muted="true" />
            </div>
          </div>
        </TransitionGroup>
        </div>
        </div>
      </section>
      </Transition>

      <!-- A section per team I'm on, below Offline so offline teammates
           don't read as online. Searching opens every team. -->
      <section
        v-for="team in teamSections"
        :key="`team-${team.id}`"
        class="pb-2"
      >
        <button
          type="button"
          class="friend-section-label friend-team-toggle"
          :aria-expanded="team.open"
          :disabled="!!searchQuery"
          @click="toggleTeam(team.id)"
        >
          <ChevronRight
            class="size-3 shrink-0 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
            :class="{ 'rotate-90': team.open }"
          />
          <span class="truncate">
            {{ $t("matchmaking.friends.team_section", { name: team.name }) }}
          </span>
          <span class="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="team.online ? 'bg-green-500' : 'bg-muted-foreground/40'"
            />
            <span :class="team.online ? 'text-green-500' : 'opacity-70'">{{
              team.online
            }}</span>
            <span class="opacity-70">/{{ team.members.length }}</span>
          </span>
        </button>
        <Fold :open="team.open">
          <div class="flex flex-col pb-2 pt-0.5">
            <FriendListItem
              v-for="member in team.members"
              :key="`team-${team.id}-${member.steam_id}`"
              :player="member"
              :muted="!isOnline(member)"
            />
          </div>
        </Fold>
      </section>

      <!-- Sent requests -->
      <Transition
        enter-active-class="friend-section-fold"
        enter-from-class="friend-section-fold-collapsed"
        leave-active-class="friend-section-fold"
        leave-to-class="friend-section-fold-collapsed"
      >
      <section
        v-if="outgoingRequests.length > 0"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
        <div class="pb-4">
        <div class="friend-section-label">
          <span class="h-2 w-2 rounded-full bg-muted-foreground/40" />
          {{ $t("matchmaking.friends.sent_requests") }}
          <span class="ml-auto tabular-nums opacity-70">
            {{ outgoingRequests.length }}
          </span>
        </div>
        <TransitionGroup :name="rowTransition" tag="div" class="flex flex-col">
          <div
            v-for="player in outgoingRequests"
            :key="player.steam_id"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0">
              <FriendListItem :player="player" :muted="true" />
            </div>
          </div>
        </TransitionGroup>
        </div>
        </div>
      </section>
      </Transition>

      <Transition
        enter-active-class="transition-opacity [transition-duration:240ms] [transition-delay:200ms] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <HubEmptyState
          v-if="isEmpty"
          :title="
            searchQuery
              ? $t('layouts.hub.empty.no_match', { query: searchQuery })
              : $t('layouts.hub.empty.friends_title')
          "
          :description="
            searchQuery ? null : $t('layouts.hub.empty.friends_description')
          "
        />
      </Transition>
    </div>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useFriendArrivals } from "~/composables/useFriendArrivals";
import { useLocalStorage } from "@vueuse/core";

// Teams folded shut, kept per browser.
const collapsedTeams = useLocalStorage<string[]>(
  "hub-friends-collapsed-teams",
  [],
);

function matchesSearch(player: any, query: string) {
  const q = query.toLowerCase();
  return (
    player.name?.toLowerCase().includes(q) ||
    String(player.steam_id ?? "").includes(query)
  );
}

export default {
  data() {
    return {
      searchQuery: "",
      syncing: false,
    };
  },
  mounted() {
    useMatchmakingStore().ensureMyTeams();
  },
  computed: {
    friends() {
      return useMatchmakingStore().friends as any[];
    },
    me() {
      return useAuthStore().me;
    },
    // Writable so the toggle drives the store's own ref, keeping both the
    // online and offline lists in step.
    registeredFriendsOnly: {
      get(): boolean {
        return useMatchmakingStore().registeredFriendsOnly;
      },
      set(value: boolean) {
        useMatchmakingStore().registeredFriendsOnly = value;
      },
    },
    onlineFriends() {
      return useMatchmakingStore().onlineFriends;
    },
    offlineFriends() {
      return useMatchmakingStore().offlineFriends;
    },
    // Friends who came online since you last looked, marked for this visit.
    justOnlineIds(): Set<string> {
      return new Set(useFriendArrivals().visitArrivals.value);
    },
    incomingRequests(): any[] {
      return this.friends.filter(
        (f: any) =>
          f.status === "Pending" &&
          String(f.invited_by_steam_id) !== String(this.me?.steam_id) &&
          matchesSearch(f, this.searchQuery),
      );
    },
    outgoingRequests(): any[] {
      return this.friends.filter(
        (f: any) =>
          f.status === "Pending" &&
          String(f.invited_by_steam_id) === String(this.me?.steam_id) &&
          matchesSearch(f, this.searchQuery),
      );
    },
    // Applied here rather than in the store: the shared friend lists also
    // feed the hub badge and social panel, which have no such toggle.
    filteredOnlinePlayers() {
      return this.onlineFriends.filter(
        (p: any) =>
          matchesSearch(p, this.searchQuery) && this.passesRegisteredFilter(p),
      );
    },
    filteredOfflinePlayers() {
      return this.offlineFriends.filter(
        (p: any) =>
          matchesSearch(p, this.searchQuery) && this.passesRegisteredFilter(p),
      );
    },
    // Every team I'm on, with its other members online first.
    teamSections(): Array<{
      id: string;
      name: string;
      members: any[];
      online: number;
      open: boolean;
    }> {
      const me = String(this.me?.steam_id);
      return (useMatchmakingStore().myTeams as any[])
        .map((team: any) => {
          const members = (team.roster ?? [])
            .map((member: any) => member.player)
            .filter(
              (player: any) =>
                player &&
                String(player.steam_id) !== me &&
                matchesSearch(player, this.searchQuery),
            )
            .sort(
              (a: any, b: any) =>
                Number(this.isOnline(b)) - Number(this.isOnline(a)),
            );
          return {
            id: team.id,
            name: team.name,
            members,
            online: members.filter((member: any) => this.isOnline(member))
              .length,
            open: !!this.searchQuery || !collapsedTeams.value.includes(team.id),
          };
        })
        .filter((team) => team.members.length > 0);
    },
    isEmpty(): boolean {
      return (
        this.teamSections.length === 0 &&
        this.incomingRequests.length === 0 &&
        this.filteredOnlinePlayers.length === 0 &&
        this.filteredOfflinePlayers.length === 0 &&
        this.outgoingRequests.length === 0
      );
    },
    searchPlaceholder() {
      return this.$t("matchmaking.friends.search_placeholder");
    },
  },
  methods: {
    toggleTeam(id: string) {
      collapsedTeams.value = collapsedTeams.value.includes(id)
        ? collapsedTeams.value.filter((collapsed) => collapsed !== id)
        : [...collapsedTeams.value, id];
    },
    isOnline(player: any) {
      return useMatchmakingStore().onlinePlayerSteamIds.includes(
        String(player.steam_id),
      );
    },
    passesRegisteredFilter(player: any) {
      if (!this.registeredFriendsOnly) {
        return true;
      }
      return useMatchmakingStore().isRegisteredFriend(player);
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
.friend-team-toggle {
  width: 100%;
  margin-top: -0.25rem;
  margin-bottom: 0;
  padding-block: 0.25rem;
  border-radius: calc(var(--radius) - 2px);
  text-align: left;
  transition: color 0.15s ease;
}
.friend-team-toggle:hover:not(:disabled) {
  color: hsl(var(--foreground));
}
.friend-team-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px hsl(var(--ring));
}

/* Animated list rows. A leaving row collapses its own height in place and the
   rows below ride normal flow up with it. position:absolute looked like the
   way to free the space, but an absolutely positioned child of a flex column
   takes the container's origin as its static position -- the row fell out of
   the hub and faded at the top-left of the panel. */
.friend-row-move,
.friend-row-enter-active {
  transition:
    opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.friend-row-enter-from {
  opacity: 0;
  transform: translateX(0.5rem);
}
.friend-row-leave-active {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.11s ease-in;
}
.friend-row-leave-active > * {
  overflow: hidden;
}
.friend-row-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
/* A whole section (label + rows) folds shut when its last row goes. The
   leaving subtree is frozen, so the departing row simply rides the fold; its
   bottom spacing lives inside the clipped cell and folds with it. */
.friend-section-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.15s ease;
}
.friend-section-fold > * {
  overflow: hidden;
}
.friend-section-fold-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .friend-row-move,
  .friend-row-enter-active,
  .friend-row-leave-active,
  .friend-section-fold {
    transition-duration: 1ms;
  }
}
</style>
