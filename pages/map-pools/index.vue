<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import MapForm from "~/components/map-pools/MapForm.vue";
import MapPoolRow from "~/components/map-pools/MapPoolRow.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.map_pools.title") }}</template>

      <template #description>
        {{ $t("pages.map_pools.description") }}
      </template>
    </PageHeading>

    <div class="flex justify-end mb-4">
      <Button @click="mapFormSheet = true">
        {{ $t("pages.map_pools.add_new_map") }}
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="pool in map_pools"
        :key="pool.id"
        class="relative p-4 bg-background rounded-lg shadow-md"
      >
        <h2 class="text-lg font-semibold">{{ pool.type }} Pool</h2>
        {{ pool.maps.map((map) => map.name).join(", ") }}
        <NuxtLink
          :to="{ name: 'map-pools-id', params: { id: pool.id } }"
          class="absolute top-4 right-4 text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded shadow"
        >
          {{ $t("pages.map_pools.edit") }}
        </NuxtLink>
      </div>
    </div>

    <Separator />

    <h2 class="text-2xl font-bold">
      {{ $t("pages.map_pools.maps") }}
    </h2>
    <table class="min-w-full bg-background rounded-lg shadow-md">
      <thead>
        <tr>
          <th class="px-4 py-2 text-left text-sm font-medium"></th>
          <th class="px-4 py-2 text-left text-sm font-medium">
            {{ $t("pages.map_pools.active_duty") }}
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium">
            {{ $t("pages.map_pools.available_modes") }}
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium">
            {{ $t("pages.map_pools.workshop_id") }}
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <MapPoolRow
          v-for="map in availableMaps"
          :key="map.id"
          :map="map"
          :match-types="matchTypes"
        />
      </tbody>
    </table>
  </div>

  <Sheet :open="mapFormSheet" @update:open="(open) => (mapFormSheet = open)">
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("pages.dedicated_servers.detail.edit") }}</SheetTitle>
        <SheetDescription>
          <MapForm @created="mapFormSheet = false" />
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { e_map_pool_types_enum, e_match_types_enum } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";

interface Map {
  id: string;
  name: string;
  type: string;
  patch?: string;
  poster?: string;
  active_pool: boolean;
  workshop_map_id?: string;
  poolTypes: string[];
  enabled: boolean;
}

interface MapPool {
  id: string;
  type: string;
  maps: {
    id: string;
    name: string;
    type: string;
    patch?: string;
    poster?: string;
    active_pool: boolean;
    workshop_map_id?: string;
  }[];
}

export default {
  data() {
    return {
      mapFormSheet: false,
      map_pools: [] as MapPool[],
      maps: [] as Map[],
      matchTypes: [
        e_match_types_enum.Competitive,
        e_match_types_enum.Wingman,
        e_match_types_enum.Duel,
      ],
    };
  },
  apollo: {
    $subscribe: {
      maps: {
        query: generateSubscription({
          maps: [
            {},
            {
              ...mapFields,
              enabled: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.maps = data.maps;
        },
      },
    },
    map_pools: {
      query: generateQuery({
        map_pools: [
          {
            where: {
              type: {
                _neq: e_map_pool_types_enum.Custom,
              },
            },
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  computed: {
    availableMaps(): Map[] {
      const uniqueMapsMap = new Map<string, Map>();

      for (const map of this.maps) {
        if (!uniqueMapsMap.has(map.name)) {
          uniqueMapsMap.set(map.name, {
            ...map,
            poolTypes: [],
          });
        }

        if (map.enabled) {
          uniqueMapsMap.get(map.name)?.poolTypes.push(map.type);
        }
      }

      return Array.from(uniqueMapsMap.values())
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        })
        .sort((a, b) => {
          return a.name
            .replace("de_", "")
            .localeCompare(b.name.replace("de_", ""));
        });
    },
  },
};
</script>
