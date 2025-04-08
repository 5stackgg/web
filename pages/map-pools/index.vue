<script setup lang="ts">
import MapDisplay from "~/components/MapDisplay.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.map_pools.title") }}</template>

      <template #description>
        {{ $t("pages.map_pools.description") }}
      </template>
    </PageHeading>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="pool in map_pools"
        :key="pool.id"
        class="relative p-4 bg-background rounded-lg shadow-md"
      >
        <h2 class="text-lg font-semibold">{{ pool.type }}</h2>
        {{ pool.maps.map((map) => map.name).join(", ") }}
        <NuxtLink
          :to="{ name: 'map-pools-id', params: { id: pool.id } }"
          class="absolute top-4 right-4 text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded shadow"
        >
          Edit
        </NuxtLink>
      </div>
    </div>

    <Separator />

    <h2 class="text-2xl font-bold">Maps</h2>
    <table class="min-w-full bg-background rounded-lg shadow-md">
      <thead>
        <tr>
          <th class="px-4 py-2 text-left text-sm font-medium"></th>
          <th class="px-4 py-2 text-left text-sm font-medium">Active Duty</th>
          <th class="px-4 py-2 text-left text-sm font-medium">
            Available Modes
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium">Workshop ID</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="map in availableMaps" :key="map.id" class="border-t">
          <td class="px-4 py-2 text-sm">
            <MapDisplay :map="map" style="max-width: 350px" />
          </td>
          <td class="px-4 py-2 text-sm">
            <div class="flex items-center gap-2">
              <Switch
                :checked="map.active_pool"
                @update:checked="toggleActivePool(map)"
              />
              <span>Active Duty</span>
            </div>
          </td>
          <td class="px-4 py-2 text-sm">
            <div class="flex flex-col gap-2">
              <div
                v-for="type in matchTypes"
                :key="type"
                class="flex items-center gap-2"
              >
                <Switch
                  :checked="map.poolTypes.includes(type)"
                  @update:checked="togglePoolType(map, type)"
                />
                <span>{{ type }}</span>
              </div>
            </div>
          </td>
          <td class="px-4 py-2 text-sm">{{ map.workshop_map_id || "N/A" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { Switch } from "@/components/ui/switch";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { e_map_pool_types_enum, e_match_types_enum } from "~/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

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
  components: {
    Switch,
  },
  data() {
    return {
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

      return Array.from(uniqueMapsMap.values()).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    },
  },
  methods: {
    async togglePoolType(map: Map, type: e_match_types_enum) {
      if (map.poolTypes.includes(type)) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_maps: [
              {
                _set: {
                  enabled: false,
                },
                where: {
                  type: {
                    _eq: type,
                  },
                  name: {
                    _eq: map.name,
                  },
                },
              },
              {
                affected_rows: true,
              },
            ],
          }),
        });
        toast({
          title: this.$t("map_pool.toggle_pool_type", {
            map: map.name,
            type: type,
          }),
        });
        return;
      }

      console.info({
        ...map,
        enabled: true,
      });
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_maps: [
            {
              objects: [
                {
                  type,
                  enabled: true,
                  name: map.name,
                  active_pool: map.active_pool,
                  workshop_map_id: map.workshop_map_id,
                  poster: map.poster,
                  patch: map.patch,
                  label: map.label,
                },
              ],
              on_conflict: {
                constraint: "maps_name_type_key",
                update_columns: ["enabled"],
              },
            },
            {
              affected_rows: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("map_pool.toggle_pool_type"),
      });
    },
    async toggleActivePool(map: Map) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_maps: [
            {
              _set: {
                active_pool: !map.active_pool,
              },
              where: {
                name: {
                  _eq: map.name,
                },
              },
            },
            {
              affected_rows: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("map_pool.toggle_active_pool", {
          map: map.name,
        }),
      });
    },
  },
};
</script>
