<script setup lang="ts">
import { ref, computed } from "vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import LeagueSeriesFormatEditor from "~/components/league/LeagueSeriesFormatEditor.vue";

export interface NewSeasonInput {
  signup_opens_at: string | null;
  signup_closes_at: string | null;
  starts_at: string | null;
  roster_lock_at: string | null;
  match_weeks_count: number;
  games_per_week: number;
  playoff_seats: number;
  promote_count: number;
  relegate_count: number;
  direct_promote_count: number;
  relegation_up_count: number;
  relegation_down_count: number;
  direct_relegate_count: number;
  default_best_of: number;
  playoff_best_of: number;
  week_best_of: Record<string, number>;
  playoff_round_best_of: Record<string, number>;
  auto_regular_season_format: boolean;
  regular_season_stage_type: string;
  playoff_stage_type: string;
  playoff_third_place_match: boolean;
  match_weeks: {
    week_number: number;
    opens_at: string;
    closes_at: string;
    default_match_at: string;
  }[];
}

const emit = defineEmits<{
  (e: "submit", season: NewSeasonInput): void;
}>();

defineProps<{
  submitting?: boolean;
}>();

// Suggested schedule: signups open today, run for 15 days, and the season
// starts 15 days after they close. Admins can adjust before submitting.
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const suggestedOpen = new Date();
suggestedOpen.setMinutes(0, 0, 0);
const suggestedClose = addDays(suggestedOpen, 15);
const suggestedStart = addDays(suggestedClose, 15);

const signupOpens = ref(toLocalInput(suggestedOpen));
const signupCloses = ref(toLocalInput(suggestedClose));
const startsAt = ref(toLocalInput(suggestedStart));
const rosterLockWeek = ref(4);
const weeksCount = ref(8);
const gamesPerWeek = ref(1);
const playoffSeats = ref(4);
const promoteCount = ref(2);
const relegateCount = ref(2);
// ESEA bands: direct up / relegation-up (playoff) / relegation-down (playoff) / direct down.
const directPromoteCount = ref(1);
const relegationUpCount = ref(2);
const relegationDownCount = ref(2);
const directRelegateCount = ref(1);
const defaultBestOf = ref(1);
const playoffBestOf = ref(3);
// Weekly default tip-off, applied to matchups the teams never agree on.
const defaultDay = ref(2); // 0 = Sunday ... 2 = Tuesday (classic CAL night)
const defaultTime = ref("21:00");
// Series-format overrides: only deviations from the defaults are stored.
const weekBestOf = ref<Record<string, number>>({});
const playoffRoundBestOf = ref<Record<string, number>>({});
const autoRegularSeasonFormat = ref(true);
const regularSeasonStageType = ref("RoundRobin");
const playoffStageType = ref("SingleElimination");
const playoffThirdPlaceMatch = ref(false);

const windowError = computed<string | null>(() => {
  if (
    signupOpens.value &&
    signupCloses.value &&
    new Date(signupOpens.value) >= new Date(signupCloses.value)
  ) {
    return "signup_order";
  }
  if (
    signupCloses.value &&
    startsAt.value &&
    new Date(signupCloses.value) > new Date(startsAt.value)
  ) {
    return "signup_after_start";
  }
  return null;
});

const isValid = computed(
  () => !!startsAt.value && weeksCount.value > 0 && !windowError.value,
);

function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

// One match week per calendar week from the season start; the default
// tip-off lands on the configured weekday/time inside each window.
function generateWeeks(): NewSeasonInput["match_weeks"] {
  const weeks: NewSeasonInput["match_weeks"] = [];
  const start = new Date(startsAt.value);
  const [hours, minutes] = defaultTime.value.split(":").map(Number);

  for (let i = 0; i < weeksCount.value; i++) {
    const opens = new Date(start);
    opens.setDate(opens.getDate() + i * 7);
    const closes = new Date(opens);
    closes.setDate(closes.getDate() + 7);

    const fallback = new Date(opens);
    const dayDelta = (defaultDay.value - fallback.getDay() + 7) % 7;
    fallback.setDate(fallback.getDate() + dayDelta);
    fallback.setHours(hours, minutes, 0, 0);
    if (fallback < opens) {
      fallback.setDate(fallback.getDate() + 7);
    }
    if (fallback > closes) {
      fallback.setTime(closes.getTime() - 60 * 60 * 1000);
    }

    weeks.push({
      week_number: i + 1,
      opens_at: opens.toISOString(),
      closes_at: closes.toISOString(),
      default_match_at: fallback.toISOString(),
    });
  }
  return weeks;
}

function submit() {
  if (!isValid.value) {
    return;
  }
  const weeks = generateWeeks();
  const lockWeek = Math.min(
    Math.max(rosterLockWeek.value, 1),
    weeksCount.value,
  );

  emit("submit", {
    signup_opens_at: toIso(signupOpens.value),
    signup_closes_at: toIso(signupCloses.value),
    starts_at: toIso(startsAt.value),
    roster_lock_at: weeks[lockWeek - 1]?.opens_at ?? null,
    match_weeks_count: weeksCount.value,
    games_per_week: gamesPerWeek.value,
    playoff_seats: playoffSeats.value,
    direct_promote_count: directPromoteCount.value,
    relegation_up_count: relegationUpCount.value,
    relegation_down_count: relegationDownCount.value,
    direct_relegate_count: directRelegateCount.value,
    promote_count: promoteCount.value,
    relegate_count: relegateCount.value,
    default_best_of: defaultBestOf.value,
    playoff_best_of: playoffBestOf.value,
    week_best_of: Object.fromEntries(
      Object.entries(weekBestOf.value).filter(
        ([week]) => Number(week) <= weeksCount.value,
      ),
    ),
    playoff_round_best_of: playoffRoundBestOf.value,
    auto_regular_season_format: autoRegularSeasonFormat.value,
    regular_season_stage_type: regularSeasonStageType.value,
    playoff_stage_type: playoffStageType.value,
    playoff_third_place_match:
      playoffStageType.value === "SingleElimination" &&
      playoffThirdPlaceMatch.value,
    match_weeks: weeks,
  });
}

const labelClasses =
  "font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.signup_opens")
        }}</label>
        <Input
          type="datetime-local"
          v-model="signupOpens"
          style="color-scheme: dark"
        />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.signup_closes")
        }}</label>
        <Input
          type="datetime-local"
          v-model="signupCloses"
          style="color-scheme: dark"
        />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.starts_at")
        }}</label>
        <Input
          type="datetime-local"
          v-model="startsAt"
          style="color-scheme: dark"
        />
      </div>
    </div>

    <p v-if="windowError" class="text-sm text-destructive">
      {{ $t(`league.season_form.errors.${windowError}`) }}
    </p>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.weeks")
        }}</label>
        <Input type="number" v-model.number="weeksCount" min="1" max="26" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.games_per_week")
        }}</label>
        <Input type="number" v-model.number="gamesPerWeek" min="1" max="5" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.roster_lock_week")
        }}</label>
        <Input
          type="number"
          v-model.number="rosterLockWeek"
          min="1"
          :max="weeksCount"
        />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.playoff_seats")
        }}</label>
        <Input type="number" v-model.number="playoffSeats" min="0" max="16" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-4">
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.direct_promote")
        }}</label>
        <Input type="number" v-model.number="directPromoteCount" min="0" max="8" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.relegation_up")
        }}</label>
        <Input type="number" v-model.number="relegationUpCount" min="0" max="8" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.relegation_down")
        }}</label>
        <Input type="number" v-model.number="relegationDownCount" min="0" max="8" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.direct_relegate")
        }}</label>
        <Input type="number" v-model.number="directRelegateCount" min="0" max="8" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.best_of")
        }}</label>
        <Input type="number" v-model.number="defaultBestOf" min="1" max="5" />
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.playoff_best_of")
        }}</label>
        <Input type="number" v-model.number="playoffBestOf" min="1" max="5" />
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.default_day")
        }}</label>
        <Select
          :model-value="String(defaultDay)"
          @update:model-value="(val) => (defaultDay = Number(val))"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="day in WEEKDAYS" :key="day" :value="String(day)">
                {{ $t(`league.season_form.weekdays.${day}`) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1.5">
        <label :class="labelClasses">{{
          $t("league.season_form.default_time")
        }}</label>
        <Input type="time" v-model="defaultTime" style="color-scheme: dark" />
      </div>
    </div>

    <p class="text-xs text-muted-foreground">
      {{ $t("league.season_form.weeks_hint") }}
    </p>
    <p class="text-xs text-muted-foreground">
      {{ $t("league.season_form.min_teams_hint") }}
    </p>

    <div class="rounded-md border border-border/60 bg-muted/10 p-3 space-y-3">
      <p class="text-xs text-muted-foreground">
        {{ $t("league.season_form.auto_format_hint") }}
      </p>

      <LeagueSeriesFormatEditor
        :weeks-count="weeksCount"
        :playoff-seats="playoffSeats"
        :default-best-of="defaultBestOf"
        :playoff-best-of="playoffBestOf"
        v-model:week-best-of="weekBestOf"
        v-model:playoff-round-best-of="playoffRoundBestOf"
        v-model:playoff-stage-type="playoffStageType"
        v-model:playoff-third-place-match="playoffThirdPlaceMatch"
      />
    </div>

    <Button type="submit" :disabled="!isValid || submitting">
      {{ $t("league.season_form.create") }}
    </Button>
  </form>
</template>
