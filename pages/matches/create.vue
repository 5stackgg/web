<script setup lang="ts">
import { ref, computed } from "vue";
import gql from "graphql-tag";
import { useForm } from "vee-validate";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Play,
} from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { setupOptionsVariables } from "~/utilities/setupOptions";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import DateTimePicker from "~/components/common/DateTimePicker.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import { Spinner } from "~/components/ui/spinner";
import {
  tacticalSectionTickClasses,
  tacticalCtaButtonClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({ middleware: ["match-schedule"] });

const { t } = useI18n();

const validatorComponent: any = { $t: t };
const form = useForm({
  keepValuesOnUnmount: true,
  validationSchema: toTypedSchema(
    matchOptionsValidator(
      validatorComponent,
      {},
      useApplicationSettingsStore().settings,
    ),
  ),
  initialValues: {},
});
validatorComponent.form = form;

const PER_TEAM: Record<string, number> = {
  Competitive: 5,
  Wingman: 2,
  Duel: 1,
  Rush: 3,
};
const matchType = computed(() => (form.values as any).type);
const perTeam = computed(() => PER_TEAM[matchType.value] || 5);

const submitting = ref(false);
const settingsSection = ref<HTMLElement | null>(null);

const scheduledAtLocal = ref("");
// Empty = ASAP. Only invalid when a time is set but it's in the past.
const scheduledValid = computed(
  () =>
    !scheduledAtLocal.value ||
    new Date(scheduledAtLocal.value).getTime() > Date.now(),
);

type KickoffChoice = "now" | "in30" | "tonight" | "tomorrow" | "custom";
const EVENING_HOUR = 20;
const kickoff = ref<KickoffChoice>("now");

const eveningOf = (daysAhead: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(EVENING_HOUR, 0, 0, 0);
  return date;
};
const formatTime = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const formatKickoff = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const halfHourFromNow = () => {
  const date = new Date(Date.now() + 30 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return date;
};

const kickoffChips = computed(() => {
  const chips: Array<{ key: KickoffChoice; label: string; sub?: string }> = [
    { key: "now", label: t("pages.matches.schedule.kickoff_now") },
    {
      key: "in30",
      label: t("pages.matches.schedule.kickoff_in_30"),
      sub: formatTime(halfHourFromNow()),
    },
  ];
  if (new Date().getHours() < EVENING_HOUR - 1) {
    chips.push({
      key: "tonight",
      label: t("pages.matches.schedule.kickoff_tonight"),
      sub: formatTime(eveningOf(0)),
    });
  }
  chips.push(
    {
      key: "tomorrow",
      label: t("pages.matches.schedule.kickoff_tomorrow"),
      sub: formatTime(eveningOf(1)),
    },
    {
      key: "custom",
      label: t("pages.matches.schedule.kickoff_pick"),
      sub:
        kickoff.value === "custom" && scheduledAtLocal.value
          ? formatKickoff(scheduledAtLocal.value)
          : undefined,
    },
  );
  return chips;
});

const chooseKickoff = (choice: KickoffChoice) => {
  kickoff.value = choice;
  if (choice === "now") {
    scheduledAtLocal.value = "";
  } else if (choice === "in30") {
    scheduledAtLocal.value = halfHourFromNow().toISOString();
  } else if (choice === "tonight") {
    scheduledAtLocal.value = eveningOf(0).toISOString();
  } else if (choice === "tomorrow") {
    scheduledAtLocal.value = eveningOf(1).toISOString();
  }
};

const kickoffSummary = computed(() =>
  scheduledAtLocal.value
    ? formatKickoff(scheduledAtLocal.value)
    : t("pages.matches.schedule.kickoff_asap_summary"),
);

type Side = {
  mode: "team" | "individual";
  teamId: string | null;
  teamName?: string;
  members: Array<{ steam_id: string; player: any }>;
};
const lineups = ref<Side[]>([
  { mode: "team", teamId: null, members: [] },
  { mode: "team", teamId: null, members: [] },
]);

const sourceOptions = computed(() => [
  { key: "team", label: t("pages.matches.schedule.team") },
  { key: "individual", label: t("pages.matches.schedule.individual") },
]);

const excludedSteamIds = computed(() =>
  lineups.value.flatMap((s) => s.members.map((m) => m.steam_id)),
);

const addPlayer = (sideIndex: number, player: { steam_id: string }) => {
  const side = lineups.value[sideIndex];
  if (
    side.members.length >= perTeam.value ||
    side.members.some((m) => m.steam_id === player.steam_id)
  ) {
    return;
  }
  side.members.push({ steam_id: player.steam_id, player });
};
const removePlayer = (sideIndex: number, steamId: string) => {
  lineups.value[sideIndex].members = lineups.value[sideIndex].members.filter(
    (m) => m.steam_id !== steamId,
  );
};

const sideValid = (side: Side) =>
  side.mode === "team"
    ? !!side.teamId
    : side.members.length >= perTeam.value;
const teamsReady = computed(() => lineups.value.every(sideValid));

const sideName = (side: Side, index: number) =>
  side.mode === "team" && side.teamName
    ? side.teamName
    : t("pages.matches.schedule.team_n", { n: index + 1 });

const sideChecks = computed(() =>
  lineups.value.map((side, index) => {
    const name = sideName(side, index);
    if (side.mode === "team") {
      return side.teamId
        ? { name, ok: true, text: "" }
        : {
            name,
            ok: false,
            text: t("pages.matches.schedule.side_no_team"),
          };
    }
    return {
      name,
      ok: side.members.length >= perTeam.value,
      text: t("pages.matches.schedule.side_players", {
        filled: side.members.length,
        total: perTeam.value,
      }),
    };
  }),
);

const formatSummary = computed(() => {
  const values = form.values as any;
  if (!values.type) {
    return "";
  }
  return [
    values.type,
    `${perTeam.value}v${perTeam.value}`,
    `Bo${values.best_of ?? 1}`,
  ].join(" · ");
});

const canSubmit = computed(
  () => teamsReady.value && scheduledValid.value && !submitting.value,
);

const buildLineup = (side: Side) =>
  side.mode === "team"
    ? { team_id: side.teamId }
    : { steam_ids: side.members.map((m) => m.steam_id) };

const submit = form.handleSubmit(
  async (values: any) => {
    if (submitting.value || !teamsReady.value || !scheduledValid.value) {
      return;
    }
    if (values.custom_map_pool) {
      values.map_pool_id = undefined;
    }
    const options = setupOptionsVariables(values, {
      mapPoolId: values.map_pool_id,
    });

    submitting.value = true;
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: gql`
          mutation CreateScheduledMatch(
            $options: jsonb!
            $scheduled_at: String!
            $lineup_1: ScheduledLineupInput!
            $lineup_2: ScheduledLineupInput!
          ) {
            createScheduledMatch(
              options: $options
              scheduled_at: $scheduled_at
              lineup_1: $lineup_1
              lineup_2: $lineup_2
            ) {
              matchId
            }
          }
        `,
        variables: {
          options,
          scheduled_at: scheduledAtLocal.value
            ? new Date(scheduledAtLocal.value).toISOString()
            : new Date().toISOString(),
          lineup_1: buildLineup(lineups.value[0]),
          lineup_2: buildLineup(lineups.value[1]),
        },
      });
      const matchId = data?.createScheduledMatch?.matchId;
      if (matchId) {
        navigateTo(`/matches/${matchId}`);
      }
    } finally {
      submitting.value = false;
    }
  },
  () => {
    settingsSection.value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  },
);
</script>

<template>
  <PageTransition>
    <div class="create-match mx-auto max-w-6xl pb-8">
      <h1 class="sr-only">{{ $t("pages.matches.schedule.title") }}</h1>

      <div class="create-match-grid">
        <div class="create-match-form space-y-4">
          <section
            ref="settingsSection"
            class="create-match-card scroll-mt-4"
            aria-labelledby="create-match-settings"
          >
            <h2
              id="create-match-settings"
              class="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
            >
              <span :class="tacticalSectionTickClasses"></span>
              1 · {{ $t("match.tabs.settings") }}
            </h2>
            <MatchOptions :form="form" />
          </section>

          <section
            class="create-match-card"
            aria-labelledby="create-match-lineups"
          >
            <div
              class="mb-3 flex flex-wrap items-baseline justify-between gap-2"
            >
              <h2
                id="create-match-lineups"
                class="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
              >
                <span :class="tacticalSectionTickClasses"></span>
                2 · {{ $t("pages.matches.schedule.step_teams") }}
              </h2>
              <p class="text-xs text-muted-foreground">
                {{
                  $t("pages.matches.schedule.lineups_desc", { count: perTeam })
                }}
              </p>
            </div>

            <div class="create-match-sides">
              <div
                v-for="(side, index) in lineups"
                :key="index"
                class="space-y-3"
              >
                <AnimatedFilters
                  v-model="side.mode"
                  :options="sourceOptions"
                  square
                  block
                />

                <!-- Keyed remount, so the shared measured swap fits: the old
                     hand-rolled version collapsed to zero and regrew (double
                     travel) and clipped focus rings at rest. -->
                <HeightSwap>
                  <div :key="side.mode">
                    <TeamSearch
                      v-if="side.mode === 'team'"
                      :label="$t('pages.matches.schedule.select_team')"
                      :model-value="side.teamId"
                      :min-players="perTeam"
                      :ineligible="
                        lineups[index === 0 ? 1 : 0].teamId
                          ? {
                              [lineups[index === 0 ? 1 : 0].teamId]: $t(
                                'team.search.ineligible.other_side',
                              ),
                            }
                          : {}
                      "
                      @selected="
                        (team) => {
                          side.teamId = team.id;
                          side.teamName = team.name;
                        }
                      "
                    />

                    <DraftTeamPanel
                      v-else
                      :title="
                        $t('pages.matches.schedule.team_n', { n: index + 1 })
                      "
                      :players="side.members"
                      :per-team="perTeam"
                      :accent="index === 0 ? 'amber' : 'blue'"
                      addable
                      removable
                      :exclude-steam-ids="excludedSteamIds"
                      @add="(steamId, player) => addPlayer(index, player)"
                      @remove="(steamId) => removePlayer(index, steamId)"
                    />
                  </div>
                </HeightSwap>
              </div>
            </div>
          </section>

        </div>

        <aside
          class="create-match-aside"
          :aria-label="$t('pages.matches.schedule.summary')"
        >
          <section
            class="create-match-card"
            aria-labelledby="create-match-kickoff"
          >
            <h2
              id="create-match-kickoff"
              class="mb-3 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
            >
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.matches.schedule.kickoff") }}
            </h2>
            <div
              role="radiogroup"
              :aria-label="$t('pages.matches.schedule.kickoff')"
              class="grid grid-cols-2 gap-1.5"
            >
              <button
                v-for="(chip, index) in kickoffChips"
                :key="chip.key"
                type="button"
                role="radio"
                :aria-checked="kickoff === chip.key"
                class="kickoff-option"
                :class="{
                  'is-on': kickoff === chip.key,
                  'col-span-2':
                    index === kickoffChips.length - 1 &&
                    kickoffChips.length % 2 === 1,
                }"
                @click="chooseKickoff(chip.key)"
              >
                <span class="flex items-center gap-1.5 font-semibold">
                  <CalendarDays
                    v-if="chip.key === 'custom'"
                    class="h-3.5 w-3.5 shrink-0"
                  />
                  {{ chip.label }}
                </span>
                <span
                  v-if="chip.sub"
                  class="truncate font-mono text-[0.62rem] tracking-[0.06em] opacity-70"
                >
                  {{ chip.sub }}
                </span>
              </button>
            </div>
            <Fold :open="kickoff === 'custom'">
              <div class="pt-3">
                <DateTimePicker
                  v-model="scheduledAtLocal"
                  class="grid w-full grid-cols-2 [&>*]:w-full"
                />
              </div>
            </Fold>
            <p
              class="mt-3 flex items-center gap-2 text-xs"
              :class="
                scheduledAtLocal
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
            >
              <Clock class="h-3.5 w-3.5 shrink-0" />
              {{ kickoffSummary }}
            </p>
            <Fold :open="!!scheduledAtLocal && !scheduledValid">
              <p class="mt-2 text-[0.72rem] text-destructive">
                {{ $t("pages.matches.schedule.kickoff_future") }}
              </p>
            </Fold>
          </section>

          <div class="create-match-card space-y-3">
            <div
              v-if="formatSummary"
              class="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ formatSummary }}
            </div>
            <ul class="space-y-2.5">
              <li
                v-for="(check, index) in sideChecks"
                :key="index"
                class="flex items-center gap-2.5"
              >
                <span
                  class="team-tick"
                  :class="{ 'is-blue': index === 1 }"
                ></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold">
                    {{ check.name }}
                  </span>
                  <span
                    v-if="check.text"
                    class="block truncate text-xs"
                    :class="
                      check.ok
                        ? 'text-muted-foreground'
                        : 'text-[hsl(var(--tac-amber))]'
                    "
                  >
                    {{ check.text }}
                  </span>
                </span>
                <CheckCircle2
                  v-if="check.ok"
                  class="h-4 w-4 shrink-0 text-green-500"
                />
                <AlertTriangle
                  v-else
                  class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
                />
              </li>
            </ul>
          </div>

          <button
            type="button"
            :class="[tacticalCtaButtonClasses, 'create-match-cta h-12 w-full']"
            :disabled="!canSubmit"
            @click="submit"
          >
            <Spinner v-if="submitting" class="h-4 w-4" />
            <CalendarClock v-else-if="scheduledAtLocal" class="h-4 w-4" />
            <Play v-else class="h-4 w-4" />
            {{
              scheduledAtLocal
                ? $t("pages.matches.schedule.submit")
                : $t("pages.matches.schedule.create_now")
            }}
          </button>
        </aside>
      </div>

      <div class="create-match-bar">
        <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ kickoffSummary }}
        </span>
        <button
          type="button"
          :class="[tacticalCtaButtonClasses, 'h-10 !py-0']"
          :disabled="!canSubmit"
          @click="submit"
        >
          <Spinner v-if="submitting" class="h-4 w-4" />
          <CalendarClock v-else-if="scheduledAtLocal" class="h-4 w-4" />
          <Play v-else class="h-4 w-4" />
          {{
            scheduledAtLocal
              ? $t("pages.matches.schedule.submit")
              : $t("pages.matches.schedule.create_now")
          }}
        </button>
      </div>
    </div>
  </PageTransition>
</template>

<style scoped>
.create-match {
  container-type: inline-size;
}
.create-match-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1.25rem;
}
.create-match-form {
  flex: 999 1 640px;
  min-width: 0;
}
.create-match-aside {
  display: flex;
  flex: 1 1 300px;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
}
.create-match-card {
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.4);
  padding: 1.25rem;
}
.create-match-sides {
  display: grid;
  gap: 1rem;
  align-items: start;
}
.create-match-cta {
  display: none;
}
.create-match-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  border-top: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--background) / 0.9);
  padding: 0.75rem 0;
  backdrop-filter: blur(8px);
}
@container (min-width: 560px) {
  .create-match-sides {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (min-width: 980px) {
  .create-match-aside {
    position: sticky;
    top: 1rem;
  }
  .create-match-cta {
    display: inline-flex;
  }
  .create-match-bar {
    display: none;
  }
}
.kickoff-option {
  display: flex;
  min-width: 0;
  height: 3rem;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.1rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.5);
  padding: 0 0.7rem;
  text-align: left;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.kickoff-option:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--tac-amber) / 0.5);
}
.kickoff-option.is-on {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
}
.team-tick {
  height: 2rem;
  width: 4px;
  flex-shrink: 0;
  border-radius: 2px;
  background: hsl(var(--tac-amber));
}
.team-tick.is-blue {
  background: hsl(var(--tac-blue));
}
@media (prefers-reduced-motion: reduce) {
  .kickoff-option {
    transition: none;
  }
}
</style>
