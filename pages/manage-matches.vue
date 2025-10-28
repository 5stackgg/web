<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import { PlusCircle, ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";
import MatchesTable from "~/components/MatchesTable.vue";
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
</script>

<template>
  <PageHeading>
    <template #title>{{ $t("pages.manage_matches.title") }}</template>
    <template #description>{{
      $t("pages.manage_matches.description")
    }}</template>
    <template #actions>
      <Button size="lg" @click="navigateTo('/matches/create')">
        <PlusCircle class="w-4 h-4" />
        <span class="hidden md:inline ml-2">{{
          $t("pages.matches.create")
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
          {{ $t("pages.manage_matches.filters") }}
        </h3>
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-2">
            <Switch
              :model-value="showOnlyMyMatches"
              @update:model-value="showOnlyMyMatches = !showOnlyMyMatches"
            />
            <Label class="text-sm font-medium">{{
              $t("pages.manage_matches.only_my_matches")
            }}</Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            @click="clearFilters"
            :disabled="!hasActiveFilters"
          >
            {{ $t("pages.manage_matches.clear_filters") }}
          </Button>
        </div>
      </div>

      <form @submit.prevent="onFilterChange" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Match ID Search -->
          <div class="space-y-2">
            <Label for="match-id-search">{{
              $t("pages.manage_matches.search_by_id")
            }}</Label>
            <Input
              id="match-id-search"
              v-model="form.values.matchId"
              :placeholder="$t('pages.manage_matches.enter_match_id')"
              @input="onFilterChange"
            />
          </div>

          <!-- Team Search -->
          <div class="space-y-2">
            <Label for="team-search">{{
              $t("pages.manage_matches.search_by_team")
            }}</Label>
            <Input
              id="team-search"
              v-model="form.values.teamName"
              :placeholder="$t('pages.manage_matches.enter_team_name')"
              @input="onFilterChange"
            />
          </div>

          <!-- Status Filter -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="status-filter">{{
                $t("pages.manage_matches.filter_by_status")
              }}</Label>
              <Button
                variant="ghost"
                size="sm"
                @click="clearAllStatuses"
                class="text-xs h-6 px-2"
                :class="{ 'opacity-50': !form.values.statuses?.length }"
              >
                {{ $t("pages.manage_matches.clear_all") }}
              </Button>
            </div>
            <Select
              :model-value="form.values.statuses"
              @update:model-value="onStatusChange"
              multiple
            >
              <SelectTrigger id="status-filter">
                <SelectValue
                  :placeholder="$t('pages.manage_matches.select_statuses')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="status in matchStatusOptions"
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
        <span>{{ $t("pages.manage_matches.sort_by") }}:</span>
        <Select v-model="sortField" @update:model-value="onSortChange">
          <SelectTrigger class="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">{{
              $t("pages.manage_matches.created_at")
            }}</SelectItem>
            <SelectItem value="started_at">{{
              $t("pages.manage_matches.started_at")
            }}</SelectItem>
            <SelectItem value="scheduled_at">{{
              $t("pages.manage_matches.scheduled_at")
            }}</SelectItem>
            <SelectItem value="ended_at">{{
              $t("pages.manage_matches.ended_at")
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
            ? $t("pages.manage_matches.newest_first")
            : $t("pages.manage_matches.oldest_first")
        }}</span>
      </Button>
    </div>

    <div class="text-sm text-muted-foreground">
      {{ $t("pages.manage_matches.showing") }} {{ matches.length }}
      {{ $t("pages.manage_matches.matches") }}
    </div>
  </div>

  <Card class="p-4">
    <MatchesTable class="p-3" :matches="matches" v-if="matches"></MatchesTable>
  </Card>

  <Pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="matchesAggregate"
    v-if="matchesAggregate"
  ></Pagination>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

interface MatchesData {
  matches: any[];
}

interface ComponentData {
  page: number;
  perPage: number;
  matches: any[];
  showOnlyMyMatches: boolean;
  form: any;
  sortField: string;
  sortDirection: string;
}

export default {
  data(): ComponentData {
    return {
      page: 1,
      perPage: 10,
      matches: [] as any[],
      showOnlyMyMatches: false,
      sortField: "created_at",
      sortDirection: "desc",
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            matchId: z.string().optional(),
            teamName: z.string().optional(),
            statuses: z.array(z.string()).optional(),
          }),
        ),
        initialValues: {
          matchId: "",
          teamName: "",
          statuses: [
            e_match_status_enum.Live,
            e_match_status_enum.Veto,
            e_match_status_enum.WaitingForCheckIn,
            e_match_status_enum.WaitingForServer,
            e_match_status_enum.Scheduled,
            e_match_status_enum.PickingPlayers,
          ],
        },
      }),
    };
  },
  mounted() {
    if (!this.form.values.statuses) {
      this.form.setValues({
        ...this.form.values,
        statuses: this.defaultStatuses,
      });
    }
  },
  apollo: {
    $subscribe: {
      matches: {
        query: typedGql("subscription")({
          matches: [
            {
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: $("order_by", "[matches_order_by!]"),
              where: $("where_clause", "matches_bool_exp!"),
            },
            simpleMatchFields,
          ],
        }),
        variables(this: any): {
          limit: number;
          order_by: any[];
          offset: number;
          where_clause: any;
        } {
          const filterConditions: any = {};
          const formValues = this.form.values;

          if (formValues.matchId?.trim()) {
            filterConditions.id = {
              _eq: formValues.matchId.trim(),
            };
          }

          if (formValues.teamName?.trim()) {
            const teamName = formValues.teamName.trim();
            filterConditions._or = [
              {
                lineup_1: {
                  name: {
                    _ilike: `%${teamName}%`,
                  },
                },
              },
              {
                lineup_2: {
                  name: {
                    _ilike: `%${teamName}%`,
                  },
                },
              },
            ];
          }

          if (formValues.statuses && formValues.statuses.length > 0) {
            filterConditions.status = {
              _in: formValues.statuses,
            };
          }

          const whereClause = {
            ...filterConditions,
          };

          if (this.showOnlyMyMatches) {
            whereClause.organizer_steam_id = {
              _eq: useAuthStore().me?.steam_id,
            };
          }

          return {
            limit: this.perPage,
            order_by: [this.getSortOrder()],
            offset: (this.page - 1) * this.perPage,
            where_clause: whereClause,
          };
        },
        result({ data }: { data: MatchesData }) {
          (this as any).matches = data.matches;
        },
      },
    },
  },
  methods: {
    onFilterChange() {
      this.page = 1;
    },
    onStatusChange(statuses: any) {
      this.form.setValues({
        ...this.form.values,
        statuses: statuses || [],
      });
      this.onFilterChange();
    },
    clearFilters() {
      this.form.setValues({
        matchId: "",
        teamName: "",
        statuses: this.defaultStatuses,
      });
      this.page = 1;
    },
    onSortChange() {
      this.page = 1;
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.page = 1;
    },
    getSortOrder() {
      const orderBy =
        this.sortDirection === "desc" ? order_by.desc : order_by.asc;
      switch (this.sortField) {
        case "created_at":
          return { created_at: orderBy };
        case "started_at":
          return { started_at: orderBy };
        case "scheduled_at":
          return { scheduled_at: orderBy };
        case "ended_at":
          return { ended_at: orderBy };
        default:
          return { created_at: orderBy };
      }
    },
    clearAllStatuses() {
      this.form.setValues({
        ...this.form.values,
        statuses: [],
      });
      this.onFilterChange();
    },
  },
  computed: {
    matchesAggregate() {
      return useMatchLobbyStore().managingMatchesCount;
    },
    hasActiveFilters(): boolean {
      const formValues = this.form.values;
      return !!(
        formValues.matchId?.trim() ||
        formValues.teamName?.trim() ||
        (formValues.statuses && formValues.statuses.length > 0)
      );
    },
    matchStatusOptions() {
      return Object.values(e_match_status_enum).map((status) => ({
        value: status,
        label: status.replace(/([A-Z])/g, " $1").trim(),
      }));
    },
    defaultStatuses() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.Scheduled,
        e_match_status_enum.PickingPlayers,
      ];
    },
  },
};
</script>
