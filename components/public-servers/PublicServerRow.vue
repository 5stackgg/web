<script setup lang="ts">
import { computed } from "vue";
import cleanMapName from "~/utilities/cleanMapName";
import PublicServerActions from "~/components/public-servers/PublicServerActions.vue";
import PublicServerMap from "~/components/public-servers/PublicServerMap.vue";
import PublicServerPing from "~/components/public-servers/PublicServerPing.vue";
import type { PublicServerView } from "~/components/public-servers/types";

const props = defineProps<{
  server: PublicServerView;
  manageTo?: string;
  canFeature?: boolean;
}>();

defineEmits<{ toggleFeatured: [] }>();

const fillPercent = computed(() =>
  props.server.max_players > 0
    ? Math.min(100, (props.server.players / props.server.max_players) * 100)
    : 0,
);
</script>

<template>
  <!-- Columns match the list header on the public servers page, so every
       count and ping lines up down the page. Below md the row stacks. -->
  <div
    data-public-server="row"
    :class="[
      'group relative grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5 border-t border-border/60 px-4 py-2.5 first:border-t-0 hover:bg-foreground/[0.025] md:grid-cols-[6rem_minmax(0,1fr)_11rem_4.5rem_auto] md:gap-x-6',
      server.hibernating ? 'opacity-70' : '',
    ]"
  >
    <div class="h-12 overflow-hidden rounded-md bg-muted">
      <PublicServerMap :map="server.map" :asleep="server.hibernating" />
    </div>

    <div class="flex min-w-0 flex-col gap-1">
      <NuxtLink
        :to="`/dedicated-servers/${server.id}`"
        class="truncate text-sm font-semibold underline-offset-[3px] after:absolute after:inset-0 after:z-[1] after:content-[''] group-hover:underline group-hover:decoration-muted-foreground focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[hsl(var(--tac-amber))]"
      >
        {{ server.label }}
      </NuxtLink>
      <span class="truncate font-mono text-[0.7rem] text-muted-foreground">
        {{ cleanMapName(server.map) }}
        <template v-if="server.game_mode">
          · {{ server.game_mode.name }}</template
        >
        · {{ server.region }}
        <template v-if="server.hibernating">
          · {{ $t("pages.public_servers.hibernating") }}</template
        >
      </span>
    </div>

    <div
      class="col-span-3 col-start-1 row-start-2 flex items-center gap-3 md:col-span-1 md:col-start-auto md:row-start-auto"
    >
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          :class="[
            'h-full rounded-full',
            server.isFull ? 'bg-[hsl(var(--tac-amber))]' : 'bg-foreground/60',
          ]"
          :style="{ width: `${fillPercent}%` }"
        />
      </div>
      <span
        :class="[
          'w-12 text-right font-mono text-[0.8rem] tabular-nums',
          server.players === 0 ? 'text-muted-foreground' : 'text-foreground',
        ]"
      >
        {{ server.players
        }}<span class="text-muted-foreground/70"
          >/{{ server.max_players }}</span
        >
      </span>
    </div>

    <div
      class="col-start-3 row-start-1 text-right md:col-start-auto md:row-start-auto"
    >
      <PublicServerPing :ping="server.ping" :tier="server.tier" />
    </div>

    <PublicServerActions
      class="col-span-3 justify-end md:col-span-1"
      :server="server"
      :manage-to="manageTo"
      :can-feature="canFeature"
      @toggle-featured="$emit('toggleFeatured')"
    />
  </div>
</template>
