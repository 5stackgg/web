<script setup lang="ts">
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import {
  Activity,
  ArrowUpIcon,
  ArrowDownIcon,
  Check,
  ChevronDown,
  PlusCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-vue-next";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import Pagination from "~/components/Pagination.vue";
import { Button } from "~/components/ui/button";
import {
  tacticalCtaButtonClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { useSidebar } from "~/components/ui/sidebar/utils";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

const { isMobile } = useSidebar();

// Compact filter-bar trigger buttons — each opens a popover.
const filterTriggerBase =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] leading-none transition-colors duration-150 cursor-pointer";
const filterTriggerIdle =
  "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground";
const filterTriggerActive =
  "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
const filterBadgeClasses =
  "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[hsl(var(--tac-amber)/0.25)] px-1 font-sans text-[0.6rem] font-bold leading-none text-[hsl(var(--tac-amber))]";
function optionRowClass(active: boolean) {
  return [
    "flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition-colors",
    active
      ? "text-[hsl(var(--tac-amber))]"
      : "text-foreground/90 hover:bg-muted/50",
  ];
}
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>{{ $t("pages.manage_tournaments.title") }}</template>
      <template v-if="canCreateTournament" #actions>
        <button
          type="button"
          :class="[tacticalCtaButtonClasses, 'max-md:px-2.5 max-md:py-2']"
          :title="$t('pages.tournaments.create')"
          @click="navigateTo('/tournaments/create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline">{{
            $t("pages.tournaments.create")
          }}</span>
        </button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <p class="text-sm text-muted-foreground">
      {{ $t("pages.manage_tournaments.description") }}
    </p>
  </PageTransition>

  <Separator v-if="showSeparators" class="my-4" />

  <!-- Filters Section -->
  <PageTransition :delay="100" class="mb-4">
    <div
      class="relative rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)] px-3 py-2.5"
    >
      <!-- Trigger row — each filter opens a self-contained popover. -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          :class="tacticalSectionTickClasses"
          class="mr-1 hidden shrink-0 sm:inline-block"
        />

        <!-- Status (multi) -->
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                form.values.statuses?.length
                  ? filterTriggerActive
                  : filterTriggerIdle,
              ]"
            >
              <Activity class="h-3.5 w-3.5" />
              {{ $t("common.status") }}
              <span
                v-if="form.values.statuses?.length"
                :class="filterBadgeClasses"
              >
                {{ form.values.statuses.length }}
              </span>
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-60 p-2">
            <div class="max-h-60 space-y-0.5 overflow-y-auto">
              <button
                v-for="status in tournamentStatusOptions"
                :key="status.value"
                type="button"
                @click="toggleStatus(status.value)"
                class="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-foreground/90 transition-colors hover:bg-muted/50"
              >
                <span>{{ status.label }}</span>
                <Check
                  v-if="form.values.statuses?.includes(status.value)"
                  class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
                />
              </button>
            </div>
            <button
              v-if="form.values.statuses?.length"
              type="button"
              @click="clearAllStatuses"
              class="mt-2 flex w-full items-center justify-center gap-1 rounded border border-border px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X class="h-3 w-3" />
              {{ $t("pages.manage_tournaments.clear_all") }}
            </button>
          </PopoverContent>
        </Popover>

        <!-- Search (Name + ID) -->
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                form.values.tournamentName || form.values.tournamentId
                  ? filterTriggerActive
                  : filterTriggerIdle,
              ]"
            >
              <Search class="h-3.5 w-3.5" />
              {{ $t("common.search") }}
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-72 space-y-2 p-3">
            <div class="space-y-1">
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("pages.manage_tournaments.search_by_name") }}
              </span>
              <Input
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
                class="h-9 text-sm"
              />
            </div>
            <div class="space-y-1">
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("pages.manage_tournaments.search_by_id") }}
              </span>
              <Input
                :model-value="form.values.tournamentId"
                @update:model-value="
                  (value) => {
                    form.setFieldValue('tournamentId', value);
                    onFilterChange();
                  }
                "
                :placeholder="
                  $t('pages.manage_tournaments.enter_tournament_id')
                "
                class="h-9 font-mono text-xs"
              />
            </div>
          </PopoverContent>
        </Popover>

        <!-- Options -->
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[
                filterTriggerBase,
                showOnlyMyTournaments ? filterTriggerActive : filterTriggerIdle,
              ]"
            >
              <SlidersHorizontal class="h-3.5 w-3.5" />
              {{ $t("common.options") }}
              <ChevronDown class="h-3 w-3 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-64 p-2">
            <button
              type="button"
              @click="showOnlyMyTournaments = !showOnlyMyTournaments"
              :class="optionRowClass(showOnlyMyTournaments)"
            >
              <span>{{
                $t("pages.manage_tournaments.only_my_tournaments")
              }}</span>
              <Check
                v-if="showOnlyMyTournaments"
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
            </button>
          </PopoverContent>
        </Popover>

        <div class="ml-auto flex items-center gap-3 pl-2">
          <button
            type="button"
            @click="resetFilters"
            class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X class="h-3 w-3" />
            {{ $t("common.reset_filters") }}
          </button>
        </div>
      </div>

      <!-- Active filters — removable chips -->
      <div
        v-if="chipFilterActive"
        class="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5"
      >
        <span v-if="form.values.tournamentName" class="tac-chip">
          <span class="text-xs text-foreground/90 truncate max-w-[180px]">
            "{{ form.values.tournamentName }}"
          </span>
          <button
            type="button"
            @click="
              form.setFieldValue('tournamentName', '');
              onFilterChange();
            "
            class="tac-chip-x"
          >
            <X class="h-3 w-3" />
          </button>
        </span>
        <span v-if="form.values.tournamentId" class="tac-chip">
          <span class="text-xs text-foreground/90 truncate max-w-[180px]">
            ID: {{ form.values.tournamentId }}
          </span>
          <button
            type="button"
            @click="
              form.setFieldValue('tournamentId', '');
              onFilterChange();
            "
            class="tac-chip-x"
          >
            <X class="h-3 w-3" />
          </button>
        </span>
        <span v-if="showOnlyMyTournaments" class="tac-chip">
          <span class="text-xs text-foreground/90">{{
            $t("pages.manage_tournaments.only_my_tournaments")
          }}</span>
          <button
            type="button"
            @click="showOnlyMyTournaments = false"
            class="tac-chip-x"
          >
            <X class="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  </PageTransition>

  <!-- Sort Controls -->
  <PageTransition :delay="200">
    <div
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4"
    >
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

      <div class="text-sm text-muted-foreground md:text-right">
        {{ $t("pages.manage_tournaments.showing") }} {{ tournaments.length }}
        {{ $t("pages.manage_tournaments.tournaments") }}
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="300">
    <div>
      <div v-if="loading" class="absolute top-4 left-4 z-10">
        <div
          class="flex items-center space-x-2 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded"
        >
          <div
            class="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"
          ></div>
          <span>{{ $t("common.loading") }}</span>
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
    </div>
  </PageTransition>

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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import { validate as validateUUID } from "uuid";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

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
      e_tournament_status_enum.Paused,
      e_tournament_status_enum.RegistrationOpen,
      e_tournament_status_enum.RegistrationClosed,
      e_tournament_status_enum.Setup,
    ];

    return {
      defaultStatuses,
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
              ...simpleTournamentFields,
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
    toggleStatus(value: string) {
      const set = new Set(this.form.values.statuses || []);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      this.onStatusChange([...set]);
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
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    canCreateTournament() {
      const me = useAuthStore().me;
      if (!me) return false;
      return useAuthStore().isRoleAbove(
        useApplicationSettingsStore().tournamentCreateRole,
      );
    },
    hasActiveFilters(): boolean {
      const formValues = this.form.values;
      return !!(
        formValues.tournamentId?.trim() ||
        formValues.tournamentName?.trim() ||
        (formValues.statuses && formValues.statuses.length > 0)
      );
    },
    chipFilterActive(): boolean {
      const formValues = this.form.values;
      return !!(
        formValues.tournamentId?.trim() ||
        formValues.tournamentName?.trim() ||
        this.showOnlyMyTournaments
      );
    },
    tournamentStatusOptions() {
      return Object.values(e_tournament_status_enum).map((status) => ({
        value: status,
        label: status.replace(/([A-Z])/g, " $1").trim(),
      }));
    },
  },
};
</script>

<style scoped>
/* Soft amber chip — no border, fill-only. */
.tac-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.45rem 0.2rem 0.55rem;
  background: hsl(var(--tac-amber) / 0.08);
  border-radius: 2px;
  font-feature-settings:
    "tnum" on,
    "cv11" on;
  transition: background 150ms ease;
}
.tac-chip:hover {
  background: hsl(var(--tac-amber) / 0.14);
}
.tac-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--tac-amber) / 0.55);
  margin-left: 0.1rem;
  border-radius: 2px;
  padding: 1px;
  transition:
    color 150ms ease,
    background 150ms ease;
}
.tac-chip-x:hover {
  color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
}
</style>
