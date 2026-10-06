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
  <article
    data-public-server="tile"
    :class="[
      'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/40 transition-[border-color,transform] duration-200 hover:-translate-y-px hover:border-foreground/25',
      server.hibernating ? 'opacity-75' : '',
    ]"
  >
    <div class="relative h-32 overflow-hidden bg-muted">
      <PublicServerMap
        :map="server.map"
        :asleep="server.hibernating"
        class="group-hover:scale-105"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent to-60%"
      />
      <span
        class="absolute left-3 top-2.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/90"
      >
        {{ cleanMapName(server.map) }}
      </span>
      <span
        class="absolute right-2.5 top-2 rounded-full bg-background/65 px-2 py-0.5"
      >
        <PublicServerPing :ping="server.ping" :tier="server.tier" />
      </span>
      <span
        v-if="server.hibernating || server.isFull"
        class="absolute bottom-2.5 left-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/70"
      >
        {{
          server.hibernating
            ? $t("pages.public_servers.hibernating")
            : $t("pages.public_servers.full")
        }}
      </span>
      <span
        class="absolute bottom-2 right-3 font-mono text-base font-semibold tabular-nums text-white"
      >
        {{ server.players
        }}<span class="text-xs text-white/55">/{{ server.max_players }}</span>
      </span>
    </div>
    <div class="h-[3px] bg-foreground/10">
      <div
        :class="[
          'h-full',
          server.isFull ? 'bg-[hsl(var(--tac-amber))]' : 'bg-foreground/60',
        ]"
        :style="{ width: `${fillPercent}%` }"
      />
    </div>

    <div class="flex flex-col gap-3 p-3.5">
      <div class="flex min-w-0 flex-col gap-1">
        <NuxtLink
          :to="`/dedicated-servers/${server.id}`"
          class="truncate text-[0.92rem] font-semibold after:absolute after:inset-0 after:z-[1] after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[hsl(var(--tac-amber))]"
        >
          {{ server.label }}
        </NuxtLink>
        <span class="truncate font-mono text-[0.7rem] text-muted-foreground">
          <template v-if="server.game_mode"
            >{{ server.game_mode.name }} ·
          </template>
          {{ server.region }}
        </span>
      </div>
      <PublicServerActions
        :server="server"
        size="sm"
        :manage-to="manageTo"
        :can-feature="canFeature"
        @toggle-featured="$emit('toggleFeatured')"
      />
    </div>
  </article>
</template>
