<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { Bell, Plus, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/toast";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import ScrimBoardRow from "~/components/scrims/ScrimBoardRow.vue";
import { useScrimClock, useScrimMaps } from "~/composables/useScrimFinder";
import { $, order_by } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import mapLabel from "~/utilities/mapLabel";
import { minutesLabel, numberLabel, weekdayName } from "~/utilities/scrimFormat";
import {
  openIntervals,
  weeklyRanges,
  windowsFromRanges,
  type DayRanges,
} from "~/utilities/scrimSchedule";

const props = defineProps<{ team: any; preview?: boolean }>();

const { t } = useI18n();
const { client } = useApolloClient();
const now = useScrimClock();
const { maps, mapsById } = useScrimMaps();
const regions = computed(
  () => useApplicationSettingsStore().availableRegions ?? [],
);

const alertsQuery = generateSubscription({
  team_scrim_alerts: [
    {
      where: { team_id: { _eq: $("teamId", "uuid!") } },
      order_by: [{ created_at: order_by.asc }],
    },
    { id: true, enabled: true },
  ],
} as any);
const alert = ref<any | null>(null);
const alertsLoaded = ref(false);
let alertSub: { unsubscribe: () => void } | null = null;
watch(
  () => props.team?.id,
  (teamId) => {
    alertSub?.unsubscribe();
    alertsLoaded.value = false;
    if (!teamId || typeof window === "undefined") return;
    alertSub = client.subscribe({ query: alertsQuery, variables: { teamId } }).subscribe({
      next: ({ data }: any) => {
        alert.value = data?.team_scrim_alerts?.[0] ?? null;
        alertsLoaded.value = true;
      },
      error: () => {
        alertsLoaded.value = true;
      },
    });
  },
  { immediate: true },
);
onBeforeUnmount(() => alertSub?.unsubscribe());

type Form = {
  open: boolean;
  ranges: DayRanges;
  outside: boolean;
  eloMin: string;
  eloMax: string;
  regions: string[];
  maps: string[];
  notes: string;
  alerts: boolean;
};
const form = reactive<Form>({
  open: false,
  ranges: Array.from({ length: 7 }, () => []),
  outside: false,
  eloMin: "",
  eloMax: "",
  regions: [],
  maps: [],
  notes: "",
  alerts: false,
});
const baseline = ref("");
const submitting = ref(false);
const dirty = computed(() => !!baseline.value && JSON.stringify(form) !== baseline.value);

function loaded(): Form {
  const settings = props.team?.scrim_settings ?? {};
  return {
    open: settings.enabled ?? false,
    ranges: weeklyRanges(props.team?.scrim_availability),
    outside: settings.allow_outside_availability ?? false,
    eloMin: settings.elo_min != null ? String(settings.elo_min) : "",
    eloMax: settings.elo_max != null ? String(settings.elo_max) : "",
    regions: [...(settings.regions ?? [])],
    maps: settings.map_ids?.length
      ? [...settings.map_ids]
      : maps.value.filter((map) => map.active_pool && map.patch).map((map) => map.id),
    notes: settings.notes ?? "",
    alerts: !!alert.value?.enabled,
  };
}
function hydrate() {
  Object.assign(form, loaded());
  baseline.value = JSON.stringify(form);
}
watch(
  () => [props.team, maps.value.length, alert.value, alertsLoaded.value],
  () => {
    if (!dirty.value && props.team && alertsLoaded.value) hydrate();
  },
  { immediate: true, deep: true },
);

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
function options(from: number, to: number) {
  const out: Array<{ value: number; label: string }> = [];
  for (let m = from; m <= to; m += 30) {
    out.push({
      value: m,
      label: m >= 1440 ? t("scrims.listing.next_day", { time: minutesLabel(m) }) : minutesLabel(m),
    });
  }
  return out;
}
function toggleDay(dow: number, open: boolean) {
  form.ranges[dow] = open ? [[20 * 60, 23 * 60]] : [];
}
function addRange(dow: number) {
  const last = form.ranges[dow][form.ranges[dow].length - 1];
  const start = Math.min(last ? last[1] + 60 : 20 * 60, 1410);
  form.ranges[dow].push([start, start + 120]);
}
function setStart(range: [number, number], value: number) {
  const length = range[1] - range[0];
  range[0] = value;
  range[1] = Math.max(value + 30, Math.min(value + length, value + 720));
}
function toggleIn(list: string[], value: string) {
  const index = list.indexOf(value);
  if (index === -1) list.push(value);
  else list.splice(index, 1);
}
const myElo = computed(() => props.team?.ranks?.avg_elo ?? null);
function near() {
  const elo = Math.round(myElo.value / 50) * 50;
  form.eloMin = String(Math.max(0, elo - 1250));
  form.eloMax = String(elo + 1250);
}
const sortedMaps = computed(() =>
  maps.value
    .filter((map) => map.patch)
    .sort((a, b) => Number(!!b.active_pool) - Number(!!a.active_pool) || mapLabel(a).localeCompare(mapLabel(b))),
);
const readElo = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
};

const previewPosting = computed(() => ({
  id: "preview",
  team_id: props.team?.id,
  regions: form.regions,
  map_ids: form.maps,
  team: { ...props.team, scrim_availability: windowsFromRanges(form.ranges) },
}));
const previewInterval = computed(
  () => openIntervals(previewPosting.value.team.scrim_availability, now.value)[0] ?? null,
);

async function save() {
  if (submitting.value) return;
  submitting.value = true;
  const teamId = props.team.id;
  let min = readElo(form.eloMin);
  let max = readElo(form.eloMax);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  try {
    await client.mutate({
      mutation: generateMutation({
        insert_team_scrim_settings_one: [
          {
            object: {
              team_id: teamId,
              enabled: form.open,
              regions: form.regions,
              map_ids: form.maps,
              notes: form.notes,
              allow_outside_availability: form.outside,
              elo_min: min,
              elo_max: max,
            },
            on_conflict: {
              constraint: "team_scrim_settings_team_id_key",
              update_columns: [
                "enabled",
                "regions",
                "map_ids",
                "notes",
                "allow_outside_availability",
                "elo_min",
                "elo_max",
              ],
            },
          },
          { id: true },
        ],
      } as any),
    });
    const before = JSON.parse(baseline.value);
    if (JSON.stringify(before.ranges) !== JSON.stringify(form.ranges)) {
      await client.mutate({
        mutation: generateMutation({
          delete_team_scrim_availability: [
            { where: { team_id: { _eq: teamId }, recurring_weekly: { _eq: true } } },
            { affected_rows: true },
          ],
        } as any),
      });
      const objects = windowsFromRanges(form.ranges).map((row) => ({ ...row, team_id: teamId }));
      if (objects.length) {
        await client.mutate({
          mutation: generateMutation({
            insert_team_scrim_availability: [{ objects }, { affected_rows: true }],
          } as any),
        });
      }
    }
    const alertFields = { enabled: form.alerts, regions: form.regions, elo_min: min, elo_max: max };
    if (alert.value) {
      await client.mutate({
        mutation: generateMutation({
          update_team_scrim_alerts_by_pk: [
            { pk_columns: { id: alert.value.id }, _set: alertFields },
            { id: true },
          ],
        } as any),
      });
    } else if (form.alerts) {
      await client.mutate({
        mutation: generateMutation({
          insert_team_scrim_alerts_one: [{ object: { team_id: teamId, ...alertFields } }, { id: true }],
        } as any),
      });
    }
    form.eloMin = min != null ? String(min) : "";
    form.eloMax = max != null ? String(max) : "";
    baseline.value = JSON.stringify(form);
    toast({ title: t("scrims.listing.saved") });
  } catch (error) {
    toast({
      title: t("scrims.toast.failed"),
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    });
  } finally {
    submitting.value = false;
  }
}
function discard() {
  hydrate();
}
</script>

<template>
  <div class="grid max-w-3xl gap-6">
    <section v-if="preview" class="grid gap-2">
      <div class="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span>{{ $t("scrims.listing.preview") }}</span>
        <span v-if="!form.open">{{ $t("scrims.listing.hidden") }}</span>
      </div>
      <div v-if="previewInterval" class="overflow-hidden rounded-lg border border-dashed border-border">
        <ScrimBoardRow
          :posting="previewPosting"
          :interval="previewInterval"
          :at="previewInterval.start"
          :now-open="previewInterval.start <= now.getTime()"
          :status="null"
          :maps-by-id="mapsById"
          :now="now"
          preview
        />
      </div>
      <p v-else class="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        {{ $t("scrims.listing.add_hours") }}
      </p>
    </section>

    <label
      class="flex cursor-pointer items-center gap-4 rounded-lg border p-3.5 transition-colors duration-150"
      :class="form.open ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.06)]' : 'border-border bg-card/40'"
    >
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="font-semibold">{{ form.open ? $t("scrims.listing.open") : $t("scrims.listing.closed") }}</span>
        <span class="text-sm text-muted-foreground">
          {{ form.open ? $t("scrims.listing.open_hint", { team: team.name }) : $t("scrims.listing.closed_hint") }}
        </span>
      </span>
      <Switch v-model="form.open" :aria-label="$t('scrims.listing.open')" />
    </label>

    <section class="grid gap-2">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold">{{ $t("scrims.listing.hours") }}</h3>
        <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.time_zone") }}</span>
      </div>
      <div class="divide-y divide-border overflow-hidden rounded-lg border border-border">
        <div
          v-for="dow in DAY_ORDER"
          :key="dow"
          class="grid min-h-11 grid-cols-[3rem_2.5rem_minmax(0,1fr)] items-center gap-2.5 px-3 py-1.5"
        >
          <span class="text-sm font-semibold">{{ weekdayName(dow) }}</span>
          <Switch
            :model-value="form.ranges[dow].length > 0"
            :aria-label="$t('scrims.listing.day_open', { day: weekdayName(dow, 'long') })"
            @update:model-value="(open: boolean) => toggleDay(dow, open)"
          />
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span v-if="!form.ranges[dow].length">{{ $t("scrims.listing.closed") }}</span>
            <span
              v-for="(range, index) in form.ranges[dow]"
              :key="index"
              class="inline-flex items-center gap-1.5"
            >
              <select
                class="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums text-foreground"
                :value="range[0]"
                :aria-label="$t('scrims.listing.starts', { day: weekdayName(dow, 'long') })"
                @change="setStart(range, Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="option in options(0, 1410)" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span>{{ $t("scrims.listing.to") }}</span>
              <select
                v-model.number="range[1]"
                class="h-8 rounded-md border border-input bg-background px-2 text-sm tabular-nums text-foreground"
                :aria-label="$t('scrims.listing.ends', { day: weekdayName(dow, 'long') })"
              >
                <option v-for="option in options(range[0] + 30, range[0] + 720)" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <Button
                v-if="form.ranges[dow].length > 1"
                variant="ghost"
                size="icon-sm"
                :aria-label="$t('scrims.listing.remove_range')"
                @click="form.ranges[dow].splice(index, 1)"
              >
                <X class="h-3.5 w-3.5" />
              </Button>
            </span>
            <button
              v-if="form.ranges[dow].length"
              type="button"
              class="inline-flex items-center gap-1 text-xs text-[hsl(var(--tac-amber))] hover:underline"
              @click="addRange(dow)"
            >
              <Plus class="h-3 w-3" />
              {{ $t("scrims.listing.add_range") }}
            </button>
          </div>
        </div>
      </div>
      <label class="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-card/40 p-3.5">
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="text-sm font-medium">{{ $t("scrims.listing.outside") }}</span>
          <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.outside_hint") }}</span>
        </span>
        <Switch v-model="form.outside" />
      </label>
    </section>

    <section class="grid gap-2">
      <h3 class="text-sm font-semibold">{{ $t("scrims.listing.opponents") }}</h3>
      <div class="flex flex-wrap items-center gap-2">
        <Input
          v-model="form.eloMin"
          inputmode="numeric"
          autocomplete="off"
          class="h-8 w-28 tabular-nums"
          :placeholder="$t('common.any')"
          :aria-label="$t('scrims.filters.elo_min')"
        />
        <span class="text-sm text-muted-foreground">{{ $t("scrims.listing.to") }}</span>
        <Input
          v-model="form.eloMax"
          inputmode="numeric"
          autocomplete="off"
          class="h-8 w-28 tabular-nums"
          :placeholder="$t('common.any')"
          :aria-label="$t('scrims.filters.elo_max')"
        />
        <Button v-if="myElo" size="sm" variant="ghost" class="text-muted-foreground" @click="near">
          {{ $t("scrims.listing.near", { n: numberLabel(1250), elo: numberLabel(myElo) }) }}
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">{{ $t("scrims.listing.elo_hint") }}</p>
    </section>

    <section class="grid gap-2">
      <h3 class="text-sm font-semibold">{{ $t("scrims.listing.regions") }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="region in regions"
          :key="region.value"
          type="button"
          :aria-pressed="form.regions.includes(region.value)"
          class="h-8 rounded-md border px-3 text-sm transition-colors duration-150"
          :class="
            form.regions.includes(region.value)
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
              : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-muted/40'
          "
          @click="toggleIn(form.regions, region.value)"
        >
          {{ region.description || region.value }}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">{{ $t("scrims.listing.regions_hint") }}</p>
    </section>

    <section class="grid gap-2">
      <h3 class="text-sm font-semibold">{{ $t("scrims.listing.maps") }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="map in sortedMaps"
          :key="map.id"
          type="button"
          :aria-pressed="form.maps.includes(map.id)"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border pl-1.5 pr-2.5 text-sm transition-colors duration-150"
          :class="
            form.maps.includes(map.id)
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
              : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-muted/40'
          "
          @click="toggleIn(form.maps, map.id)"
        >
          <img
            :src="map.patch"
            :alt="mapLabel(map)"
            class="h-5 w-5 object-contain"
            :class="{ 'opacity-45 grayscale': !form.maps.includes(map.id) }"
          />
          {{ mapLabel(map) }}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">{{ $t("scrims.listing.maps_hint") }}</p>
    </section>

    <section class="grid gap-2">
      <label for="scrim-listing-notes" class="text-sm font-semibold">{{ $t("scrims.listing.note") }}</label>
      <Textarea
        id="scrim-listing-notes"
        v-model="form.notes"
        maxlength="280"
        :placeholder="$t('scrims.listing.note_placeholder')"
      />
      <span class="justify-self-end text-xs tabular-nums text-muted-foreground">{{ form.notes.length }}/280</span>
    </section>

    <label
      class="flex cursor-pointer items-center gap-4 rounded-lg border p-3.5 transition-colors duration-150"
      :class="form.alerts ? 'border-[hsl(var(--tac-amber)/0.45)]' : 'border-border bg-card/40'"
    >
      <Bell class="h-4 w-4 shrink-0 text-muted-foreground" />
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="text-sm font-medium">{{ $t("scrims.listing.alerts") }}</span>
        <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.alerts_hint") }}</span>
      </span>
      <Switch v-model="form.alerts" />
    </label>

    <SettingsSaveBar
      :dirty="dirty"
      :submitting="submitting"
      :action-label="$t('scrims.listing.save')"
      @save="save"
      @discard="discard"
    />
  </div>
</template>
