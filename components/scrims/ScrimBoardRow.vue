<script setup lang="ts">
import { computed } from "vue";
import { Send } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import ScrimStatusTag from "~/components/scrims/ScrimStatusTag.vue";
import mapLabel from "~/utilities/mapLabel";
import teamAvatarSrc from "~/utilities/teamAvatar";
import { numberLabel, rangeLabel, timeLabel, dayLabel } from "~/utilities/scrimFormat";
import type { OpenInterval } from "~/utilities/scrimSchedule";
import type { ScrimStatus } from "~/utilities/scrimPosting";

const props = defineProps<{
  posting: any;
  interval: OpenInterval;
  at: number;
  nowOpen: boolean;
  status: ScrimStatus | null;
  mapsById: Record<string, any>;
  now: Date;
  preview?: boolean;
}>();

const emit = defineEmits<{ (e: "open", at: number): void }>();

const team = computed(() => props.posting.team ?? {});
const maps = computed(() =>
  (props.posting.map_ids ?? [])
    .map((id: string) => props.mapsById[id])
    .filter((map: any) => map?.patch),
);
const reputation = computed(() => team.value.reputation ?? null);
const blocked = computed(
  () => props.status?.tone === "bad" || props.status?.key === "you_are_booked",
);
const requested = computed(() =>
  ["needs_you", "requested", "booked"].includes(props.status?.key ?? ""),
);
const label = computed(() =>
  props.nowOpen
    ? `${team.value.name}, ${timeLabel(props.at)}`
    : `${team.value.name}, ${dayLabel(props.interval.start, props.now)} ${rangeLabel(props.interval.start, props.interval.end)}`,
);
</script>

<template>
  <div
    class="relative grid min-h-[3.75rem] grid-cols-[4.75rem_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-2.5 transition-colors duration-150 md:grid-cols-[5.5rem_minmax(0,1fr)_4rem_8.5rem_5.5rem] md:items-center md:gap-3.5 md:px-3.5 xl:grid-cols-[5.75rem_minmax(0,1fr)_8.25rem_4rem_4.5rem_8.5rem_5.5rem] [@media(hover:hover)]:hover:bg-muted/20"
  >
    <button
      v-if="!preview"
      type="button"
      class="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
      :aria-label="label"
      @click="emit('open', at)"
    />

    <div
      class="grid gap-px leading-tight"
      :class="{ 'opacity-55': blocked }"
    >
      <span
        class="whitespace-nowrap text-sm font-semibold tabular-nums md:text-[0.95rem]"
        :class="{ 'text-[hsl(var(--tac-amber))]': nowOpen }"
      >
        {{ nowOpen ? $t("scrims.board.now") : timeLabel(interval.start) }}
      </span>
      <span class="whitespace-nowrap text-[0.7rem] tabular-nums text-muted-foreground/80 md:text-xs">
        {{
          nowOpen
            ? $t("scrims.board.until", { time: timeLabel(interval.end) })
            : $t("scrims.board.to", { time: timeLabel(interval.end) })
        }}
      </span>
    </div>

    <div class="flex min-w-0 items-center gap-2.5" :class="{ 'opacity-55': blocked }">
      <Avatar shape="square" class="hidden h-8 w-8 shrink-0 rounded-md md:flex">
        <AvatarImage
          v-if="teamAvatarSrc(team)"
          :src="teamAvatarSrc(team)!"
          :alt="team.name"
        />
        <AvatarFallback class="rounded-md text-[0.65rem] font-semibold uppercase">
          {{ (team.name || "?").slice(0, 2) }}
        </AvatarFallback>
      </Avatar>
      <div class="grid min-w-0 gap-px">
        <span class="truncate font-semibold">{{ team.name }}</span>
        <span class="hidden truncate text-xs text-muted-foreground md:block">
          {{ posting.regions?.length ? posting.regions.join(", ") : $t("scrims.board.any_region") }}
        </span>
        <div
          class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground md:mt-0.5 xl:hidden"
        >
          <ScrimStatusTag v-if="status" :tone="status.tone" class="md:hidden">
            {{ $t(`scrims.status.${status.key}`, { time: status.at ? timeLabel(status.at) : "" }) }}
          </ScrimStatusTag>
          <span class="tabular-nums md:hidden">
            {{ $t("scrims.board.elo_value", { elo: numberLabel(team.ranks?.avg_elo) }) }}
          </span>
          <span class="tabular-nums">
            {{
              reputation?.reliability_pct != null
                ? $t("scrims.board.reliable", { pct: reputation.reliability_pct })
                : $t("scrims.board.new_team")
            }}
          </span>
          <span v-if="maps.length" class="flex items-center gap-0.5">
            <img
              v-for="map in maps.slice(0, 4)"
              :key="map.id"
              :src="map.patch"
              :alt="mapLabel(map)"
              :title="mapLabel(map)"
              class="h-4 w-4 object-contain"
            />
            <span v-if="maps.length > 4" class="ml-0.5 text-[0.7rem]">+{{ maps.length - 4 }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="hidden items-center gap-0.5 xl:flex" :class="{ 'opacity-55': blocked }">
      <template v-if="maps.length">
        <img
          v-for="map in maps.slice(0, 5)"
          :key="map.id"
          :src="map.patch"
          :alt="mapLabel(map)"
          :title="mapLabel(map)"
          class="h-5 w-5 object-contain"
        />
        <span v-if="maps.length > 5" class="ml-0.5 text-xs text-muted-foreground">+{{ maps.length - 5 }}</span>
      </template>
      <span v-else class="text-xs text-muted-foreground">{{ $t("scrims.board.any_map") }}</span>
    </div>

    <div class="hidden text-sm tabular-nums md:block" :class="{ 'opacity-55': blocked }">
      {{ numberLabel(team.ranks?.avg_elo) }}
    </div>

    <div class="hidden text-sm tabular-nums xl:block" :class="{ 'opacity-55': blocked }">
      <template v-if="reputation?.reliability_pct != null">
        {{ reputation.reliability_pct }}%
        <span class="block text-[0.7rem] text-muted-foreground">
          {{ $t("scrims.board.played", { count: reputation.scrims_completed ?? 0 }) }}
        </span>
      </template>
      <span v-else class="text-xs text-muted-foreground">{{ $t("scrims.board.new") }}</span>
    </div>

    <div class="hidden md:block">
      <ScrimStatusTag v-if="preview" tone="muted">{{ $t("scrims.board.your_team") }}</ScrimStatusTag>
      <ScrimStatusTag v-else-if="status" :tone="status.tone">
        {{ $t(`scrims.status.${status.key}`, { time: status.at ? timeLabel(status.at) : "" }) }}
      </ScrimStatusTag>
    </div>

    <div class="relative z-[2] justify-self-end">
      <Button
        v-if="!preview && requested"
        size="sm"
        variant="outline"
        class="h-10 md:h-8"
        @click="emit('open', at)"
      >
        {{ status?.key === "needs_you" ? $t("scrims.board.answer") : $t("scrims.board.view") }}
      </Button>
      <Button
        v-else-if="!preview && !blocked"
        size="sm"
        variant="secondary"
        class="h-10 w-11 gap-1.5 px-0 md:h-8 md:w-auto md:px-3"
        :aria-label="$t('scrims.board.request_at', { team: team.name, time: timeLabel(at) })"
        @click="emit('open', at)"
      >
        <Send class="h-3.5 w-3.5" />
        <span class="hidden md:inline">{{ $t("scrims.board.request") }}</span>
      </Button>
    </div>
  </div>
</template>
