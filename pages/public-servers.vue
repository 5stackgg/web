<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Separator } from "@/components/ui/separator";
import cleanMapName from "~/utilities/cleanMapName";
import PageHeading from "~/components/PageHeading.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { $ } from "~/generated/zeus";
import { e_server_types_enum } from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title> {{ $t("pages.public_servers.title") }} </template>
      <template #description>
        {{ $t("pages.public_servers.description") }}
      </template>
    </PageHeading>
  </PageTransition>

  <PageTransition :delay="100">
    <div class="mt-6">
      <Transition name="fade" mode="out-in">
        <!-- Loading -->
        <div
          v-if="loading"
          key="loading"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div
            v-for="i in 3"
            :key="i"
            class="rounded-xl border overflow-hidden"
          >
            <Skeleton class="h-36 w-full" />
            <div class="p-4 space-y-2">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-2 w-full" />
              <Skeleton class="h-9 w-full" />
            </div>
          </div>
        </div>

        <!-- Empty -->
        <Empty
          v-else-if="!servers || (servers as any[]).length === 0"
          key="empty"
          class="min-h-[200px]"
        >
          <EmptyTitle>{{
            $t("pages.public_servers.no_servers_title")
          }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.public_servers.no_public_servers")
          }}</EmptyDescription>
        </Empty>

        <!-- Server cards -->
        <div v-else key="servers" class="space-y-8">
          <div v-for="(gameServers, game) in serversByGame" :key="game">
            <div class="flex items-center gap-3 mb-4">
              <h2 class="text-xl font-semibold whitespace-nowrap">
                {{ gameLabel(game) }}
              </h2>
              <Separator class="flex-1" />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatedCard
                v-for="server of flattenGame(gameServers)"
                :key="server.id"
                variant="elevated"
                class="overflow-hidden group cursor-pointer p-0"
              >
                <!-- Zone A: Map Hero -->
                <div class="relative h-36 rounded-t-xl overflow-hidden">
                  <img
                    :src="`/img/maps/screenshots/${mapName(server.id)}.webp`"
                    :alt="mapName(server.id)"
                    class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    @error="onImgError"
                  />
                  <div
                    class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                  />
                  <!-- Top-left: map name -->
                  <div class="absolute top-0 left-0 right-0 px-2 pt-2">
                    <span
                      class="text-[11px] font-bold text-white/90 uppercase tracking-widest drop-shadow-lg"
                    >
                      {{ cleanMapName(mapName(server.id)) }}
                    </span>
                  </div>
                  <!-- Patch centered -->
                  <div
                    class="absolute inset-0 flex items-center justify-center"
                  >
                    <img
                      v-if="mapPatch(server.id)"
                      :src="mapPatch(server.id)"
                      class="w-1/4 max-w-[72px] h-auto max-h-[60%] object-contain drop-shadow-2xl opacity-80"
                    />
                  </div>
                  <!-- Top-right: server type -->
                  <div class="absolute top-2 right-2">
                    <Badge variant="secondary" class="text-xs">{{
                      server.type
                    }}</Badge>
                  </div>
                  <!-- Bottom-right: region -->
                  <div class="absolute bottom-2 right-2">
                    <Badge
                      variant="outline"
                      class="border-white/20 text-white/70 text-xs"
                      >{{ server.region }}</Badge
                    >
                  </div>
                </div>

                <!-- Zone B: Card Body -->
                <div class="px-4 pt-3 pb-2">
                  <p class="font-semibold truncate mb-2">{{ server.label }}</p>
                  <div class="flex items-center justify-between text-sm mb-1.5">
                    <span class="text-muted-foreground">{{
                      $t("pages.public_servers.players")
                    }}</span>
                    <span
                      :class="capacityClass(server)"
                      class="font-mono font-medium"
                    >
                      {{ getDedicatedServerPlayers(server.id) }} /
                      {{ server.max_players }}
                    </span>
                  </div>
                  <div
                    class="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20"
                  >
                    <div
                      class="h-full rounded-full transition-all"
                      :class="capacityBarClass(server)"
                      :style="`width: ${capacityPercent(server)}%`"
                    />
                  </div>
                </div>

                <!-- Zone C: CTA Footer -->
                <div
                  class="px-4 pb-4 pt-2 [&>div]:w-full [&_a]:w-full [&_button]:w-full"
                >
                  <QuickServerConnect :server="server" />
                </div>
              </AnimatedCard>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </PageTransition>

  <!-- LAN Servers -->
  <PageTransition :delay="200">
    <div v-if="!loading && lanServers && lanServers.length > 0" class="mt-8">
      <div class="flex items-center gap-3 mb-4">
        <h2
          class="text-xl font-semibold whitespace-nowrap text-muted-foreground"
        >
          {{ $t("pages.public_servers.lan_servers_title") }}
        </h2>
        <Separator class="flex-1" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatedCard
          v-for="server of lanServers"
          :key="server.id"
          variant="elevated"
          class="overflow-hidden group cursor-pointer p-0"
        >
          <!-- Zone A: Map Hero -->
          <div class="relative h-36 rounded-t-xl overflow-hidden">
            <img
              :src="`/img/maps/screenshots/${mapName(server.id)}.webp`"
              :alt="mapName(server.id)"
              class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
              @error="onImgError"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
            />
            <!-- Top-left: map name -->
            <div class="absolute top-0 left-0 right-0 px-2 pt-2">
              <span
                class="text-[11px] font-bold text-white/90 uppercase tracking-widest drop-shadow-lg"
              >
                {{ cleanMapName(mapName(server.id)) }}
              </span>
            </div>
            <!-- Top-right: server type -->
            <div class="absolute top-2 right-2">
              <Badge variant="secondary" class="text-xs">{{
                server.type
              }}</Badge>
            </div>
            <!-- Bottom-right: region -->
            <div class="absolute bottom-2 right-2">
              <Badge
                variant="outline"
                class="border-white/20 text-white/70 text-xs"
                >{{ server.region }}</Badge
              >
            </div>
          </div>

          <!-- Zone B: Card Body -->
          <div class="px-4 pt-3 pb-2">
            <p class="font-semibold truncate mb-2">{{ server.label }}</p>
            <div class="flex items-center justify-between text-sm mb-1.5">
              <span class="text-muted-foreground">{{
                $t("pages.public_servers.players")
              }}</span>
              <span
                :class="capacityClass(server)"
                class="font-mono font-medium"
              >
                {{ getDedicatedServerPlayers(server.id) }} /
                {{ server.max_players }}
              </span>
            </div>
            <div
              class="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20"
            >
              <div
                class="h-full rounded-full transition-all"
                :class="capacityBarClass(server)"
                :style="`width: ${capacityPercent(server)}%`"
              />
            </div>
          </div>

          <!-- Zone C: CTA Footer -->
          <div
            class="px-4 pb-4 pt-2 [&>div]:w-full [&_a]:w-full [&_button]:w-full"
          >
            <QuickServerConnect :server="server" />
          </div>
        </AnimatedCard>
      </div>
    </div>
  </PageTransition>
</template>

<script lang="ts">
export default {
  data() {
    return {
      servers: undefined as any[] | undefined,
      serversByGame: {} as Record<string, Record<string, any[]>>,
      lanServers: undefined as any[] | undefined,
      getDedicatedServerInfo: undefined as any[] | undefined,
      maps: undefined as any[] | undefined,
      loading: true,
    };
  },
  apollo: {
    getDedicatedServerInfo: {
      query: generateQuery({
        getDedicatedServerInfo: [
          {},
          {
            id: true,
            map: true,
            players: true,
            lastPing: true,
          },
        ],
      }),
      pollInterval: 60 * 1000,
    },
    maps: {
      query: generateQuery({
        maps: [{}, { name: true, patch: true }],
      }),
    },
    $subscribe: {
      servers: {
        query: generateSubscription({
          servers: [
            {
              where: {
                _and: [
                  {
                    _or: [
                      {
                        type: {
                          _neq: $("rankedType", "e_server_types_enum!"),
                        },
                      },
                      {
                        connection_string: {
                          _is_null: false,
                        },
                      },
                    ],
                  },
                  {
                    enabled: {
                      _eq: true,
                    },
                  },
                  {
                    connected: {
                      _eq: true,
                    },
                  },
                ],
              },
              order_by: [
                {
                  label: "asc" as any,
                },
              ],
            },
            {
              id: true,
              label: true,
              type: true,
              game: true,
              region: true,
              connected: true,
              connection_link: true,
              connection_string: true,
              max_players: true,
              server_region: {
                is_lan: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            rankedType: e_server_types_enum.Ranked,
          };
        },
        result: function ({ data }: { data: any }) {
          const nonLan = data.servers.filter(
            (server: any) => !server.server_region.is_lan,
          );
          this.servers = nonLan;
          this.serversByGame = nonLan.reduce(
            (acc: Record<string, Record<string, any[]>>, s: any) => {
              if (!acc[s.game]) acc[s.game] = {};
              (acc[s.game][s.type] = acc[s.game][s.type] || []).push(s);
              return acc;
            },
            {} as Record<string, Record<string, any[]>>,
          );
          this.lanServers = data.servers.filter(
            (server: any) => server.server_region.is_lan,
          );
          this.loading = false;
        },
      },
    },
  },
  methods: {
    gameLabel(game: string): string {
      const labels: Record<string, string> = {
        cs2: "Counter-Strike 2",
        csgo: "Counter-Strike: Global Offensive",
      };
      return labels[game] ?? game;
    },
    flattenGame(typeMap: Record<string, any[]>): any[] {
      return Object.values(typeMap).flat();
    },
    getDedicatedServerMap(id: string) {
      return this.getDedicatedServerInfo?.find((server) => server.id === id)
        ?.map;
    },
    getDedicatedServerPlayers(id: string) {
      return (
        this.getDedicatedServerInfo?.find((server) => server.id === id)
          ?.players || 0
      );
    },
    mapPatch(id: string): string | undefined {
      const name = this.getDedicatedServerMap(id);
      return this.maps?.find((m) => m.name === name)?.patch;
    },
    mapName(id: string): string {
      return this.getDedicatedServerMap(id) || "default";
    },
    capacityPercent(server: any): number {
      const players = this.getDedicatedServerPlayers(server.id);
      return server.max_players > 0
        ? Math.min(100, Math.round((players / server.max_players) * 100))
        : 0;
    },
    capacityClass(server: any): string {
      const pct = this.capacityPercent(server);
      if (pct >= 80) return "text-red-400";
      if (pct >= 50) return "text-yellow-400";
      return "text-green-400";
    },
    capacityBarClass(server: any): string {
      const pct = this.capacityPercent(server);
      if (pct >= 80) return "bg-red-400";
      if (pct >= 50) return "bg-yellow-400";
      return "bg-green-400";
    },
    onImgError(e: Event) {
      (e.target as HTMLImageElement).src = "/img/maps/screenshots/default.webp";
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
