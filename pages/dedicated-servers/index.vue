<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Pagination from "@/components/Pagination.vue";
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle } from "lucide-vue-next";
import ServerStatus from "~/components/servers/ServerStatus.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <PageTransition>
    <PageHeading>
      <template #title> {{ $t("pages.dedicated_servers.title") }} </template>

      <template #description>
        {{ $t("pages.dedicated_servers.description") }}
        <a href="https://github.com/5stackgg/game-server"
          >https://github.com/5stackgg/game-server</a
        >.
      </template>

      <template #actions>
        <NuxtLink :to="{ name: 'dedicated-servers-create' }">
          <Button :size="isMobile ? 'default' : 'lg'">
            <PlusCircle class="w-4 h-4" />
            <span class="hidden md:inline ml-2">{{
              $t("pages.dedicated_servers.create.title")
            }}</span>
          </Button>
        </NuxtLink>
      </template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <AnimatedCard variant="gradient" class="p-4">
      <Transition name="fade" mode="out-in">
        <Empty v-if="loading" key="loading" class="min-h-[200px]">
          <div class="space-y-3 w-full max-w-md">
            <Skeleton class="h-4 w-3/4 mx-auto" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-5/6 mx-auto" />
          </div>
        </Empty>

        <Table v-else-if="servers && servers.length > 0" key="servers">
          <TableHeader>
            <TableRow>
              <TableHead>{{
                $t("pages.dedicated_servers.table.connection_details")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.label")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.type")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.region")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.plugin_version")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.port")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.tv_port")
              }}</TableHead>
              <TableHead>{{
                $t("pages.dedicated_servers.table.enabled")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="server of servers"
              :key="server.id"
              class="cursor-pointer"
            >
              <NuxtLink
                :to="{
                  name: 'dedicated-servers-id',
                  params: { id: server.id },
                }"
                class="contents"
              >
                <TableCell>
                  <div class="flex gap-2 items-center">
                    <ServerStatus :server="server" />
                    <span class="truncate">
                      {{ server.host }}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{{ server.label }}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {{ server.type }}
                  </Badge>
                </TableCell>
                <TableCell>{{ server.region }}</TableCell>
                <TableCell>
                  <template v-if="server.plugin_version">
                    v{{ server.plugin_version }}
                  </template>
                  <template v-else> - </template>
                </TableCell>
                <TableCell>{{ server.port }}</TableCell>
                <TableCell>{{ server.tv_port }}</TableCell>
                <TableCell>{{
                  server.enabled
                    ? $t("pages.dedicated_servers.table.yes")
                    : $t("pages.dedicated_servers.table.no")
                }}</TableCell>
              </NuxtLink>
            </TableRow>
          </TableBody>
        </Table>

        <Empty v-else key="empty" class="min-h-[200px]">
          <EmptyTitle>{{
            $t("pages.dedicated_servers.no_servers_title")
          }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.dedicated_servers.no_servers")
          }}</EmptyDescription>
        </Empty>
      </Transition>
    </AnimatedCard>
  </PageTransition>

  <Pagination
    v-if="servers_aggregate && servers_aggregate.aggregate.count > 0"
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="servers_aggregate.aggregate.count"
  ></Pagination>
</template>

<script lang="ts">
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      servers: undefined,
      loading: true,
    };
  },
  apollo: {
    $subscribe: {
      servers: {
        query: generateSubscription({
          servers: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
            },
            {
              id: true,
              host: true,
              type: true,
              port: true,
              label: true,
              region: true,
              tv_port: true,
              enabled: true,
              connected: true,
              rcon_status: true,
              max_players: true,
              plugin_version: true,
              connect_password: true,
              offline_at: true,
              current_match: {
                id: true,
              },
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
          this.servers = data.servers;
          this.loading = false;
        },
      },
    },
    servers_aggregate: {
      query: generateQuery({
        servers_aggregate: [
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
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
