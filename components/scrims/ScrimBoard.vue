<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Calendar, Check, ChevronDown, Globe, Search, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import FilterBar from "~/components/common/FilterBar.vue";
import FilterMenu from "~/components/common/FilterMenu.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import ScrimBoardRow from "~/components/scrims/ScrimBoardRow.vue";
import mapLabel from "~/utilities/mapLabel";
import { dayLabel, fullDayLabel } from "~/utilities/scrimFormat";
import {
  ceilToStep,
  dayOffset,
  earliestStart,
  startOfDay,
} from "~/utilities/scrimSchedule";
import { mineSide, postingView } from "~/utilities/scrimPosting";
import {
  filterBadgeClasses,
  filterTriggerActive,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  postings: any[];
  myTeam: any | null;
  requests: any[];
  mapsById: Record<string, any>;
  now: Date;
}>();

const emit = defineEmits<{
  (e: "open", posting: any, at: number): void;
  (e: "edit-listing"): void;
}>();

const { t } = useI18n();

const search = ref("");
const day = ref<number | null>(null);
const regions = ref<string[]>([]);
const maps = ref<string[]>([]);
const eloMin = ref("");
const eloMax = ref("");
const fitsOnly = ref(false);
const menuOpen = ref(false);

const regionOptions = computed(() => {
  const set = new Set<string>();
  for (const posting of props.postings) {
    for (const region of posting.regions ?? []) set.add(region);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});
const mapOptions = computed(() => {
  const set = new Set<string>();
  for (const posting of props.postings) {
    for (const id of posting.map_ids ?? []) set.add(id);
  }
  return [...set]
    .map((id) => props.mapsById[id])
    .filter(Boolean)
    .sort((a, b) => mapLabel(a).localeCompare(mapLabel(b)));
});
const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = startOfDay(props.now);
    date.setDate(date.getDate() + i);
    return { offset: i, label: dayLabel(date.getTime(), props.now) };
  }),
);

const eloBounds = computed(() => {
  const read = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  };
  return [read(eloMin.value), read(eloMax.value)] as const;
});
const menuCount = computed(
  () => (maps.value.length ? 1 : 0) + (eloBounds.value.some((v) => v != null) ? 1 : 0),
);
const hasFilters = computed(
  () =>
    !!search.value ||
    day.value != null ||
    regions.value.length > 0 ||
    fitsOnly.value ||
    menuCount.value > 0,
);
function resetFilters() {
  search.value = "";
  day.value = null;
  regions.value = [];
  maps.value = [];
  eloMin.value = "";
  eloMax.value = "";
  fitsOnly.value = false;
}
function toggle(list: typeof regions, value: string) {
  list.value = list.value.includes(value)
    ? list.value.filter((item) => item !== value)
    : [...list.value, value];
}

const mine = computed(() => mineSide(props.myTeam, props.now));

const views = computed(() => {
  const query = search.value.trim().toLowerCase();
  const [min, max] = eloBounds.value;
  return props.postings
    .filter((posting) => {
      const team = posting.team ?? {};
      const elo = team.ranks?.avg_elo ?? null;
      if (query && !(team.name ?? "").toLowerCase().includes(query)) return false;
      if (
        regions.value.length &&
        posting.regions?.length &&
        !regions.value.some((region) => posting.regions.includes(region))
      )
        return false;
      if (
        maps.value.length &&
        posting.map_ids?.length &&
        !maps.value.some((id) => posting.map_ids.includes(id))
      )
        return false;
      if (
        (min != null || max != null) &&
        (elo == null || (min != null && elo < min) || (max != null && elo > max))
      )
        return false;
      return true;
    })
    .map((posting) => ({
      posting,
      view: postingView(
        posting,
        mine.value,
        props.myTeam?.id ?? null,
        props.requests,
        props.now,
      ),
    }))
    .filter(({ view }) => !fitsOnly.value || view.status?.tone !== "bad");
});

const toneOrder: Record<string, number> = { amber: 0, ok: 1, muted: 2, bad: 3 };

const groups = computed(() => {
  const nowMs = props.now.getTime();
  const from = earliestStart(props.now);
  const byGroup = new Map<number, any[]>();
  for (const { posting, view } of views.value) {
    for (const interval of view.intervals) {
      const nowOpen = interval.start <= nowMs && interval.end > nowMs;
      const group = nowOpen ? -1 : dayOffset(interval.start, props.now);
      if (group > 6) continue;
      if (day.value != null && (nowOpen ? 0 : group) !== day.value) continue;
      const at = Math.max(ceilToStep(interval.start), from);
      if (at > interval.end) continue;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push({
        key: `${posting.id}-${interval.start}`,
        posting,
        interval,
        at,
        nowOpen,
        status: view.status,
      });
    }
  }
  for (const rows of byGroup.values()) {
    rows.sort(
      (a, b) =>
        a.interval.start - b.interval.start ||
        (toneOrder[a.status?.tone ?? "ok"] ?? 1) -
          (toneOrder[b.status?.tone ?? "ok"] ?? 1) ||
        (a.posting.team?.name ?? "").localeCompare(b.posting.team?.name ?? ""),
    );
  }
  return [...byGroup.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([group, rows]) => {
      const date = startOfDay(props.now);
      date.setDate(date.getDate() + Math.max(group, 0));
      return {
        group,
        rows,
        label:
          group === -1
            ? t("scrims.board.open_now")
            : dayLabel(date.getTime(), props.now),
        sub:
          group === -1
            ? t("scrims.board.open_now_hint")
            : group < 2
              ? fullDayLabel(date.getTime())
              : "",
      };
    });
});
</script>

<template>
  <div class="space-y-4">
    <FilterBar>
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="search"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="$t('scrims.filters.search')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="search"
            type="button"
            class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :aria-label="$t('common.clear')"
            @click="search = ''"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <Popover>
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="[filterTriggerBase, day != null ? filterTriggerActive : filterTriggerIdle]"
          >
            <Calendar class="h-3.5 w-3.5" />
            {{ day != null ? days[day].label : $t("scrims.filters.day") }}
            <ChevronDown class="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-48 p-1.5">
          <button
            v-for="option in [{ offset: null, label: $t('scrims.filters.any_day') }, ...days]"
            :key="String(option.offset)"
            type="button"
            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
            @click="day = option.offset"
          >
            <Check class="h-3.5 w-3.5" :class="day === option.offset ? 'text-[hsl(var(--tac-amber))]' : 'invisible'" />
            {{ option.label }}
          </button>
        </PopoverContent>
      </Popover>

      <Popover v-if="regionOptions.length">
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="[filterTriggerBase, regions.length ? filterTriggerActive : filterTriggerIdle]"
          >
            <Globe class="h-3.5 w-3.5" />
            {{ $t("scrims.filters.region") }}
            <span v-if="regions.length" :class="filterBadgeClasses">{{ regions.length }}</span>
            <ChevronDown class="h-3 w-3 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-56 p-1.5">
          <button
            v-for="region in regionOptions"
            :key="region"
            type="button"
            class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
            @click="toggle(regions, region)"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
              :class="regions.includes(region) ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black' : 'border-border'"
            >
              <Check v-if="regions.includes(region)" class="h-3 w-3" />
            </span>
            <span class="truncate">{{ region }}</span>
          </button>
          <p class="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">
            {{ $t("scrims.filters.regions_hint") }}
          </p>
        </PopoverContent>
      </Popover>

      <button
        v-if="myTeam"
        type="button"
        :aria-pressed="fitsOnly"
        :class="[filterTriggerBase, fitsOnly ? filterTriggerActive : filterTriggerIdle]"
        @click="fitsOnly = !fitsOnly"
      >
        <Check class="h-3.5 w-3.5" />
        <span class="max-w-[12rem] truncate">{{ $t("scrims.filters.fits", { team: myTeam.name }) }}</span>
      </button>

      <FilterMenu
        v-model:open="menuOpen"
        class="ml-auto"
        :count="menuCount"
        :active="menuCount > 0"
        :show-reset="hasFilters"
        content-class="w-[min(92vw,320px)] space-y-4 p-3"
        @reset="resetFilters"
      >
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.filters.maps") }}</span>
          <div class="max-h-56 overflow-y-auto">
            <button
              v-for="map in mapOptions"
              :key="map.id"
              type="button"
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
              @click="toggle(maps, map.id)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                :class="maps.includes(map.id) ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-black' : 'border-border'"
              >
                <Check v-if="maps.includes(map.id)" class="h-3 w-3" />
              </span>
              <img v-if="map.patch" :src="map.patch" :alt="mapLabel(map)" class="h-5 w-5 object-contain" />
              <span class="truncate">{{ mapLabel(map) }}</span>
            </button>
          </div>
        </div>
        <div class="space-y-1.5 border-t border-border/50 pt-3">
          <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.filters.elo") }}</span>
          <div class="flex items-center gap-2">
            <Input
              v-model="eloMin"
              inputmode="numeric"
              autocomplete="off"
              class="h-8 w-24 tabular-nums"
              :placeholder="$t('scrims.filters.elo_min')"
              :aria-label="$t('scrims.filters.elo_min')"
            />
            <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.to") }}</span>
            <Input
              v-model="eloMax"
              inputmode="numeric"
              autocomplete="off"
              class="h-8 w-24 tabular-nums"
              :placeholder="$t('scrims.filters.elo_max')"
              :aria-label="$t('scrims.filters.elo_max')"
            />
          </div>
          <div v-if="myTeam?.ranks?.avg_elo" class="flex flex-wrap gap-1.5 pt-1">
            <Button
              v-for="spread in [500, 1000]"
              :key="spread"
              size="sm"
              variant="outline"
              @click="
                eloMin = String(Math.max(0, Math.round(myTeam.ranks.avg_elo) - spread));
                eloMax = String(Math.round(myTeam.ranks.avg_elo) + spread);
              "
            >
              {{ $t("scrims.filters.elo_near", { n: spread.toLocaleString(), team: myTeam.name }) }}
            </Button>
          </div>
        </div>
      </FilterMenu>
    </FilterBar>

    <SectionEmpty
      v-if="!postings.length"
      :title="$t('scrims.board.empty_title')"
      :description="
        myTeam
          ? $t('scrims.board.empty_description_team', { team: myTeam.name })
          : $t('scrims.board.empty_description')
      "
    >
      <Button v-if="myTeam" variant="outline" size="sm" class="h-8" @click="emit('edit-listing')">
        {{ $t("scrims.board.edit_listing") }}
      </Button>
    </SectionEmpty>

    <SectionEmpty
      v-else-if="!groups.length"
      :title="$t('common.empty_filtered.title')"
      :description="
        fitsOnly && myTeam
          ? $t('scrims.board.filtered_fits', { team: myTeam.name })
          : $t('common.empty_filtered.description')
      "
    >
      <Button variant="outline" size="sm" class="h-8" @click="resetFilters">
        <X class="h-3.5 w-3.5" />
        {{ $t("common.reset_filters") }}
      </Button>
    </SectionEmpty>

    <div v-else class="space-y-5">
      <section v-for="group in groups" :key="group.group" :aria-label="group.label">
        <div class="sticky top-0 z-[3] flex items-baseline gap-2 bg-background px-0.5 py-2">
          <h2
            class="text-sm font-semibold"
            :class="{ 'text-[hsl(var(--tac-amber))]': group.group === -1 }"
          >
            {{ group.label }}
          </h2>
          <span v-if="group.sub" class="text-xs text-muted-foreground">{{ group.sub }}</span>
        </div>
        <div class="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card/40">
          <div
            class="hidden h-8 items-center gap-3.5 px-3.5 text-xs text-muted-foreground/80 md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_4rem_8.5rem_5.5rem] xl:grid-cols-[5.75rem_minmax(0,1fr)_8.25rem_4rem_4.5rem_8.5rem_5.5rem]"
            aria-hidden="true"
          >
            <span>{{ $t("scrims.board.col_opens") }}</span>
            <span>{{ $t("scrims.board.col_team") }}</span>
            <span class="hidden xl:block">{{ $t("scrims.board.col_maps") }}</span>
            <span>{{ $t("scrims.board.col_elo") }}</span>
            <span class="hidden xl:block">{{ $t("scrims.board.col_reliable") }}</span>
            <span>{{ myTeam ? $t("scrims.board.col_for_you") : "" }}</span>
            <span />
          </div>
          <ScrimBoardRow
            v-for="row in group.rows"
            :key="row.key"
            :posting="row.posting"
            :interval="row.interval"
            :at="row.at"
            :now-open="row.nowOpen"
            :status="row.status"
            :maps-by-id="mapsById"
            :now="now"
            @open="(at) => emit('open', row.posting, at)"
          />
        </div>
      </section>
      <p class="text-xs text-muted-foreground">{{ $t("scrims.board.times_note") }}</p>
    </div>
  </div>
</template>
