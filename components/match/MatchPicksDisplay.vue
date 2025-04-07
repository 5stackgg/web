<script lang="ts" setup>
import MapDisplay from "~/components/MapDisplay.vue";
</script>

<template>
  <div class="flex gap-4 h-[200px] overflow-hidden">
    <div
      class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
      v-if="regions.length > 1"
    >
      <NuxtImg
        src="/img/maps/screenshots/default.webp"
        class="w-full h-full object-cover min-w-[150px]"
        sizes="400px lg:600"
      />
      <div class="absolute inset-0 bg-black bg-opacity-45"></div>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        {{ match.e_region.description }}
      </div>
    </div>

    <template v-for="pick of picks" v-if="picks?.length > 0">
      <template v-if="pick.type === 'Side'">
        <div
          class="relative w-auto max-h-[100%] overflow-hidden rounded-[12px]"
        >
          <NuxtImg
            src="/img/maps/screenshots/random.webp"
            class="w-full h-full object-cover min-w-[150px]"
            sizes="400px lg:600"
          />
          <div class="absolute inset-0 bg-black bg-opacity-45"></div>
          <div
            class="absolute inset-0 flex flex-col items-center justify-center"
          >
            <img
              :src="
                pick.side === 'CT'
                  ? '/img/teams/ct_logo.svg'
                  : '/img/teams/t_logo.svg'
              "
              class="max-w-[96px] w-full"
            />
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <MapDisplay :map="pick.map">
          <template v-slot:header>
            <div class="absolute top-3">
              <badge
                :variant="pick.type === 'Pick' ? 'default' : 'destructive'"
              >
                <template v-if="pick.type === 'Decider'">
                  {{ $t("match.picks.decider") }}
                </template>
                <template v-else>
                  {{ pick.type }}
                </template>
              </badge>
            </div>
          </template>

          <template v-slot:default>
            <div class="absolute bottom-3 text-sm">
              {{ pick.match_lineup.name }}
            </div>
          </template>
        </MapDisplay>
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
