<script lang="ts" setup>
import { Badge } from "~/components/ui/badge";
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <div
    v-if="loading"
    class="flex w-full items-center justify-center gap-2 py-6 text-muted-foreground"
  >
    <Loader2 class="w-4 h-4 animate-spin" />
    <span class="text-xs uppercase tracking-[0.18em] font-mono">{{
      $t("common.loading")
    }}</span>
  </div>
  <div
    v-else-if="!picks || picks.length === 0"
    class="flex w-full items-center justify-center py-6 text-muted-foreground text-xs uppercase tracking-[0.18em] font-mono"
  >
    {{ $t("match.picks.empty") }}
  </div>
  <div v-else class="picks-grid">
    <!-- Pick cards -->
    <template v-for="(pick, index) of picks" v-if="picks?.length > 0">
      <!-- Side pick -->
      <template v-if="pick.type === 'Side'">
        <div
          class="relative rounded-xl overflow-hidden border border-border/50 min-w-0"
        >
          <span class="pick-order">{{ pickOrder(index) }}</span>
          <div class="relative h-16">
            <NuxtImg
              src="/img/maps/screenshots/random.webp"
              class="w-full h-full object-cover brightness-50"
              sizes="200px"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
            />
            <div class="absolute inset-0 flex items-center justify-center">
              <img
                :src="
                  pick.side === 'CT'
                    ? '/img/teams/ct_logo.svg'
                    : '/img/teams/t_logo.svg'
                "
                class="w-8 h-8 drop-shadow-xl"
              />
            </div>
          </div>
          <div class="bg-muted/40 px-2 py-1.5 text-center">
            <span class="text-xs font-semibold truncate block">{{
              pick.match_lineup.name
            }}</span>
            <span class="text-[10px] text-muted-foreground">{{
              pick.side
            }}</span>
          </div>
        </div>
      </template>
      <!-- Map pick/ban -->
      <template v-else>
        <div
          class="relative rounded-xl overflow-hidden border border-border/50 min-w-0"
        >
          <span class="pick-order">{{ pickOrder(index) }}</span>
          <div class="relative h-16">
            <NuxtImg
              :src="pick.map.poster"
              class="w-full h-full object-cover brightness-50"
              sizes="200px"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
            />
            <div class="absolute inset-0 flex items-center justify-center">
              <img
                v-if="pick.map.patch"
                :src="pick.map.patch"
                class="max-w-[36px] h-auto max-h-[80%] object-contain drop-shadow-xl"
              />
            </div>
          </div>
          <div class="bg-muted/40 px-2 py-1.5 text-center">
            <span class="text-xs font-semibold truncate block">{{
              pick.match_lineup.name
            }}</span>
            <span
              class="text-[10px]"
              :class="{
                'text-green-400': pick.type === 'Pick',
                'text-red-400': pick.type === 'Ban',
                'text-yellow-400': pick.type === 'Decider',
              }"
              >{{
                pick.type === "Decider" ? $t("match.picks.decider") : pick.type
              }}</span
            >
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

import { $, order_by } from "~/generated/zeus/index";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    match_map_veto_picks: {
      variables() {
        return {
          order_by: order_by.asc,
          matchId: this.$route.params.id,
        };
      },
      query: typedGql("query")({
        match_map_veto_picks: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
            },
            order_by: [
              {},
              {
                created_at: $("order_by", "order_by"),
              },
            ],
          },
          {
            id: true,
            map: {
              id: true,
              name: true,
              patch: true,
              poster: true,
            },
            side: true,
            type: true,
            match_lineup_id: true,
            match_lineup: [
              {},
              {
                name: true,
              },
            ],
          },
        ],
      }),
      result({ data }: { data: any }) {
        this.picks = data?.match_map_veto_picks ?? [];
      },
    },
  },
  data() {
    return {
      picks: undefined as any[] | undefined,
    };
  },
  computed: {
    loading() {
      return this.picks === undefined;
    },
  },
  methods: {
    pickOrder(index: number) {
      return index + 1;
    },
  },
};
</script>

<style scoped>
.picks-grid {
  --cols: 3;
  --gap: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--gap);
  width: 100%;
}
.picks-grid > * {
  flex: 0 0 calc((100% - (var(--cols) - 1) * var(--gap)) / var(--cols));
  max-width: calc((100% - (var(--cols) - 1) * var(--gap)) / var(--cols));
}
@media (min-width: 640px) {
  .picks-grid {
    --cols: 4;
  }
}
@media (min-width: 1024px) {
  .picks-grid {
    --cols: 3;
  }
}
.pick-order {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  border-radius: 0.25rem;
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
    monospace;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  color: hsl(var(--tac-amber));
  background: hsl(0 0% 0% / 0.72);
  border: 1px solid hsl(var(--tac-amber) / 0.6);
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 3px hsl(0 0% 0% / 0.5);
}
</style>
