<script setup lang="ts">
import {
  PlusCircle,
  ArrowUpIcon,
  ArrowDownIcon,
  Swords,
  Calendar as CalendarIcon,
  X,
} from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

const apiDomain = useRuntimeConfig().public.apiDomain;
const teamAvatar = (t: { avatar_url?: string | null }) =>
  t.avatar_url ? `https://${apiDomain}/${t.avatar_url}` : null;
const playerAvatar = (p: { avatar_url?: string }) => p.avatar_url || null;
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  tacticalCtaButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const auth = useAuthStore();
// Admin-tier roles see the extended filter set (match-ID search, in-lineup
// filter, only-my-matches toggle, Create button). Anyone below sees a
// trimmed view — server-side RLS already enforces what they can read.
const canManageMatches = computed(
  () =>
    auth.isAdmin.value ||
    auth.isMatchOrganizer.value ||
    auth.isTournamentOrganizer.value,
);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>
        <Swords class="h-3.5 w-3.5" />
        {{ $t("pages.matches.browser") }}
      </template>
      <template #title>{{ $t("pages.matches.title") }}</template>
      <template #actions>
        <button
          v-if="canManageMatches"
          type="button"
          :class="tacticalCtaButtonClasses"
          @click="navigateTo('/matches/create')"
        >
          <PlusCircle class="w-4 h-4" />
          <span class="hidden md:inline">{{ $t("pages.matches.create") }}</span>
        </button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <div
      class="relative rounded-md border border-border bg-card/40 [backdrop-filter:blur(6px)] transition-shadow duration-200"
      :class="
        activeFilterCount > 0 &&
        '[box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.18),0_0_28px_-14px_hsl(var(--tac-amber)/0.5)]'
      "
    >
      <span
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-[hsl(var(--tac-amber)/0.55)]"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-[hsl(var(--tac-amber)/0.55)]"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-[hsl(var(--tac-amber)/0.55)]"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-[hsl(var(--tac-amber)/0.55)]"
      />

      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-4 py-2"
      >
        <div
          class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          <span :class="tacticalSectionTickClasses" />
          <span>{{ $t("pages.matches.filters") }}</span>
          <span class="text-muted-foreground/30">·</span>
          <span
            :class="
              activeFilterCount > 0
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground/60'
            "
          >
            {{ activeFilterCount }} {{ $t("pages.matches.active") }}
          </span>
          <span class="text-muted-foreground/30">·</span>
          <span class="text-muted-foreground/80">
            {{ matchesAggregate || 0 }}
            {{
              matchesAggregate === 1
                ? $t("pages.matches.result_singular")
                : $t("pages.matches.result_plural")
            }}
          </span>
        </div>
        <button
          type="button"
          :disabled="!activeFilterCount"
          @click="resetFilters"
          class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
        >
          <X class="h-3 w-3" />
          {{ $t("common.reset_filters") }}
        </button>
      </div>

      <div class="grid gap-x-4 gap-y-3 px-4 pb-3 pt-3 md:grid-cols-2">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-2">
              <Label
                class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground/80"
              >
                {{ $t("pages.matches.teams") }}
              </Label>
              <span
                v-if="form.teams.length"
                class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
              >
                · {{ form.teams.length }}
                {{
                  form.teams.length === 1
                    ? $t("pages.matches.target_singular")
                    : $t("pages.matches.target_plural")
                }}
              </span>
              <span
                v-else
                class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/50"
              >
                · {{ $t("pages.matches.by_name") }}
              </span>
            </div>
            <button
              v-if="form.teams.length > 1"
              type="button"
              @click="
                form.teams = [];
                onFilterChange();
              "
              class="inline-flex items-center gap-1 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X class="h-3 w-3" /> {{ $t("pages.matches.clear") }}
            </button>
          </div>
          <TeamSearch
            :label="$t('pages.manage_matches.enter_team_name')"
            :exclude="form.teams.map((t) => t.id)"
            @selected="addTeam"
          />
          <div v-if="form.teams.length" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="(t, i) in form.teams"
              :key="t.id"
              class="tac-chip animate-in fade-in slide-in-from-left-1 duration-200"
              :style="{ animationDelay: `${i * 35}ms` }"
            >
              <Avatar class="h-4 w-4 rounded-sm shrink-0">
                <AvatarImage
                  v-if="teamAvatar(t)"
                  :src="teamAvatar(t)!"
                  :alt="t.name"
                />
                <AvatarFallback
                  class="rounded-sm text-[8px] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]"
                >
                  {{ (t.short_name || t.name).slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
              <span
                v-if="t.short_name"
                class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber)/0.7)]"
              >
                [{{ t.short_name }}]
              </span>
              <span class="text-xs text-foreground/90 truncate max-w-[140px]">
                {{ t.name }}
              </span>
              <button
                type="button"
                @click="removeTeam(t.id)"
                class="tac-chip-x"
                :aria-label="$t('pages.matches.remove_team', { name: t.name })"
              >
                <X class="h-3 w-3" />
              </button>
            </span>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-2">
              <Label
                class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground/80"
              >
                {{ $t("pages.matches.players") }}
              </Label>
              <span
                v-if="form.players.length"
                class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
              >
                · {{ form.players.length }}
                {{
                  form.players.length === 1
                    ? $t("pages.matches.operator_singular")
                    : $t("pages.matches.operator_plural")
                }}
              </span>
              <span
                v-else
                class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/50"
              >
                · {{ $t("pages.matches.by_handle") }}
              </span>
            </div>
            <button
              v-if="form.players.length > 1"
              type="button"
              @click="
                form.players = [];
                onFilterChange();
              "
              class="inline-flex items-center gap-1 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X class="h-3 w-3" /> {{ $t("pages.matches.clear") }}
            </button>
          </div>
          <PlayerSearch
            class="w-full"
            :label="$t('player.search.placeholder')"
            :exclude="form.players.map((p) => p.steam_id)"
            @selected="addPlayer"
          />
          <div v-if="form.players.length" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="(p, i) in form.players"
              :key="p.steam_id"
              class="tac-chip animate-in fade-in slide-in-from-left-1 duration-200"
              :style="{ animationDelay: `${i * 35}ms` }"
            >
              <Avatar class="h-4 w-4 rounded-full shrink-0">
                <AvatarImage
                  v-if="playerAvatar(p)"
                  :src="playerAvatar(p)!"
                  :alt="p.name"
                />
                <AvatarFallback
                  class="text-[8px] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]"
                >
                  {{ p.name.slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
              <span class="text-xs text-foreground/90 truncate max-w-[140px]">
                {{ p.name }}
              </span>
              <button
                type="button"
                @click="removePlayer(p.steam_id)"
                class="tac-chip-x"
                :aria-label="
                  $t('pages.matches.remove_player', { name: p.name })
                "
              >
                <X class="h-3 w-3" />
              </button>
            </span>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label
            for="status-filter"
            class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground/80"
          >
            {{ $t("pages.matches.status_label") }}
          </Label>
          <Select
            :model-value="form.statuses"
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
          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <span
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/50"
            >
              {{ $t("pages.matches.presets") }}
            </span>
            <button
              type="button"
              @click="applyStatusPreset('upcomingLive')"
              :class="[
                'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors duration-150',
                activePresetName === 'upcomingLive'
                  ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              ]"
            >
              {{ $t("pages.matches.preset_upcoming_live") }}
            </button>
            <button
              type="button"
              @click="applyStatusPreset('finished')"
              :class="[
                'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] transition-colors duration-150',
                activePresetName === 'finished'
                  ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              ]"
            >
              {{ $t("pages.matches.preset_finished") }}
            </button>
            <button
              v-if="form.statuses.length"
              type="button"
              @click="clearAllStatuses"
              class="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <X class="h-3 w-3" /> {{ $t("pages.matches.clear_short") }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-baseline gap-2">
            <Label
              class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground/80"
            >
              {{ $t("pages.matches.window") }}
            </Label>
            <span
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/50"
            >
              · {{ sortFieldLabel }}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              class="w-8 shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground/60"
            >
              {{ $t("pages.matches.from") }}
            </span>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="h-9 min-w-0 flex-1 justify-start gap-2 text-left font-normal"
                  :class="{ 'text-muted-foreground': !fromCalendar }"
                >
                  <CalendarIcon class="h-4 w-4 shrink-0" />
                  <span class="truncate">
                    {{ fromCalendar || $t("common.pick_date") }}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="fromCalendar" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              v-if="showTimeInputs"
              type="time"
              v-model="fromTime"
              style="color-scheme: dark"
              class="w-[128px] shrink-0 font-mono tabular-nums"
            />
            <Button
              v-if="fromCalendar || fromTime"
              type="button"
              variant="ghost"
              size="icon"
              @click.prevent="clearFromDate"
              class="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              class="w-8 shrink-0 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground/60"
            >
              {{ $t("pages.matches.to") }}
            </span>
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="h-9 min-w-0 flex-1 justify-start gap-2 text-left font-normal"
                  :class="{ 'text-muted-foreground': !toCalendar }"
                >
                  <CalendarIcon class="h-4 w-4 shrink-0" />
                  <span class="truncate">
                    {{ toCalendar || $t("common.pick_date") }}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="toCalendar" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              v-if="showTimeInputs"
              type="time"
              v-model="toTime"
              style="color-scheme: dark"
              class="w-[128px] shrink-0 font-mono tabular-nums"
            />
            <Button
              v-if="toCalendar || toTime"
              type="button"
              variant="ghost"
              size="icon"
              @click.prevent="clearToDate"
              class="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label
            class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground/80"
          >
            {{ $t("pages.matches.options") }}
          </Label>
          <div class="flex flex-col gap-2">
            <div v-if="canManageMatches" class="flex items-center gap-2">
              <Switch
                :model-value="showOnlyMyMatches"
                @update:model-value="showOnlyMyMatches = !showOnlyMyMatches"
              />
              <Label class="text-xs font-medium uppercase tracking-wider">
                {{ $t("pages.manage_matches.only_my_matches") }}
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <Switch
                :model-value="!includeOutOfLineup"
                @update:model-value="includeOutOfLineup = !includeOutOfLineup"
              />
              <Label class="text-xs font-medium uppercase tracking-wider">
                {{ $t("pages.matches.lineup_only") }}
              </Label>
            </div>
            <Input
              v-if="canManageMatches"
              id="match-id-search"
              :model-value="form.matchId"
              @update:model-value="
                (value) => {
                  form.matchId = String(value || '');
                  onFilterChange();
                }
              "
              :placeholder="$t('pages.manage_matches.enter_match_id')"
              class="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="150" class="mt-6">
    <div
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex items-center gap-3">
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("pages.manage_matches.sort_by") }}
        </span>
        <Select v-model="sortField" @update:model-value="onSortChange">
          <SelectTrigger class="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled_at">{{
              $t("pages.manage_matches.scheduled_at")
            }}</SelectItem>
            <SelectItem value="started_at">{{
              $t("pages.manage_matches.started_at")
            }}</SelectItem>
            <SelectItem value="ended_at">{{
              $t("pages.manage_matches.ended_at")
            }}</SelectItem>
            <SelectItem value="created_at">{{
              $t("pages.manage_matches.created_at")
            }}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          @click="toggleSortDirection"
          class="flex h-8 items-center gap-1"
        >
          <ArrowUpIcon v-if="sortDirection === 'desc'" class="h-3.5 w-3.5" />
          <ArrowDownIcon v-else class="h-3.5 w-3.5" />
          <span class="text-xs">
            {{
              sortDirection === "desc"
                ? $t("pages.manage_matches.newest_first")
                : $t("pages.manage_matches.oldest_first")
            }}
          </span>
        </Button>
      </div>
      <div
        class="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {{ $t("pages.manage_matches.showing") }} {{ matches.length }}
        {{ $t("pages.manage_matches.matches") }}
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="200" class="mt-4">
    <div class="relative">
      <div v-if="loading" class="absolute right-4 top-2 z-10">
        <div
          class="inline-flex items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground [backdrop-filter:blur(6px)]"
        >
          <div
            class="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
          ></div>
          <span>{{ $t("common.loading") }}</span>
        </div>
      </div>

      <MatchesTable
        v-if="matches && matches.length > 0"
        :matches="matches"
        :show-all-matches="canManageMatches"
      />

      <div
        v-else-if="!loading"
        class="relative flex min-h-24 flex-col items-center justify-center overflow-hidden rounded-md border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center [background-image:repeating-linear-gradient(135deg,transparent_0,transparent_8px,hsl(var(--muted-foreground)/0.04)_8px,hsl(var(--muted-foreground)/0.04)_9px)]"
      >
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground/80"
        >
          <span
            aria-hidden="true"
            class="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
          ></span>
          {{ $t("pages.matches.standby_no_matches") }}
        </div>
        <p class="mt-1.5 text-xs text-muted-foreground/70">
          {{ $t("pages.manage_matches.no_matches") }}
        </p>
      </div>
    </div>
  </PageTransition>

  <Pagination
    v-if="matchesAggregate"
    class="mt-4"
    :page="page"
    :per-page="perPage"
    :total="matchesAggregate"
    @page="
      (_page) => {
        page = _page;
      }
    "
  />
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { $, e_match_status_enum, order_by } from "~/generated/zeus";
import { validate as validateUUID } from "uuid";
import { useAuthStore } from "~/stores/AuthStore";
import {
  CalendarDateTime,
  fromDate,
  toCalendarDate,
  toZoned,
  getLocalTimeZone,
} from "@internationalized/date";

function decomposeIso(iso?: string): { calendar: any; time: string } {
  if (!iso) return { calendar: undefined, time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { calendar: undefined, time: "" };
  return {
    calendar: toCalendarDate(fromDate(d, getLocalTimeZone())),
    time: `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}`,
  };
}

function composeIso(cal: any, time: string): string {
  if (!cal) return "";
  const [h, m] = (time || "00:00").split(":").map(Number);
  const cdt = new CalendarDateTime(
    cal.year,
    cal.month,
    cal.day,
    Number.isFinite(h) ? h : 0,
    Number.isFinite(m) ? m : 0,
  );
  return toZoned(cdt, getLocalTimeZone()).toAbsoluteString();
}

const STORAGE_KEY = "matches-filters";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const statusPresets: Record<string, e_match_status_enum[]> = {
  upcomingLive: [
    e_match_status_enum.Live,
    e_match_status_enum.Veto,
    e_match_status_enum.WaitingForCheckIn,
    e_match_status_enum.WaitingForServer,
    e_match_status_enum.Scheduled,
    e_match_status_enum.PickingPlayers,
  ],
  finished: [e_match_status_enum.Finished],
};

interface FilterTeam {
  id: string;
  name: string;
  short_name?: string;
  avatar_url?: string | null;
}

interface FilterPlayer {
  steam_id: string;
  name: string;
  avatar_url?: string;
  country?: string;
}

interface MatchesFilters {
  matchId: string;
  teams: FilterTeam[];
  players: FilterPlayer[];
  statuses: e_match_status_enum[];
  dateFrom: string;
  dateTo: string;
}

interface ComponentData {
  page: number;
  perPage: number;
  matches: any[];
  matchesAggregate: number;
  showOnlyMyMatches: boolean;
  includeOutOfLineup: boolean;
  sortField: string;
  sortDirection: string;
  loading: boolean;
  form: MatchesFilters;
  fromCalendar: any;
  fromTime: string;
  toCalendar: any;
  toTime: string;
}

export default {
  data(): ComponentData {
    const saved = loadFiltersFromStorage();
    const fromInit = decomposeIso(saved.dateFrom);
    const toInit = decomposeIso(saved.dateTo);
    return {
      fromCalendar: fromInit.calendar,
      fromTime: fromInit.time,
      toCalendar: toInit.calendar,
      toTime: toInit.time,
      page: 1,
      perPage: 10,
      matches: [],
      matchesAggregate: 0,
      showOnlyMyMatches: saved.showOnlyMyMatches ?? false,
      // When false, where-clause adds is_in_lineup: true. Default true
      // so guests aren't locked out of organizer-created matches that
      // haven't been added to a lineup yet.
      includeOutOfLineup: saved.includeOutOfLineup ?? true,
      sortField: saved.sortField ?? "scheduled_at",
      sortDirection: saved.sortDirection ?? "desc",
      loading: false,
      form: {
        matchId: saved.matchId ?? "",
        teams: saved.teams ?? [],
        players: saved.players ?? [],
        statuses: saved.statuses ?? [],
        dateFrom: saved.dateFrom ?? "",
        dateTo: saved.dateTo ?? "",
      },
    };
  },
  watch: {
    showOnlyMyMatches() {
      this.saveFiltersToStorage();
    },
    includeOutOfLineup() {
      this.saveFiltersToStorage();
    },
    fromCalendar() {
      this.syncFromDate();
    },
    fromTime() {
      this.syncFromDate();
    },
    toCalendar() {
      this.syncToDate();
    },
    toTime() {
      this.syncToDate();
    },
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
        variables(this: any) {
          if (
            this.form.matchId?.trim() &&
            !validateUUID(this.form.matchId.trim())
          ) {
            this.loading = false;
            this.matches = [];
            return undefined;
          }
          this.loading = true;
          return {
            limit: this.perPage,
            order_by: this.getSortOrder(),
            offset: (this.page - 1) * this.perPage,
            where_clause: this.getWhereClause(),
          };
        },
        result(this: any, { data }: any) {
          this.loading = false;
          this.matches = data?.matches ?? [];
        },
        error(this: any) {
          this.loading = false;
        },
      },
      matchesAggregate: {
        query: typedGql("subscription")({
          matches_aggregate: [
            {
              where: $("where_clause", "matches_bool_exp!"),
            },
            { aggregate: { count: true } },
          ],
        }),
        variables(this: any) {
          if (
            this.form.matchId?.trim() &&
            !validateUUID(this.form.matchId.trim())
          ) {
            this.matchesAggregate = 0;
            return undefined;
          }
          return { where_clause: this.getWhereClause() };
        },
        result(this: any, { data }: any) {
          this.matchesAggregate =
            data?.matches_aggregate?.aggregate?.count || 0;
        },
      },
    },
  },
  computed: {
    canManageMatches(): boolean {
      const a = useAuthStore();
      return (
        a.isAdmin.value ||
        a.isMatchOrganizer.value ||
        a.isTournamentOrganizer.value
      );
    },
    matchStatusOptions() {
      return Object.values(e_match_status_enum).map((status) => ({
        value: status,
        label: status.replace(/([A-Z])/g, " $1").trim(),
      }));
    },
    activeFilterCount(): number {
      let n = 0;
      if (this.form.teams?.length) n++;
      if (this.form.players?.length) n++;
      if (this.form.matchId?.trim()) n++;
      if (this.form.statuses?.length) n++;
      if (this.form.dateFrom || this.form.dateTo) n++;
      if (this.showOnlyMyMatches) n++;
      if (!this.includeOutOfLineup) n++;
      return n;
    },
    activePresetName(): string | null {
      const current = [...(this.form.statuses ?? [])].sort();
      for (const [name, preset] of Object.entries(statusPresets)) {
        const p = [...preset].sort();
        if (
          current.length === p.length &&
          current.every((v, i) => v === p[i])
        ) {
          return name;
        }
      }
      return null;
    },
    sortFieldLabel(): string {
      return (this.sortField || "").replace(/_/g, " ").toUpperCase();
    },
    showTimeInputs(): boolean {
      return this.sortField !== "created_at";
    },
  },
  methods: {
    getWhereClause() {
      const where: any = {};
      const ands: any[] = [];
      const { matchId, teams, players, statuses, dateFrom, dateTo } = this.form;

      if (matchId?.trim()) {
        const id = matchId.trim();
        if (!validateUUID(id)) {
          return { id: { _eq: ZERO_UUID } };
        }
        where.id = { _eq: id };
      }

      if (teams?.length) {
        const teamIds = teams.map((t) => t.id);
        ands.push({
          _or: [
            { lineup_1: { team_id: { _in: teamIds } } },
            { lineup_2: { team_id: { _in: teamIds } } },
          ],
        });
      }

      if (players?.length) {
        const steamIds = players.map((p) => p.steam_id);
        ands.push({
          _or: [
            { lineup_1: { lineup_players: { steam_id: { _in: steamIds } } } },
            { lineup_2: { lineup_players: { steam_id: { _in: steamIds } } } },
          ],
        });
      }

      if (statuses?.length) {
        where.status = { _in: statuses };
      }

      // Date range applies to whichever timestamp the user is sorting
      // by — e.g. "ended_at desc + last week" reads naturally.
      // For scheduled_at, fall back to created_at when scheduled_at is null
      // so unscheduled matches still surface in the window.
      if (dateFrom || dateTo) {
        const range: any = {};
        if (dateFrom) range._gte = dateFrom;
        if (dateTo) range._lte = dateTo;
        if (this.sortField === "scheduled_at") {
          ands.push({
            _or: [
              { scheduled_at: range },
              {
                _and: [
                  { scheduled_at: { _is_null: true } },
                  { created_at: range },
                ],
              },
            ],
          });
        } else {
          where[this.sortField] = range;
        }
      }

      if (this.canManageMatches && this.showOnlyMyMatches) {
        where.organizer_steam_id = {
          _eq: useAuthStore().me?.steam_id,
        };
      }
      if (!this.includeOutOfLineup) {
        where.is_in_lineup = { _eq: true };
      }

      if (ands.length) {
        where._and = ands;
      }

      return where;
    },
    getSortOrder() {
      const dir = this.sortDirection === "desc" ? order_by.desc : order_by.asc;
      const nullsLast =
        this.sortDirection === "desc"
          ? order_by.desc_nulls_last
          : order_by.asc_nulls_last;
      switch (this.sortField) {
        case "started_at":
          return [{ started_at: nullsLast }, { created_at: dir }];
        case "scheduled_at":
          // Unscheduled matches fall through to created_at so they still
          // appear in a sensible spot rather than clustering at top/bottom.
          return [{ scheduled_at: nullsLast }, { created_at: dir }];
        case "ended_at":
          return [{ ended_at: nullsLast }, { created_at: dir }];
        case "created_at":
        default:
          return [{ created_at: dir }];
      }
    },
    saveFiltersToStorage() {
      if (!process.client) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            matchId: this.form.matchId,
            teams: this.form.teams,
            players: this.form.players,
            statuses: this.form.statuses,
            dateFrom: this.form.dateFrom,
            dateTo: this.form.dateTo,
            showOnlyMyMatches: this.showOnlyMyMatches,
            includeOutOfLineup: this.includeOutOfLineup,
            sortField: this.sortField,
            sortDirection: this.sortDirection,
          }),
        );
      } catch (err) {
        console.warn("Failed to save matches filters:", err);
      }
    },
    addTeam(team: FilterTeam) {
      if (!team?.id) return;
      if (this.form.teams.some((t) => t.id === team.id)) return;
      this.form.teams = [
        ...this.form.teams,
        {
          id: team.id,
          name: team.name,
          short_name: team.short_name,
          avatar_url: team.avatar_url,
        },
      ];
      this.onFilterChange();
    },
    removeTeam(id: string) {
      this.form.teams = this.form.teams.filter((t) => t.id !== id);
      this.onFilterChange();
    },
    addPlayer(player: FilterPlayer) {
      if (!player?.steam_id) return;
      if (this.form.players.some((p) => p.steam_id === player.steam_id)) return;
      this.form.players = [
        ...this.form.players,
        {
          steam_id: player.steam_id,
          name: player.name,
          avatar_url: player.avatar_url,
          country: player.country,
        },
      ];
      this.onFilterChange();
    },
    removePlayer(steamId: string) {
      this.form.players = this.form.players.filter(
        (p) => p.steam_id !== steamId,
      );
      this.onFilterChange();
    },
    onFilterChange() {
      this.page = 1;
      this.saveFiltersToStorage();
    },
    onStatusChange(statuses: any) {
      this.form.statuses = statuses ?? [];
      this.onFilterChange();
    },
    clearAllStatuses() {
      this.form.statuses = [];
      this.onFilterChange();
    },
    applyStatusPreset(name: keyof typeof statusPresets) {
      this.form.statuses = [...(statusPresets[name] ?? [])];
      this.onFilterChange();
    },
    syncFromDate() {
      this.form.dateFrom = composeIso(this.fromCalendar, this.fromTime);
      this.onFilterChange();
    },
    syncToDate() {
      this.form.dateTo = composeIso(this.toCalendar, this.toTime);
      this.onFilterChange();
    },
    clearFromDate() {
      this.fromCalendar = undefined;
      this.fromTime = "";
    },
    clearToDate() {
      this.toCalendar = undefined;
      this.toTime = "";
    },
    onSortChange() {
      if (this.sortField === "created_at") {
        this.fromTime = "";
        this.toTime = "";
      }
      this.page = 1;
      this.saveFiltersToStorage();
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.page = 1;
      this.saveFiltersToStorage();
    },
    resetFilters() {
      this.form.matchId = "";
      this.form.teams = [];
      this.form.players = [];
      this.form.statuses = [];
      this.fromCalendar = undefined;
      this.fromTime = "";
      this.toCalendar = undefined;
      this.toTime = "";
      this.showOnlyMyMatches = false;
      this.includeOutOfLineup = true;
      this.sortField = "scheduled_at";
      this.sortDirection = "desc";
      this.page = 1;
      this.saveFiltersToStorage();
    },
  },
};

function loadFiltersFromStorage(): Partial<{
  matchId: string;
  teams: FilterTeam[];
  players: FilterPlayer[];
  statuses: e_match_status_enum[];
  dateFrom: string;
  dateTo: string;
  showOnlyMyMatches: boolean;
  includeOutOfLineup: boolean;
  sortField: string;
  sortDirection: string;
}> {
  if (!process.client) return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}
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
