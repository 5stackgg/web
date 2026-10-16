<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import MapPoolForm from "~/components/map-pools/MapPoolForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import ManageSection from "~/components/common/ManageSection.vue";
</script>

<template>
  <PageTransition :delay="0">
    <div class="grid gap-4">
      <NuxtLink
        to="/settings/application/map-pools"
        class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft class="h-4 w-4" />
        {{ $t("pages.map_pools.title") }}
      </NuxtLink>
      <ManageSection
        v-if="map_pools_by_pk"
        :label="$t('pages.map_pools.pool.modify_maps')"
      >
        <MapPoolForm
          :pool="map_pools_by_pk"
          :availableMaps="availableMaps"
          :locked="locked"
          v-if="map_pools_by_pk && availableMaps"
        />
      </ManageSection>
    </div>
  </PageTransition>
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
        e_match_types_enum.Rush,
      ],
    };
  },
  apollo: {
    maps: {
      query: generateQuery({
        maps: [
          {
            where: {
              enabled: {
                _eq: true,
              },
              deleted_at: {
                _is_null: true,
              },
            },
          },
          mapFields,
        ],
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
            seed: true,
            enabled: true,
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
    locked(): boolean {
      const setting = useApplicationSettingsStore().settings.find(
        (setting) => setting.name === "update_map_pools",
      );

      return (
        !!this.map_pools_by_pk?.seed &&
        !!this.map_pools_by_pk?.enabled &&
        (!setting || setting.value === "true") &&
        this.maps.some(
          (map) => map.type === this.map_pools_by_pk.type && map.active_pool,
        )
      );
    },
    availableMaps(): Map[] {
      if (!this.map_pools_by_pk) {
        return [];
      }

      const maps = this.maps.filter((map) => {
        return map.type === this.map_pools_by_pk.type;
      });

      // Turning a mode off leaves the map in that mode's pools, so it has to
      // stay listed here to be removed.
      for (const map of this.map_pools_by_pk.maps) {
        if (!maps.some(({ id }) => id === map.id)) {
          maps.push(map);
        }
      }

      return maps.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    },
  },
};
</script>
