<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { Check } from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/toast";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import ScrimHoursGrid from "~/components/scrims/ScrimHoursGrid.vue";
import ScrimRegionPicker from "~/components/scrims/ScrimRegionPicker.vue";
import { useScrimClock, useScrimMaps } from "~/composables/useScrimFinder";
import { $, order_by } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import mapLabel from "~/utilities/mapLabel";
import teamAvatarSrc from "~/utilities/teamAvatar";
import { dayLabel, numberLabel, rangeLabel } from "~/utilities/scrimFormat";
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
const mapGroups = computed(() => {
  const sorted = [...maps.value].sort((a, b) => mapLabel(a).localeCompare(mapLabel(b)));
  return [
    { key: "active_duty", maps: sorted.filter((map) => map.active_pool) },
    { key: "official", maps: sorted.filter((map) => !map.active_pool && !map.workshop_map_id) },
    { key: "workshop", maps: sorted.filter((map) => !map.active_pool && map.workshop_map_id) },
  ].filter((group) => group.maps.length);
});
function pickedIn(group: { maps: any[] }) {
  return group.maps.filter((map) => form.maps.includes(map.id)).length;
}
function setGroup(group: { maps: any[] }, on: boolean) {
  const ids = group.maps.map((map) => map.id);
  form.maps = on
    ? [...new Set([...form.maps, ...ids])]
    : form.maps.filter((id) => !ids.includes(id));
}
const readElo = (value: string) => {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
};

const showWorkshop = ref(false);

const previewInterval = computed(
  () => openIntervals(windowsFromRanges(form.ranges), now.value)[0] ?? null,
);
const previewMaps = computed(() =>
  form.maps.map((id) => mapsById.value[id]).filter((map) => map?.patch),
);
const regionLine = computed(() =>
  form.regions.length
    ? form.regions
        .map((value) => {
          const region = regions.value.find((item) => item.value === value);
          return region?.description || value;
        })
        .join(", ")
    : t("scrims.board.any_region"),
);
const reliability = computed(() => {
  const pct = props.team?.reputation?.reliability_pct;
  return pct != null ? t("scrims.board.reliable", { pct }) : t("scrims.board.new");
});

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
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
    <aside
      class="grid min-w-0 rounded-lg border bg-card/30 transition-colors duration-150 lg:col-start-2 lg:row-start-1"
      :class="form.open ? 'border-[hsl(var(--tac-amber)/0.4)]' : 'border-border'"
    >
      <label class="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="font-semibold" :class="{ 'text-[hsl(var(--tac-amber))]': form.open }">
            {{ form.open ? $t("scrims.listing.open") : $t("scrims.listing.closed") }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ form.open ? $t("scrims.listing.open_hint", { team: team.name }) : $t("scrims.listing.closed_hint") }}
          </span>
        </span>
        <Switch v-model="form.open" :aria-label="$t('scrims.listing.open')" />
      </label>

      <div v-if="preview" class="grid gap-2 border-t border-border px-4 py-3.5">
        <div class="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>{{ $t("scrims.listing.preview") }}</span>
          <span v-if="!form.open">{{ $t("scrims.listing.hidden") }}</span>
        </div>
        <div
          class="grid gap-2 rounded-md border border-dashed border-border px-3 py-2.5 transition-opacity duration-150"
          :class="{ 'opacity-60': !form.open }"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <Avatar shape="square" class="h-8 w-8 shrink-0 rounded-md">
              <AvatarImage v-if="teamAvatarSrc(team)" :src="teamAvatarSrc(team)!" :alt="team.name" />
              <AvatarFallback class="rounded-md text-[0.65rem] font-semibold uppercase">
                {{ (team.name || "?").slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <span class="grid min-w-0 flex-1 gap-px leading-tight">
              <span class="truncate font-semibold">{{ team.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ regionLine }}</span>
            </span>
            <span
              v-if="previewInterval"
              class="grid shrink-0 justify-items-end gap-px text-right leading-tight tabular-nums"
            >
              <span class="text-sm font-semibold">{{ dayLabel(previewInterval.start, now) }}</span>
              <span class="text-xs text-muted-foreground">
                {{ rangeLabel(previewInterval.start, previewInterval.end) }}
              </span>
            </span>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span v-if="previewMaps.length" class="flex items-center gap-0.5">
              <img
                v-for="map in previewMaps.slice(0, 5)"
                :key="map.id"
                :src="map.patch"
                :alt="mapLabel(map)"
                class="h-[18px] w-[18px] object-contain"
              />
              <span v-if="form.maps.length > 5" class="ml-0.5">+{{ form.maps.length - 5 }}</span>
            </span>
            <span v-else>{{ $t("scrims.board.any_map") }}</span>
            <span class="ml-auto tabular-nums text-foreground">{{ numberLabel(team.ranks?.avg_elo) }}</span>
            <span>{{ reliability }}</span>
          </div>
        </div>
        <p v-if="!previewInterval" class="text-xs text-muted-foreground">{{ $t("scrims.listing.add_hours") }}</p>
      </div>

      <div class="grid gap-2 border-t border-border px-4 py-3.5">
        <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.listing.opponents") }}</span>
        <div class="flex items-center gap-2">
          <Input
            v-model="form.eloMin"
            inputmode="numeric"
            autocomplete="off"
            class="h-8 min-w-0 flex-1 tabular-nums"
            :placeholder="$t('common.any')"
            :aria-label="$t('scrims.filters.elo_min')"
          />
          <span class="text-sm text-muted-foreground">{{ $t("scrims.listing.to") }}</span>
          <Input
            v-model="form.eloMax"
            inputmode="numeric"
            autocomplete="off"
            class="h-8 min-w-0 flex-1 tabular-nums"
            :placeholder="$t('common.any')"
            :aria-label="$t('scrims.filters.elo_max')"
          />
        </div>
        <button
          v-if="myElo"
          type="button"
          class="justify-self-start text-xs text-[hsl(var(--tac-amber))] [@media(hover:hover)]:hover:underline"
          @click="near"
        >
          {{ $t("scrims.listing.near", { n: numberLabel(1250), elo: numberLabel(myElo) }) }}
        </button>
      </div>

      <div class="border-t border-border px-4 py-3.5">
        <ScrimRegionPicker v-model="form.regions" />
      </div>

      <div class="grid gap-2 border-t border-border px-4 py-3.5">
        <label for="scrim-listing-notes" class="text-xs font-medium text-muted-foreground">
          {{ $t("scrims.listing.note") }}
        </label>
        <Textarea
          id="scrim-listing-notes"
          v-model="form.notes"
          rows="3"
          maxlength="280"
          :placeholder="$t('scrims.listing.note_placeholder')"
        />
        <span v-if="form.notes.length > 240" class="justify-self-end text-xs tabular-nums text-muted-foreground">
          {{ form.notes.length }}/280
        </span>
      </div>

      <div class="grid border-t border-border px-4 py-1.5">
        <label class="flex min-h-11 cursor-pointer items-center gap-3">
          <span class="flex-1 text-sm">{{ $t("scrims.listing.outside") }}</span>
          <Switch v-model="form.outside" />
        </label>
        <label class="flex min-h-11 cursor-pointer items-center gap-3">
          <span class="flex-1 text-sm">{{ $t("scrims.listing.alerts") }}</span>
          <Switch v-model="form.alerts" />
        </label>
      </div>
    </aside>

    <div class="grid min-w-0 grid-cols-1 gap-8 lg:col-start-1 lg:row-start-1">
      <section class="grid grid-cols-1 gap-2.5">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold">{{ $t("scrims.listing.hours") }}</h3>
          <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.time_zone") }}</span>
        </div>
        <ScrimHoursGrid v-model="form.ranges" />
      </section>

      <section class="grid grid-cols-1 gap-4">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 class="text-sm font-semibold">{{ $t("scrims.listing.maps") }}</h3>
          <span class="text-xs text-muted-foreground">{{ $t("scrims.listing.maps_hint") }}</span>
        </div>
        <div v-for="group in mapGroups" :key="group.key" class="grid gap-2">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-medium">{{ $t(`maps.${group.key}`) }}</span>
            <span class="tabular-nums text-muted-foreground">{{ pickedIn(group) }}/{{ group.maps.length }}</span>
            <button
              v-if="group.key === 'workshop'"
              type="button"
              class="text-[hsl(var(--tac-amber))] [@media(hover:hover)]:hover:underline"
              :aria-expanded="showWorkshop"
              @click="showWorkshop = !showWorkshop"
            >
              {{ showWorkshop ? $t("scrims.listing.show_less") : $t("common.see_all") }}
            </button>
            <button
              v-else
              type="button"
              class="text-[hsl(var(--tac-amber))] [@media(hover:hover)]:hover:underline"
              @click="setGroup(group, pickedIn(group) < group.maps.length)"
            >
              {{ pickedIn(group) < group.maps.length ? $t("common.all") : $t("common.none") }}
            </button>
          </div>
          <div
            v-if="group.key === 'active_duty'"
            class="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2"
          >
            <button
              v-for="map in group.maps"
              :key="map.id"
              type="button"
              :aria-pressed="form.maps.includes(map.id)"
              :aria-label="mapLabel(map)"
              class="relative aspect-[16/10] overflow-hidden rounded-lg border bg-card transition-colors duration-150"
              :class="
                form.maps.includes(map.id)
                  ? 'border-[hsl(var(--tac-amber)/0.7)]'
                  : 'border-border [@media(hover:hover)]:hover:border-muted-foreground/50'
              "
              @click="toggleIn(form.maps, map.id)"
            >
              <NuxtImg
                v-if="map.poster"
                :src="map.poster"
                sizes="240px"
                alt=""
                class="absolute inset-0 h-full w-full object-cover transition-[filter] duration-150"
                :class="{ 'grayscale-[0.85]': !form.maps.includes(map.id) }"
              />
              <span
                class="absolute inset-0 transition-colors duration-150"
                :class="
                  form.maps.includes(map.id)
                    ? 'bg-gradient-to-t from-background/85 to-background/20'
                    : 'bg-background/70'
                "
              />
              <img
                v-if="map.patch"
                :src="map.patch"
                alt=""
                class="absolute left-1/2 top-[42%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 object-contain"
                :class="{ 'opacity-50': !form.maps.includes(map.id) }"
              />
              <span
                class="absolute inset-x-2 bottom-1.5 truncate text-left text-xs font-semibold"
                :class="form.maps.includes(map.id) ? 'text-foreground' : 'text-muted-foreground'"
              >
                {{ mapLabel(map) }}
              </span>
              <span
                v-if="form.maps.includes(map.id)"
                class="absolute right-1.5 top-1.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]"
              >
                <Check class="h-3 w-3" :stroke-width="3" />
              </span>
            </button>
          </div>
          <div v-else-if="group.key !== 'workshop' || showWorkshop" class="flex flex-wrap gap-1.5">
            <button
              v-for="map in group.maps"
              :key="map.id"
              type="button"
              :aria-pressed="form.maps.includes(map.id)"
              class="inline-flex h-8 items-center gap-1.5 rounded-md border pr-2.5 text-sm transition-colors duration-150"
              :class="[
                form.maps.includes(map.id)
                  ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
                  : 'border-border text-muted-foreground [@media(hover:hover)]:hover:bg-muted/40',
                map.patch ? 'pl-1.5' : 'pl-2.5',
              ]"
              @click="toggleIn(form.maps, map.id)"
            >
              <img
                v-if="map.patch"
                :src="map.patch"
                :alt="mapLabel(map)"
                class="h-5 w-5 object-contain"
                :class="{ 'opacity-45 grayscale': !form.maps.includes(map.id) }"
              />
              {{ mapLabel(map) }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <SettingsSaveBar
      :dirty="dirty"
      :submitting="submitting"
      :action-label="$t('scrims.listing.save')"
      @save="save"
      @discard="discard"
    />
  </div>
</template>
