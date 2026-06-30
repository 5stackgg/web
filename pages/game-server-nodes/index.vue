<script setup lang="ts">
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";
import SetupDialog from "~/components/game-server-nodes/SetupDialog.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import {
  PlusCircle,
  ArrowUpIcon,
  ArrowDownIcon,
  Info,
  Search,
  X,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Activity,
  CircleDot,
} from "lucide-vue-next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import Pagination from "~/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  tacticalSectionTickClasses,
  filterTriggerBase,
  filterTriggerIdle,
  filterTriggerActive,
  filterBadgeClasses,
} from "~/utilities/tacticalClasses";

const fadeTransition = {
  enterActiveClass: "transition-opacity duration-200 ease-out",
  leaveActiveClass: "transition-opacity duration-200 ease-out",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
};
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.game_server_nodes.title") }}</template>
      <template #subtitle>{{
        $t("pages.game_server_nodes.description")
      }}</template>
      <template #actions>
        <button
          type="button"
          @click="createGameServerNode"
          :disabled="!supportsGameServerNodes"
          :class="[
            tacticalCtaButtonClasses,
            tacticalHeaderActionClasses,
            'max-md:aspect-square max-md:!px-0',
            !supportsGameServerNodes && 'pointer-events-none opacity-50',
          ]"
          :title="$t('pages.game_server_nodes.create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline">{{
            $t("pages.game_server_nodes.create")
          }}</span>
        </button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Not supported notice -->
  <PageTransition :delay="80" class="mt-6" v-if="!supportsGameServerNodes">
    <div
      class="flex items-start gap-3 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] px-4 py-3 text-sm"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div class="space-y-0.5">
        <p class="font-semibold">
          {{ $t("pages.game_server_nodes.not_supported.title") }}
        </p>
        <p class="text-muted-foreground">
          {{ $t("pages.game_server_nodes.not_supported.description") }}
          <a
            target="_blank"
            class="underline underline-offset-2 hover:text-foreground"
            href="https://docs.5stack.gg/servers/game-server-nodes/"
            >{{ $t("layouts.app_nav.administration.game_server_nodes") }}</a
          >.
        </p>
      </div>
    </div>
  </PageTransition>

  <!-- CS version info strip -->
  <PageTransition :delay="120" class="mt-6" v-if="currentGameVersion">
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card/40 px-3 py-2 text-xs [backdrop-filter:blur(6px)]"
    >
      <span
        class="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em] text-muted-foreground"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.game_server_nodes.cs_version_info") }}
      </span>
      <span class="font-semibold text-foreground">
        {{ currentGameVersion.version }} ({{ currentGameVersion.build_id }})
      </span>
      <span class="text-muted-foreground/50">•</span>
      <span class="text-muted-foreground">
        {{
          $t("pages.game_server_nodes.last_updated", {
            date: new Date(currentGameVersion.updated_at).toLocaleString(),
          })
        }}
      </span>
    </div>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="160" class="mt-6">
    <FilterBar>
      <!-- Name search (always visible) -->
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          :model-value="form.values.name"
          @update:model-value="
            (value) => {
              form.setFieldValue('name', String(value ?? ''));
              onFilterChange();
            }
          "
          :placeholder="$t('pages.manage_matches.enter_name')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="form.values.name"
            type="button"
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="
              form.setFieldValue('name', '');
              onFilterChange();
            "
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <!-- Regions multi-select -->
      <Popover>
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="[
              filterTriggerBase,
              selectedRegions.length ? filterTriggerActive : filterTriggerIdle,
            ]"
          >
            <Globe class="h-3.5 w-3.5" />
            {{ $t("common.region") }}
            <span v-if="selectedRegions.length" :class="filterBadgeClasses">
              {{ selectedRegions.length }}
            </span>
            <ChevronDown class="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          class="max-h-72 w-56 space-y-0.5 overflow-y-auto p-2"
        >
          <span
            class="block px-1 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("pages.manage_matches.filter_by_regions") }}
          </span>
          <button
            v-for="region in availableRegions"
            :key="region.value"
            type="button"
            @click="toggleRegion(region.value)"
            class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
            :class="
              isRegionSelected(region.value)
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-foreground/90'
            "
          >
            <span>{{ region.description || region.value }}</span>
            <Check
              v-if="isRegionSelected(region.value)"
              class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
            />
          </button>
        </PopoverContent>
      </Popover>

      <!-- Filters (bundled, pinned right) + grouped reset -->
      <FilterMenu
        class="ml-auto"
        :count="optionsActiveCount"
        :active="optionsActiveCount > 0"
        :show-reset="hasActiveFilters"
        content-class="w-60 space-y-0.5 p-2"
        @reset="resetFilters"
      >
        <button
          type="button"
          @click="toggleOnlyEnabled"
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          :class="
            onlyEnabled ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground/90'
          "
        >
          <span class="flex items-center gap-2">
            <CircleDot class="h-3.5 w-3.5" />
            {{ $t("pages.game_server_nodes.only_enabled") }}
          </span>
          <Check
            v-if="onlyEnabled"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
        </button>
        <button
          type="button"
          @click="toggleHideOffline"
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          :class="
            hideOffline ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground/90'
          "
        >
          <span class="flex items-center gap-2">
            <Activity class="h-3.5 w-3.5" />
            {{ $t("pages.game_server_nodes.hide_offline") }}
          </span>
          <Check
            v-if="hideOffline"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
        </button>
        <button
          type="button"
          @click="toggleNodeMetrics"
          class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          :class="
            displayMetrics
              ? 'text-[hsl(var(--tac-amber))]'
              : 'text-foreground/90'
          "
        >
          <span class="flex items-center gap-2">
            <Activity class="h-3.5 w-3.5" />
            {{ $t("pages.game_server_nodes.display_metrics") }}
          </span>
          <Check
            v-if="displayMetrics"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
        </button>
      </FilterMenu>
    </FilterBar>
  </PageTransition>

  <!-- Results -->
  <PageTransition :delay="220" class="mt-6">
    <div
      class="rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)]"
    >
      <Transition v-bind="fadeTransition" mode="out-in">
        <Empty v-if="loading" key="loading" class="min-h-[200px]">
          <div class="space-y-3 w-full max-w-md">
            <Skeleton class="h-4 w-3/4 mx-auto" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-5/6 mx-auto" />
          </div>
        </Empty>

        <div
          v-else-if="gameServerNodes && gameServerNodes.length > 0"
          key="nodes"
          class="overflow-x-auto"
        >
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
                <TableHead class="hidden xl:table-cell">{{
                  $t("game_server.hardware")
                }}</TableHead>
                <TableHead class="hidden xl:table-cell">{{
                  $t("common.region")
                }}</TableHead>
                <TableHead class="hidden xl:table-cell whitespace-nowrap">
                  <div class="flex items-center gap-1">
                    {{ $t("pages.game_server_nodes.table.capacity") }}
                    <FiveStackToolTip>{{
                      $t("pages.game_server_nodes.table.ports_tooltip")
                    }}</FiveStackToolTip>
                  </div>
                </TableHead>
                <TableHead class="hidden xl:table-cell pr-1">
                  {{ $t("pages.game_server_nodes.table.cs_build_id") }}
                </TableHead>
                <TableHead class="hidden xl:table-cell pl-1">
                  {{ $t("common.plugin_version") }}
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <GameServerNodeRow
                :game-server-node="gameServerNode"
                :key="gameServerNode.id"
                v-for="gameServerNode of gameServerNodes"
                :display-metrics="displayMetrics"
              ></GameServerNodeRow>
            </TableBody>
          </Table>
        </div>

        <Empty v-else key="empty" class="min-h-[200px]">
          <EmptyTitle>{{
            $t("pages.game_server_nodes.no_nodes_title")
          }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.game_server_nodes.table.no_nodes")
          }}</EmptyDescription>
        </Empty>
      </Transition>
    </div>
  </PageTransition>

  <Pagination
    v-if="nodesAggregate && nodesAggregate > 0"
    class="mt-6"
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="nodesAggregate || 0"
  ></Pagination>

  <!-- Setup Dialog -->
  <SetupDialog
    :open="showSetupDialog"
    :setup-game-server="setupGameServer"
    @close="closeSetupDialog"
    v-if="setupGameServer"
  />
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by, $ } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";

export default {
  data() {
    return {
      gameVersions: [],
      gameServerNodes: [],
      setupGameServer: null,
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
      showSetupDialog: false,
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
                  id: order_by.asc,
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
              enabled_for_match_making: true,
              build_id: true,
              csgo_build_id: true,
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
              gpu_info: true,
              gpu_streaming_enabled: true,
              gpu_demos_enabled: true,
              gpu_rendering_enabled: true,
              cs2_video_settings: true,
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
              disk_available_gb: true,
              disk_used_percent: true,
            } as any,
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
      const currentName = this.form.values.name || "";
      const currentRegions = this.form.values.regions || [];
      const hasChanges =
        currentName !== "" ||
        currentRegions.length > 0 ||
        this.onlyEnabled !== false ||
        this.hideOffline !== false ||
        this.sortDirection !== "asc" ||
        this.sortField !== "label" ||
        this.page !== 1;

      if (!hasChanges) {
        return;
      }

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
    onFilterChange() {
      this.page = 1;
      this.saveFiltersToStorage();
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.saveFiltersToStorage();
    },
    isRegionSelected(value: string) {
      return (this.form.values.regions || []).includes(value);
    },
    regionDescription(value: string) {
      const region = this.availableRegions.find((r: any) => r.value === value);
      return region?.description || value;
    },
    toggleRegion(value: string) {
      const current = [...(this.form.values.regions || [])];
      const index = current.indexOf(value);
      if (index >= 0) {
        current.splice(index, 1);
      } else {
        current.push(value);
      }
      this.form.setValues({
        ...this.form.values,
        regions: current,
      });
      this.onFilterChange();
    },
    toggleOnlyEnabled() {
      this.onlyEnabled = !this.onlyEnabled;
      this.onFilterChange();
    },
    toggleHideOffline() {
      this.hideOffline = !this.hideOffline;
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
      this.showSetupDialog = true;
    },
    closeSetupDialog() {
      this.showSetupDialog = false;
      setTimeout(() => {
        this.setupGameServer = null;
      }, 300);
    },
  },
  computed: {
    currentGameVersion() {
      return this.gameVersions.find((version) => {
        return version.current === true;
      });
    },
    selectedRegions() {
      return this.form.values.regions || [];
    },
    optionsActiveCount() {
      return (this.onlyEnabled ? 1 : 0) + (this.hideOffline ? 1 : 0);
    },
    hasActiveFilters() {
      return (
        (this.form.values.name || "") !== "" ||
        this.selectedRegions.length > 0 ||
        this.onlyEnabled ||
        this.hideOffline ||
        this.sortDirection !== "asc"
      );
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
