<script setup lang="ts">
import { Button } from "~/components/ui/button";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  Check,
  ChevronsUpDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-vue-next";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import { Slider } from "~/components/ui/slider";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { kdrColor } from "~/utilities/kdrColor";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { getAllCountries } from "countries-and-timezones";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import {
  tacticalFilterPillActiveClasses,
  tacticalFilterPillActiveDangerClasses,
  tacticalFilterPillActiveWarningClasses,
  tacticalFilterPillClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.players.title") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="100" class="mt-6">
    <div class="space-y-3">
      <!-- Search + Filters toggle -->
      <div class="flex gap-2 items-stretch">
        <div class="relative flex-1">
          <Search
            class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
          />
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
            class="h-12 pl-12 pr-12 text-base bg-card/60 backdrop-blur border-border"
          />
          <button
            v-if="form.values.name"
            type="button"
            @click="
              form.setFieldValue('name', '');
              onFilterChange();
            "
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <Popover v-model:open="filtersPopoverOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-12 px-4 gap-2 bg-card/60 backdrop-blur"
              :class="{
                'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                  activeFilterChips.length > 0,
              }"
            >
              <SlidersHorizontal class="w-4 h-4" />
              <span class="hidden sm:inline">{{ $t("common.filters") }}</span>
              <span
                v-if="activeFilterChips.length > 0"
                class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[0.65rem] font-semibold bg-[hsl(var(--tac-amber)/0.2)] text-[hsl(var(--tac-amber))] border border-[hsl(var(--tac-amber)/0.45)]"
              >
                {{ activeFilterChips.length }}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-[min(90vw,440px)] p-4">
            <div class="flex items-center justify-between mb-3">
              <h4
                class="font-mono text-xs tracking-[0.24em] uppercase text-muted-foreground"
              >
                {{ $t("common.filters") }}
              </h4>
              <button
                v-if="activeFilterChips.length > 0"
                type="button"
                @click="resetFilters"
                class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                {{ $t("common.reset_filters") }}
              </button>
            </div>
            <form @submit.prevent class="space-y-4">
              <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <!-- Elo range slider -->
                <div class="space-y-3 sm:col-span-2">
                  <div class="flex items-center justify-between">
                    <Label>{{ $t("pages.players.elo_range") }}</Label>
                    <span
                      class="text-xs font-mono text-[hsl(var(--tac-amber))] tabular-nums"
                    >
                      {{ eloRange[0] }} — {{ eloRange[1] }}
                    </span>
                  </div>
                  <Slider
                    :model-value="eloRange"
                    @update:model-value="onEloRangeChange"
                    :min="eloSliderMin"
                    :max="eloSliderMax"
                    :step="100"
                    class="py-2"
                  />
                </div>

                <!-- Country multi-select -->
                <div class="space-y-2">
                  <Label for="countries-filter">{{
                    $t("pages.players.filter_by_country")
                  }}</Label>
                  <Popover v-model:open="countryPopoverOpen">
                    <PopoverTrigger as-child>
                      <Button
                        id="countries-filter"
                        role="combobox"
                        variant="outline"
                        class="w-full justify-between"
                      >
                        <span
                          v-if="
                            form.values.countries &&
                            form.values.countries.length > 0
                          "
                          class="text-sm"
                        >
                          {{ form.values.countries.length }}
                          {{ $t("pages.players.countries_selected") }}
                        </span>
                        <span v-else class="text-muted-foreground">
                          {{ $t("pages.players.select_country") }}
                        </span>
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

                <!-- Privilege/Role multi-select (admin only) -->
                <div v-if="canViewAdditionalDetails" class="space-y-2">
                  <Label for="roles-filter">{{
                    $t("pages.players.filter_by_privilege")
                  }}</Label>
                  <Popover v-model:open="rolePopoverOpen">
                    <PopoverTrigger as-child>
                      <Button
                        id="roles-filter"
                        role="combobox"
                        variant="outline"
                        class="w-full justify-between"
                      >
                        <span
                          v-if="
                            form.values.roles && form.values.roles.length > 0
                          "
                          class="text-sm"
                        >
                          {{ form.values.roles.length }}
                          {{ $t("pages.players.countries_selected") }}
                        </span>
                        <span v-else class="text-muted-foreground">
                          {{ $t("pages.players.select_privileges") }}
                        </span>
                        <ChevronsUpDown
                          class="ml-2 h-4 w-4 shrink-0 opacity-50"
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="w-full p-0">
                      <Command class="w-[240px]">
                        <CommandList>
                          <CommandGroup>
                            <CommandItem
                              v-for="role in availableRoles"
                              :key="role.value"
                              :value="role.display"
                              @select="() => toggleRole(role.value)"
                            >
                              <span>{{ role.display }}</span>
                              <Check
                                :class="[
                                  'ml-auto h-4 w-4 flex-shrink-0',
                                  form.values.roles?.includes(role.value)
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

                <!-- Min sanctions (admin only) -->
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
              </div>

              <!-- Toggle pills -->
              <div class="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  :class="[
                    tacticalFilterPillClasses,
                    onlyPlayedMatches ? tacticalFilterPillActiveClasses : '',
                  ]"
                  @click="onlyPlayedMatches = !onlyPlayedMatches"
                >
                  {{ $t("pages.players.played_matches") }}
                </button>

                <template v-if="canViewAdditionalDetails">
                  <button
                    type="button"
                    :class="[
                      tacticalFilterPillClasses,
                      form.values.isBanned
                        ? tacticalFilterPillActiveDangerClasses
                        : '',
                    ]"
                    @click="
                      () => {
                        form.setFieldValue('isBanned', !form.values.isBanned);
                        onFilterChange();
                      }
                    "
                  >
                    {{ $t("pages.players.is_banned") }}
                  </button>
                  <button
                    type="button"
                    :class="[
                      tacticalFilterPillClasses,
                      form.values.isGagged
                        ? tacticalFilterPillActiveWarningClasses
                        : '',
                    ]"
                    @click="
                      () => {
                        form.setFieldValue('isGagged', !form.values.isGagged);
                        onFilterChange();
                      }
                    "
                  >
                    {{ $t("pages.players.is_gagged") }}
                  </button>
                  <button
                    type="button"
                    :class="[
                      tacticalFilterPillClasses,
                      form.values.isMuted
                        ? tacticalFilterPillActiveWarningClasses
                        : '',
                    ]"
                    @click="
                      () => {
                        form.setFieldValue('isMuted', !form.values.isMuted);
                        onFilterChange();
                      }
                    "
                  >
                    {{ $t("pages.players.is_muted") }}
                  </button>
                </template>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      <!-- Active filter chips -->
      <div
        v-if="activeFilterChips.length > 0"
        class="flex gap-2 flex-wrap items-center"
      >
        <span
          class="text-[0.65rem] font-mono tracking-[0.22em] uppercase text-muted-foreground"
        >
          Active
        </span>
        <button
          v-for="chip in activeFilterChips"
          :key="chip.id"
          type="button"
          @click="chip.clear()"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[hsl(var(--tac-amber)/0.12)] border border-[hsl(var(--tac-amber)/0.35)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] transition-colors"
        >
          <span class="font-medium">{{ chip.label }}:</span>
          <span class="opacity-80">{{ chip.value }}</span>
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="200" class="mt-6">
    <Card variant="gradient" class="p-4 relative">
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
      <Empty v-if="players && players.length === 0">
        <p class="text-muted-foreground">
          {{ $t("pages.players.table.no_players") }}
        </p>
      </Empty>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="cursor-pointer" @click="toggleSort('name')">
              <div class="flex items-center gap-1">
                {{ $t("common.player") }}
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
            <TableHead>{{ $t("common.stats.wins") }}</TableHead>
            <TableHead>{{ $t("common.stats.losses") }}</TableHead>
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
                v-if="player.last_sign_in_at && player.last_sign_in_at !== `~~`"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  </PageTransition>

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
      eloSliderMin: 0,
      eloSliderMax: 20000,
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
      rolePopoverOpen: false,
      filtersPopoverOpen: false,
      countries: getAllCountries(),
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
    availableRoles() {
      return [
        { value: e_player_roles_enum.user, display: this.$t("roles.user") },
        { value: e_player_roles_enum.verified_user, display: this.$t("roles.verified_user") },
        { value: e_player_roles_enum.streamer, display: this.$t("roles.streamer") },
        { value: e_player_roles_enum.match_organizer, display: this.$t("roles.match_organizer") },
        { value: e_player_roles_enum.tournament_organizer, display: this.$t("roles.tournament_organizer") },
        { value: e_player_roles_enum.administrator, display: this.$t("roles.administrator") },
      ];
    },
    canViewAdditionalDetails() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    eloRange() {
      return [
        this.form.values.eloMin ?? this.eloSliderMin,
        this.form.values.eloMax ?? this.eloSliderMax,
      ];
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
    activeFilterChips() {
      const chips: Array<{
        id: string;
        label: string;
        value: string;
        clear: () => void;
      }> = [];
      const f = this.form.values;
      if (f.eloMin !== null && f.eloMin !== undefined) {
        chips.push({
          id: "elo-min",
          label: this.$t("pages.players.filter_chips.elo_min"),
          value: String(f.eloMin),
          clear: () => {
            this.form.setFieldValue("eloMin", null);
            this.onFilterChange();
          },
        });
      }
      if (f.eloMax !== null && f.eloMax !== undefined) {
        chips.push({
          id: "elo-max",
          label: this.$t("pages.players.filter_chips.elo_max"),
          value: String(f.eloMax),
          clear: () => {
            this.form.setFieldValue("eloMax", null);
            this.onFilterChange();
          },
        });
      }
      if (f.countries?.length) {
        chips.push({
          id: "countries",
          label: this.$t("pages.players.filter_chips.countries"),
          value: String(f.countries.length),
          clear: () => this.clearAllCountries(),
        });
      }
      if (f.roles?.length) {
        chips.push({
          id: "roles",
          label: this.$t("pages.players.filter_chips.privilege"),
          value: String(f.roles.length),
          clear: () => this.clearAllRoles(),
        });
      }
      if (f.sanctionsMin !== null && f.sanctionsMin !== undefined) {
        chips.push({
          id: "sanctions-min",
          label: this.$t("pages.players.filter_chips.sanctions_min"),
          value: String(f.sanctionsMin),
          clear: () => {
            this.form.setFieldValue("sanctionsMin", null);
            this.onFilterChange();
          },
        });
      }
      if (this.onlyPlayedMatches) {
        chips.push({
          id: "played",
          label: this.$t("pages.players.filter_chips.played"),
          value: "yes",
          clear: () => {
            this.onlyPlayedMatches = false;
          },
        });
      }
      if (f.isBanned) {
        chips.push({
          id: "banned",
          label: this.$t("pages.players.filter_chips.banned"),
          value: "yes",
          clear: () => {
            this.form.setFieldValue("isBanned", false);
            this.onFilterChange();
          },
        });
      }
      if (f.isGagged) {
        chips.push({
          id: "gagged",
          label: this.$t("pages.players.filter_chips.gagged"),
          value: "yes",
          clear: () => {
            this.form.setFieldValue("isGagged", false);
            this.onFilterChange();
          },
        });
      }
      if (f.isMuted) {
        chips.push({
          id: "muted",
          label: this.$t("pages.players.filter_chips.muted"),
          value: "yes",
          clear: () => {
            this.form.setFieldValue("isMuted", false);
            this.onFilterChange();
          },
        });
      }
      return chips;
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
    onEloRangeChange(value: number[] | undefined) {
      if (!value) return;
      const [min, max] = value;
      const nextMin = min === this.eloSliderMin ? null : min;
      const nextMax = max === this.eloSliderMax ? null : max;
      this.form.setValues({
        ...this.form.values,
        eloMin: nextMin,
        eloMax: nextMax,
      });
      this.onFilterChange();
    },
    toggleRole(role: e_player_roles_enum) {
      const current = this.form.values.roles || [];
      const next = current.includes(role)
        ? current.filter((r: e_player_roles_enum) => r !== role)
        : [...current, role];
      this.form.setValues({
        ...this.form.values,
        roles: next,
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
      const kills = player.stats?.kills ?? 0;
      const deaths = player.stats?.deaths ?? 0;
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
