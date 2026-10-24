<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import OthersPlayersList from "~/components/hub/OthersPlayersList.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useInvites } from "@/composables/useInvites";

const activeTab = ref("friends");

const matchmakingStore = useMatchmakingStore();
const { hasSocialInvites } = useInvites();

const onlineFriends = computed(() => matchmakingStore.onlineFriends);
const offlineFriends = computed(() => matchmakingStore.offlineFriends);

// Everyone online while the api lists them, and everyone at this tab's LAN.
const onLan = computed(() => !!matchmakingStore.lanRegion);
const listed = computed(() => matchmakingStore.onlineListed);
const showOthers = computed(() => onLan.value || listed.value);
const othersCount = computed(() =>
  listed.value
    ? Math.max(
        0,
        matchmakingStore.onlineCount -
          (matchmakingStore.onlinePlayerSteamIds as string[]).length,
      )
    : (matchmakingStore.lanPlayers as any[]).length -
      (matchmakingStore.lanLeft as string[]).length,
);

watch(showOthers, (show) => {
  if (!show && activeTab.value === "others") {
    activeTab.value = "friends";
  }
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
            v-if="showOthers"
            value="others"
            data-testid="others-tab"
            class="flex-1 text-[0.7rem] font-semibold tracking-[0.1em] uppercase px-2 py-[0.35rem]"
          >
            {{
              listed
                ? $t("matchmaking.others.title")
                : $t("matchmaking.lan.title")
            }}
            <span class="font-mono text-[0.6rem] ml-1 opacity-65 tabular-nums">
              {{ othersCount }}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>
      <!-- Reka keeps the inactive panel in the DOM behind a bare [hidden],
           which `flex` overrides, so it would take half the height. -->
      <TabsContent
        value="friends"
        class="mt-0 flex flex-1 flex-col overflow-y-auto min-h-0 px-3 data-[state=inactive]:hidden"
      >
        <PlayersList />
      </TabsContent>
      <TabsContent
        v-if="showOthers"
        value="others"
        class="mt-0 flex flex-1 flex-col overflow-y-auto min-h-0 px-3 data-[state=inactive]:hidden"
      >
        <OthersPlayersList />
      </TabsContent>
    </Tabs>
  </div>
</template>
