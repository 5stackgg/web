<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { CalendarClock, Map as MapIcon, Send } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import ScrimTimeChips from "~/components/scrims/ScrimTimeChips.vue";
import ScrimStatusTag from "~/components/scrims/ScrimStatusTag.vue";
import { useScrimActions } from "~/composables/useScrimFinder";
import { fullDayLabel, rangeLabel, dayLabel } from "~/utilities/scrimFormat";
import {
  covers,
  dayOffset,
  earliestStart,
  firstStart,
  openIntervals,
  seriesMinutes,
  startOfDay,
  startsOn,
} from "~/utilities/scrimSchedule";

const props = defineProps<{
  posting: any;
  team: any;
  now: Date;
  initialAt?: number | null;
}>();

const emit = defineEmits<{ (e: "sent"): void }>();

const { t } = useI18n();
const actions = useScrimActions();

const theirs = computed(() => openIntervals(props.posting.team?.scrim_availability, props.now));
const mine = computed(() => openIntervals(props.team?.scrim_availability, props.now));
const opponentName = computed(() => props.posting.team?.name ?? "");

const bestOf = ref(1);
const minutes = computed(() => seriesMinutes(bestOf.value));
const day = ref(0);
const start = ref<number | null>(null);
const other = ref(false);
const otherDay = ref("0");
const otherTime = ref("21:00");
const sending = ref(false);

function place(at: number | null | undefined) {
  const valid =
    at != null && at >= earliestStart(props.now) && covers(theirs.value, at, minutes.value);
  const next = valid
    ? at!
    : (firstStart(theirs.value, minutes.value, props.now, mine.value) ??
      firstStart(theirs.value, minutes.value, props.now));
  start.value = next;
  day.value = next != null ? dayOffset(next, props.now) : 0;
}
place(props.initialAt);
watch(
  () => [props.posting?.id, props.initialAt],
  () => {
    bestOf.value = 1;
    other.value = false;
    place(props.initialAt);
  },
);

const seriesOptions = computed(() =>
  [1, 3, 5].map((value) => ({
    value,
    fits:
      other.value ||
      firstStart(theirs.value, seriesMinutes(value), props.now) != null,
  })),
);
const unfit = computed(() =>
  seriesOptions.value.filter((option) => !option.fits).map((option) => option.value),
);

function pickSeries(value: number) {
  bestOf.value = value;
  if (other.value) return;
  const date = startOfDay(props.now);
  date.setDate(date.getDate() + day.value);
  const list = startsOn(theirs.value, date, seriesMinutes(value), props.now);
  if (start.value != null && list.includes(start.value)) return;
  place(list.find((at) => covers(mine.value, at, seriesMinutes(value))) ?? list[0] ?? null);
}

const otherAt = computed(() => {
  const [h, m] = otherTime.value.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  const date = startOfDay(props.now);
  date.setDate(date.getDate() + Number(otherDay.value));
  date.setHours(h, m || 0, 0, 0);
  return date.getTime() >= props.now.getTime() + 15 * 60_000 ? date.getTime() : null;
});
const at = computed(() => (other.value ? otherAt.value : start.value));
const bothFree = computed(() => at.value != null && covers(mine.value, at.value, minutes.value));

function toggleOther() {
  other.value = !other.value;
  if (other.value) {
    otherDay.value = String(day.value);
  } else {
    place(start.value);
  }
}

const otherDays = computed(() =>
  Array.from({ length: 7 }, (_, offset) => {
    const date = startOfDay(props.now);
    date.setDate(date.getDate() + offset);
    return { offset, label: dayLabel(date.getTime(), props.now) };
  }),
);

async function send() {
  if (at.value == null || sending.value) return;
  sending.value = true;
  const ok = await actions.send({
    fromTeamId: props.team.id,
    toTeamId: props.posting.team_id,
    at: at.value,
    bestOf: bestOf.value,
    teamName: opponentName.value,
  });
  sending.value = false;
  if (ok) emit("sent");
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="send">
    <div class="space-y-2">
      <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.form.series") }}</span>
      <div class="inline-flex gap-0.5 rounded-md border border-border bg-card/60 p-0.5" role="group" :aria-label="$t('scrims.form.series')">
        <button
          v-for="option in seriesOptions"
          :key="option.value"
          type="button"
          :disabled="!option.fits"
          :aria-pressed="bestOf === option.value"
          class="h-[1.625rem] rounded px-3 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:line-through"
          :class="
            bestOf === option.value
              ? 'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))]'
              : 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground'
          "
          @click="pickSeries(option.value)"
        >
          {{ $t("scrims.form.best_of", { n: option.value }) }}
        </button>
      </div>
      <p v-if="unfit.length" class="text-xs text-muted-foreground">
        {{ $t("scrims.form.series_hint", { team: opponentName }) }}
      </p>
    </div>

    <ScrimTimeChips
      v-if="!other"
      v-model:day="day"
      v-model:start="start"
      :intervals="theirs"
      :mine="mine"
      :minutes="minutes"
      :now="now"
      :both-label="$t('scrims.form.both_free_legend', { team: team.name })"
    />

    <div v-if="posting.allow_outside_availability" class="space-y-2">
      <div v-if="other" class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ $t("scrims.form.other_time") }}</span>
        <button type="button" class="text-xs text-[hsl(var(--tac-amber))] hover:underline" @click="toggleOther">
          {{ $t("scrims.form.back_to_hours") }}
        </button>
      </div>
      <div v-if="other" class="flex flex-wrap gap-2">
        <select
          v-model="otherDay"
          class="h-8 rounded-md border border-input bg-background px-2 text-sm"
          :aria-label="$t('scrims.form.day')"
        >
          <option v-for="option in otherDays" :key="option.offset" :value="String(option.offset)">
            {{ option.label }}
          </option>
        </select>
        <Input
          v-model="otherTime"
          type="time"
          step="900"
          class="h-8 w-[8.5rem] tabular-nums [color-scheme:dark]"
          :aria-label="$t('scrims.form.start')"
        />
      </div>
      <p v-if="other" class="text-xs" :class="otherAt == null ? 'text-red-400' : 'text-muted-foreground'">
        {{ otherAt == null ? $t("scrims.form.past") : $t("scrims.form.other_hint", { team: opponentName }) }}
      </p>
      <button v-else type="button" class="text-xs text-[hsl(var(--tac-amber))] hover:underline" @click="toggleOther">
        {{ $t("scrims.form.other_time_link") }}
      </button>
    </div>

    <div
      class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md border border-border bg-card/60 px-3 py-2.5 text-sm"
    >
      <template v-if="at != null">
        <CalendarClock class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span class="font-semibold tabular-nums">
          {{ fullDayLabel(at) }} · {{ rangeLabel(at, at + minutes * 60_000) }}
        </span>
        <span class="text-muted-foreground">{{ $t("scrims.form.best_of", { n: bestOf }) }}</span>
        <ScrimStatusTag :tone="bothFree ? 'ok' : 'muted'">
          {{
            bothFree
              ? $t("scrims.status.both_free")
              : other
                ? $t("scrims.form.outside_theirs")
                : $t("scrims.form.outside_yours")
          }}
        </ScrimStatusTag>
      </template>
      <span v-else class="text-muted-foreground">{{ $t("scrims.form.pick_start") }}</span>
    </div>

    <p class="flex gap-1.5 text-xs text-muted-foreground">
      <MapIcon class="mt-0.5 h-3 w-3 shrink-0" />
      {{ $t("scrims.form.map_pool", { team: opponentName }) }}
    </p>

    <div class="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-border bg-background px-5 py-3">
      <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {{ $t("scrims.form.from", { team: team.name }) }}
      </span>
      <Button type="submit" size="sm" class="tac-amber-cta h-8 gap-1.5" :disabled="at == null" :loading="sending">
        <Send class="h-3.5 w-3.5" />
        {{ $t("scrims.form.send") }}
      </Button>
    </div>
  </form>
</template>
