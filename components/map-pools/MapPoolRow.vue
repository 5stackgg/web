<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import MapDisplay from "~/components/MapDisplay.vue";
import MapForm from "~/components/map-pools/MapForm.vue";
import ViewOnSteam from "~/components/map-pools/ViewOnSteam.vue";
import { Pencil } from "lucide-vue-next";
</script>

<template>
  <TableRow class="border-t">
    <TableCell class="px-4 py-2 text-sm">
      <MapDisplay :map="map" style="max-width: 350px" />
    </TableCell>
    <TableCell class="px-4 py-2 text-sm">
      <div class="flex items-center gap-2">
        <Switch
          :checked="map.active_pool"
          @update:checked="toggleActivePool(map)"
        />
        <span>{{ $t("pages.map_pools.active_duty") }}</span>
      </div>
    </TableCell>
    <TableCell class="px-4 py-2 text-sm">
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
    </TableCell>
    <TableCell class="px-4 py-2 text-sm">
      <ViewOnSteam
        :workshop_map_id="map.workshop_map_id"
        v-if="map.workshop_map_id"
      />
    </TableCell>
    <TableCell>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon">
            <PaginationEllipsis class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56">
          <DropdownMenuItem @click="editMapSheet = true">
            <Pencil class="mr-2 h-4 w-4" />
            <span>{{ $t("map_pools.edit_map") }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>

  <Sheet :open="editMapSheet" @update:open="(open) => (editMapSheet = open)">
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("pages.dedicated_servers.detail.edit") }}</SheetTitle>
        <SheetDescription>
          <MapForm
            @updated="editMapSheet = false"
            :map="map"
            @deleted="editMapSheet = false"
          />
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
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

export default {
  name: "MapPoolRow",
  props: {
    map: {
      type: Object as () => Map,
      required: true,
    },
    matchTypes: {
      type: Array as () => e_match_types_enum[],
      required: true,
    },
  },
  data() {
    return {
      editMapSheet: false,
    };
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
          title: this.$t("pages.map_pool.toggle_pool_type", {
            map: map.name,
            type: type,
          }),
        });
        return;
      }

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
        title: this.$t("pages.map_pool.toggle_pool_type"),
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
        title: this.$t("pages.map_pool.toggle_active_pool", {
          map: map.name,
        }),
      });
    },
  },
};
</script>
