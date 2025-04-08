<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import MapPoolForm from "~/components/map-pools/MapPoolForm.vue";
</script>

<template>
  <PageHeading v-if="map_pools_by_pk">
    <template #title>{{
      $t("pages.map_pools.pool.title", { type: map_pools_by_pk.type })
    }}</template>
    <template #description>{{
      $t("pages.map_pools.pool.description")
    }}</template>
  </PageHeading>

  <Card v-if="map_pools_by_pk" class="my-4">
    <CardHeader>
      <CardTitle class="flex justify-between items-center">{{
        $t("pages.map_pools.pool.modify_maps")
      }}</CardTitle>
    </CardHeader>
    <CardContent>
      <MapPoolForm
        :pool="map_pools_by_pk"
        :availableMaps="availableMaps"
        v-if="map_pools_by_pk && availableMaps"
      />
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus";
import { Switch } from "@/components/ui/switch";
import { generateQuery } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";
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
    maps: {
      query: generateQuery({
        maps: [{}, mapFields],
      }),
    },
    map_pools_by_pk: {
      query: generateQuery({
        map_pools_by_pk: [
          {
            id: $("id", "uuid!"),
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
      variables: function () {
        return {
          id: this.$route.params.id,
        };
      },
    },
  },
  computed: {
    availableMaps(): Map[] {
      if (!this.map_pools_by_pk) {
        return [];
      }

      return this.maps
        .filter((map) => {
          return map.type === this.map_pools_by_pk.type;
        })
        .sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
    },
  },
};
</script>
