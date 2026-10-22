<script setup lang="ts">
import { computed } from "vue";
import { Check } from "lucide-vue-next";
import RegionLatency from "~/components/matchmaking/RegionLatency.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const model = defineModel<string[]>({ required: true });

const settings = useApplicationSettingsStore();
const matchmaking = useMatchmakingStore();

const ping = (value: string) => {
  const latency = Number(matchmaking.getRegionlatencyResult(value)?.latency);
  return Number.isFinite(latency) ? latency : null;
};

// Closest first; offline regions sink to the bottom.
const regions = computed(() =>
  [...(settings.availableRegions ?? [])].sort(
    (a, b) =>
      Number(a.status === "Offline") - Number(b.status === "Offline") ||
      (ping(a.value) ?? Infinity) - (ping(b.value) ?? Infinity) ||
      (a.description || a.value).localeCompare(b.description || b.value),
  ),
);

const maxLatency = computed(() => matchmaking.playerMaxAcceptableLatency);
const nearby = computed(() =>
  regions.value
    .filter((region) => {
      const latency = ping(region.value);
      return (
        region.status !== "Offline" &&
        latency != null &&
        latency <= maxLatency.value
      );
    })
    .map((region) => region.value),
);
const isNearby = computed(
  () =>
    nearby.value.length === model.value.length &&
    nearby.value.every((value) => model.value.includes(value)),
);

function toggle(value: string) {
  model.value = model.value.includes(value)
    ? model.value.filter((picked) => picked !== value)
    : [...model.value, value];
}

const box = (on: boolean) =>
  on
    ? "border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]"
    : "border-border";
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.listing.regions") }}</span>
      <button
        v-if="nearby.length && !isNearby"
        type="button"
        class="text-xs text-[hsl(var(--tac-amber))] [@media(hover:hover)]:hover:underline"
        @click="model = nearby"
      >
        {{ $t("scrims.listing.nearby", { ms: maxLatency }) }}
      </button>
    </div>
    <div class="grid divide-y divide-border overflow-hidden rounded-md border border-border">
      <button
        type="button"
        :aria-pressed="!model.length"
        class="flex min-h-10 items-center gap-2.5 px-3 text-left text-sm transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/30"
        @click="model = []"
      >
        <span class="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border" :class="box(!model.length)">
          <Check v-if="!model.length" class="h-3 w-3" :stroke-width="3" />
        </span>
        <span :class="model.length ? 'text-muted-foreground' : 'text-foreground'">
          {{ $t("scrims.board.any_region") }}
        </span>
      </button>
      <button
        v-for="region in regions"
        :key="region.value"
        type="button"
        :aria-pressed="model.includes(region.value)"
        class="flex min-h-10 items-center gap-2.5 px-3 text-left text-sm transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/30"
        @click="toggle(region.value)"
      >
        <span class="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border" :class="box(model.includes(region.value))">
          <Check v-if="model.includes(region.value)" class="h-3 w-3" :stroke-width="3" />
        </span>
        <span
          class="min-w-0 flex-1 truncate"
          :class="model.includes(region.value) ? 'text-foreground' : 'text-muted-foreground'"
        >
          {{ region.description || region.value }}
        </span>
        <span
          v-if="region.is_lan"
          class="rounded-sm border border-border px-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          {{ $t("matchmaking.where.lan") }}
        </span>
        <span v-if="region.status === 'Offline'" class="text-xs text-muted-foreground">{{ $t("common.offline") }}</span>
        <RegionLatency v-else :region="region.value" class="shrink-0" />
      </button>
    </div>
  </div>
</template>
