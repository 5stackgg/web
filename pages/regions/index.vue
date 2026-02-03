<script setup lang="ts">
import Pagination from "@/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Pencil, Trash, PlusCircle, Info } from "lucide-vue-next";
import RegionForm from "~/components/regions/RegionForm.vue";
import FivestackTooltip from "~/components/FiveStackToolTip.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{ $t("pages.regions.title") }}</template>

      <template #description>
        {{ $t("pages.regions.description") }}
      </template>

      <template #actions>
        <Button
          @click="regionDialogOpen = true"
          :size="isMobile ? 'default' : 'lg'"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline ml-2">{{
            $t("pages.regions.create")
          }}</span>
        </Button>
      </template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <AnimatedCard variant="gradient" class="p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ $t("pages.regions.table.name") }}</TableHead>
            <TableHead>{{ $t("pages.regions.table.status") }}</TableHead>
            <TableHead>{{
              $t("pages.regions.table.available_servers")
            }}</TableHead>
            <TableHead>{{ $t("pages.regions.table.description") }}</TableHead>
            <TableHead>
              <FivestackTooltip>
                <template #trigger>
                  <div class="flex items-center gap-2">
                    <Info class="w-4 h-4" />
                    {{ $t("pages.regions.table.use_steam_relay") }}
                  </div>
                </template>
                {{ $t("pages.regions.table.use_steam_relay_description") }}
              </FivestackTooltip>
            </TableHead>
            <TableHead>{{ $t("pages.regions.table.use_lan_ip") }}</TableHead>
            <TableHead class="w-[100px]">{{
              $t("pages.regions.table.actions")
            }}</TableHead>
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
              <Switch
                :model-value="region.steam_relay"
                @click="toggleSteamRelay(region)"
              />
            </TableCell>
            <TableCell>
              <Switch
                :model-value="region.is_lan"
                @click="toggleIsLan(region)"
              />
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
    </AnimatedCard>
  </PageTransition>

  <Dialog v-model:open="regionDialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          <template v-if="regionToEdit">{{
            $t("pages.regions.edit")
          }}</template>
          <template v-else>{{ $t("pages.regions.create") }}</template>
        </DialogTitle>
      </DialogHeader>
      <RegionForm @updated="regionDialogOpen = false" :region="regionToEdit" />
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("pages.regions.delete.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.regions.delete.description") }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="deleteDialogOpen = false">
          {{ $t("pages.regions.delete.cancel") }}
        </Button>
        <Button variant="destructive" @click="deleteRegion">
          {{ $t("pages.regions.delete.confirm") }}
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
              steam_relay: true,
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
    async deleteRegion() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_server_regions_by_pk: [
            {
              value: this.regionToDelete.value,
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
        title: this.$t("pages.regions.deleted"),
      });
    },
    async toggleSteamRelay(region) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_server_regions_by_pk: [
            {
              pk_columns: {
                value: region.value,
              },
              _set: {
                steam_relay: !region.steam_relay,
              },
            },
            {
              value: true,
            },
          ],
        }),
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
