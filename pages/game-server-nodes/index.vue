<script setup lang="ts">
import { Button } from "~/components/ui/button";
import PageHeading from "~/components/PageHeading.vue";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { PlusCircle, ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import { Info, ExternalLink } from "lucide-vue-next";
import { Switch } from "~/components/ui/switch";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Pagination from "~/components/Pagination.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <div class="flex-grow flex flex-col gap-6">
    <PageTransition :delay="0">
      <PageHeading>
        <template #title>{{ $t("pages.game_server_nodes.title") }}</template>

        <template #description>{{
          $t("pages.game_server_nodes.description")
        }}</template>
        <template #actions>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2" @click="toggleNodeMetrics()">
              <div class="flex items-center gap-1">
                {{ $t("pages.game_server_nodes.display_metrics") }}
              </div>
              <Switch :model-value="displayMetrics" />
            </div>

            <Popover>
              <PopoverTrigger class="flex gap-4">
                <template v-if="!supportsGameServerNodes">
                  <Alert class="bg-background text-lg">
                    <Info class="h-4 w-4" />
                    <AlertTitle>{{
                      $t("pages.game_server_nodes.not_supported.title")
                    }}</AlertTitle>
                    <AlertDescription>
                      {{
                        $t("pages.game_server_nodes.not_supported.description")
                      }}
                      <a
                        target="_blank"
                        class="underline"
                        href="https://docs.5stack.gg/servers/game-server-nodes/"
                        >Game Server Nodes</a
                      >.
                    </AlertDescription>
                  </Alert>
                </template>

                <Button
                  :size="isMobile ? 'default' : 'lg'"
                  @click="createGameServerNode"
                  :disabled="!supportsGameServerNodes"
                >
                  <PlusCircle class="w-4 h-4" />
                  <span class="hidden md:inline ml-2">{{
                    $t("pages.game_server_nodes.create")
                  }}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <div
                  class="relative bg-gray-900 rounded-lg p-4"
                  v-if="setupGameServer"
                >
                  <div class="flex justify-between items-start">
                    <h3 class="text-white text-sm font-semibold">
                      {{ $t("pages.game_server_nodes.installation_script") }}
                    </h3>
                    <ClipBoard
                      :data="setupGameServer.link"
                      class="text-white hover:text-gray-300 transition-colors"
                    ></ClipBoard>
                  </div>
                  <div class="text-sm mt-2">
                    {{ setupGameServer.gameServerId }}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </template>
      </PageHeading>
    </PageTransition>

    <PageTransition :delay="100">
      <Alert class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <Info class="h-4 w-4" />
          <AlertTitle class="m-0">{{
            $t("pages.game_server_nodes.cs_version_info")
          }}</AlertTitle>
        </div>
        <AlertDescription class="m-0 flex items-center gap-2">
          <span>{{
            $t("pages.game_server_nodes.build_id", {
              id: `${currentGameVersion?.version} (${currentGameVersion?.build_id})`,
            })
          }}</span>
          <span class="text-muted-foreground">•</span>
          <span>{{
            $t("pages.game_server_nodes.last_updated", {
              date: new Date(currentGameVersion?.updated_at).toLocaleString(),
            })
          }}</span>
        </AlertDescription>
      </Alert>
    </PageTransition>

    <!-- Filters -->
    <PageTransition :delay="200">
      <AnimatedCard variant="gradient" class="p-4 mb-4">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ $t("pages.game_server_nodes.filters") }}
            </h3>
            <Button variant="outline" size="sm" @click="resetFilters">
              {{ $t("pages.manage_matches.reset_filters") }}
            </Button>
          </div>

          <form @submit.prevent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <!-- Name search -->
              <div class="space-y-2">
                <Label for="node-name-search">{{
                  $t("pages.manage_matches.search_by_name")
                }}</Label>
                <Input
                  id="node-name-search"
                  :model-value="form.values.name"
                  @update:model-value="
                    (value) => {
                      form.setFieldValue('name', value);
                      onFilterChange();
                    }
                  "
                  :placeholder="$t('pages.manage_matches.enter_name')"
                />
              </div>

              <!-- Regions multi-select -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label for="regions-filter">{{
                    $t("pages.manage_matches.filter_by_regions")
                  }}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="clearAllRegions"
                    class="text-xs h-6 px-2"
                    :class="{ 'opacity-50': !form.values.regions?.length }"
                  >
                    {{ $t("pages.manage_matches.clear_all") }}
                  </Button>
                </div>
                <Select
                  :model-value="form.values.regions"
                  @update:model-value="onRegionsChange"
                  multiple
                >
                  <SelectTrigger id="regions-filter">
                    <SelectValue
                      :placeholder="$t('pages.manage_matches.select_regions')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="region in availableRegions"
                      :key="region.value"
                      :value="region.value"
                    >
                      {{ region.description || region.value }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Enabled toggle -->
              <div class="space-y-2">
                <Label>{{ $t("pages.game_server_nodes.only_enabled") }}</Label>
                <div class="flex items-center gap-2">
                  <Switch
                    :model-value="onlyEnabled"
                    @update:model-value="onlyEnabled = !onlyEnabled"
                  />
                  <span class="text-sm text-muted-foreground">{{
                    onlyEnabled ? $t("common.enabled") : $t("common.all")
                  }}</span>
                </div>
              </div>
              <!-- Hide Offline toggle -->
              <div class="space-y-2">
                <Label>{{ $t("pages.game_server_nodes.hide_offline") }}</Label>
                <div class="flex items-center gap-2">
                  <Switch
                    :model-value="hideOffline"
                    @update:model-value="hideOffline = !hideOffline"
                  />
                  <span class="text-sm text-muted-foreground">{{
                    hideOffline
                      ? $t("pages.game_server_nodes.status.online")
                      : $t("pages.game_server_nodes.status.offline")
                  }}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </AnimatedCard>
    </PageTransition>

    <PageTransition :delay="300">
      <AnimatedCard variant="gradient" class="p-4 relative">
        <div v-if="loading" class="absolute top-4 left-4 z-10">
          <div
            class="flex items-center space-x-2 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded"
          >
            <div
              class="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"
            ></div>
            <span>{{ $t("pages.manage_matches.loading") }}</span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="cursor-pointer" @click="toggleSortDirection">
                <div class="flex items-center gap-1">
                  {{ $t("pages.game_server_nodes.table.node") }}
                  <ArrowUpIcon
                    v-if="sortDirection === 'desc'"
                    class="w-4 h-4"
                  />
                  <ArrowDownIcon v-else class="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead>
                <a
                  href="https://docs.5stack.gg/servers/low-latency-kernel"
                  target="_blank"
                  class="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {{ $t("pages.game_server_nodes.table.supports_low_latency") }}
                  <ExternalLink class="w-4 h-4" />
                </a>
              </TableHead>
              <TableHead>
                <a
                  href="https://docs.5stack.gg/servers/cpu-pinning"
                  target="_blank"
                  class="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {{ $t("pages.game_server_nodes.table.supports_cpu_pinning") }}
                  <ExternalLink class="w-4 h-4" />
                </a>
              </TableHead>
              <TableHead>
                <a
                  href="https://docs.5stack.gg/servers/cpu-governance"
                  target="_blank"
                  class="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {{ $t("pages.game_server_nodes.table.cpu_governor") }}
                  <ExternalLink class="w-4 h-4" />
                </a>
              </TableHead>
              <TableHead
                >{{ $t("pages.game_server_nodes.table.cs_build_id") }}
              </TableHead>
              <TableHead>
                {{ $t("pages.game_server_nodes.table.pin_build_id") }}
                <FiveStackToolTip>{{
                  $t("pages.game_server_nodes.table.pin_build_id_tooltip")
                }}</FiveStackToolTip>
              </TableHead>
              <TableHead
                >{{ $t("pages.game_server_nodes.table.pin_plugin_version") }}

                <FiveStackToolTip>{{
                  $t("pages.game_server_nodes.table.pin_plugin_version_tooltip")
                }}</FiveStackToolTip>
              </TableHead>
              <TableHead>{{
                $t("pages.game_server_nodes.table.region")
              }}</TableHead>
              <TableHead>{{
                $t("pages.game_server_nodes.table.capacity")
              }}</TableHead>
              <TableHead>
                <div class="flex items-center gap-1">
                  {{ $t("pages.game_server_nodes.table.ports") }}
                  <FiveStackToolTip>{{
                    $t("pages.game_server_nodes.table.ports_tooltip")
                  }}</FiveStackToolTip>
                </div>
              </TableHead>
              <TableHead>{{
                $t("pages.game_server_nodes.table.demo_network_limiter")
              }}</TableHead>
              <TableHead>{{
                $t("pages.game_server_nodes.table.enabled")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="gameServerNodes?.length === 0">
              <TableRow>
                <TableCell colspan="5" class="text-center">{{
                  $t("pages.game_server_nodes.table.no_nodes")
                }}</TableCell>
              </TableRow>
            </template>
            <template v-else>
              <GameServerNodeRow
                :game-server-node="gameServerNode"
                :key="gameServerNode.id"
                v-for="gameServerNode of gameServerNodes"
                :display-metrics="displayMetrics"
              ></GameServerNodeRow>
            </template>
          </TableBody>
        </Table>
      </AnimatedCard>
    </PageTransition>
  </div>

  <Pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="nodesAggregate || 0"
    v-if="nodesAggregate"
  ></Pagination>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by, $ } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  data() {
    return {
      gameVersions: [],
      gameServerNodes: [],
      setupGameServer: localStorage.getItem("displayMetrics") === "true",
      displayMetrics: false,
      onlyEnabled: this.loadFiltersFromStorage().onlyEnabled || false,
      hideOffline: this.loadFiltersFromStorage().hideOffline || false,
      availableRegions: [],
      loading: false,
      page: 1,
      perPage: 10,
      nodesAggregate: 0,
      sortDirection: this.loadFiltersFromStorage().sortDirection || "asc",
      sortField: this.loadFiltersFromStorage().sortField || "label",
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().optional(),
            regions: z.array(z.string()).optional(),
          }),
        ),
        initialValues: {
          name: this.loadFiltersFromStorage().name || "",
          regions: this.loadFiltersFromStorage().regions || [],
        },
      }),
    };
  },
  watch: {
    onlyEnabled() {
      this.saveFiltersToStorage();
    },
  },
  apollo: {
    $subscribe: {
      game_versions: {
        query: typedGql("subscription")({
          game_versions: [
            {},
            {
              build_id: true,
              version: true,
              description: true,
              updated_at: true,
              current: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.gameVersions = data.game_versions;
        },
      },
      game_server_nodes: {
        query: typedGql("subscription")({
          game_server_nodes: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                {},
                {
                  label: $("label_order", "order_by!"),
                },
              ],
              where: $("where_clause", "game_server_nodes_bool_exp!"),
            },
            {
              id: true,
              label: true,
              status: true,
              region: true,
              enabled: true,
              build_id: true,
              pin_build_id: true,
              pin_plugin_version: true,
              plugin_supported: true,
              lan_ip: true,
              public_ip: true,
              start_port_range: true,
              end_port_range: true,
              supports_low_latency: true,
              supports_cpu_pinning: true,
              update_status: true,
              gpu: true,
              cpu_sockets: true,
              cpu_governor_info: true,
              cpu_frequency_info: true,
              cpu_cores_per_socket: true,
              cpu_threads_per_core: true,
              offline_at: true,
              e_region: {
                description: true,
              },
              e_status: {
                description: true,
              },
              total_server_count: true,
              available_server_count: true,
              demo_network_limiter: true,
            },
          ],
        }),
        variables(this: any): {
          where_clause: any;
          label_order: any;
          limit: number;
          offset: number;
        } {
          this.loading = true;
          const filterConditions: any = {};
          const formValues = this.form.values;

          if (formValues.name?.trim()) {
            filterConditions.label = { _ilike: `%${formValues.name.trim()}%` };
          }

          if (formValues.regions && formValues.regions.length > 0) {
            filterConditions.region = { _in: formValues.regions };
          }

          if (this.onlyEnabled) {
            filterConditions.enabled = { _eq: true };
          }

          if (this.hideOffline) {
            filterConditions.offline_at = { _is_null: true };
          }

          this.saveFiltersToStorage();

          return {
            where_clause: {
              ...filterConditions,
            },
            label_order:
              this.sortDirection === "desc" ? order_by.desc : order_by.asc,
            limit: this.perPage,
            offset: (this.page - 1) * this.perPage,
          };
        },
        result: function ({ data }) {
          this.loading = false;
          this.gameServerNodes = data.game_server_nodes;
        },
        error: function () {
          this.loading = false;
        },
      },
      game_server_nodes_aggregate: {
        query: typedGql("subscription")({
          game_server_nodes_aggregate: [
            {
              where: $("where_clause", "game_server_nodes_bool_exp!"),
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        variables(this: any): { where_clause: any } {
          const filterConditions: any = {};
          const formValues = this.form.values;

          if (formValues.name?.trim()) {
            filterConditions.label = { _ilike: `%${formValues.name.trim()}%` };
          }
          if (formValues.regions && formValues.regions.length > 0) {
            filterConditions.region = { _in: formValues.regions };
          }
          if (this.onlyEnabled) {
            filterConditions.enabled = { _eq: true };
          }
          if (this.hideOffline) {
            filterConditions.offline_at = { _is_null: true };
          }

          return {
            where_clause: {
              ...filterConditions,
            },
          };
        },
        result: function ({ data }) {
          this.nodesAggregate =
            data.game_server_nodes_aggregate?.aggregate?.count || 0;
        },
      },
      server_regions: {
        query: typedGql("subscription")({
          server_regions: [
            {},
            {
              value: true,
              description: true,
            },
          ],
        }),
        result: function ({ data }) {
          this.availableRegions = data.server_regions || [];
        },
      },
    },
  },
  methods: {
    resetFilters() {
      this.form.setValues({
        name: "",
        regions: [],
      });
      this.onlyEnabled = false;
      this.hideOffline = false;
      this.sortDirection = "asc";
      this.sortField = "label";
      this.page = 1;
      this.saveFiltersToStorage();
      this.updatePagedNodes();
    },
    updatePagedNodes() {
      const start = (this.page - 1) * this.perPage;
      const end = start + this.perPage;
      this.gameServerNodes = (this.allGameServerNodes || []).slice(start, end);
    },
    loadFiltersFromStorage() {
      if (process.client) {
        try {
          const saved = localStorage.getItem("game-server-nodes-filters");
          return saved ? JSON.parse(saved) : {};
        } catch (error) {
          return {};
        }
      }
      return {};
    },
    saveFiltersToStorage() {
      if (process.client) {
        try {
          const filters = {
            name: this.form.values.name,
            regions: this.form.values.regions,
            onlyEnabled: this.onlyEnabled,
            hideOffline: this.hideOffline,
            sortDirection: this.sortDirection,
            sortField: this.sortField,
          };
          localStorage.setItem(
            "game-server-nodes-filters",
            JSON.stringify(filters),
          );
        } catch (error) {
          // ignore storage errors
        }
      }
    },
    onSortChange() {
      this.saveFiltersToStorage();
    },
    onFilterChange() {
      this.page = 1;
      this.saveFiltersToStorage();
      this.updatePagedNodes();
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.saveFiltersToStorage();
    },
    onRegionsChange(regions: any) {
      this.form.setValues({
        ...this.form.values,
        regions: regions || [],
      });
      this.onFilterChange();
    },
    clearAllRegions() {
      this.form.setValues({
        ...this.form.values,
        regions: [],
      });
      this.onFilterChange();
    },
    toggleNodeMetrics() {
      this.displayMetrics = !this.displayMetrics;
      localStorage.setItem("displayMetrics", String(this.displayMetrics));
    },
    async createGameServerNode() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          setupGameServer: {
            link: true,
            gameServerId: true,
          },
        }),
      });

      this.setupGameServer = data.setupGameServer;
    },
  },
  computed: {
    currentGameVersion() {
      return this.gameVersions.find((version) => {
        return version.current === true;
      });
    },
    supportsGameServerNodes() {
      return useApplicationSettingsStore().supportsGameServerNodes;
    },
  },
  created() {
    if (process.client) {
      try {
        const stored = localStorage.getItem("displayMetrics");
        if (stored !== null) {
          this.displayMetrics = stored === "true";
        }
        // Ensure defaults for filters if not set
        const saved = this.loadFiltersFromStorage();
        if (!this.form.values.regions) {
          this.form.setValues({
            ...this.form.values,
            regions: saved.regions || [],
          });
        }
      } catch (e) {
        // ignore storage errors
      }
    }
  },
};
</script>
