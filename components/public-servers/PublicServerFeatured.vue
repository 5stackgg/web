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
  // The only server on the page: it gets the full width and a bigger stage.
  solo?: boolean;
}>();

defineEmits<{ toggleFeatured: [] }>();

// One segment per seat reads as "how many places are left" at a glance; past
// a couple of dozen seats the segments get too thin, so it becomes a bar.
const SEGMENT_LIMIT = 24;
const seats = computed(() =>
  props.server.max_players <= SEGMENT_LIMIT
    ? Array.from({ length: props.server.max_players }, (_, i) => i)
    : null,
);
const fillPercent = computed(() =>
  props.server.max_players > 0
    ? Math.min(100, (props.server.players / props.server.max_players) * 100)
    : 0,
);
</script>

<template>
  <article
    data-public-server="featured"
    :class="[
      'group relative flex overflow-hidden rounded-2xl border border-border bg-card/40 transition-colors duration-200 hover:border-[hsl(var(--tac-amber)/0.45)]',
      solo ? 'min-h-[19rem] md:min-h-[26rem]' : 'min-h-[19rem]',
    ]"
  >
    <div class="absolute inset-0">
      <PublicServerMap
        :map="server.map"
        :asleep="server.hibernating"
        class="group-hover:scale-[1.03]"
      />
    </div>
    <div
      class="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20"
    />
    <!-- Solo, the text sits on the left of a wide image: shade that side. -->
    <div
      v-if="solo"
      class="absolute inset-0 hidden bg-gradient-to-r from-background/90 via-background/40 to-transparent md:block"
    />

    <div
      :class="[
        'relative flex flex-1 flex-col justify-between gap-10 p-5 sm:p-6',
        solo ? 'md:p-10' : '',
      ]"
    >
      <div class="flex items-center justify-between gap-3">
        <!-- "Most players" means nothing with one server; a pin still does. -->
        <span
          v-if="!solo || server.featured"
          class="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-foreground/85"
        >
          <span
            class="inline-block h-[7px] w-[7px] rotate-45 bg-[hsl(var(--tac-amber))]"
          />
          {{
            server.featured
              ? $t("pages.public_servers.pinned")
              : server.players > 0
                ? $t("pages.public_servers.most_players")
                : $t("pages.public_servers.featured")
          }}
        </span>
        <span
          class="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-background/60 px-2.5 py-1 font-mono text-xs text-foreground/85 backdrop-blur-sm"
        >
          {{ server.region }}
          <PublicServerPing :ping="server.ping" :tier="server.tier" />
        </span>
      </div>

      <div :class="['flex flex-col gap-4', solo ? 'md:max-w-xl' : '']">
        <div class="flex min-w-0 flex-col gap-1.5">
          <!-- Stretched over the card; the action row sits above it. -->
          <NuxtLink
            :to="`/dedicated-servers/${server.id}`"
            :class="[
              'truncate font-bold leading-tight',
              solo ? 'text-3xl md:text-[2.6rem]' : 'text-2xl sm:text-[1.7rem]',
            ]"
            class="after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[hsl(var(--tac-amber))]"
          >
            {{ server.label }}
          </NuxtLink>
          <span class="truncate font-mono text-xs text-muted-foreground">
            {{ cleanMapName(server.map) }}
            <template v-if="server.game_mode">
              · {{ server.game_mode.name }}</template
            >
            ·
            <template v-if="server.hibernating">{{
              $t("pages.public_servers.hibernating_hint")
            }}</template>
            <template v-else-if="server.isFull">{{
              $t("pages.public_servers.full")
            }}</template>
            <template v-else>{{
              $t("pages.public_servers.seats_open", {
                count: server.max_players - server.players,
              })
            }}</template>
          </span>
        </div>

        <div class="flex items-center gap-3">
          <div
            v-if="seats"
            class="flex flex-1 gap-[3px]"
            role="img"
            :aria-label="`${server.players} / ${server.max_players}`"
          >
            <span
              v-for="seat in seats"
              :key="seat"
              :class="[
                'h-1.5 flex-1 rounded-sm',
                seat < server.players
                  ? server.isFull
                    ? 'bg-[hsl(var(--tac-amber))]'
                    : 'bg-foreground/85'
                  : 'bg-foreground/15',
              ]"
            />
          </div>
          <div
            v-else
            class="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/15"
          >
            <div
              class="h-full rounded-full bg-foreground/85"
              :style="{ width: `${fillPercent}%` }"
            />
          </div>
          <span
            class="w-14 text-right font-mono text-sm tabular-nums text-foreground"
          >
            {{ server.players
            }}<span class="text-muted-foreground"
              >/{{ server.max_players }}</span
            >
          </span>
        </div>

        <PublicServerActions
          :server="server"
          size="lg"
          :manage-to="manageTo"
          :can-feature="canFeature"
          @toggle-featured="$emit('toggleFeatured')"
        />
      </div>
    </div>
  </article>
</template>
