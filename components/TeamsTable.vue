<script setup lang="ts">
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import PlayerElo from "~/components/PlayerElo.vue";
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <NuxtLink
      v-for="(team, index) in teams"
      :key="team.id"
      :to="{ name: 'teams-id', params: { id: team.id } }"
      class="bg-muted/30 p-4 rounded-lg transition-all duration-200 hover:bg-muted/50 hover:shadow-md cursor-pointer animate-in fade-in slide-in-from-bottom-2 flex flex-col"
      :style="{ animationDelay: `${index * 50}ms` }"
    >
      <div class="font-medium text-base mb-3 truncate" :title="team.name">
        {{ team.name }}
      </div>
      <!-- Horizontal lineup of player cards -->
      <div
        class="flex gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5 -mx-0.5 min-h-0 overscroll-x-contain"
      >
        <NuxtLink
          v-for="rosterItem in team.roster || []"
          :key="rosterItem.player?.steam_id"
          :to="{
            name: 'players-id',
            params: { id: rosterItem.player?.steam_id },
          }"
          class="flex flex-col items-center flex-shrink-0 w-[48px] rounded bg-muted/50 hover:bg-muted transition-colors p-1 text-center"
          @click.stop
        >
          <Avatar class="h-7 w-7 rounded mb-0.5">
            <AvatarImage
              :src="rosterItem.player?.avatar_url"
              :alt="rosterItem.player?.name"
            />
            <AvatarFallback class="rounded text-[10px]">
              {{ rosterItem.player?.name?.slice(0, 2) ?? "?" }}
            </AvatarFallback>
          </Avatar>
          <div
            class="flex items-center justify-center gap-0.5 min-h-3 w-full overflow-hidden"
          >
            <TimezoneFlag
              v-if="rosterItem.player?.country"
              :country="rosterItem.player.country"
              class="shrink-0 h-3 w-4"
            />
            <span
              class="text-[10px] font-medium truncate max-w-[32px]"
              :title="rosterItem.player?.name"
            >
              {{ rosterItem.player?.name }}
            </span>
          </div>
          <PlayerElo
            :elo="rosterItem.player?.elo"
            class="text-[9px] mt-0.5 leading-tight text-muted-foreground"
          />
        </NuxtLink>
      </div>
      <p
        v-if="(team.roster?.length ?? 0) > 5"
        class="text-xs text-muted-foreground mt-2"
      >
        {{ team.roster?.length }}
        {{ $t("team.roster_count_players") || "players" }}
      </p>
    </NuxtLink>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    teams: {
      required: true,
      type: Object,
    },
  },
};
</script>
