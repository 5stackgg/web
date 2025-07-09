<script setup lang="ts">
import { Users } from "lucide-vue-next";
import ScrollArea from "~/components/ui/scroll-area/ScrollArea.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <Popover v-model:open="showPlayersOnline">
    <PopoverTrigger>
      <div class="flex items-center gap-4 text-sm text-muted-foreground">
        <Users class="h-4 w-4" />
        <span>{{ playersOnline.length }}</span>
      </div>
    </PopoverTrigger>
    <PopoverContent>
      <ScrollArea class="max-h-[20vh] overflow-auto">
        <template :key="player.steam_id" v-for="player of playersOnline">
          <PlayerDisplay
            @click="showPlayersOnline = false"
            :player="player"
            class="my-2"
            :linkable="true"
          ></PlayerDisplay>
        </template>
      </ScrollArea>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
export default {
  data() {
    return {
      showPlayersOnline: false,
    };
  },
  computed: {
    playersOnline() {
      return useMatchmakingStore().playersOnline;
    },
  },
};
</script>
