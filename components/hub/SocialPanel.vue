<script setup lang="ts">
import { ref, computed } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
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
    if (me && player.steam_id === me.steam_id) {
      return false;
    }

    if (friends?.some((f: any) => f.steam_id === player.steam_id)) {
      return false;
    }

    return true;
  }).length;
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Tabs v-model="activeTab" class="flex flex-col h-full min-h-0">
      <div class="px-3 pt-3 pb-2 flex-shrink-0">
        <div class="hub-panel-label mb-2">
          <span class="hub-panel-tick"></span>
          Social
        </div>
        <TabsList variant="underline" class="hub-tabs-list">
          <TabsTrigger value="friends" class="hub-tabs-trigger relative">
            {{ $t("matchmaking.friends.title") }}
            <span class="hub-tabs-count">
              {{ onlineFriends.length }}/{{ offlineFriends.length }}
            </span>
            <span
              v-if="hasSocialInvites"
              class="absolute top-0.5 left-1 w-2 h-2 bg-red-500 rounded-full"
            />
          </TabsTrigger>
          <TabsTrigger value="online" class="hub-tabs-trigger">
            {{ $t("matchmaking.others.title") }}
            <span class="hub-tabs-count">{{ otherOnlineCount }}</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="friends" class="mt-0 flex-1 overflow-y-auto min-h-0 px-3">
        <MatchInvites />
        <PlayersList :friends-only="true" />
      </TabsContent>
      <TabsContent value="online" class="mt-0 flex-1 overflow-y-auto min-h-0 px-3">
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

<style scoped>
.hub-panel-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Oxanium", monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.hub-panel-tick {
  width: 8px;
  height: 2px;
  background: hsl(var(--tac-amber));
}
.hub-tabs-list {
  width: 100%;
  gap: 0.15rem;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  padding: 0.2rem;
}
.hub-tabs-trigger {
  flex: 1;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.5rem;
}
.hub-tabs-count {
  font-family: "Oxanium", monospace;
  font-size: 0.6rem;
  margin-left: 0.25rem;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
</style>
