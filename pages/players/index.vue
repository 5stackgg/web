<script setup lang="ts">
import { Button } from "~/components/ui/button";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-vue-next";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import Pagination from "~/components/Pagination.vue";
import { e_player_roles_enum } from "~/generated/zeus";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{ $t("pages.players.title") }}</template>
    </PageHeading>

    <!-- Filters -->
    <Card class="p-4 mb-4">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">
            {{ $t("pages.manage_matches.filters") }}
          </h3>
          <Button variant="outline" size="sm" @click="resetFilters">
            {{ $t("pages.manage_matches.reset_filters") }}
          </Button>
        </div>

        <form @submit.prevent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Name search -->
            <div class="space-y-2">
              <Label for="player-name-search">{{
                $t("pages.manage_matches.search_by_name")
              }}</Label>
              <Input
                id="player-name-search"
                :model-value="form.values.name"
                @update:model-value="
                  (value) => {
                    form.setFieldValue('name', value as string);
                    onFilterChange();
                  }
                "
                :placeholder="$t('pages.manage_matches.enter_name')"
              />
            </div>

            <!-- Privilege/Role multi-select -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label for="roles-filter">{{
                  $t("pages.players.filter_by_privilege")
                }}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="clearAllRoles"
                  class="text-xs h-6 px-2"
                  :class="{ 'opacity-50': !form.values.roles?.length }"
                >
                  {{ $t("pages.manage_matches.clear_all") }}
                </Button>
              </div>
              <Select
                :model-value="form.values.roles || []"
                @update:model-value="onRolesChange"
                multiple
              >
                <SelectTrigger id="roles-filter">
                  <SelectValue
                    :placeholder="$t('pages.players.select_privileges')"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="role in availableRoles"
                    :key="role.value"
                    :value="role.value"
                  >
                    {{ role.display }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Elo min -->
            <div class="space-y-2">
              <Label for="elo-min">{{ $t("pages.players.elo_min") }}</Label>
              <Input
                id="elo-min"
                type="number"
                :model-value="form.values.eloMin?.toString() || ''"
                @update:model-value="
                  (value) => {
                    form.setFieldValue(
                      'eloMin',
                      value ? parseInt(value as string) || null : null,
                    );
                    onFilterChange();
                  }
                "
                :placeholder="$t('pages.players.min_elo')"
              />
            </div>

            <!-- Elo max -->
            <div class="space-y-2">
              <Label for="elo-max">{{ $t("pages.players.elo_max") }}</Label>
              <Input
                id="elo-max"
                type="number"
                :model-value="form.values.eloMax?.toString() || ''"
                @update:model-value="
                  (value) => {
                    form.setFieldValue(
                      'eloMax',
                      value ? parseInt(value as string) || null : null,
                    );
                    onFilterChange();
                  }
                "
                :placeholder="$t('pages.players.max_elo')"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Has played matches toggle -->
            <div class="space-y-2">
              <Label>{{ $t("pages.players.only_played_matches") }}</Label>
              <div class="flex items-center gap-2">
                <Switch
                  :model-value="onlyPlayedMatches"
                  @update:model-value="onlyPlayedMatches = !onlyPlayedMatches"
                />
                <span class="text-sm text-muted-foreground">{{
                  onlyPlayedMatches
                    ? $t("pages.players.played_matches")
                    : $t("pages.players.all_players")
                }}</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Card>

    <Card class="p-4 relative">
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
            <TableHead class="cursor-pointer" @click="toggleSort('name')">
              <div class="flex items-center gap-1">
                {{ $t("pages.players.table.player") }}
                <ArrowUpIcon
                  v-if="sortField === 'name' && sortDirection === 'desc'"
                  class="w-4 h-4"
                />
                <ArrowDownIcon
                  v-else-if="sortField === 'name' && sortDirection === 'asc'"
                  class="w-4 h-4"
                />
              </div>
            </TableHead>
            <TableHead class="cursor-pointer" @click="toggleSort('elo')">
              <div class="flex items-center gap-1">
                {{ $t("pages.players.table.elo") }}
                <ArrowUpIcon
                  v-if="sortField === 'elo' && sortDirection === 'desc'"
                  class="w-4 h-4"
                />
                <ArrowDownIcon
                  v-else-if="sortField === 'elo' && sortDirection === 'asc'"
                  class="w-4 h-4"
                />
              </div>
            </TableHead>
            <TableHead>{{ $t("pages.players.table.privilege") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="players?.length === 0">
            <TableRow>
              <TableCell colspan="3" class="text-center">{{
                $t("pages.players.table.no_players")
              }}</TableCell>
            </TableRow>
          </template>
          <template v-else>
            <TableRow
              v-for="player of players"
              :key="player.steam_id"
              class="cursor-pointer"
            >
              <NuxtLink
                :to="{
                  name: 'players-id',
                  params: { id: String(player.steam_id) },
                }"
                class="contents"
              >
                <TableCell class="font-medium">
                  <PlayerDisplay :player="player"></PlayerDisplay>
                </TableCell>
                <TableCell>
                  <PlayerElo :elo="player.elo"></PlayerElo>
                </TableCell>
                <TableCell>
                  {{ getRoleDisplay(player.role) }}
                </TableCell>
              </NuxtLink>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </Card>
  </div>

  <Pagination
    :page="page"
    :per-page="perPage"
    @page="
      (_page) => {
        page = _page;
      }
    "
    :total="playersAggregate || 0"
    v-if="playersAggregate"
  ></Pagination>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

export default {
  data() {
    return {
      players: [] as any[],
      loading: false,
      page: 1,
      perPage: 10,
      playersAggregate: 0,
      sortField: this.loadFiltersFromStorage().sortField || "name",
      sortDirection: this.loadFiltersFromStorage().sortDirection || "asc",
      onlyPlayedMatches:
        this.loadFiltersFromStorage().onlyPlayedMatches || false,
      availableRoles: [
        { value: e_player_roles_enum.user, display: "User" },
        {
          value: e_player_roles_enum.verified_user,
          display: "Verified User",
        },
        { value: e_player_roles_enum.streamer, display: "Streamer" },
        {
          value: e_player_roles_enum.match_organizer,
          display: "Match Organizer",
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: "Tournament Organizer",
        },
        { value: e_player_roles_enum.administrator, display: "Administrator" },
      ],
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            name: z.string().optional(),
            roles: z.array(z.nativeEnum(e_player_roles_enum)).optional(),
            eloMin: z.number().nullable().optional(),
            eloMax: z.number().nullable().optional(),
          }),
        ),
        initialValues: {
          name: this.loadFiltersFromStorage().name || "",
          roles: this.loadFiltersFromStorage().roles || [],
          eloMin: this.loadFiltersFromStorage().eloMin || null,
          eloMax: this.loadFiltersFromStorage().eloMax || null,
        },
      }),
    };
  },
  watch: {
    page: {
      immediate: true,
      handler() {
        this.searchPlayers();
      },
    },
    "form.values.name": {
      handler() {
        this.page = 1;
        this.searchPlayers();
      },
    },
    "form.values.roles": {
      handler() {
        this.page = 1;
        this.searchPlayers();
      },
    },
    "form.values.eloMin": {
      handler() {
        this.page = 1;
        this.searchPlayers();
      },
    },
    "form.values.eloMax": {
      handler() {
        this.page = 1;
        this.searchPlayers();
      },
    },
    onlyPlayedMatches() {
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
    sortField() {
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
    sortDirection() {
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
  },
  methods: {
    resetFilters() {
      this.form.setValues({
        name: "",
        roles: [],
        eloMin: null,
        eloMax: null,
      });
      this.onlyPlayedMatches = false;
      this.sortField = "name";
      this.sortDirection = "asc";
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
    loadFiltersFromStorage() {
      if (process.client) {
        try {
          const saved = localStorage.getItem("players-filters");
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
            roles: this.form.values.roles,
            eloMin: this.form.values.eloMin,
            eloMax: this.form.values.eloMax,
            onlyPlayedMatches: this.onlyPlayedMatches,
            sortField: this.sortField,
            sortDirection: this.sortDirection,
          };
          localStorage.setItem("players-filters", JSON.stringify(filters));
        } catch (error) {
          // ignore storage errors
        }
      }
    },
    onFilterChange() {
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
    toggleSort(field: "name" | "elo") {
      if (this.sortField === field) {
        // If clicking the same column, toggle direction
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      } else {
        // If clicking a different column, set it as active with default direction
        this.sortField = field;
        this.sortDirection = "asc";
      }
      this.saveFiltersToStorage();
    },
    onRolesChange(roles: any) {
      this.form.setValues({
        ...this.form.values,
        roles: roles || [],
      });
      this.onFilterChange();
    },
    clearAllRoles() {
      this.form.setValues({
        ...this.form.values,
        roles: [],
      });
      this.onFilterChange();
    },
    getRoleDisplay(role: string) {
      const roleObj = this.availableRoles.find((r) => r.value === role);
      return roleObj ? roleObj.display : role;
    },
    async searchPlayers() {
      this.loading = true;
      this.saveFiltersToStorage();

      try {
        // If onlyPlayedMatches is true, ensure elo_min is at least 1
        let eloMin =
          this.form.values.eloMin !== null &&
          this.form.values.eloMin !== undefined
            ? this.form.values.eloMin
            : undefined;
        if (this.onlyPlayedMatches) {
          eloMin = eloMin !== undefined ? Math.max(1, eloMin) : 1;
        }

        const response = await $fetch("/api/players-search", {
          method: "post",
          body: {
            page: this.page,
            query: this.form.values.name || "",
            per_page: this.perPage,
            roles:
              this.form.values.roles && this.form.values.roles.length > 0
                ? this.form.values.roles
                : undefined,
            elo_min: eloMin,
            elo_max:
              this.form.values.eloMax !== null &&
              this.form.values.eloMax !== undefined
                ? this.form.values.eloMax
                : undefined,
            sort_by: this.getSortBy(),
          },
        });

        const { found, hits } = response;

        this.playersAggregate = found || 0;
        this.players = (hits || []).map(({ document }) => {
          return document;
        });
      } catch (error) {
        console.error("Error searching players:", error);
        this.players = [];
        this.playersAggregate = 0;
      } finally {
        this.loading = false;
      }
    },
    getSortBy() {
      return `${this.sortField}:${this.sortDirection}`;
    },
  },
  created() {
    if (process.client) {
      try {
        const saved = this.loadFiltersFromStorage();
        if (!this.form.values.roles) {
          this.form.setValues({
            ...this.form.values,
            roles: saved.roles || [],
          });
        }
      } catch (e) {
        // ignore storage errors
      }
    }
  },
};
</script>
