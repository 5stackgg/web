<script setup lang="ts">
import Pagination from "@/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Pencil, Trash, PlusCircle } from "lucide-vue-next";
import RegionForm from "~/components/regions/RegionForm.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> Regions </template>

      <template #description>
        Regions allow you to group game servers by geographic location. Players
        can select preferred regions during matchmaking and veto undesired
        regions during match setup.
      </template>

      <template #actions>
        <Button @click="regionDialogOpen = true">
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline ml-2">Create Region</span>
        </Button>
      </template>
    </PageHeading>

    <Card class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Available Servers / Total Servers</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Use LAN IP</TableHead>
            <TableHead class="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="region of regions" :key="region.value">
            <TableCell>
              <span>{{ region.value }}</span>
            </TableCell>
            <TableCell>
              <span>{{ region.status }}</span>
            </TableCell>
            <TableCell>
              <span
                >{{ region.available_server_count }} /
                {{ region.total_server_count }}</span
              >
            </TableCell>
            <TableCell>
              <span>{{ region.description }}</span>
            </TableCell>
            <TableCell>
              <Switch :checked="region.is_lan" @click="toggleIsLan(region)" />
            </TableCell>
            <TableCell>
              <div class="flex gap-2">
                <Button variant="ghost" size="icon" @click="editRegion(region)">
                  <Pencil class="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  @click="
                    () => {
                      regionToDelete = region;
                      deleteDialogOpen = true;
                    }
                  "
                >
                  <Trash class="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>

    <Dialog v-model:open="regionDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <template v-if="regionToEdit"> Edit Region </template>
            <template v-else> Create Region </template>
          </DialogTitle>
        </DialogHeader>
        <RegionForm
          @updated="regionDialogOpen = false"
          :region="regionToEdit"
        />
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Region</DialogTitle>
        </DialogHeader>
        <p v-if="regionToDelete">
          Are you sure you want to delete region "{{ regionToDelete.value }}"?
        </p>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogOpen = false"
            >Cancel</Button
          >
          <Button
            variant="destructive"
            @click="regionToDelete && deleteRegion(regionToDelete.value)"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Pagination
      :page="page"
      :per-page="perPage"
      @page="
        (_page) => {
          page = _page;
        }
      "
      :total="server_regions_aggregate.aggregate.count"
      v-if="server_regions_aggregate"
    ></Pagination>
  </div>
</template>

<script lang="ts">
import {
  generateQuery,
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      regions: undefined,
      regionDialogOpen: false,
      deleteDialogOpen: false,
      regionToDelete: null,
      regionToEdit: null,
    };
  },
  apollo: {
    $subscribe: {
      regions: {
        query: generateSubscription({
          server_regions: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                {
                  value: "asc",
                },
              ],
            },
            {
              value: true,
              description: true,
              is_lan: true,
              status: true,
              total_server_count: true,
              available_server_count: true,
            },
          ],
        }),
        variables: function () {
          return {
            limit: this.perPage,
            offset: (this.page - 1) * this.perPage,
          };
        },
        result: function ({ data }) {
          this.regions = data.server_regions;
        },
      },
    },
    server_regions_aggregate: {
      query: generateQuery({
        server_regions_aggregate: [
          {},
          {
            aggregate: {
              count: true,
            },
          },
        ],
      }),
    },
  },
  methods: {
    editRegion(region) {
      this.regionToEdit = region;
      this.regionDialogOpen = true;
    },
    async deleteRegion(value: string) {
      console.info("deleting region ", value);
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_server_regions_by_pk: [
            {
              value,
            },
            {
              value: true,
            },
          ],
        }),
      });

      this.deleteDialogOpen = false;
      this.regionToDelete = null;

      toast({
        title: "Deleted Region",
      });
    },
    async toggleIsLan(region) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_server_regions_by_pk: [
            {
              pk_columns: {
                value: region.value,
              },
              _set: {
                is_lan: !region.is_lan,
              },
            },
            {
              value: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
