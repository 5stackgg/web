<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle, ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import Pagination from "~/components/Pagination.vue";
import { Button } from "~/components/ui/button";
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
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { useSidebar } from "~/components/ui/sidebar/utils";

const { isMobile } = useSidebar();
</script>

<template>
  <PageHeading>
    <template #title>{{ $t("pages.manage_tournaments.title") }}</template>
    <template #description>{{
      $t("pages.manage_tournaments.description")
    }}</template>
    <template #actions>
      <Button
        :size="isMobile ? 'default' : 'lg'"
        @click="navigateTo('/tournaments/create')"
      >
        <PlusCircle class="w-4 h-4" />
        <span class="hidden md:inline ml-2">{{
          $t("pages.tournaments.create")
        }}</span>
      </Button>
    </template>
  </PageHeading>

  <Separator class="my-4" />

  <!-- Filters Section -->
  <Card class="p-4 mb-4">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ $t("pages.manage_tournaments.filters") }}
        </h3>
        <Button variant="outline" size="sm" @click="resetFilters">
          {{ $t("pages.manage_tournaments.reset_filters") }}
        </Button>
      </div>

      <form @submit.prevent="onFilterChange" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Tournament ID Search -->
          <div class="space-y-2">
            <Label for="tournament-id-search">{{
              $t("pages.manage_tournaments.search_by_id")
            }}</Label>
            <Input
              id="tournament-id-search"
              :model-value="form.values.tournamentId"
              @update:model-value="
                (value) => {
                  form.setFieldValue('tournamentId', value);
                  onFilterChange();
                }
              "
              :placeholder="$t('pages.manage_tournaments.enter_tournament_id')"
            />
          </div>

          <!-- Tournament Name Search -->
          <div class="space-y-2">
            <Label for="tournament-name-search">{{
              $t("pages.manage_tournaments.search_by_name")
            }}</Label>
            <Input
              id="tournament-name-search"
              :model-value="form.values.tournamentName"
              @update:model-value="
                (value) => {
                  form.setFieldValue('tournamentName', value);
                  onFilterChange();
                }
              "
              :placeholder="
                $t('pages.manage_tournaments.enter_tournament_name')
              "
            />
          </div>

          <!-- Status Filter -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="status-filter">{{
                $t("pages.manage_tournaments.filter_by_status")
              }}</Label>
              <Button
                variant="ghost"
                size="sm"
                @click="clearAllStatuses"
                class="text-xs h-6 px-2"
                :class="{ 'opacity-50': !form.values.statuses?.length }"
              >
                {{ $t("pages.manage_tournaments.clear_all") }}
              </Button>
            </div>
            <Select
              :model-value="form.values.statuses"
              @update:model-value="onStatusChange"
              multiple
            >
              <SelectTrigger id="status-filter">
                <SelectValue
                  :placeholder="$t('pages.manage_tournaments.select_statuses')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="status in tournamentStatusOptions"
                  :key="status.value"
                  :value="status.value"
                >
                  {{ status.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </form>
    </div>
  </Card>

  <!-- Sort Controls -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2 text-sm text-muted-foreground">
        <span>{{ $t("pages.manage_tournaments.sort_by") }}:</span>
        <Select v-model="sortField" @update:model-value="onSortChange">
          <SelectTrigger class="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">{{
              $t("pages.manage_tournaments.created_at")
            }}</SelectItem>
            <SelectItem value="start">{{
              $t("pages.manage_tournaments.start")
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="sm"
        @click="toggleSortDirection"
        class="flex items-center space-x-1"
      >
        <ArrowUpIcon v-if="sortDirection === 'desc'" class="w-4 h-4" />
        <ArrowDownIcon v-else class="w-4 h-4" />
        <span class="text-xs">{{
          sortDirection === "desc"
            ? $t("pages.manage_tournaments.newest_first")
            : $t("pages.manage_tournaments.oldest_first")
        }}</span>
      </Button>
    </div>

    <div class="flex items-center space-x-2">
      <div class="flex items-center space-x-2">
        <Switch
          :model-value="showOnlyMyTournaments"
          @update:model-value="showOnlyMyTournaments = !showOnlyMyTournaments"
        />
        <Label class="text-sm font-medium">{{
          $t("pages.manage_tournaments.only_my_tournaments")
        }}</Label>
      </div>

      <div class="text-sm text-muted-foreground">
        {{ $t("pages.manage_tournaments.showing") }} {{ tournaments.length }}
        {{ $t("pages.manage_tournaments.tournaments") }}
      </div>
    </div>
  </div>

  <Card class="p-4 relative">
    <div v-if="loading" class="absolute top-4 left-4 z-10">
      <div
        class="flex items-center space-x-2 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded"
      >
        <div
          class="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"
        ></div>
        <span>{{ $t("pages.manage_tournaments.loading") }}</span>
      </div>
    </div>
    <div v-if="tournaments && tournaments.length > 0" class="space-y-4">
      <TournamentTableRow
        v-for="tournament in tournaments"
        :key="tournament.id"
        :tournament="tournament"
      ></TournamentTableRow>
    </div>
    <div v-else class="text-center py-8">
      <p class="text-muted-foreground">
        {{ $t("tournament.table.no_tournaments_found") }}
      </p>
    </div>
  </Card>

  <Pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page: number) => {
        page = _page;
      }
    "
    :total="tournamentsAggregate"
    v-if="tournamentsAggregate"
  ></Pagination>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { validate as validateUUID } from "uuid";
import { useAuthStore } from "~/stores/AuthStore";
import { mapFields } from "~/graphql/mapGraphql";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";

interface TournamentsData {
  tournaments: any[];
}

interface ComponentData {
  page: number;
  perPage: number;
  tournaments: any[];
  tournamentsAggregate: number;
  showOnlyMyTournaments: boolean;
  form: any;
  sortField: string;
  sortDirection: string;
  loading: boolean;
}

export default {
  components: {
    TournamentTableRow,
  },
  data(): ComponentData {
    // Load saved filters from localStorage
    const savedFilters = this.loadFiltersFromStorage();

    // Helper function to filter valid statuses
    const filterValidStatuses = (statuses: any[]): string[] => {
      if (!Array.isArray(statuses)) {
        return [];
      }
      const validStatuses = Object.values(e_tournament_status_enum);
      return statuses.filter(
        (status) =>
          status !== null &&
          status !== undefined &&
          validStatuses.includes(status),
      );
    };

    const defaultStatuses = [
      e_tournament_status_enum.Live,
      e_tournament_status_enum.RegistrationOpen,
      e_tournament_status_enum.RegistrationClosed,
      e_tournament_status_enum.Setup,
    ];

    return {
      page: 1,
      perPage: 10,
      tournaments: [] as any[],
      tournamentsAggregate: 0,
      showOnlyMyTournaments: savedFilters.showOnlyMyTournaments || false,
      sortField: savedFilters.sortField || "created_at",
      sortDirection: savedFilters.sortDirection || "desc",
      loading: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            tournamentId: z.string().optional(),
            tournamentName: z.string().optional(),
            statuses: z.array(z.string()).optional(),
          }),
        ),
        initialValues: {
          tournamentId: savedFilters.tournamentId || "",
          tournamentName: savedFilters.tournamentName || "",
          statuses: filterValidStatuses(
            savedFilters.statuses || defaultStatuses,
          ),
        },
      }),
    };
  },
  mounted() {
    if (!this.form.values.statuses || this.form.values.statuses.length === 0) {
      const validDefaultStatuses = this.filterValidStatuses(
        this.defaultStatuses,
      );
      this.form.setValues({
        ...this.form.values,
        statuses: validDefaultStatuses,
      });
    } else {
      // Validate existing statuses
      const validStatuses = this.filterValidStatuses(this.form.values.statuses);
      if (validStatuses.length !== this.form.values.statuses.length) {
        this.form.setValues({
          ...this.form.values,
          statuses: validStatuses,
        });
      }
    }
  },
  watch: {
    showOnlyMyTournaments: {
      handler() {
        this.saveFiltersToStorage();
      },
      immediate: false,
    },
  },
  apollo: {
    $subscribe: {
      tournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: $("order_by", "[tournaments_order_by!]"),
              where: $("where_clause", "tournaments_bool_exp!"),
            },
            {
              id: true,
              name: true,
              start: true,
              description: true,
              e_tournament_status: {
                description: true,
              },
              options: {
                type: true,
                map_pool: [
                  {},
                  {
                    id: true,
                    type: true,
                    e_type: {
                      description: true,
                    },
                    maps: [{}, mapFields],
                  },
                ],
              },
              stages: [
                {
                  order_by: [
                    {
                      order: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  type: true,
                  e_tournament_stage_type: {
                    description: true,
                  },
                  order: true,
                  match_options: matchOptionsFields,
                },
              ],
              teams_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                  },
                },
              ],
              is_organizer: true,
            },
          ],
        }),
        variables(this: any):
          | {
              limit: number;
              order_by: any[];
              offset: number;
              where_clause: any;
            }
          | undefined {
          const formValues = this.form.values;

          // Check for invalid UUID before running query
          if (
            formValues.tournamentId?.trim() &&
            !validateUUID(formValues.tournamentId.trim())
          ) {
            this.loading = false;
            (this as any).tournaments = [];
            return undefined;
          }

          this.loading = true;
          return {
            limit: this.perPage,
            order_by: [this.getSortOrder()],
            offset: (this.page - 1) * this.perPage,
            where_clause: this.getWhereClause(),
          };
        },
        result({ data }: { data: TournamentsData }) {
          this.loading = false;
          (this as any).tournaments = data.tournaments;
        },
        error(error: any) {
          this.loading = false;
        },
      },
      tournamentsAggregate: {
        query: typedGql("subscription")({
          tournaments_aggregate: [
            {
              where: $("where_clause", "tournaments_bool_exp!"),
            },
            {
              aggregate: {
                count: true,
              },
            },
          ],
        }),
        variables(this: any):
          | {
              where_clause: any;
            }
          | undefined {
          const formValues = this.form.values;

          // Check for invalid UUID before running query
          if (
            formValues.tournamentId?.trim() &&
            !validateUUID(formValues.tournamentId.trim())
          ) {
            (this as any).tournamentsAggregate = 0;
            return undefined;
          }

          return {
            where_clause: this.getWhereClause(),
          };
        },
        result({
          data,
        }: {
          data: { tournaments_aggregate: { aggregate: { count: number } } };
        }) {
          (this as any).tournamentsAggregate =
            data.tournaments_aggregate?.aggregate?.count || 0;
        },
      },
    },
  },
  methods: {
    filterValidStatuses(statuses: any[]): string[] {
      if (!Array.isArray(statuses)) {
        return [];
      }
      const validStatuses = Object.values(e_tournament_status_enum);
      return statuses.filter(
        (status) =>
          status !== null &&
          status !== undefined &&
          validStatuses.includes(status),
      );
    },
    getWhereClause() {
      const filterConditions: any = {};
      const formValues = this.form.values;

      if (formValues.tournamentId?.trim()) {
        const tournamentId = formValues.tournamentId.trim();

        if (!validateUUID(tournamentId)) {
          // Return a where clause that will return 0 results for invalid UUID
          return {
            id: {
              _eq: "00000000-0000-0000-0000-000000000000",
            },
          };
        }

        filterConditions.id = {
          _eq: tournamentId,
        };
      }

      if (formValues.tournamentName?.trim()) {
        const tournamentName = formValues.tournamentName.trim();
        filterConditions.name = {
          _ilike: `%${tournamentName}%`,
        };
      }

      const validStatuses = this.filterValidStatuses(formValues.statuses || []);
      if (validStatuses.length > 0) {
        filterConditions.status = {
          _in: validStatuses,
        };
      }

      const whereClause = {
        ...filterConditions,
      };

      if (this.showOnlyMyTournaments) {
        whereClause.is_organizer = {
          _eq: true,
        };
      }

      return whereClause;
    },
    loadFiltersFromStorage() {
      if (process.client) {
        try {
          const saved = localStorage.getItem("manage-tournaments-filters");
          return saved ? JSON.parse(saved) : {};
        } catch (error) {
          console.warn("Failed to load filters from localStorage:", error);
          return {};
        }
      }
      return {};
    },
    saveFiltersToStorage() {
      if (process.client) {
        try {
          const filters = {
            tournamentId: this.form.values.tournamentId,
            tournamentName: this.form.values.tournamentName,
            statuses: this.form.values.statuses,
            showOnlyMyTournaments: this.showOnlyMyTournaments,
            sortField: this.sortField,
            sortDirection: this.sortDirection,
          };
          localStorage.setItem(
            "manage-tournaments-filters",
            JSON.stringify(filters),
          );
        } catch (error) {
          console.warn("Failed to save filters to localStorage:", error);
        }
      }
    },
    onFilterChange() {
      this.page = 1;
      this.saveFiltersToStorage();
    },
    onStatusChange(statuses: any) {
      const validStatuses = this.filterValidStatuses(statuses || []);
      this.form.setValues({
        ...this.form.values,
        statuses: validStatuses,
      });
      this.onFilterChange();
    },
    resetFilters() {
      const validDefaultStatuses = this.filterValidStatuses(
        this.defaultStatuses,
      );
      this.form.setValues({
        tournamentId: "",
        tournamentName: "",
        statuses: validDefaultStatuses,
      });
      this.showOnlyMyTournaments = false;
      this.sortField = "created_at";
      this.sortDirection = "desc";
      this.page = 1;
      this.saveFiltersToStorage();
    },
    onSortChange() {
      this.page = 1;
      this.saveFiltersToStorage();
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.page = 1;
      this.saveFiltersToStorage();
    },
    getSortOrder() {
      const orderBy =
        this.sortDirection === "desc" ? order_by.desc : order_by.asc;
      switch (this.sortField) {
        case "created_at":
          return { created_at: orderBy };
        case "start":
          return { start: orderBy };
        default:
          return { created_at: orderBy };
      }
    },
    clearAllStatuses() {
      this.form.setValues({
        ...this.form.values,
        statuses: [] as string[],
      });
      this.onFilterChange();
    },
  },
  computed: {
    hasActiveFilters(): boolean {
      const formValues = this.form.values;
      return !!(
        formValues.tournamentId?.trim() ||
        formValues.tournamentName?.trim() ||
        (formValues.statuses && formValues.statuses.length > 0)
      );
    },
    tournamentStatusOptions() {
      return Object.values(e_tournament_status_enum).map((status) => ({
        value: status,
        label: status.replace(/([A-Z])/g, " $1").trim(),
      }));
    },
    defaultStatuses() {
      return [
        e_tournament_status_enum.Live,
        e_tournament_status_enum.RegistrationOpen,
        e_tournament_status_enum.RegistrationClosed,
        e_tournament_status_enum.Setup,
      ];
    },
  },
};
</script>
