<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import mapLabel from "~/utilities/mapLabel";
import teamAvatarSrc from "~/utilities/teamAvatar";
import { ELO_MAX, ELO_STEP } from "~/utilities/scrimElo";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { useAuthStore } from "~/stores/AuthStore";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ExternalLink, Search, X, SlidersHorizontal, Check, Gauge, Globe, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import ScrimRequestDialog from "~/components/team/ScrimRequestDialog.vue";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default {
  components: {
    Button,
    Avatar,
    AvatarImage,
    AvatarFallback,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Popover,
    PopoverContent,
    PopoverTrigger,
    ExternalLink,
    Search,
    X,
    SlidersHorizontal,
    Check,
    Gauge,
    Globe,
    Slider,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    TacticalPageHeader,
    PageTransition,
    TeamRankSummary,
    ScrimRequestDialog,
  },
  data() {
    return {
      postings: [] as any[],
      myTeams: [] as any[],
      myMemberTeamIds: [] as string[],
      mapsById: {} as Record<string, any>,
      regionFilter: [] as string[],
      regionSearch: "",
      searchQuery: "",
      mapFilter: [] as string[],
      eloRange: [0, ELO_MAX] as number[],
      ELO_MAX,
      ELO_STEP,
      sortChain: [] as { key: string; dir: "asc" | "desc" }[],
      dialogOpen: false,
      selectedPosting: null as any,
    };
  },
  computed: {
    scrimFinderEnabled(): boolean {
      return useApplicationSettingsStore().scrimFinderEnabled;
    },
    mySteamId(): string | undefined {
      return useAuthStore().me?.steam_id;
    },
    regionOptions() {
      const regions = new Set<string>();
      for (const posting of this.postings) {
        for (const region of posting.regions ?? []) {
          regions.add(region);
        }
      }
      return Array.from(regions)
        .sort((a, b) => a.localeCompare(b))
        .map((region) => ({ key: region, label: region }));
    },
    filteredRegionOptions() {
      const query = this.regionSearch.trim().toLowerCase();
      if (!query) {
        return this.regionOptions;
      }
      return this.regionOptions.filter((region) =>
        region.label.toLowerCase().includes(query),
      );
    },
    sortOptions() {
      return [
        { key: "name", label: this.$t("pages.scrims.sort_name") },
        { key: "elo", label: this.$t("pages.scrims.sort_elo") },
        { key: "reliability", label: this.$t("pages.scrims.sort_reliable") },
      ];
    },
    mapOptions() {
      const ids = new Set<string>();
      for (const posting of this.postings) {
        for (const id of posting.map_ids ?? []) {
          ids.add(id);
        }
      }
      return Array.from(ids)
        .map((id) => this.mapsById[id])
        .filter(Boolean)
        .sort((a, b) => this.cleanName(a).localeCompare(this.cleanName(b)));
    },
    eloActive(): boolean {
      return this.eloRange[0] > 0 || this.eloRange[1] < this.ELO_MAX;
    },
    regionScoped(): any[] {
      return this.postings.filter(
        (posting) =>
          // The finder is for finding opponents — hide teams you're on (you
          // manage their listing from the team page instead).
          !this.myMemberTeamIds.includes(posting.team_id) &&
          this.regionMatches(posting),
      );
    },
    todayRows() {
      const now = new Date();
      const todayDow = now.getDay();
      const rows: any[] = [];

      for (const posting of this.regionScoped) {
        for (const window of posting.team?.scrim_availability ?? []) {
          const start = new Date(window.starts_at);
          const end = new Date(window.ends_at);
          const matches = window.recurring_weekly
            ? start.getDay() === todayDow
            : sameDate(start, now);
          if (!matches) {
            continue;
          }
          rows.push({
            key: `${posting.id}-${window.starts_at}`,
            posting,
            startMinutes: start.getHours() * 60 + start.getMinutes(),
            startLabel: this.formatTime(start),
            endLabel: this.formatTime(end),
          });
        }
      }

      rows.sort((a, b) => a.startMinutes - b.startMinutes);
      return rows;
    },
    availableTeams(): any[] {
      const query = this.searchQuery.trim().toLowerCase();
      const filtered = this.regionScoped.filter((posting) => {
        if (query && !(posting.team?.name ?? "").toLowerCase().includes(query)) {
          return false;
        }
        return this.mapMatches(posting) && this.eloMatches(posting);
      });

      return [...filtered].sort((a, b) => this.compareSort(a, b));
    },
    sortSummary(): string {
      const labels: Record<string, string> = {
        name: this.$t("pages.scrims.sort_name"),
        elo: this.$t("pages.scrims.sort_elo"),
        reliability: this.$t("pages.scrims.sort_reliable"),
      };
      return this.sortChain
        .map(({ key, dir }) => `${labels[key]} ${dir === "asc" ? "↑" : "↓"}`)
        .join(" · ");
    },
  },
  apollo: {
    $subscribe: {
      team_scrim_settings: {
        query: typedGql("subscription")({
          team_scrim_settings: [
            {
              where: { enabled: { _eq: true } },
              order_by: [{ updated_at: order_by.desc }],
            },
            {
              id: true,
              team_id: true,
              regions: true,
              map_ids: true,
              notes: true,
              allow_outside_availability: true,
              team: {
                id: true,
                name: true,
                avatar_url: true,
                ranks: {
                  avg_elo: true,
                  min_elo: true,
                  max_elo: true,
                  avg_faceit_level: true,
                  avg_faceit_elo: true,
                  avg_premier: true,
                  roster_size: true,
                },
                reputation: {
                  scrims_completed: true,
                  no_shows: true,
                  reliability_pct: true,
                },
                scrim_availability: {
                  starts_at: true,
                  ends_at: true,
                  recurring_weekly: true,
                },
              },
            },
          ],
        }),
        result({ data }) {
          this.postings = data.team_scrim_settings ?? [];
        },
      },
      myTeams: {
        query: typedGql("subscription")({
          teams: [
            {
              where: {
                _or: [
                  { owner_steam_id: { _eq: $("steamId", "bigint!") } },
                  {
                    roster: {
                      _and: [
                        { role: { _eq: "Admin" } },
                        { player_steam_id: { _eq: $("steamId", "bigint!") } },
                      ],
                    },
                  },
                ],
              },
            },
            { id: true, name: true },
          ],
        }),
        variables() {
          return { steamId: this.mySteamId };
        },
        skip() {
          return !this.mySteamId;
        },
        result({ data }) {
          this.myTeams = data.teams ?? [];
        },
      },
      myMemberships: {
        query: typedGql("subscription")({
          teams: [
            {
              where: {
                roster: {
                  player_steam_id: { _eq: $("steamId", "bigint!") },
                },
              },
            },
            { id: true },
          ],
        }),
        variables() {
          return { steamId: this.mySteamId };
        },
        skip() {
          return !this.mySteamId;
        },
        result({ data }) {
          this.myMemberTeamIds = (data.teams ?? []).map((team: any) => team.id);
        },
      },
    },
  },
  mounted() {
    this.loadMaps();
  },
  methods: {
    async loadMaps() {
      const { data } = await this.$apollo.query({
        query: typedGql("query")({
          maps: [{}, { id: true, name: true, patch: true }],
        }),
      });
      const byId: Record<string, any> = {};
      for (const map of data.maps ?? []) {
        byId[map.id] = map;
      }
      this.mapsById = byId;
    },
    formatTime(date: Date): string {
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    },
    regionMatches(posting: any): boolean {
      if (this.regionFilter.length === 0) {
        return true;
      }
      const regions = posting.regions ?? [];
      return (
        regions.length === 0 ||
        this.regionFilter.some((region) => regions.includes(region))
      );
    },
    toggleRegion(region: string) {
      const next = new Set(this.regionFilter);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      this.regionFilter = Array.from(next);
    },
    mapMatches(posting: any): boolean {
      if (this.mapFilter.length === 0) {
        return true;
      }
      const mapIds = posting.map_ids ?? [];
      return (
        mapIds.length === 0 ||
        this.mapFilter.some((id) => mapIds.includes(id))
      );
    },
    sortRank(key: string): number {
      return this.sortChain.findIndex((entry) => entry.key === key) + 1;
    },
    sortDir(key: string): "asc" | "desc" | null {
      return this.sortChain.find((entry) => entry.key === key)?.dir ?? null;
    },
    toggleSort(key: string) {
      const entry = this.sortChain.find((item) => item.key === key);
      if (entry) {
        entry.dir = entry.dir === "asc" ? "desc" : "asc";
        return;
      }
      this.sortChain.push({ key, dir: key === "name" ? "asc" : "desc" });
    },
    removeSort(key: string) {
      this.sortChain = this.sortChain.filter((entry) => entry.key !== key);
    },
    compareSort(a: any, b: any): number {
      for (let i = 0; i < this.sortChain.length; i++) {
        const { key, dir } = this.sortChain[i];
        const isLast = i === this.sortChain.length - 1;
        let cmp = 0;
        if (key === "name") {
          cmp = (a.team?.name ?? "").localeCompare(b.team?.name ?? "");
        } else if (key === "elo") {
          const ea = a.team?.ranks?.avg_elo ?? -1;
          const eb = b.team?.ranks?.avg_elo ?? -1;
          // Bucket ELO when another key follows so it can break near-ties;
          // keep it exact when ELO is the final (or only) key.
          cmp = isLast
            ? ea - eb
            : Math.floor(ea / this.ELO_STEP) - Math.floor(eb / this.ELO_STEP);
        } else if (key === "reliability") {
          cmp =
            (a.team?.reputation?.reliability_pct ?? -1) -
            (b.team?.reputation?.reliability_pct ?? -1);
        }
        if (cmp !== 0) {
          return dir === "asc" ? cmp : -cmp;
        }
      }
      return (a.team?.name ?? "").localeCompare(b.team?.name ?? "");
    },
    eloMatches(posting: any): boolean {
      if (!this.eloActive) {
        return true;
      }
      const elo = posting.team?.ranks?.avg_elo;
      if (elo == null) {
        return false;
      }
      return (
        elo >= this.eloRange[0] &&
        (this.eloRange[1] >= this.ELO_MAX || elo <= this.eloRange[1])
      );
    },
    toggleMap(id: string) {
      const next = new Set(this.mapFilter);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      this.mapFilter = Array.from(next);
    },
    availabilityDays(posting: any): string[] {
      const days = new Set<number>();
      for (const window of posting.team?.scrim_availability ?? []) {
        days.add(new Date(window.starts_at).getDay());
      }
      return Array.from(days)
        .sort((a, b) => a - b)
        .map((index) => DAY_NAMES[index]);
    },
    mapPatches(mapIds: Array<string>): Array<any> {
      return (mapIds ?? [])
        .map((id) => this.mapsById[id])
        .filter((map) => map && map.patch);
    },
    cleanName(map: any): string {
      return mapLabel(map);
    },
    teamAvatar(team: any): string | null {
      return teamAvatarSrc(team);
    },
    canRequest(posting: any): boolean {
      // You can't scrim a team you're on, and you need a team you manage to
      // request from.
      if (this.myMemberTeamIds.includes(posting.team_id)) {
        return false;
      }
      return this.myTeams.length > 0;
    },
    openRequest(posting: any) {
      this.selectedPosting = posting;
      this.dialogOpen = true;
    },
  },
};
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.scrims.title") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <div>
    <p
      v-if="!scrimFinderEnabled"
      class="mt-6 rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      {{ $t("pages.scrims.disabled_message") }}
    </p>

    <template v-else>
      <PageTransition :delay="100" class="mt-6 block">
        <div class="flex flex-wrap items-center gap-2">
          <InputGroup class="h-9 max-w-xs flex-1 bg-card/60">
            <InputGroupAddon class="pl-3">
              <Search class="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              v-model="searchQuery"
              type="text"
              :placeholder="$t('pages.scrims.search_placeholder')"
              class="h-full text-sm"
            />
            <InputGroupAddon align="inline-end" class="pr-2">
              <button
                v-if="searchQuery"
                type="button"
                class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                @click="searchQuery = ''"
              >
                <X class="h-4 w-4" />
              </button>
            </InputGroupAddon>
          </InputGroup>

          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                :class="
                  regionFilter.length
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-foreground'
                    : ''
                "
              >
                <Globe class="h-4 w-4" />
                {{ $t("pages.scrims.regions_label") }}
                <span
                  v-if="regionFilter.length"
                  class="rounded bg-[hsl(var(--tac-amber)/0.15)] px-1.5 text-[hsl(var(--tac-amber))]"
                >
                  {{ regionFilter.length }}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-56 p-1.5">
              <div class="flex items-center justify-between px-2 py-1">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.scrims.regions_section") }}
                </span>
                <button
                  v-if="regionFilter.length"
                  type="button"
                  class="text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))] hover:underline"
                  @click="regionFilter = []"
                >
                  {{ $t("common.clear") }}
                </button>
              </div>
              <InputGroup class="mb-1 h-8 bg-card/60">
                <InputGroupAddon class="pl-2.5">
                  <Search class="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  v-model="regionSearch"
                  type="text"
                  :placeholder="$t('pages.scrims.filter_regions_placeholder')"
                  class="h-full text-xs"
                />
              </InputGroup>
              <div class="max-h-60 overflow-y-auto">
                <button
                  v-for="region in filteredRegionOptions"
                  :key="region.key"
                  type="button"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                  @click="toggleRegion(region.key)"
                >
                  <span
                    class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    :class="
                      regionFilter.includes(region.key)
                        ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black'
                        : 'border-border'
                    "
                  >
                    <Check
                      v-if="regionFilter.includes(region.key)"
                      class="h-3 w-3"
                    />
                  </span>
                  <span class="truncate">{{ region.label }}</span>
                </button>
              </div>
              <p
                v-if="filteredRegionOptions.length === 0"
                class="px-2 py-3 text-center text-xs text-muted-foreground"
              >
                {{ $t("pages.scrims.no_regions_found") }}
              </p>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                :class="
                  mapFilter.length
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-foreground'
                    : ''
                "
              >
                <SlidersHorizontal class="h-4 w-4" />
                {{ $t("pages.scrims.maps_label") }}
                <span
                  v-if="mapFilter.length"
                  class="rounded bg-[hsl(var(--tac-amber)/0.15)] px-1.5 text-[hsl(var(--tac-amber))]"
                >
                  {{ mapFilter.length }}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-56 p-1.5">
              <div class="flex items-center justify-between px-2 py-1">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.scrims.preferred_maps") }}
                </span>
                <button
                  v-if="mapFilter.length"
                  type="button"
                  class="text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))] hover:underline"
                  @click="mapFilter = []"
                >
                  {{ $t("common.clear") }}
                </button>
              </div>
              <button
                v-for="map in mapOptions"
                :key="map.id"
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                @click="toggleMap(map.id)"
              >
                <span
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                  :class="
                    mapFilter.includes(map.id)
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black'
                      : 'border-border'
                  "
                >
                  <Check v-if="mapFilter.includes(map.id)" class="h-3 w-3" />
                </span>
                <img
                  v-if="map.patch"
                  :src="map.patch"
                  :alt="cleanName(map)"
                  class="h-5 w-5 object-contain"
                />
                <span class="truncate">{{ cleanName(map) }}</span>
              </button>
              <p
                v-if="mapOptions.length === 0"
                class="px-2 py-3 text-center text-xs text-muted-foreground"
              >
                {{ $t("pages.scrims.no_map_preferences") }}
              </p>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                :class="
                  eloActive
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-foreground'
                    : ''
                "
              >
                <Gauge class="h-4 w-4" />
                {{ $t("pages.scrims.elo_label") }}
                <span
                  v-if="eloActive"
                  class="rounded bg-[hsl(var(--tac-amber)/0.15)] px-1.5 text-[hsl(var(--tac-amber))]"
                >
                  {{ eloRange[0] }}–{{
                    eloRange[1] >= ELO_MAX ? "∞" : eloRange[1]
                  }}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-64 p-3">
              <div class="flex items-center justify-between">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.scrims.team_avg_elo") }}
                </span>
                <button
                  v-if="eloActive"
                  type="button"
                  class="text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))] hover:underline"
                  @click="eloRange = [0, ELO_MAX]"
                >
                  {{ $t("common.clear") }}
                </button>
              </div>
              <div
                class="mt-3 flex items-center justify-between text-xs tabular-nums text-muted-foreground"
              >
                <span>{{ eloRange[0] === 0 ? $t("common.any") : eloRange[0] }}</span>
                <span>{{ eloRange[1] >= ELO_MAX ? $t("common.any") : eloRange[1] }}</span>
              </div>
              <Slider
                v-model="eloRange"
                :min="0"
                :max="ELO_MAX"
                :step="ELO_STEP"
                class="mt-2"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger as-child>
              <button
                type="button"
                class="ml-auto inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                :class="
                  sortChain.length
                    ? 'border-[hsl(var(--tac-amber)/0.5)] text-foreground'
                    : ''
                "
              >
                <ArrowUpDown class="h-4 w-4" />
                <span v-if="sortChain.length" class="normal-case tracking-normal">
                  {{ sortSummary }}
                </span>
                <span v-else>{{ $t("pages.scrims.sort_label") }}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-60 p-1.5">
              <div class="flex items-center justify-between px-2 py-1">
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.scrims.sort_by") }}
                </span>
                <button
                  v-if="sortChain.length"
                  type="button"
                  class="text-[0.6rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))] hover:underline"
                  @click="sortChain = []"
                >
                  {{ $t("common.clear") }}
                </button>
              </div>
              <button
                v-for="option in sortOptions"
                :key="option.key"
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                @click="toggleSort(option.key)"
              >
                <span
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[0.6rem] font-semibold"
                  :class="
                    sortRank(option.key)
                      ? 'bg-[hsl(var(--tac-amber))] text-black'
                      : 'border border-border text-transparent'
                  "
                >
                  {{ sortRank(option.key) || "" }}
                </span>
                <span class="flex-1 truncate">{{ option.label }}</span>
                <ArrowUp
                  v-if="sortDir(option.key) === 'asc'"
                  class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
                />
                <ArrowDown
                  v-else-if="sortDir(option.key) === 'desc'"
                  class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
                />
                <button
                  v-if="sortRank(option.key)"
                  type="button"
                  class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  @click.stop="removeSort(option.key)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </button>
              <p
                class="px-2 pb-1 pt-1.5 text-[0.6rem] leading-snug text-muted-foreground"
              >
                {{ $t("pages.scrims.sort_instructions") }}
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </PageTransition>

      <PageTransition :delay="200" class="mt-6 block">
        <div class="space-y-10">
          <!-- Today's schedule -->
          <section class="space-y-3">
            <div class="flex items-center gap-3">
              <span
                class="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("pages.scrims.today") }}
              </span>
              <span class="text-xs text-muted-foreground">{{
                todayRows.length
              }}</span>
              <span class="h-px flex-1 bg-border" />
            </div>

            <p
              v-if="todayRows.length === 0"
              class="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t("pages.scrims.no_teams_today") }}
            </p>

            <div
              v-for="entry in todayRows"
              :key="entry.key"
              class="group relative flex items-stretch overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-[hsl(var(--tac-amber)/0.5)]"
            >
              <div
                class="relative flex w-[110px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border/60 bg-[hsl(var(--tac-amber)/0.05)] px-2 py-4 text-center sm:w-[124px]"
              >
                <span class="absolute inset-y-0 left-0 w-[3px] bg-[hsl(var(--tac-amber))]" />
                <span
                  class="font-sans text-lg font-bold leading-none tabular-nums text-foreground"
                >
                  {{ entry.startLabel }}
                </span>
                <span
                  class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {{ $t("pages.scrims.time_to") }} {{ entry.endLabel }}
                </span>
              </div>

              <div
                class="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div class="flex min-w-0 flex-1 flex-col gap-2">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <NuxtLink
                      :to="`/teams/${entry.posting.team_id}`"
                      class="flex min-w-0 items-center gap-2 font-semibold hover:text-[hsl(var(--tac-amber))]"
                    >
                      <Avatar shape="square" class="h-7 w-7 rounded-md">
                        <AvatarImage
                          v-if="teamAvatar(entry.posting.team)"
                          :src="teamAvatar(entry.posting.team)"
                          :alt="entry.posting.team?.name"
                        />
                        <AvatarFallback class="rounded-md text-[0.6rem] font-semibold uppercase">
                          {{ (entry.posting.team?.name || "?").slice(0, 2) }}
                        </AvatarFallback>
                      </Avatar>
                      <span class="truncate">{{ entry.posting.team?.name }}</span>
                    </NuxtLink>
                    <a
                      :href="`/teams/${entry.posting.team_id}`"
                      target="_blank"
                      rel="noopener"
                      class="text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                      :title="$t('pages.scrims.open_team_new_tab')"
                      @click.stop
                    >
                      <ExternalLink class="h-3.5 w-3.5" />
                    </a>
                    <span
                      v-for="region in entry.posting.regions"
                      :key="region"
                      class="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {{ region }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <TeamRankSummary
                      :ranks="entry.posting.team?.ranks"
                      :reputation="entry.posting.team?.reputation"
                    />
                    <div
                      v-if="mapPatches(entry.posting.map_ids).length"
                      class="flex flex-wrap items-center gap-1.5"
                    >
                      <img
                        v-for="map in mapPatches(entry.posting.map_ids)"
                        :key="map.id"
                        :src="map.patch"
                        :alt="cleanName(map)"
                        :title="cleanName(map)"
                        class="h-6 w-6 object-contain"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  v-if="canRequest(entry.posting)"
                  class="tac-amber-cta shrink-0 self-start sm:self-center"
                  @click="openRequest(entry.posting)"
                >
                  {{ $t("pages.scrims.request_scrim") }}
                </Button>
              </div>
            </div>
          </section>

          <!-- Browse all available teams -->
          <section class="space-y-3">
            <div class="flex items-center gap-3">
              <span
                class="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("pages.scrims.available_teams") }}
              </span>
              <span class="text-xs text-muted-foreground">{{
                availableTeams.length
              }}</span>
              <span class="h-px flex-1 bg-border" />
            </div>

            <p
              v-if="availableTeams.length === 0"
              class="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t("pages.scrims.no_teams_match") }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="posting in availableTeams"
                :key="posting.id"
                class="group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 transition-all hover:border-[hsl(var(--tac-amber)/0.5)]"
              >
                <div class="flex min-w-0 items-start gap-3">
                  <NuxtLink
                    :to="`/teams/${posting.team_id}`"
                    class="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:text-[hsl(var(--tac-amber))]"
                  >
                    <Avatar shape="square" class="h-9 w-9 rounded-md">
                      <AvatarImage
                        v-if="teamAvatar(posting.team)"
                        :src="teamAvatar(posting.team)"
                        :alt="posting.team?.name"
                      />
                      <AvatarFallback class="rounded-md text-[0.65rem] font-semibold uppercase">
                        {{ (posting.team?.name || "?").slice(0, 2) }}
                      </AvatarFallback>
                    </Avatar>
                    <span class="truncate">{{ posting.team?.name }}</span>
                  </NuxtLink>
                  <a
                    :href="`/teams/${posting.team_id}`"
                    target="_blank"
                    rel="noopener"
                    class="mt-1 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                    :title="$t('pages.scrims.open_team_new_tab')"
                    @click.stop
                  >
                    <ExternalLink class="h-3.5 w-3.5" />
                  </a>
                </div>

                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    v-for="region in posting.regions"
                    :key="region"
                    class="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {{ region }}
                  </span>
                  <span
                    v-for="day in availabilityDays(posting)"
                    :key="day"
                    class="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {{ day }}
                  </span>
                </div>

                <TeamRankSummary
                  :ranks="posting.team?.ranks"
                  :reputation="posting.team?.reputation"
                />

                <div
                  v-if="mapPatches(posting.map_ids).length"
                  class="flex flex-wrap items-center gap-1.5"
                >
                  <img
                    v-for="map in mapPatches(posting.map_ids)"
                    :key="map.id"
                    :src="map.patch"
                    :alt="cleanName(map)"
                    :title="cleanName(map)"
                    class="h-6 w-6 object-contain"
                  />
                </div>

                <p
                  v-if="posting.notes"
                  class="line-clamp-2 text-xs text-muted-foreground"
                >
                  {{ posting.notes }}
                </p>

                <Button
                  v-if="canRequest(posting)"
                  class="tac-amber-cta mt-auto w-full"
                  @click="openRequest(posting)"
                >
                  {{ $t("pages.scrims.request_scrim") }}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </PageTransition>
    </template>

    <ScrimRequestDialog
      v-model:open="dialogOpen"
      :posting="selectedPosting"
    />
  </div>
</template>
