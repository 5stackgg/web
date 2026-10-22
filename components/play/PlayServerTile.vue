<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plug } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";
import PlayWayCard from "~/components/play/PlayWayCard.vue";

export type PlayServerTileModel = {
  id: string;
  label: string;
  map: string | null;
  // Raw map name (de_mirage) for the map art and icon.
  mapName: string | null;
  region: string | null;
  ping: number | null;
  players: number;
  maxPlayers: number;
  connectionLink: string | null;
  connectionString: string | null;
};

const props = withDefaults(
  defineProps<{
    server: PlayServerTileModel;
    layout?: "featured" | "peek";
  }>(),
  { layout: "featured" },
);

// One segment per seat; past a couple of dozen they get too thin, so it
// becomes a bar (same as the public servers page).
const SEGMENT_LIMIT = 24;
const seats = computed(() =>
  props.server.maxPlayers <= SEGMENT_LIMIT ? props.server.maxPlayers : 0,
);
const fill = computed(() =>
  props.server.maxPlayers > 0
    ? Math.min(100, (props.server.players / props.server.maxPlayers) * 100)
    : 0,
);

const where = computed(() =>
  [props.server.map, props.server.region].filter(Boolean).join(" · "),
);

// A workshop map has no icon: the plug stands in.
const iconFailed = ref(false);
watch(
  () => props.server.mapName,
  () => (iconFailed.value = false),
);

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <PlayWayCard
    :layout="layout"
    :title="server.label"
    :icon="Plug"
    :art="server.mapName"
  >
    <template v-if="layout === 'featured' && server.players > 0" #kicker>
      <span
        aria-hidden="true"
        class="size-[7px] shrink-0 rounded-full bg-green-500"
      ></span>
      {{
        $t("pages.play.more_ways.drop_in.playing_now", {
          count: server.players,
        })
      }}
    </template>

    <template v-if="layout === 'peek' && server.mapName && !iconFailed" #icon>
      <img
        :src="`/img/maps/icons/${server.mapName}.svg`"
        alt=""
        class="size-[22px] object-contain"
        @error="iconFailed = true"
      />
    </template>

    {{ where }}
    <span v-if="server.ping !== null" class="tabular-nums"
      >{{ server.ping }} ms</span
    >

    <template #preview>
      <div
        :class="
          layout === 'featured'
            ? 'mt-0.5 max-w-80'
            : 'flex items-center gap-3 text-[13px] text-muted-foreground'
        "
      >
        <div v-if="seats" aria-hidden="true" class="flex flex-1 gap-[3px]">
          <span
            v-for="seat in seats"
            :key="seat"
            :class="[
              'flex-1 rounded-sm',
              layout === 'featured' ? 'h-1' : 'h-1.5',
              seat <= server.players
                ? layout === 'featured'
                  ? 'bg-foreground/80'
                  : 'bg-foreground/65'
                : layout === 'featured'
                  ? 'bg-foreground/15'
                  : 'bg-muted',
            ]"
          ></span>
        </div>
        <div
          v-else
          aria-hidden="true"
          :class="[
            'flex-1 overflow-hidden rounded-sm',
            layout === 'featured' ? 'h-1 bg-foreground/15' : 'h-1.5 bg-muted',
          ]"
        >
          <span
            class="block h-full"
            :class="
              layout === 'featured' ? 'bg-foreground/80' : 'bg-foreground/65'
            "
            :style="{ width: `${fill}%` }"
          ></span>
        </div>
        <span v-if="layout === 'peek'" class="shrink-0 tabular-nums">
          <b class="font-semibold text-foreground">{{ server.players }}</b
          >/{{ server.maxPlayers }}
          <span class="sr-only">{{
            $t("pages.play.more_ways.drop_in.players")
          }}</span>
        </span>
      </div>
    </template>

    <template #actions>
      <Button
        v-if="server.connectionLink"
        as-child
        size="sm"
        :variant="layout === 'featured' ? 'default' : 'outline'"
        :class="[
          'h-8 gap-1.5',
          touchTarget,
          layout === 'featured' &&
            'bg-[hsl(var(--tac-amber))] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)] max-md:flex-1',
        ]"
      >
        <a :href="server.connectionLink">
          <Plug class="size-3.5" />
          {{ $t("pages.play.more_ways.drop_in.connect") }}
        </a>
      </Button>
      <ClipBoard
        v-if="
          server.connectionString &&
          (layout === 'featured' || !server.connectionLink)
        "
        :data="server.connectionString"
        :class="[
          'h-8 w-8 shrink-0 [&_svg]:size-3.5',
          touchTarget,
          layout === 'featured' && 'bg-background/55',
        ]"
        :aria-label="$t('pages.play.more_ways.drop_in.copy')"
      />
    </template>
  </PlayWayCard>
</template>
