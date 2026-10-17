<script setup lang="ts">
import { ArrowDown, ArrowUp, BookOpen, Plus, Search, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import Pagination from "~/components/Pagination.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FacetRail from "~/components/admin/FacetRail.vue";
import ServerFleetRow from "~/components/servers/ServerFleetRow.vue";
import {
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({ middleware: "admin" });

const SETUP_URL = "https://docs.5stack.gg/servers/dedicated-servers/";

const { openFiles } = useFilePopout();
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.dedicated_servers.title") }}</h1>

  <PageTransition>
    <div class="grid gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <InputGroup
          class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-[18rem]"
        >
          <InputGroupAddon class="pl-2.5">
            <Search class="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            v-model="search"
            autocomplete="off"
            :placeholder="$t('pages.dedicated_servers.search_placeholder')"
            :aria-label="$t('pages.dedicated_servers.search_placeholder')"
            class="h-full text-sm"
          />
          <InputGroupAddon v-if="search" align="inline-end" class="pr-2">
            <button
              type="button"
              class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-label="$t('pages.dedicated_servers.clear_search')"
              @click="search = ''"
            >
              <X class="size-3.5" />
            </button>
          </InputGroupAddon>
        </InputGroup>

        <Button as-child variant="ghost" size="sm" class="ml-auto h-8">
          <a :href="SETUP_URL" target="_blank" rel="noopener noreferrer">
            <BookOpen class="size-3.5" />
            <span class="max-md:sr-only">{{
              $t("pages.dedicated_servers.setup_guide")
            }}</span>
          </a>
        </Button>
        <Button as-child size="sm" :class="listCreateButtonClasses">
          <NuxtLink
            :to="{ name: 'dedicated-servers-create' }"
            :title="$t('pages.dedicated_servers.create_server')"
          >
            <Plus class="size-4" />
            <span class="max-md:sr-only">{{
              $t("pages.dedicated_servers.create_server")
            }}</span>
          </NuxtLink>
        </Button>
      </div>

      <FadeSwap>
        <SectionEmpty
          v-if="!loading && !servers.length"
          key="empty"
          :title="$t('pages.dedicated_servers.empty_title')"
          :description="$t('pages.dedicated_servers.description')"
        >
          <Button as-child variant="ghost" size="sm">
            <a :href="SETUP_URL" target="_blank" rel="noopener noreferrer">
              <BookOpen class="size-3.5" />
              {{ $t("pages.dedicated_servers.setup_guide") }}
            </a>
          </Button>
          <Button as-child size="sm" :class="createButtonClasses">
            <NuxtLink :to="{ name: 'dedicated-servers-create' }">
              <Plus class="size-4" />
              {{ $t("pages.dedicated_servers.create_server") }}
            </NuxtLink>
          </Button>
        </SectionEmpty>

        <FacetRail
          v-else
          key="fleet"
          v-model="facets"
          :groups="facetGroups"
          :defaults="facetDefaults"
          :counts="!loading"
          :label="$t('pages.dedicated_servers.filter_label')"
        >
          <template #top>
            <div
              class="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-muted-foreground"
            >
              <span v-if="!loading">
                <b class="font-semibold tabular-nums text-foreground">{{
                  liveVisible.length
                }}</b>
                {{
                  $t("pages.dedicated_servers.servers_word", liveVisible.length)
                }}
              </span>
              <template v-if="hiddenDisabled">
                <span class="text-muted-foreground/70">{{
                  $t(
                    "pages.dedicated_servers.disabled_hidden",
                    { count: hiddenDisabled },
                    hiddenDisabled,
                  )
                }}</span>
                <button
                  type="button"
                  class="text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
                  @click="showDisabled"
                >
                  {{ $t("pages.dedicated_servers.show_them") }}
                </button>
              </template>
              <span v-if="pages > 1" class="ml-auto tabular-nums">{{
                $t("pages.dedicated_servers.page_of", { page, pages })
              }}</span>
            </div>
          </template>

          <SectionEmpty
            v-if="!loading && !visibleServers.length"
            :title="$t('common.empty_filtered.title')"
            :description="$t('common.empty_filtered.description')"
          >
            <Button variant="outline" size="sm" @click="clearAll">
              {{ $t("pages.dedicated_servers.clear_all") }}
            </Button>
          </SectionEmpty>

          <div v-else class="grid max-w-[1080px] gap-1">
            <div
              ref="scrollbox"
              class="max-h-[max(420px,calc(100dvh-14rem))] overflow-auto rounded-lg border border-border bg-card/20 transition-opacity motion-reduce:transition-none"
              :class="
                rowsFading
                  ? 'opacity-0 [transition-duration:110ms] ease-in'
                  : 'opacity-100 [transition-duration:200ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
              "
              data-servers-ledger
            >
              <table class="w-full text-[0.8125rem] md:min-w-[760px]">
                <thead>
                  <tr class="text-left text-[0.72rem] text-muted-foreground">
                    <th
                      v-for="column in columns"
                      :key="column.key"
                      class="sticky top-0 z-[2] whitespace-nowrap border-b border-border bg-background px-3 py-2.5 font-medium"
                      :class="[
                        column.right && 'text-right',
                        column.key === 'server' ? 'md:min-w-[240px]' : 'w-px',
                        !column.phone && 'max-md:hidden',
                      ]"
                      :aria-sort="
                        applied.sort.key === column.key
                          ? applied.sort.dir > 0
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      "
                    >
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground"
                        :class="sort.key === column.key && 'text-foreground'"
                        @click="sortBy(column.key)"
                      >
                        <FiveStackToolTip
                          v-if="column.key === 'ports'"
                          as-child
                          :tap-toggle="false"
                        >
                          <template #trigger>
                            <span
                              class="cursor-help underline decoration-muted-foreground/70 decoration-dotted underline-offset-[3px]"
                              >{{ column.label }}</span
                            >
                          </template>
                          {{ $t("pages.dedicated_servers.ports_tip") }}
                        </FiveStackToolTip>
                        <template v-else>{{ column.label }}</template>
                        <ArrowUp
                          v-if="sort.key === column.key && sort.dir > 0"
                          class="size-3"
                        />
                        <ArrowDown
                          v-else-if="sort.key === column.key"
                          class="size-3"
                        />
                      </button>
                      <!-- Status lives under each server's address now; it
                           still sorts from here. -->
                      <template v-if="column.key === 'server'">
                        <span class="mx-1.5 text-muted-foreground/40">·</span>
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground"
                          :class="sort.key === 'status' && 'text-foreground'"
                          @click="sortBy('status')"
                        >
                          {{ $t("common.status") }}
                          <ArrowUp
                            v-if="sort.key === 'status' && sort.dir > 0"
                            class="size-3"
                          />
                          <ArrowDown
                            v-else-if="sort.key === 'status'"
                            class="size-3"
                          />
                        </button>
                      </template>
                    </th>
                    <th
                      class="sticky top-0 z-[2] w-12 border-b border-border bg-background px-2 py-2.5"
                    >
                      <span class="sr-only">{{
                        $t("common.actions_label")
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <tbody v-if="loading">
                  <tr v-for="i in 6" :key="i">
                    <td :colspan="columns.length + 1" class="px-3 py-2">
                      <Skeleton class="h-9 w-full rounded-md" />
                    </td>
                  </tr>
                </tbody>
                <tbody v-else>
                  <ServerFleetRow
                    v-for="server in pagedServers"
                    :key="server.id"
                    :server="server"
                    :ctx="fleetCtx"
                    can-files
                    @toggle-enabled="toggleEnabled(server)"
                    @delete="deleteTarget = server"
                    @copy="copyAddress"
                    @files="openFiles({ scope: 'server', id: server.id })"
                  />
                </tbody>
              </table>
            </div>

            <Pagination
              v-if="pages > 1"
              :page="page"
              :per-page="perPage"
              :total="visibleServers.length"
              @page="toPage"
            />
          </div>
        </FacetRail>
      </FadeSwap>
    </div>
  </PageTransition>

  <AlertDialog
    :open="!!deleteTarget"
    @update:open="
      (open) => {
        if (!open) deleteTarget = null;
      }
    "
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.dedicated_servers.delete_title", {
            label: deleteTarget?.label ?? "",
          })
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            deleteTarget?.game_server_node_id
              ? $t("pages.dedicated_servers.delete_body_node", {
                  node:
                    deleteTarget.game_server_node?.label ||
                    deleteTarget.game_server_node_id,
                })
              : $t("pages.dedicated_servers.delete_body_external")
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button: AlertDialogAction closes before the mutation runs. -->
        <Button
          variant="destructive"
          :disabled="deleting"
          @click="deleteServer"
        >
          {{ $t("pages.dedicated_servers.delete_server") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { toast } from "@/components/ui/toast";
import { order_by } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import {
  facetHits,
  matchesFacets,
  type FacetGroup,
  type FacetSelection,
} from "~/components/admin/facets";
import {
  DEFAULT_SERVER_STATES,
  SERVER_PAGE_SIZE,
  SERVER_STATES,
  hostLabel,
  matchesServerSearch,
  readServerView,
  saveServerView,
  serverAddress,
  serverFacetValues,
  sortServers,
  versionRank,
  type FleetContext,
  type ServerSort,
  type ServerSortKey,
} from "~/components/servers/serverFleet";

const defaultFacets = (): FacetSelection => ({
  state: [...DEFAULT_SERVER_STATES],
  type: [],
  region: [],
  host: [],
  plugin: [],
});

export default {
  data() {
    const view = readServerView({
      search: "",
      facets: defaultFacets(),
      sort: { key: "status", dir: 1 },
    });
    return {
      servers: [] as any[],
      loading: true,
      search: view.search,
      facets: view.facets,
      sort: view.sort as ServerSort,
      // The table lags the controls by the moment its rows take to fade out.
      applied: {
        search: view.search,
        facets: JSON.parse(JSON.stringify(view.facets)) as FacetSelection,
        sort: { ...view.sort } as ServerSort,
      },
      rowsFading: false,
      fadeTimer: null as ReturnType<typeof setTimeout> | null,
      searchTimer: null as ReturnType<typeof setTimeout> | null,
      page: 1,
      perPage: SERVER_PAGE_SIZE,
      deleteTarget: null as any,
      deleting: false,
      getDedicatedServerInfo: [] as any[],
      // "Offline since" reads against this, refreshed once a minute.
      now: Date.now(),
      clockTimer: null as ReturnType<typeof setInterval> | null,
    };
  },
  apollo: {
    getDedicatedServerInfo: {
      query: generateQuery({
        getDedicatedServerInfo: [{}, { id: true, players: true }],
      }),
      pollInterval: 30 * 1000,
    },
    $subscribe: {
      servers: {
        query: generateSubscription({
          servers: [
            { order_by: [{ label: order_by.asc }] },
            {
              id: true,
              label: true,
              host: true,
              port: true,
              tv_port: true,
              type: true,
              region: true,
              enabled: true,
              connected: true,
              hibernating: true,
              rcon_status: true,
              max_players: true,
              plugin_version: true,
              plugin_runtime: true,
              offline_at: true,
              game_server_node_id: true,
              current_match: { id: true },
              game_mode: { name: true },
              server_region: { value: true, description: true },
              game_server_node: { id: true, label: true, node_ip: true },
            },
          ],
        }),
        result: function (this: any, { data }: { data: any }) {
          this.servers = data?.servers ?? [];
          this.loading = false;
        },
        error: function (this: any) {
          this.loading = false;
        },
      },
    },
  },
  mounted(this: any) {
    this.clockTimer = setInterval(() => (this.now = Date.now()), 60_000);
  },
  beforeUnmount(this: any) {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
  },
  watch: {
    facetSignature() {
      (this as any).apply(110);
      (this as any).remember();
    },
    search() {
      const self = this as any;
      self.remember();
      if (self.searchTimer) clearTimeout(self.searchTimer);
      self.searchTimer = setTimeout(() => self.apply(70), 140);
    },
  },
  computed: {
    fleetCtx(): FleetContext {
      const settings = useApplicationSettingsStore();
      const players = new Map<string, number>();
      for (const entry of (this.getDedicatedServerInfo as any[]) ?? []) {
        if (entry?.id) players.set(entry.id, Number(entry.players) || 0);
      }
      return {
        currentPluginVersion: settings.currentPluginVersion,
        pluginRuntime: settings.gameServerPluginRuntime,
        players,
        now: this.now,
      };
    },
    // Phones keep only the columns marked `phone`; enabling moves to the ⋯ menu.
    columns(): Array<{
      key: ServerSortKey;
      label: string;
      right?: boolean;
      phone?: boolean;
    }> {
      return [
        {
          key: "server",
          label: String(this.$t("pages.dedicated_servers.col_server")),
          phone: true,
        },
        {
          key: "type",
          label: String(this.$t("pages.dedicated_servers.table.type")),
        },
        {
          key: "hosting",
          label: String(this.$t("pages.dedicated_servers.col_hosting")),
        },
        {
          key: "players",
          label: String(this.$t("pages.dedicated_servers.col_players")),
          right: true,
          phone: true,
        },
        {
          key: "plugin",
          label: String(this.$t("pages.dedicated_servers.col_plugin")),
        },
        {
          key: "ports",
          label: String(this.$t("pages.dedicated_servers.col_ports")),
          right: true,
        },
        {
          key: "enabled",
          label: String(this.$t("pages.dedicated_servers.table.enabled")),
        },
      ];
    },
    facetDefaults(): FacetSelection {
      return defaultFacets();
    },
    facetSignature(): string {
      return JSON.stringify([this.facets, this.sort]);
    },
    facetValueOf(): (server: any, key: string) => string {
      const ctx = this.fleetCtx as FleetContext;
      return (server: any, key: string) => serverFacetValues(server, key, ctx);
    },
    // Counts follow the controls straight away; the rows follow a beat later.
    searched(): any[] {
      return this.servers.filter((server: any) =>
        matchesServerSearch(server, this.search),
      );
    },
    facetGroups(): FacetGroup[] {
      const pool = this.servers as any[];
      const values = this.facetValueOf as (s: any, k: string) => string;
      const search = (server: any) => matchesServerSearch(server, this.search);
      const count = (key: string, value: string) =>
        facetHits(pool, key, value, this.facets, values, search);
      const tally = (key: string) => {
        const seen = new Map<string, { server: any; n: number }>();
        for (const server of pool) {
          const value = values(server, key);
          const entry = seen.get(value);
          if (entry) entry.n++;
          else seen.set(value, { server, n: 1 });
        }
        return [...seen.entries()];
      };
      const current = useApplicationSettingsStore().currentPluginVersion;

      return [
        {
          key: "state",
          label: String(this.$t("common.status")),
          options: SERVER_STATES.map((value) => ({
            value,
            label: String(this.$t(`pages.dedicated_servers.states.${value}`)),
            count: count("state", value),
          })),
        },
        {
          key: "type",
          label: String(this.$t("pages.dedicated_servers.table.type")),
          options: tally("type")
            .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
            .map(([value]) => ({
              value,
              label: value,
              count: count("type", value),
            })),
        },
        {
          key: "region",
          label: String(this.$t("common.region")),
          options: tally("region")
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, { server }]) => ({
              value,
              label: server.server_region?.description || value || "—",
              count: count("region", value),
            })),
        },
        {
          key: "host",
          label: String(this.$t("pages.dedicated_servers.facet_host")),
          limit: 6,
          options: tally("host")
            .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
            .map(([value, { server }]) => ({
              value,
              label: hostLabel(server),
              mono: true,
              tag: server.game_server_node_id
                ? String(this.$t("pages.dedicated_servers.node_tag"))
                : undefined,
              count: count("host", value),
            })),
        },
        {
          key: "plugin",
          label: String(this.$t("common.plugin_version")),
          options: tally("plugin")
            .sort((a, b) => versionRank(b[0]) - versionRank(a[0]))
            .map(([value]) => ({
              value,
              label:
                value === "none"
                  ? String(this.$t("common.none"))
                  : value === current
                    ? String(
                        this.$t("pages.dedicated_servers.plugin_current", {
                          version: value,
                        }),
                      )
                    : `v${value}`,
              mono: value !== "none",
              count: count("plugin", value),
            })),
        },
      ];
    },
    // Live: the summary line never waits on the fade.
    liveVisible(): any[] {
      const values = this.facetValueOf as (s: any, k: string) => string;
      return (this.searched as any[]).filter((server) =>
        matchesFacets(server, this.facets, values),
      );
    },
    hiddenDisabled(): number {
      const states = this.facets.state ?? [];
      if (!states.length || states.includes("disabled")) return 0;
      return facetHits(
        this.servers,
        "state",
        "disabled",
        this.facets,
        this.facetValueOf as (s: any, k: string) => string,
        (server: any) => matchesServerSearch(server, this.search),
      );
    },
    visibleServers(): any[] {
      const values = this.facetValueOf as (s: any, k: string) => string;
      const { search, facets, sort } = this.applied;
      return sortServers(
        this.servers.filter(
          (server: any) =>
            matchesServerSearch(server, search) &&
            matchesFacets(server, facets, values),
        ),
        sort,
        this.fleetCtx as FleetContext,
      );
    },
    pages(): number {
      return Math.max(
        1,
        Math.ceil((this.visibleServers as any[]).length / this.perPage),
      );
    },
    pagedServers(): any[] {
      const page = Math.min(this.page, this.pages as number);
      return (this.visibleServers as any[]).slice(
        (page - 1) * this.perPage,
        page * this.perPage,
      );
    },
  },
  methods: {
    reducedMotion(): boolean {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    },
    fade(out: number, land: () => void) {
      if (this.fadeTimer) clearTimeout(this.fadeTimer);
      if (this.loading || this.reducedMotion()) {
        land();
        return;
      }
      this.rowsFading = true;
      this.fadeTimer = setTimeout(() => {
        land();
        this.rowsFading = false;
        this.fadeTimer = null;
      }, out);
    },
    remember() {
      saveServerView({
        search: this.search,
        facets: this.facets,
        sort: this.sort,
      });
    },
    apply(out: number) {
      const next = {
        search: this.search,
        facets: JSON.parse(JSON.stringify(this.facets)) as FacetSelection,
        sort: { ...this.sort },
      };
      this.fade(out, () => {
        this.applied = next;
        this.page = 1;
      });
    },
    toPage(page: number) {
      this.fade(110, () => {
        this.page = page;
        const box = this.$refs.scrollbox as HTMLElement | undefined;
        if (box) box.scrollTop = 0;
      });
    },
    sortBy(key: ServerSortKey) {
      this.sort =
        this.sort.key === key
          ? { key, dir: this.sort.dir > 0 ? -1 : 1 }
          : { key, dir: 1 };
    },
    showDisabled() {
      this.facets = {
        ...this.facets,
        state: [...(this.facets.state ?? []), "disabled"],
      };
    },
    clearAll() {
      this.search = "";
      this.facets = defaultFacets();
    },
    async copyAddress(address: string) {
      try {
        await navigator.clipboard?.writeText(address);
        toast({
          title: String(
            this.$t("pages.dedicated_servers.copied", { value: address }),
          ),
        });
      } catch {
        return;
      }
    },
    async toggleEnabled(server: any) {
      const enabled = !server.enabled;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_servers_by_pk: [
              { pk_columns: { id: server.id }, _set: { enabled } },
              { __typename: true },
            ],
          }),
        });
        toast({
          title: String(
            this.$t(
              enabled
                ? "pages.dedicated_servers.enabled_toast"
                : "pages.dedicated_servers.disabled_toast",
              { label: server.label || serverAddress(server) },
            ),
          ),
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: String(this.$t("common.error")),
          description: error?.message,
        });
      }
    },
    async deleteServer() {
      const server = this.deleteTarget;
      if (!server || this.deleting) return;
      this.deleting = true;
      try {
        const { data } = await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_servers_by_pk: [{ id: server.id }, { __typename: true }],
          }),
        });
        if (!data?.delete_servers_by_pk) {
          toast({
            variant: "destructive",
            title: String(this.$t("common.error")),
            description: String(
              this.$t("pages.dedicated_servers.detail.migration.locked"),
            ),
          });
          return;
        }
        this.deleteTarget = null;
        toast({
          title: String(
            this.$t("pages.dedicated_servers.deleted_toast", {
              label: server.label || serverAddress(server),
            }),
          ),
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: String(this.$t("common.error")),
          description: error?.message,
        });
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>
