<script setup lang="ts">
import { computed } from "vue";
import { Plug } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";

export type PlayServerTileModel = {
  id: string;
  label: string;
  map: string | null;
  region: string | null;
  ping: number | null;
  players: number;
  maxPlayers: number;
  connectionLink: string | null;
  connectionString: string | null;
};

const props = defineProps<{ server: PlayServerTileModel }>();

const fill = computed(() =>
  props.server.maxPlayers > 0
    ? Math.min(100, (props.server.players / props.server.maxPlayers) * 100)
    : 0,
);

const where = computed(() =>
  [props.server.map, props.server.region].filter(Boolean).join(" · "),
);
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4"
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 min-w-0 truncate text-[15px] font-bold">
        {{ server.label }}
      </h3>
      <span class="shrink-0 text-[13px] font-semibold tabular-nums">
        {{ server.players }}/{{ server.maxPlayers }}
        <span class="sr-only">{{
          $t("pages.play.more_ways.drop_in.players")
        }}</span>
      </span>
    </div>

    <p class="m-0 text-[12.5px] text-muted-foreground">
      {{ where }}
      <span v-if="server.ping !== null" class="tabular-nums"
        >{{ server.ping }} ms</span
      >
    </p>

    <span
      aria-hidden="true"
      class="block h-1 overflow-hidden rounded-sm bg-muted"
    >
      <span
        class="block h-full bg-foreground/65"
        :style="{ width: `${fill}%` }"
      ></span>
    </span>

    <div class="mt-auto flex items-center gap-2 pt-1">
      <Button
        v-if="server.connectionLink"
        as-child
        size="sm"
        variant="outline"
        class="relative h-8 gap-1.5 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden"
      >
        <a :href="server.connectionLink">
          <Plug class="size-3.5" />
          {{ $t("pages.play.more_ways.drop_in.connect") }}
        </a>
      </Button>
      <ClipBoard
        v-if="server.connectionString"
        :data="server.connectionString"
        class="h-8 w-8 [&_svg]:size-3.5"
        :aria-label="$t('pages.play.more_ways.drop_in.copy')"
      />
    </div>
  </article>
</template>
