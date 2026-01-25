<script setup lang="ts">
import { Button } from "~/components/ui/button";
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  Check,
  ChevronsUpDown,
} from "lucide-vue-next";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import Pagination from "~/components/Pagination.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { kdrColor } from "~/utilities/kdrColor";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { getAllCountries } from "countries-and-timezones";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-6">
    <PageTransition>
      <PageHeading>
        <template #title>{{ $t("pages.players.title") }}</template>
      </PageHeading>
    </PageTransition>

    <!-- Filters -->
    <PageTransition :delay="100">
      <AnimatedCard variant="gradient" class="p-4 mb-4">
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
              <div v-if="canViewAdditionalDetails" class="space-y-2">
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

              <!-- Country multi-select -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label for="countries-filter">{{
                    $t("pages.players.filter_by_country")
                  }}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="clearAllCountries"
                    class="text-xs h-6 px-2"
                    :class="{ 'opacity-50': !form.values.countries?.length }"
                  >
                    {{ $t("pages.manage_matches.clear_all") }}
                  </Button>
                </div>
                <Popover v-model:open="countryPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      id="countries-filter"
                      role="combobox"
                      variant="outline"
                      class="w-full justify-between"
                    >
                      <div class="flex items-center gap-2 flex-wrap">
                        <template
                          v-if="
                            form.values.countries &&
                            form.values.countries.length > 0
                          "
                        >
                          <span class="text-sm">
                            {{ form.values.countries.length }}
                            {{ $t("pages.players.countries_selected") }}
                          </span>
                        </template>
                        <template v-else>
                          {{ $t("pages.players.select_country") }}
                        </template>
                      </div>
                      <ChevronsUpDown
                        class="ml-2 h-4 w-4 shrink-0 opacity-50"
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-full p-0">
                    <Command class="w-[300px]">
                      <CommandInput
                        :placeholder="$t('pages.players.search_country')"
                      />
                      <CommandEmpty>{{
                        $t("pages.players.no_country_found")
                      }}</CommandEmpty>
                      <CommandList>
                        <CommandGroup>
                          <CommandItem
                            v-for="country in sortedCountries"
                            :key="country.id"
                            :value="country.name"
                            @select="
                              () => {
                                toggleCountry(country.id);
                              }
                            "
                          >
                            <div class="flex items-center gap-2 w-full">
                              <TimezoneFlag :country="country.id" />
                              <span class="truncate">{{ country.name }}</span>
                            </div>
                            <Check
                              :class="[
                                'ml-auto h-4 w-4 flex-shrink-0',
                                form.values.countries?.includes(country.id)
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              ]"
                            />
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

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

              <!-- Sanction Filters (only visible to authorized users) -->
              <div v-if="canViewAdditionalDetails" class="space-y-2">
                <Label for="sanctions-min">{{
                  $t("pages.players.min_sanctions")
                }}</Label>
                <Input
                  id="sanctions-min"
                  type="number"
                  :model-value="form.values.sanctionsMin?.toString() || ''"
                  @update:model-value="
                    (value) => {
                      form.setFieldValue(
                        'sanctionsMin',
                        value ? parseInt(value as string) || null : null,
                      );
                      onFilterChange();
                    }
                  "
                  :placeholder="$t('pages.players.min_sanctions')"
                  min="0"
                />
              </div>

              <div v-if="canViewAdditionalDetails" class="space-y-2">
                <Label>{{ $t("pages.players.is_banned") }}</Label>
                <div class="flex items-center gap-2">
                  <Switch
                    :model-value="form.values.isBanned || false"
                    @update:model-value="
                      (value) => {
                        form.setFieldValue('isBanned', value);
                        onFilterChange();
                      }
                    "
                  />
                  <span class="text-sm text-muted-foreground">{{
                    form.values.isBanned
                      ? $t("pages.players.banned_only")
                      : $t("pages.players.all_players")
                  }}</span>
                </div>
              </div>

              <div v-if="canViewAdditionalDetails" class="space-y-2">
                <Label>{{ $t("pages.players.is_gagged") }}</Label>
                <div class="flex items-center gap-2">
                  <Switch
                    :model-value="form.values.isGagged || false"
                    @update:model-value="
                      (value) => {
                        form.setFieldValue('isGagged', value);
                        onFilterChange();
                      }
                    "
                  />
                  <span class="text-sm text-muted-foreground">{{
                    form.values.isGagged
                      ? $t("pages.players.gagged_only")
                      : $t("pages.players.all_players")
                  }}</span>
                </div>
              </div>

              <div v-if="canViewAdditionalDetails" class="space-y-2">
                <Label>{{ $t("pages.players.is_muted") }}</Label>
                <div class="flex items-center gap-2">
                  <Switch
                    :model-value="form.values.isMuted || false"
                    @update:model-value="
                      (value) => {
                        form.setFieldValue('isMuted', value);
                        onFilterChange();
                      }
                    "
                  />
                  <span class="text-sm text-muted-foreground">{{
                    form.values.isMuted
                      ? $t("pages.players.muted_only")
                      : $t("pages.players.all_players")
                  }}</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </AnimatedCard>
    </PageTransition>

    <PageTransition :delay="200">
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
              <TableHead>{{ $t("pages.players.table.wins") }}</TableHead>
              <TableHead>{{ $t("pages.players.table.losses") }}</TableHead>
              <TableHead>{{ $t("pages.players.table.kdr") }}</TableHead>
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
              <TableHead v-if="canViewAdditionalDetails">{{
                $t("pages.players.table.privilege")
              }}</TableHead>
              <TableHead v-if="canViewAdditionalDetails">
                {{ $t("pages.players.table.last_sign_in_at") }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="players?.length === 0">
              <TableRow>
                <TableCell
                  :colspan="canViewAdditionalDetails ? 7 : 5"
                  class="text-center"
                  >{{ $t("pages.players.table.no_players") }}</TableCell
                >
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
                    <PlayerDisplay
                      :player="player"
                      :show-elo="false"
                    ></PlayerDisplay>
                  </TableCell>
                  <TableCell>{{ player.wins ?? 0 }}</TableCell>
                  <TableCell>{{ player.losses ?? 0 }}</TableCell>
                  <TableCell :class="kdrColor(calculateKDR(player))">{{
                    calculateKDR(player)
                  }}</TableCell>
                  <TableCell>
                    <PlayerElo
                      :elo="{
                        competitive: player.elo_competitive,
                        wingman: player.elo_wingman,
                        duel: player.elo_duel,
                      }"
                    ></PlayerElo>
                  </TableCell>
                </NuxtLink>
                <TableCell v-if="canViewAdditionalDetails">
                  <PlayerRoleForm
                    :player="player"
                    @updated="updatePlayerRole(player.steam_id, $event)"
                  />
                </TableCell>
                <TableCell v-if="canViewAdditionalDetails">
                  <TimeAgo
                    :date="player.last_sign_in_at"
                    v-if="
                      player.last_sign_in_at && player.last_sign_in_at !== `~~`
                    "
                  />
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </AnimatedCard>
    </PageTransition>
  </div>

  <Pagination
    :page="page"
    :per-page="perPage"
    :show-per-page-selector="true"
    @page="
      (_page: number) => {
        page = _page;
      }
    "
    @update:perPage="
      (value: number) => {
        perPage = value;
        page = 1;
        saveFiltersToStorage();
        searchPlayers();
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
      perPage: this.loadFiltersFromStorage().perPage || 10,
      playersAggregate: 0,
      sortField: this.loadFiltersFromStorage().sortField || "name",
      sortDirection: this.loadFiltersFromStorage().sortDirection || "asc",
      onlyPlayedMatches:
        this.loadFiltersFromStorage().onlyPlayedMatches || false,
      countryPopoverOpen: false,
      countries: getAllCountries(),
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
            countries: z.array(z.string()).optional(),
            sanctionsMin: z.number().nullable().optional(),
            isBanned: z.boolean().optional(),
            isGagged: z.boolean().optional(),
            isMuted: z.boolean().optional(),
          }),
        ),
        initialValues: {
          name: this.loadFiltersFromStorage().name || "",
          roles: this.loadFiltersFromStorage().roles || [],
          eloMin: this.loadFiltersFromStorage().eloMin || null,
          eloMax: this.loadFiltersFromStorage().eloMax || null,
          countries: this.loadFiltersFromStorage().countries || [],
          sanctionsMin: this.loadFiltersFromStorage().sanctionsMin || null,
          isBanned: this.loadFiltersFromStorage().isBanned || false,
          isGagged: this.loadFiltersFromStorage().isGagged || false,
          isMuted: this.loadFiltersFromStorage().isMuted || false,
        },
      }),
    };
  },
  computed: {
    canViewAdditionalDetails() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    sortedCountries() {
      const allCountries = Object.values(this.countries);
      const userCountry = useAuthStore().me?.country;

      if (!userCountry) {
        return allCountries;
      }

      // Find user's country and put it first
      const userCountryObj = allCountries.find(
        (country) => country.id === userCountry,
      );

      if (!userCountryObj) {
        return allCountries;
      }

      // Return user's country first, then all others
      return [
        userCountryObj,
        ...allCountries.filter((country) => country.id !== userCountry),
      ];
    },
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
        this.onFilterChange();
      },
    },
    "form.values.roles": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.eloMin": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.eloMax": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.countries": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.sanctionsMin": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.isBanned": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.isGagged": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    "form.values.isMuted": {
      handler() {
        this.page = 1;
        this.onFilterChange();
      },
    },
    onlyPlayedMatches() {
      this.page = 1;
      this.onFilterChange();
    },
    sortField() {
      this.page = 1;
      this.onFilterChange();
    },
    sortDirection() {
      this.page = 1;
      this.onFilterChange();
    },
  },
  methods: {
    updatePlayerRole(steam_id: string, role: e_player_roles_enum) {
      const player = this.players.find((player) => {
        return player.steam_id === steam_id;
      });

      if (!player) {
        return;
      }

      player.role = role;
    },
    resetFilters() {
      this.form.setValues({
        name: "",
        roles: [],
        eloMin: null,
        eloMax: null,
        countries: [],
        sanctionsMin: null,
        isBanned: false,
        isGagged: false,
        isMuted: false,
      });
      this.onlyPlayedMatches = false;
      this.sortField = "name";
      this.sortDirection = "asc";
      this.page = 1;
      this.saveFiltersToStorage();
      this.searchPlayers();
    },
    toggleCountry(countryId: string) {
      const currentCountries = this.form.values.countries || [];
      const index = currentCountries.indexOf(countryId);

      if (index === -1) {
        // Add country
        this.form.setValues({
          ...this.form.values,
          countries: [...currentCountries, countryId],
        });
      } else {
        // Remove country
        this.form.setValues({
          ...this.form.values,
          countries: currentCountries.filter((id) => id !== countryId),
        });
      }
      this.onFilterChange();
    },
    clearAllCountries() {
      this.form.setValues({
        ...this.form.values,
        countries: [],
      });
      this.onFilterChange();
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
            countries: this.form.values.countries,
            sanctionsMin: this.form.values.sanctionsMin,
            isBanned: this.form.values.isBanned,
            isGagged: this.form.values.isGagged,
            isMuted: this.form.values.isMuted,
            onlyPlayedMatches: this.onlyPlayedMatches,
            sortField: this.sortField,
            sortDirection: this.sortDirection,
            perPage: this.perPage,
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
    calculateKDR(player: any) {
      const kills = player.kills_aggregate?.aggregate?.count ?? 0;
      const deaths = player.deaths_aggregate?.aggregate?.count ?? 0;
      if (deaths === 0) {
        return kills > 0 ? kills.toFixed(2) : "0.00";
      }
      return (kills / deaths).toFixed(2);
    },
    async searchPlayers() {
      this.loading = true;
      this.saveFiltersToStorage();

      try {
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
            elo_min:
              this.form.values.eloMin !== null &&
              this.form.values.eloMin !== undefined
                ? this.form.values.eloMin
                : undefined,
            elo_max:
              this.form.values.eloMax !== null &&
              this.form.values.eloMax !== undefined
                ? this.form.values.eloMax
                : undefined,
            countries:
              this.form.values.countries &&
              this.form.values.countries.length > 0
                ? this.form.values.countries
                : undefined,
            sanctions_min:
              this.form.values.sanctionsMin !== null &&
              this.form.values.sanctionsMin !== undefined
                ? this.form.values.sanctionsMin
                : undefined,
            is_banned:
              this.form.values.isBanned !== undefined &&
              this.form.values.isBanned !== false
                ? this.form.values.isBanned
                : undefined,
            is_gagged:
              this.form.values.isGagged !== undefined &&
              this.form.values.isGagged !== false
                ? this.form.values.isGagged
                : undefined,
            is_muted:
              this.form.values.isMuted !== undefined &&
              this.form.values.isMuted !== false
                ? this.form.values.isMuted
                : undefined,
            only_played_matches: this.onlyPlayedMatches,
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
        if (!this.form.values.countries) {
          this.form.setValues({
            ...this.form.values,
            countries: saved.countries || [],
          });
        }
      } catch (e) {
        // ignore storage errors
      }
    }
  },
};
</script>
