<script setup lang="ts">
import { ref, computed } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useInvites } from "@/composables/useInvites";

const activeTab = ref("friends");

const matchmakingStore = useMatchmakingStore();
const authStore = useAuthStore();
const { hasSocialInvites } = useInvites();

const onlineFriends = computed(() => matchmakingStore.onlineFriends);
const offlineFriends = computed(() => matchmakingStore.offlineFriends);

const otherOnlineCount = computed(() => {
  const me = authStore.me;
  const friends = matchmakingStore.friends;

  return matchmakingStore.playersOnline.filter((player: any) => {
    if (me && String(player.steam_id) === String(me.steam_id)) {
      return false;
    }

    // Mirror PlayersList "Others" filter: accepted friends and incoming
    // requests live in the Friends tab; outgoing requests stay here.
    const entry = friends?.find(
      (f: any) => String(f.steam_id) === String(player.steam_id),
    );
    if (entry) {
      if (entry.status !== "Pending") return false;
      if (String(entry.invited_by_steam_id) !== String(me?.steam_id)) {
        return false;
      }
    }

    return true;
  }).length;
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Tabs
      v-model="activeTab"
      :scroll-floor="false"
      class="flex flex-col h-full min-h-0"
    >
      <div class="px-3 pt-3 pb-3 flex-shrink-0">
        <div
          class="flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-bold tracking-[0.24em] uppercase text-muted-foreground -mx-3 px-3 pb-3 mb-3 border-b border-border"
        >
          <span class="w-2 h-[2px] bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("layouts.hub.social") }}
        </div>
        <TabsList
          variant="underline"
          class="w-full gap-[0.15rem] bg-muted/30 border border-border rounded-md p-[0.2rem]"
        >
          <TabsTrigger
            value="friends"
            class="relative flex-1 text-[0.7rem] font-semibold tracking-[0.1em] uppercase px-2 py-[0.35rem]"
          >
            {{ $t("matchmaking.friends.title") }}
            <span class="font-mono text-[0.6rem] ml-1 opacity-65 tabular-nums">
              {{ onlineFriends.length }}/{{ offlineFriends.length }}
            </span>
            <span
              v-if="hasSocialInvites"
              class="absolute top-0.5 left-1 w-2 h-2 bg-red-500 rounded-full"
            />
          </TabsTrigger>
          <TabsTrigger
            value="online"
            class="flex-1 text-[0.7rem] font-semibold tracking-[0.1em] uppercase px-2 py-[0.35rem]"
          >
            {{ $t("matchmaking.others.title") }}
            <span class="font-mono text-[0.6rem] ml-1 opacity-65 tabular-nums">
              {{ otherOnlineCount }}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent
        value="friends"
        class="mt-0 flex-1 overflow-y-auto min-h-0 px-3"
      >
        <PlayersList :friends-only="true" />
      </TabsContent>
      <TabsContent
        value="online"
        class="mt-0 flex-1 overflow-y-auto min-h-0 px-3"
      >
        <template v-if="otherOnlineCount > 0">
          <PlayersList />
        </template>
        <template v-else>
          <Empty class="text-sm text-muted-foreground">
            <p>{{ $t("player.search.no_players_found") }}</p>
          </Empty>
        </template>
      </TabsContent>
    </Tabs>
  </div>
</template>
