<script setup lang="ts">
import { ref, computed } from "vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { CalendarClock, Calendar as CalendarIcon } from "lucide-vue-next";
import {
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
  type DateValue,
} from "@internationalized/date";

const props = defineProps<{
  weekOpensAt: string;
  weekClosesAt: string;
  /** Day pre-selected by clicking a calendar cell. */
  initialDate?: string | null;
  /** The week's default match time, so the form opens on the league's night. */
  defaultTime?: string | null;
  /** e.g. "vs Nightfall" — what the captain is actually scheduling. */
  matchup?: string | null;
  /** e.g. "Season 1 · Week 5". */
  scope?: string | null;
}>();

const emit = defineEmits<{
  (e: "submit", proposedTime: string, message: string): void;
  (e: "cancel"): void;
}>();

// Mounted fresh for each fixture (callers `v-if` on the target), so the seed is
// a plain initializer rather than a watcher.
const date = ref<DateValue | undefined>(
  props.initialDate
    ? toCalendarDate(fromDate(new Date(props.initialDate), getLocalTimeZone()))
    : undefined,
);
const time = ref(props.defaultTime ?? "21:00");
const message = ref("");

const windowStart = computed(() => new Date(props.weekOpensAt));
const windowEnd = computed(() => new Date(props.weekClosesAt));

function isDateDisabled(value: DateValue) {
  const day = value.toDate(getLocalTimeZone());
  const endOfDay = new Date(day);
  endOfDay.setHours(23, 59, 59, 999);
  return (
    endOfDay < windowStart.value ||
    day > windowEnd.value ||
    endOfDay < new Date()
  );
}

const proposedTime = computed<Date | null>(() => {
  if (!date.value || !time.value) {
    return null;
  }
  const [hours, minutes] = time.value.split(":").map(Number);
  const result = date.value.toDate(getLocalTimeZone());
  result.setHours(hours, minutes, 0, 0);
  return result;
});

const isValid = computed(
  () =>
    proposedTime.value !== null &&
    proposedTime.value >= windowStart.value &&
    proposedTime.value <= windowEnd.value &&
    proposedTime.value > new Date(),
);

function submit() {
  if (!proposedTime.value || !isValid.value) {
    return;
  }
  emit("submit", proposedTime.value.toISOString(), message.value);
}

function formatDay(value: DateValue | undefined) {
  return value
    ? value.toDate(getLocalTimeZone()).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
}

function formatBound(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-3">
    <!-- What you're scheduling -->
    <div v-if="matchup || scope">
      <p v-if="matchup" class="text-sm font-semibold">{{ matchup }}</p>
      <p
        v-if="scope"
        class="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        {{ scope }}
      </p>
    </div>

    <p class="text-xs text-muted-foreground">
      {{
        $t("league.schedule.propose_description", {
          from: formatBound(weekOpensAt),
          to: formatBound(weekClosesAt),
        })
      }}
    </p>

    <div class="flex items-center gap-2">
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            class="flex-1 justify-start text-left font-normal"
            :class="{ 'text-muted-foreground': !date }"
          >
            <CalendarIcon class="mr-2 h-4 w-4" />
            {{ formatDay(date) || $t("common.pick_date") }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0">
          <Calendar
            v-model="date"
            :is-date-disabled="isDateDisabled"
            initial-focus
          />
        </PopoverContent>
      </Popover>
      <Input
        v-model="time"
        type="time"
        style="color-scheme: dark"
        class="w-[120px]"
      />
    </div>

    <Input
      v-model="message"
      :placeholder="$t('league.schedule.message_placeholder')"
    />

    <p v-if="date && !isValid" class="text-sm text-destructive">
      {{ $t("league.schedule.outside_window") }}
    </p>

    <div class="flex items-center justify-end gap-2 pt-1">
      <Button variant="outline" size="sm" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </Button>
      <Button
        size="sm"
        class="tac-amber-cta gap-1.5 font-bold uppercase tracking-[0.14em]"
        :disabled="!isValid"
        @click="submit"
      >
        <CalendarClock class="h-3.5 w-3.5" />
        {{ $t("league.schedule.propose") }}
      </Button>
    </div>
  </div>
</template>
