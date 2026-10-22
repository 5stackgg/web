<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import ScrollArrows from "~/components/common/ScrollArrows.vue";
import ScrimStatusTag from "~/components/scrims/ScrimStatusTag.vue";
import { awaitingTeam, scrimOpponent } from "~/composables/useScrimFinder";
import teamAvatarSrc from "~/utilities/teamAvatar";
import {
  rangeLabel,
  shortDateLabel,
  timeLabel,
  weekdayLabel,
} from "~/utilities/scrimFormat";
import type { ScrimTone } from "~/utilities/scrimPosting";
import {
  WEEK_DAYS,
  dayOffset,
  openIntervals,
  startOfDay,
} from "~/utilities/scrimSchedule";

const props = defineProps<{ team: any; requests: any[]; now: Date }>();
const emit = defineEmits<{ (e: "focus", requestId: string): void }>();

const { t } = useI18n();
const scrollRow = ref<InstanceType<typeof HorizontalScrollRow> | null>(null);

function status(request: any): { tone: ScrimTone; label: string } {
  if (request.status === "Matched") {
    return { tone: "ok", label: t("scrims.requests.booked") };
  }
  return awaitingTeam(request, props.team.id)
    ? { tone: "amber", label: t("scrims.status.needs_you") }
    : { tone: "muted", label: t("scrims.status.requested") };
}

// The next seven days: your open hours as a strip, and every request on the
// day it's proposed for.
const days = computed(() => {
  const intervals = openIntervals(props.team?.scrim_availability, props.now);
  return Array.from({ length: WEEK_DAYS }, (_, offset) => {
    const start = startOfDay(props.now);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const from = start.getTime();
    const to = end.getTime();
    const hours = intervals
      .filter((interval) => interval.start < to && interval.end > from)
      .map((interval) => {
        const a = Math.max(interval.start, from);
        const b = Math.min(interval.end, to);
        return {
          left: `${((a - from) / (to - from)) * 100}%`,
          width: `${((b - a) / (to - from)) * 100}%`,
          label: rangeLabel(a, b),
        };
      });
    const items = props.requests
      .map((request) => ({
        request,
        at: new Date(request.proposed_scheduled_at).getTime(),
      }))
      .filter(({ at }) => dayOffset(at, props.now) === offset)
      .map(({ request, at }) => ({
        id: request.id,
        time: timeLabel(at),
        bestOf: request.match_options?.best_of ?? 1,
        opponent: scrimOpponent(request, props.team.id) ?? {},
        ...status(request),
      }));
    return {
      key: from,
      label: weekdayLabel(from, props.now),
      date: shortDateLabel(from),
      today: offset === 0,
      hours,
      items,
    };
  });
});
</script>

<template>
  <section class="grid gap-2">
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{{ $t("scrims.week.title") }}</h3>
      <div class="flex items-center gap-3">
        <slot name="actions" />
        <ScrollArrows
          :can-left="scrollRow?.state.canScrollLeft"
          :can-right="scrollRow?.state.canScrollRight"
          @scroll="(direction) => scrollRow?.scrollByDirection(direction)"
        />
      </div>
    </div>
    <HorizontalScrollRow ref="scrollRow">
      <div
        v-for="day in days"
        :key="day.key"
        class="flex min-h-[10rem] w-[10.5rem] shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card/30 p-2.5 lg:w-auto lg:min-w-[8.5rem] lg:flex-1 lg:basis-0"
        :class="day.today ? 'border-[hsl(var(--tac-amber)/0.35)]' : 'border-border'"
      >
        <div class="flex items-baseline justify-between gap-1.5">
          <span class="text-sm font-semibold" :class="{ 'text-[hsl(var(--tac-amber))]': day.today }">
            {{ day.label }}
          </span>
          <span class="text-xs tabular-nums text-muted-foreground">{{ day.date }}</span>
        </div>
        <div class="grid gap-1">
          <div class="relative h-1 overflow-hidden rounded-full bg-muted/40">
            <span
              v-for="(hour, index) in day.hours"
              :key="index"
              class="absolute inset-y-0 rounded-full bg-[hsl(var(--tac-amber)/0.85)]"
              :style="{ left: hour.left, width: hour.width }"
            />
          </div>
          <span class="truncate text-[0.7rem] tabular-nums text-muted-foreground">
            {{ day.hours.length ? day.hours.map((hour) => hour.label).join(", ") : $t("scrims.week.no_hours") }}
          </span>
        </div>
        <button
          v-for="item in day.items"
          :key="item.id"
          type="button"
          class="grid gap-1.5 rounded-md border bg-card/60 p-2 text-left transition-colors duration-150"
          :class="
            item.tone === 'amber'
              ? 'border-[hsl(var(--tac-amber)/0.45)] [@media(hover:hover)]:hover:border-[hsl(var(--tac-amber)/0.7)]'
              : 'border-border [@media(hover:hover)]:hover:border-muted-foreground/50'
          "
          @click="emit('focus', item.id)"
        >
          <span class="flex items-baseline justify-between gap-1.5">
            <span class="text-sm font-semibold tabular-nums">{{ item.time }}</span>
            <span class="text-[0.7rem] text-muted-foreground">{{ $t("scrims.form.best_of", { n: item.bestOf }) }}</span>
          </span>
          <span class="flex min-w-0 items-center gap-1.5">
            <Avatar shape="square" class="h-5 w-5 shrink-0 rounded">
              <AvatarImage
                v-if="teamAvatarSrc(item.opponent)"
                :src="teamAvatarSrc(item.opponent)!"
                :alt="item.opponent.name"
              />
              <AvatarFallback class="rounded text-[0.5rem] font-semibold uppercase">
                {{ (item.opponent.name || "?").slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <span class="truncate text-xs font-medium">{{ item.opponent.name }}</span>
          </span>
          <ScrimStatusTag :tone="item.tone" class="justify-self-start">{{ item.label }}</ScrimStatusTag>
        </button>
      </div>
    </HorizontalScrollRow>
  </section>
</template>
