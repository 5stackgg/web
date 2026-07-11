<script setup lang="ts">
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import Empty from "~/components/ui/empty/Empty.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

defineProps<{
  teams: Array<{
    id: string | null;
    name: string;
    short_name?: string | null;
    avatar_url?: string | null;
  }>;
  players: any[];
}>();

const apiDomain = useRuntimeConfig().public.apiDomain;

function teamAvatar(url?: string | null): string | null {
  return url ? `https://${apiDomain}/${url}` : null;
}
function initials(team: { name: string; short_name?: string | null }): string {
  return (team.short_name || team.name || "?").slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="space-y-8">
    <!-- TEAMS -->
    <section>
      <div
        :class="[
          tacticalSectionLabelClasses,
          '!flex w-full items-center gap-2',
        ]"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.teams.title") }}
        <span class="font-mono text-[hsl(var(--tac-amber))]">
          {{ teams.length }}
        </span>
      </div>

      <Empty v-if="teams.length === 0" class="min-h-[100px]">
        <p class="text-muted-foreground">{{ $t("event.teams.none") }}</p>
      </Empty>

      <div
        v-else
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <component
          :is="team.id ? 'NuxtLink' : 'div'"
          v-for="team in teams"
          :key="team.id || team.name"
          :to="
            team.id ? { name: 'teams-id', params: { id: team.id } } : undefined
          "
          class="flex items-center gap-3 rounded-md border border-border/70 bg-card/40 p-3 transition-[border-color,transform,background] duration-150"
          :class="{
            'hover:-translate-y-px hover:border-[hsl(var(--tac-amber)/0.45)] hover:bg-card/60':
              team.id,
          }"
        >
          <Avatar class="h-10 w-10 shrink-0 rounded-md">
            <AvatarImage
              v-if="teamAvatar(team.avatar_url)"
              :src="teamAvatar(team.avatar_url)!"
              :alt="team.name"
            />
            <AvatarFallback
              class="rounded-md bg-muted/40 font-mono text-xs text-muted-foreground"
            >
              {{ initials(team) }}
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-foreground">
              {{ team.name }}
            </p>
            <p
              v-if="team.short_name"
              class="truncate font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ team.short_name }}
            </p>
          </div>
        </component>
      </div>
    </section>

    <!-- PLAYERS -->
    <section>
      <div
        :class="[
          tacticalSectionLabelClasses,
          '!flex w-full items-center gap-2',
        ]"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("event.players.title") }}
        <span class="font-mono text-[hsl(var(--tac-amber))]">
          {{ players.length }}
        </span>
      </div>

      <Empty v-if="players.length === 0" class="min-h-[100px]">
        <p class="text-muted-foreground">{{ $t("event.players.none") }}</p>
      </Empty>

      <div
        v-else
        class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div
          v-for="player in players"
          :key="player.steam_id"
          class="flex items-center gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.35)] hover:bg-card/60"
        >
          <PlayerDisplay
            :player="player"
            size="xs"
            compact
            :show-flag="true"
            :show-role="false"
            :show-elo="false"
            :show-online="false"
            :tooltip="false"
            linkable
          />
        </div>
      </div>
    </section>
  </div>
</template>
