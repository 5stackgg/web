<script setup lang="ts">
import { computed } from "vue";
import { timeLabel, weekdayLabel } from "~/utilities/scrimFormat";
import {
  covers,
  startOfDay,
  startsOn,
  WEEK_DAYS,
  type OpenInterval,
} from "~/utilities/scrimSchedule";
import { dateLocale } from "~/utilities/dateLocale";

const props = defineProps<{
  intervals: OpenInterval[];
  mine?: OpenInterval[] | null;
  minutes: number;
  now: Date;
  bothLabel?: string;
}>();

const day = defineModel<number>("day", { required: true });
const start = defineModel<number | null>("start", { required: true });

const days = computed(() =>
  Array.from({ length: WEEK_DAYS }, (_, offset) => {
    const date = startOfDay(props.now);
    date.setDate(date.getDate() + offset);
    const starts = startsOn(props.intervals, date, props.minutes, props.now);
    return {
      offset,
      name: weekdayLabel(date.getTime(), props.now),
      date: date.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }),
      open: starts.length > 0,
      both: !!props.mine && starts.some((t) => covers(props.mine!, t, props.minutes)),
    };
  }),
);

const starts = computed(() => {
  const date = startOfDay(props.now);
  date.setDate(date.getDate() + day.value);
  return startsOn(props.intervals, date, props.minutes, props.now).map((t) => ({
    t,
    both: !!props.mine && covers(props.mine, t, props.minutes),
  }));
});

function pickDay(offset: number) {
  day.value = offset;
  const date = startOfDay(props.now);
  date.setDate(date.getDate() + offset);
  const list = startsOn(props.intervals, date, props.minutes, props.now);
  start.value =
    list.find((t) => props.mine && covers(props.mine, t, props.minutes)) ??
    list[0] ??
    null;
}
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.form.day") }}</span>
        <span v-if="mine && bothLabel" class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
          {{ bothLabel }}
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('scrims.form.day')">
        <button
          v-for="option in days"
          :key="option.offset"
          type="button"
          :disabled="!option.open"
          :aria-pressed="day === option.offset"
          class="relative grid min-w-[3.5rem] justify-items-center rounded-md border px-3 py-1 text-xs leading-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground/60"
          :class="
            day === option.offset
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-foreground'
              : 'border-border [@media(hover:hover)]:hover:bg-muted/40'
          "
          @click="pickDay(option.offset)"
        >
          <span class="text-[0.8rem] font-semibold">{{ option.name }}</span>
          <span
            class="text-[0.7rem]"
            :class="day === option.offset ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'"
          >
            {{ option.open ? option.date : $t("scrims.form.closed") }}
          </span>
          <span
            v-if="option.both"
            class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-green-400"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.form.start") }}</span>
      <div v-if="starts.length" class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('scrims.form.start')">
        <button
          v-for="option in starts"
          :key="option.t"
          type="button"
          :aria-pressed="start === option.t"
          class="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm tabular-nums transition-colors duration-150"
          :class="
            start === option.t
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-foreground'
              : 'border-border [@media(hover:hover)]:hover:bg-muted/40'
          "
          @click="start = option.t"
        >
          <span v-if="option.both" class="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true" />
          {{ timeLabel(option.t) }}
        </button>
      </div>
      <p v-else class="text-xs text-muted-foreground">
        {{ $t("scrims.form.no_start", { hours: minutes / 60 }) }}
      </p>
    </div>
  </div>
</template>
