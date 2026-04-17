<script lang="ts" setup>
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <div class="flex w-full max-w-full flex-wrap justify-center gap-3 pb-1">
    <!-- Region card -->
    <div
      v-if="regions.length > 1"
      class="shrink-0 w-[130px] rounded-xl overflow-hidden border border-border/50"
    >
      <div class="relative h-16">
        <NuxtImg
          src="/img/maps/screenshots/default.webp"
          class="w-full h-full object-cover brightness-50"
          sizes="200px"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
        />
      </div>
      <div class="bg-muted/40 px-2 py-1.5 text-center">
        <span class="text-xs font-semibold truncate block">
          {{ match.e_region.description || match.e_region.value }}
        </span>
        <span class="text-[10px] text-muted-foreground">{{
          $t("common.region")
        }}</span>
      </div>
    </div>

    <!-- Pick cards -->
    <template v-for="pick of picks" v-if="picks?.length > 0">
      <!-- Side pick -->
      <template v-if="pick.type === 'Side'">
        <div
          class="shrink-0 w-[130px] rounded-xl overflow-hidden border border-border/50"
        >
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
          class="shrink-0 w-[130px] rounded-xl overflow-hidden border border-border/50"
        >
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
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

import { $, order_by } from "~/generated/zeus/index";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    $subscribe: {
      match_map_veto_picks: {
        variables: function () {
          return {
            order_by: order_by.asc,
            matchId: this.$route.params.id,
          };
        },
        query: typedGql("subscription")({
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
        result: function ({ data }) {
          this.picks = data.match_map_veto_picks;
        },
      },
    },
  },
  data() {
    return {
      picks: undefined,
    };
  },
  computed: {
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
  },
};
</script>
