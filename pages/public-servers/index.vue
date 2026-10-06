<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { MonitorSmartphone, Settings2 } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DeferredLoading from "~/components/common/DeferredLoading.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import PublicServerFeatured from "~/components/public-servers/PublicServerFeatured.vue";
import PublicServerTile from "~/components/public-servers/PublicServerTile.vue";
import PublicServerRow from "~/components/public-servers/PublicServerRow.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const sectionTitleClasses = [tacticalSectionLabelClasses, "!mb-0"];

// The list header's columns; keep in step with PublicServerRow's md grid so
// the counts and pings line up under it.
const listColumns =
  "md:grid-cols-[6rem_minmax(0,1fr)_11rem_4.5rem_auto] md:gap-x-6";
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.public_servers.title") }}</h1>

  <PageTransition>
    <DeferredLoading :loading="loading" v-slot="{ skeleton, loaded }">
      <FadeSwap>
        <!-- Loading -->
        <div v-if="skeleton" key="loading" class="space-y-4" aria-busy="true">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton v-for="i in 2" :key="i" class="h-[19rem] rounded-2xl" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton v-for="i in 4" :key="i" class="h-60 rounded-xl" />
          </div>
        </div>

        <!-- Empty -->
        <SectionEmpty
          v-else-if="loaded && allServers.length === 0"
          key="empty"
          :title="$t('pages.public_servers.no_servers_title')"
          :description="
            canSetup
              ? $t('pages.public_servers.no_public_servers_admin')
              : $t('pages.public_servers.no_public_servers')
          "
        >
          <Button
            v-if="canSetup"
            as-child
            size="sm"
            :class="createButtonClasses"
          >
            <NuxtLink to="/dedicated-servers/create">
              <Settings2 class="h-4 w-4" />
              {{ $t("pages.public_servers.setup_public_server") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <div v-else key="servers" class="flex flex-col gap-8">
          <!-- Pulse line, in place of a page header -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="font-mono text-xs text-muted-foreground">
              <i18n-t keypath="pages.public_servers.summary" scope="global">
                <template #playing>
                  <span class="text-foreground">{{ totals.playing }}</span>
                </template>
                <template #awake>
                  <span class="text-foreground">{{ totals.awake }}</span>
                </template>
                <template #hibernating>{{ totals.hibernating }}</template>
              </i18n-t>
            </p>
            <Button
              v-if="canSetup"
              as-child
              size="sm"
              :class="listCreateButtonClasses"
            >
              <NuxtLink
                to="/dedicated-servers/create"
                :title="$t('pages.public_servers.setup_public_server')"
              >
                <Settings2 class="h-4 w-4" />
                <span class="max-md:sr-only">{{
                  $t("pages.public_servers.setup_public_server")
                }}</span>
              </NuxtLink>
            </Button>
          </div>

          <!-- Phones and tablets cannot launch CS2; say so once instead of
               offering a join that goes nowhere. -->
          <div
            class="hidden items-start gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground [@media(pointer:coarse)]:flex"
          >
            <MonitorSmartphone class="mt-0.5 h-4 w-4 shrink-0" />
            {{ $t("pages.public_servers.touch_notice") }}
          </div>

          <!-- On site: the LAN comes first -->
          <section
            v-if="onLan && lanServers.length"
            class="flex flex-col gap-3"
            aria-labelledby="public-servers-lan"
          >
            <div class="flex flex-wrap items-baseline gap-3">
              <h2 id="public-servers-lan" :class="sectionTitleClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("pages.public_servers.on_lan_title") }}
              </h2>
              <span class="text-xs text-muted-foreground">
                {{ $t("pages.public_servers.on_lan_description") }}
              </span>
            </div>
            <div class="rounded-xl border border-border bg-card/30">
              <PublicServerRow
                v-for="server of lanServers"
                :key="server.id"
                :server="server"
                :manage-to="manageTo(server.id)"
                :can-feature="false"
              />
            </div>
          </section>

          <section
            v-if="onlineServers.length"
            class="flex flex-col gap-4"
            aria-labelledby="public-servers-online"
          >
            <h2
              id="public-servers-online"
              :class="[
                sectionTitleClasses,
                onLan && lanServers.length ? '' : 'sr-only',
              ]"
            >
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.public_servers.online_title") }}
            </h2>

            <!-- Featured pair: an admin's pins, then the busiest -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PublicServerFeatured
                v-for="server of layout.featured"
                :key="server.id"
                :server="server"
                :manage-to="manageTo(server.id)"
                :can-feature="canSetup"
                @toggle-featured="toggleFeatured(server)"
              />
            </div>

            <!-- A handful: tiles, two rows of four at most -->
            <div
              v-if="layout.layout === 'tiles' && layout.rest.length"
              class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <PublicServerTile
                v-for="server of layout.rest"
                :key="server.id"
                :server="server"
                :manage-to="manageTo(server.id)"
                :can-feature="canSetup"
                @toggle-featured="toggleFeatured(server)"
              />
            </div>

            <!-- Many: filters and an aligned list -->
            <div
              v-else-if="layout.layout === 'list'"
              class="flex flex-col gap-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <AnimatedFilters
                  v-if="modeFilters.length > 2"
                  v-model="modeFilter"
                  square
                  :options="modeFilters"
                />
                <AnimatedFilters
                  v-model="sort"
                  square
                  class="ml-auto"
                  :options="sortOptions"
                />
              </div>
              <div
                :class="[
                  'hidden px-4 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground/70 md:grid',
                  listColumns,
                ]"
                aria-hidden="true"
              >
                <span>{{ $t("pages.public_servers.columns.map") }}</span>
                <span>{{ $t("pages.public_servers.columns.server") }}</span>
                <span class="text-right">{{
                  $t("pages.public_servers.players")
                }}</span>
                <span class="text-right">{{
                  $t("pages.public_servers.columns.ping")
                }}</span>
                <span></span>
              </div>
              <div class="rounded-xl border border-border bg-card/30">
                <PublicServerRow
                  v-for="server of listServers"
                  :key="server.id"
                  :server="server"
                  :manage-to="manageTo(server.id)"
                  :can-feature="canSetup"
                  @toggle-featured="toggleFeatured(server)"
                />
              </div>
            </div>
          </section>

          <!-- Off site: LAN servers stay listed, quietly, at the bottom -->
          <section
            v-if="!onLan && lanServers.length"
            class="tac-section-sep flex flex-col gap-3 pt-6"
            aria-labelledby="public-servers-lan-offsite"
          >
            <h2
              id="public-servers-lan-offsite"
              :class="[sectionTitleClasses, 'text-muted-foreground/70']"
            >
              {{ $t("pages.public_servers.lan_servers_title") }}
            </h2>
            <div class="rounded-xl border border-border bg-card/20">
              <PublicServerRow
                v-for="server of lanServers"
                :key="server.id"
                :server="server"
                :manage-to="manageTo(server.id)"
                :can-feature="false"
              />
            </div>
          </section>
        </div>
      </FadeSwap>
    </DeferredLoading>
  </PageTransition>
</template>

<script lang="ts">
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { $, e_player_roles_enum, e_server_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  isFull,
  pingTier,
  showcase,
  sortServers,
  type PublicServerSort,
} from "~/utilities/publicServers";
import type { PublicServerView } from "~/components/public-servers/types";

export default {
  data() {
    return {
      servers: undefined as any[] | undefined,
      getDedicatedServerInfo: undefined as any[] | undefined,
      modeFilter: "all",
      sort: "players" as PublicServerSort,
      loading: true,
    };
  },
  mounted() {
    // Ping and "am I on the LAN" both come from the matchmaking probe. It
    // only runs for signed-in players, and only when nothing is cached.
    useMatchmakingStore().checkLatenies();
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
              featured: true,
              hibernating: true,
              connection_link: true,
              connection_string: true,
              max_players: true,
              game_mode: {
                slug: true,
                name: true,
                description: true,
              },
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
          this.servers = data.servers;
          this.loading = false;
        },
      },
    },
  },
  computed: {
    canManage(): boolean {
      return useAuthStore().isRoleAbove(e_player_roles_enum.moderator);
    },
    canSetup(): boolean {
      return useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
    },
    onLan(): boolean {
      return useMatchmakingStore().onLan;
    },
    allServers(): PublicServerView[] {
      return ((this.servers ?? []) as any[]).map((server) =>
        this.toView(server),
      );
    },
    lanServers(): PublicServerView[] {
      return sortServers(
        this.allServers.filter((server) => server.server_region?.is_lan),
        "players",
      );
    },
    onlineServers(): PublicServerView[] {
      return this.allServers.filter((server) => !server.server_region?.is_lan);
    },
    layout() {
      return showcase(this.onlineServers);
    },
    totals(): { playing: number; awake: number; hibernating: number } {
      const visible = this.onLan ? this.allServers : this.onlineServers;
      return {
        playing: visible.reduce((sum, server) => sum + server.players, 0),
        awake: visible.filter((server) => !server.hibernating).length,
        hibernating: visible.filter((server) => server.hibernating).length,
      };
    },
    // Built from the listed servers, so the list never offers a mode nobody
    // is running.
    modeFilters(): Array<{ key: string; label: string; count: number }> {
      const counts = new Map<string, { label: string; count: number }>();

      for (const server of this.layout.rest) {
        const key = server.game_mode?.slug ?? "vanilla";
        const label =
          server.game_mode?.name ?? this.$t("pages.public_servers.no_mode");
        const entry = counts.get(key) ?? { label: String(label), count: 0 };

        entry.count++;
        counts.set(key, entry);
      }

      if (counts.size === 0) {
        return [];
      }

      return [
        {
          key: "all",
          label: String(this.$t("pages.public_servers.all_modes")),
          count: this.layout.rest.length,
        },
        ...[...counts.entries()].map(([key, entry]) => ({
          key,
          label: entry.label,
          count: entry.count,
        })),
      ];
    },
    sortOptions(): Array<{ key: string; label: string }> {
      return [
        {
          key: "players",
          label: String(this.$t("pages.public_servers.sort_players")),
        },
        {
          key: "ping",
          label: String(this.$t("pages.public_servers.sort_ping")),
        },
      ];
    },
    listServers(): PublicServerView[] {
      const inMode =
        this.modeFilter === "all"
          ? this.layout.rest
          : this.layout.rest.filter(
              (server) =>
                (server.game_mode?.slug ?? "vanilla") === this.modeFilter,
            );
      return sortServers(inMode, this.sort);
    },
  },
  methods: {
    toView(server: any): PublicServerView {
      const info = this.getDedicatedServerInfo?.find(
        (entry: any) => entry.id === server.id,
      );
      const reading = useMatchmakingStore().getRegionlatencyResult(
        server.region,
      );
      const ping = reading ? Math.round(Number(reading.latency)) : undefined;
      const view = {
        ...server,
        players: Number(info?.players) || 0,
        map: info?.map || "default",
        ping,
        tier: pingTier(
          ping,
          Number(useApplicationSettingsStore().maxAcceptableLatency) || 100,
        ),
      };
      return { ...view, isFull: isFull(view) };
    },
    // The card opens the server's page; this skips to where it is edited.
    // Settings is administrator-only, so a moderator lands on Players.
    manageTo(serverId: string): string | undefined {
      if (!this.canManage) {
        return undefined;
      }
      return `/dedicated-servers/${serverId}?tab=${this.canSetup ? "settings" : "players"}`;
    },
    async toggleFeatured(server: PublicServerView) {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_servers_by_pk: [
              {
                pk_columns: { id: server.id },
                _set: { featured: !server.featured },
              },
              { __typename: true },
            ],
          }),
        });
      } catch (error) {
        toast({
          title: String(this.$t("pages.public_servers.feature_failed")),
          variant: "destructive",
        });
      }
    },
  },
};
</script>
