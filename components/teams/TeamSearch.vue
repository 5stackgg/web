<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { useMediaQuery } from "@vueuse/core";
import debounce from "~/utilities/debounce";
import { e_team_roles_enum } from "~/generated/zeus";

const isMobile = useMediaQuery("(max-width: 768px)");
const { height: viewportHeight } = useVisualViewport();
</script>

<template>
  <!-- Mobile: Drawer -->
  <Drawer v-if="isMobile" v-model:open="open">
    <div
      @click="
        open = true;
        searchTeams();
      "
    >
      <slot>
        <div
          class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Avatar v-if="selectedTeam" class="h-5 w-5 rounded shrink-0">
              <AvatarImage
                v-if="teamAvatarSrc(selectedTeam)"
                :src="teamAvatarSrc(selectedTeam)!"
                :alt="selectedTeam.name"
              />
              <AvatarFallback class="rounded text-[10px]">
                {{ (selectedTeam.short_name || selectedTeam.name).slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <span class="truncate">
              {{ selectedTeam?.name || label }}
            </span>
          </div>
          <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </div>
      </slot>
    </div>
    <DrawerContent>
      <DrawerTitle class="sr-only">{{ label }}</DrawerTitle>
      <div
        class="flex flex-col"
        :style="{ height: `${viewportHeight * 0.9}px` }"
      >
        <div class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col">
          <div class="flex-1" />
          <div
            v-if="!teams?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("team.search.no_teams_found") }}
          </div>

          <div v-else class="divide-y">
            <div
              v-for="(team, index) in teams"
              :key="team.id"
              :ref="index === selectedIndex ? setActiveRow : undefined"
              class="px-3 py-2"
              :class="
                isSelected(team)
                  ? 'opacity-60 cursor-not-allowed bg-accent/40'
                  : canSelectTeam(team)
                    ? index === selectedIndex
                      ? 'bg-accent cursor-pointer'
                      : 'hover:bg-accent cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'
              "
              @click="select(team)"
              @mouseenter="selectedIndex = index"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Avatar class="h-6 w-6 rounded shrink-0">
                  <AvatarImage
                    v-if="teamAvatarSrc(team)"
                    :src="teamAvatarSrc(team)!"
                    :alt="team.name"
                  />
                  <AvatarFallback class="rounded text-[10px]">
                    {{ (team.short_name || team.name).slice(0, 2) }}
                  </AvatarFallback>
                </Avatar>
                <span class="text-xs text-muted-foreground">
                  [{{ team.short_name }}]
                </span>
                <span class="truncate">{{ team.name }}</span>
                <span
                  v-if="isSelected(team)"
                  class="text-[10px] uppercase tracking-wide text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("team.search.selected") }}
                </span>
                <span
                  v-if="showStats && team.player_count != null"
                  class="ml-auto flex shrink-0 items-center gap-2 text-[10px] tabular-nums text-muted-foreground"
                >
                  <span>{{ team.player_count }}p</span>
                  <span v-if="team.avg_elo != null">
                    {{ team.avg_elo }}
                    <span class="text-[hsl(var(--tac-amber))]">5S</span>
                  </span>
                  <span v-if="team.avg_premier != null">
                    {{ team.avg_premier }}
                    <span class="text-[hsl(200_90%_62%)]">CS2</span>
                  </span>
                </span>
                <span
                  v-else-if="tournamentJoinSelector"
                  class="ml-auto text-[10px] uppercase tracking-wide"
                  :class="
                    canSelectTeam(team) ? 'text-emerald-600' : 'text-amber-600'
                  "
                >
                  {{ teamEligibilityLabel(team) }}
                </span>
              </div>
              <p
                v-if="teamDisabledReason(team)"
                class="mt-1 text-[11px] text-muted-foreground"
              >
                {{ teamDisabledReason(team) }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="teams?.length"
          class="px-4 py-2 text-xs text-muted-foreground border-t"
        >
          {{ teams.length }} {{ $t("team.search.found_teams") }}
        </div>

        <div class="flex items-center justify-between p-4 border-t">
          <input
            ref="mobileSearchInput"
            v-model="query"
            :placeholder="$t('team.search.placeholder')"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            class="flex-1 bg-transparent outline-none text-base"
            @input="
              (e: Event) =>
                debouncedSearch((e.target as HTMLInputElement).value)
            "
            @keydown="onKeydown"
          />
          <div
            class="flex items-center gap-2 ml-4"
            v-if="!myTeams && !teamOptions"
          >
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="myTeamsOnly"
              @click="toggleMyTeamsOnly"
            />
            {{ $t("team.search.my_teams_only") }}
          </div>
        </div>
      </div>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: Popover -->
  <Popover v-else v-model:open="open">
    <PopoverTrigger as-child>
      <div class="relative w-full">
        <slot>
          <button
            type="button"
            :aria-expanded="open"
            class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @click="searchTeams()"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Avatar v-if="selectedTeam" class="h-5 w-5 rounded shrink-0">
                <AvatarImage
                  v-if="teamAvatarSrc(selectedTeam)"
                  :src="teamAvatarSrc(selectedTeam)!"
                  :alt="selectedTeam.name"
                />
                <AvatarFallback class="rounded text-[10px]">
                  {{
                    (selectedTeam.short_name || selectedTeam.name).slice(0, 2)
                  }}
                </AvatarFallback>
              </Avatar>
              <span class="truncate">
                {{ selectedTeam?.name || label }}
              </span>
            </div>
            <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </slot>
      </div>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[400px]">
      <div class="flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b">
          <input
            v-model="query"
            :placeholder="$t('team.search.placeholder')"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            class="flex-1 bg-transparent outline-none"
            @input="
              (e: Event) =>
                debouncedSearch((e.target as HTMLInputElement).value)
            "
            @keydown="onKeydown"
          />
          <div
            class="flex items-center gap-2 ml-4"
            v-if="!myTeams && !teamOptions"
          >
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="myTeamsOnly"
              @click="toggleMyTeamsOnly"
            />
            {{ $t("team.search.my_teams_only") }}
          </div>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-if="!teams?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("team.search.no_teams_found") }}
          </div>

          <div v-else>
            <div class="px-3 py-2 text-sm text-muted-foreground">
              {{ teams.length }} {{ $t("team.search.found_teams") }}
            </div>

            <div class="divide-y">
              <div
                v-for="(team, index) in teams"
                :key="team.id"
                :ref="index === selectedIndex ? setActiveRow : undefined"
                class="px-3 py-2"
                :class="
                  isSelected(team)
                    ? 'opacity-60 cursor-not-allowed bg-accent/40'
                    : canSelectTeam(team)
                      ? index === selectedIndex
                        ? 'bg-accent cursor-pointer'
                        : 'hover:bg-accent cursor-pointer'
                      : 'opacity-60 cursor-not-allowed'
                "
                @click="select(team)"
                @mouseenter="selectedIndex = index"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Avatar class="h-6 w-6 rounded shrink-0">
                    <AvatarImage
                      v-if="teamAvatarSrc(team)"
                      :src="teamAvatarSrc(team)!"
                      :alt="team.name"
                    />
                    <AvatarFallback class="rounded text-[10px]">
                      {{ (team.short_name || team.name).slice(0, 2) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs text-muted-foreground">
                    [{{ team.short_name }}]
                  </span>
                  <span class="truncate">{{ team.name }}</span>
                  <span
                    v-if="isSelected(team)"
                    class="text-[10px] uppercase tracking-wide text-[hsl(var(--tac-amber))]"
                  >
                    {{ $t("team.search.selected") }}
                  </span>
                  <span
                    v-if="showStats && team.player_count != null"
                    class="ml-auto flex shrink-0 items-center gap-2 text-[10px] tabular-nums text-muted-foreground"
                  >
                    <span>{{ team.player_count }}p</span>
                    <span v-if="team.avg_elo != null">
                      {{ team.avg_elo }}
                      <span class="text-[hsl(var(--tac-amber))]">5S</span>
                    </span>
                    <span v-if="team.avg_premier != null">
                      {{ team.avg_premier }}
                      <span class="text-[hsl(200_90%_62%)]">CS2</span>
                    </span>
                  </span>
                  <span
                    v-else-if="tournamentJoinSelector"
                    class="ml-auto text-[10px] uppercase tracking-wide"
                    :class="
                      canSelectTeam(team)
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    "
                  >
                    {{ teamEligibilityLabel(team) }}
                  </span>
                </div>
                <p
                  v-if="teamDisabledReason(team)"
                  class="mt-1 text-[11px] text-muted-foreground"
                >
                  {{ teamDisabledReason(team) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { teamAvgElo, teamAvgPremier } from "~/utilities/teamElo";

interface Team {
  id: string;
  name: string;
  short_name: string;
  owner_steam_id?: string | null;
  captain_steam_id?: string | null;
  avatar_url?: string | null;
  role?: e_team_roles_enum;
  player_count?: number;
  avg_elo?: number | null;
  avg_premier?: number | null;
}

export default {
  emits: ["selected", "update:modelValue"],
  props: {
    label: {
      type: String,
      required: true,
    },
    exclude: {
      type: Array,
      required: false,
      default: [],
    },
    modelValue: {
      type: [String, Number, Array, Object],
      default: "",
      required: false,
    },
    isAdmin: {
      type: Boolean,
      required: false,
      default: false,
    },
    myTeams: {
      type: Boolean,
      required: false,
      default: false,
    },
    tournamentJoinSelector: {
      type: Boolean,
      required: false,
      default: false,
    },
    // When set, teams with fewer eligible players are shown but not selectable.
    minPlayers: {
      type: Number,
      required: false,
      default: 0,
    },
    withStats: {
      type: Boolean,
      required: false,
      default: false,
    },
    teamOptions: {
      type: Array as () => Team[] | undefined,
      required: false,
      default: undefined,
    },
  },
  data() {
    return {
      open: false,
      query: "",
      teams: undefined as Team[] | undefined,
      myTeamsOnly: false,
      selectedIndex: 0,
      activeRow: null as HTMLElement | null,
      debouncedSearch: debounce((query: string) => {
        this.searchTeams(query);
      }, 300),
    };
  },
  watch: {
    query(newQuery: string) {
      this.debouncedSearch(newQuery);
    },
    open: {
      handler(newOpen: boolean) {
        if (newOpen) {
          this.searchTeams();
          this.$nextTick(() => {
            (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
          });
        }
      },
    },
    modelValue: {
      once: true,
      immediate: true,
      async handler(teamId: string) {
        if (!teamId) {
          return;
        }

        if (this.teamOptions) {
          this.teams = this.teamOptions;
          return;
        }

        const { data } = await this.$apollo.query({
          query: generateQuery({
            teams: [
              {
                where: {
                  id: {
                    _eq: teamId,
                  },
                },
              },
              {
                id: true,
                name: true,
                short_name: true,
                avatar_url: true,
              },
            ],
          }),
        });

        this.teams = data.teams;
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    showStats(): boolean {
      return !!this.minPlayers || this.withStats;
    },
    selectedTeam(): Team | undefined {
      const value: any = this.modelValue;
      const id =
        value && typeof value === "object" && "id" in value ? value.id : value;
      const source = this.teams ?? this.teamOptions;
      return source?.find((team) => team.id === id);
    },
  },
  methods: {
    setActiveRow(el: HTMLElement | null) {
      this.activeRow = el;
    },
    scrollActiveIntoView() {
      this.$nextTick(() => {
        this.activeRow?.scrollIntoView({ block: "nearest" });
      });
    },
    onKeydown(event: KeyboardEvent) {
      const list = this.teams ?? [];
      if (!list.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, list.length - 1);
        this.scrollActiveIntoView();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollActiveIntoView();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (list[this.selectedIndex]) this.select(list[this.selectedIndex]);
      }
    },
    canSelectTeam(team: Team): boolean {
      if (this.minPlayers && (team.player_count ?? 0) < this.minPlayers) {
        return false;
      }
      if (!this.tournamentJoinSelector) return true;
      const isOwner = team.owner_steam_id === this.me?.steam_id;
      const isCaptain = team.captain_steam_id === this.me?.steam_id;
      return isOwner || isCaptain;
    },
    teamEligibilityLabel(team: Team): string {
      if (!this.tournamentJoinSelector) return "";
      if (team.owner_steam_id === this.me?.steam_id) {
        return this.$t("team.search.owner");
      }
      if (team.captain_steam_id === this.me?.steam_id) {
        return this.$t("team.search.captain");
      }
      return this.$t("team.search.ineligible_short");
    },
    teamDisabledReason(team: Team): string {
      if (this.minPlayers && (team.player_count ?? 0) < this.minPlayers) {
        return this.$t("team.search.not_enough_players", {
          count: this.minPlayers,
        });
      }
      if (!this.tournamentJoinSelector || this.canSelectTeam(team)) return "";
      return this.$t("team.search.tournament_join_requires_owner_or_captain");
    },
    async enrichTeams() {
      // Only fetch roster details when a consumer needs eligibility / ELO.
      if (!this.showStats || !this.teams?.length) return;
      const ids = this.teams.map((team) => team.id);
      const { data } = await this.$apollo.query({
        query: generateQuery({
          teams: [
            { where: { id: { _in: ids } } },
            {
              id: true,
              avatar_url: true,
              roster: [
                { where: { status: { _in: ["Starter", "Substitute"] } } },
                {
                  player: {
                    steam_id: true,
                    elo: true,
                    premier_rank: true,
                  },
                },
              ],
            },
          ],
        }),
      });
      const detailsById = new Map<string, any>(
        (data.teams || []).map((team: any) => [team.id, team]),
      );
      this.teams = this.teams.map((team) => {
        const details = detailsById.get(team.id);
        const roster = details?.roster || [];
        return {
          ...team,
          avatar_url: team.avatar_url ?? details?.avatar_url ?? null,
          player_count: roster.length,
          avg_elo: teamAvgElo(roster),
          avg_premier: teamAvgPremier(roster),
        };
      });
    },
    teamAvatarSrc(team: { avatar_url?: string | null }): string | null {
      if (!team.avatar_url) return null;
      return `https://${this.apiDomain}/${team.avatar_url}`;
    },
    toggleMyTeamsOnly() {
      this.myTeamsOnly = !this.myTeamsOnly;
      this.searchTeams();
      this.$nextTick(() => {
        (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
      });
    },
    isSelected(team: Team): boolean {
      return !!this.modelValue && team.id === this.modelValue;
    },
    select(team: Team) {
      // Already-selected team can't be deselected from the list.
      if (!team || !this.canSelectTeam(team) || this.isSelected(team)) {
        return;
      }
      this.open = false;
      this.$emit("selected", team);
      this.$emit("update:modelValue", team);
    },
    async searchTeams(query?: string) {
      if (query !== undefined) {
        this.query = query;
      }

      this.selectedIndex = 0;

      if (this.teamOptions) {
        const search = this.query.toLowerCase();
        this.teams = this.teamOptions.filter((team) => {
          if (this.exclude.includes(team.id)) {
            return false;
          }
          return !search || (team.name || "").toLowerCase().includes(search);
        });
        await this.enrichTeams();
        return;
      }

      if (this.myTeamsOnly || this.myTeams) {
        this.teams = this.me.teams.filter((team: Team) => {
          if (this.exclude.includes(team.id)) {
            return false;
          }

          const isTeamCaptain = team.captain_steam_id === this.me?.steam_id;
          const isTeamOwner = team.owner_steam_id === this.me?.steam_id;
          if (
            this.isAdmin &&
            team.role !== e_team_roles_enum.Admin &&
            !isTeamOwner &&
            !isTeamCaptain
          ) {
            return this.tournamentJoinSelector;
          }

          return true;
        });
        await this.enrichTeams();
        return;
      }

      const { data } = await this.$apollo.query({
        query: generateQuery({
          teams: [
            {
              where: {
                _and: [
                  {
                    id: {
                      _nin: this.exclude,
                    },
                  },
                  ...[
                    this.query
                      ? {
                          name: {
                            _ilike: `%${this.query}%`,
                          },
                        }
                      : {},
                  ],
                ],
              },
            },
            {
              id: true,
              name: true,
              short_name: true,
              avatar_url: true,
            },
          ],
        }),
      });
      this.teams = data.teams;
      await this.enrichTeams();
    },
  },
};
</script>
