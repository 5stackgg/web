<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useForm } from "vee-validate";
import {
  Users,
  Shield,
  ArrowRight,
  ArrowLeft,
  Inbox,
  Shuffle,
  Crosshair,
  Globe,
  Send,
  UserCheck,
  Lock,
  X,
} from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { setupOptions, setupOptionsVariables } from "~/utilities/setupOptions";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import MatchOptions from "~/components/MatchOptions.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import DraftRosterPicker from "~/components/draft-games/DraftRosterPicker.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "~/components/ui/toast";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalCtaButtonClasses,
} from "~/utilities/tacticalClasses";

const { t } = useI18n();

const props = defineProps<{
  initial?: any;
  editing?: boolean;
  settingsOnly?: boolean;
  rehost?: any;
  forOthers?: boolean;
}>();

const canHostForOthers = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer),
);

const emit = defineEmits<{
  (event: "created"): void;
  (event: "back"): void;
}>();

const REHOST_KEY = "draft-games:rehost";

const submitting = ref(false);

const source = props.rehost || props.initial;

const mode = ref<string>(
  source?.mode || (props.forOthers ? "Host" : "Pug"),
);
const access = ref<string>(source?.access || "Friends");
const requireApproval = ref<boolean>(source?.require_approval ?? false);
const captainSelection = ref<string>(source?.captain_selection || "TopEloTwo");
const draftOrder = ref<string>(source?.draft_order || "Snake");

// Organizers can open a lobby they manage without being added as a player.
// Defaults off (host plays); entering via the manage-matches page (?for=others)
// flips it on.
const hostJoins = ref<boolean>(
  !(props.forOthers && canHostForOthers.value),
);
const RANK_MIN = 0;
const RANK_MAX = 30000;
const RANK_STEP = 500;

const rankRange = ref<number[]>([
  source?.min_elo ?? RANK_MIN,
  source?.max_elo ?? RANK_MAX,
]);
const rankGated = computed(
  () => rankRange.value[0] > RANK_MIN || rankRange.value[1] < RANK_MAX,
);
const rankMin = computed(() =>
  rankRange.value[0] > RANK_MIN ? rankRange.value[0] : undefined,
);
const rankMax = computed(() =>
  rankRange.value[1] < RANK_MAX ? rankRange.value[1] : undefined,
);
const team1Id = ref<string | undefined>(source?.team_1_id);
const team2Id = ref<string | undefined>(source?.team_2_id);
const innerSquad = ref<boolean>(source?.inner_squad ?? false);

const rosterAssignment = ref<Array<{ steam_id: string; lineup: number | null }>>(
  [],
);

const initialAssignment = computed<Record<string, number | null> | undefined>(
  () => {
    const players = source?.players;
    if (!players?.length) {
      return undefined;
    }
    const map: Record<string, number | null> = {};
    for (const player of players) {
      map[String(player.steam_id)] = player.lineup ?? null;
    }
    return map;
  },
);

const team1Selection = computed(() =>
  team1Id.value ? { id: team1Id.value, name: source?.team_1?.name } : null,
);
const team2Selection = computed(() =>
  team2Id.value ? { id: team2Id.value, name: source?.team_2?.name } : null,
);

const step = ref(1);
const steps = [
  "draft_games.create.step_settings",
  "draft_games.create.step_format",
  "draft_games.create.step_rules",
];
const stepDisabled = (n: number) => n === 2 && isDuel.value;

const goToStep = (n: number) => {
  if (stepDisabled(n)) {
    return;
  }
  step.value = n;
};

const next = () => {
  let target = step.value + 1;
  while (target <= steps.length && stepDisabled(target)) {
    target++;
  }
  if (target <= steps.length) {
    step.value = target;
  }
};
const prev = () => {
  let target = step.value - 1;
  while (target >= 1 && stepDisabled(target)) {
    target--;
  }
  if (target >= 1) {
    step.value = target;
  }
};

const modeOptions = [
  {
    value: "Pug",
    icon: Shuffle,
    label: "draft_games.mode.pug",
    desc: "draft_games.mode.pug_desc",
  },
  {
    value: "Captains",
    icon: Users,
    label: "draft_games.mode.captains",
    desc: "draft_games.mode.captains_desc",
  },
  {
    value: "Host",
    icon: Shield,
    label: "draft_games.mode.host",
    desc: "draft_games.mode.host_desc",
  },
  {
    value: "Teams",
    icon: Crosshair,
    label: "draft_games.mode.teams",
    desc: "draft_games.mode.teams_desc",
  },
];

watch(
  mode,
  (value) => {
    if (value === "Host") {
      // Host mode is self-service: players pick their own team, no approval gate.
      requireApproval.value = false;
    }
    if (value === "Teams") {
      if (!team1Id.value) {
        team1Id.value = useAuthStore().me?.teams?.[0]?.id;
      }
    }
  },
  { immediate: true },
);

const bothTeamsAssigned = computed(
  () => mode.value === "Teams" && !!team1Id.value && !!team2Id.value,
);
watch(
  bothTeamsAssigned,
  (locked) => {
    if (locked) {
      access.value = "Private";
    }
  },
  { immediate: true },
);

const accessOptions = [
  {
    value: "Open",
    icon: Globe,
    label: "draft_games.access.open",
    desc: "draft_games.access.open_desc",
  },
  {
    value: "Friends",
    icon: UserCheck,
    label: "draft_games.access.friends",
    desc: "draft_games.access.friends_desc",
  },
  {
    value: "Invite",
    icon: Send,
    label: "draft_games.access.invite",
    desc: "draft_games.access.invite_desc",
  },
  {
    value: "Private",
    icon: Lock,
    label: "draft_games.access.private",
    desc: "draft_games.access.private_desc",
  },
];

const accessFilterOptions = computed(() =>
  accessOptions.map((option) => ({
    key: option.value,
    label: t(option.label),
    icon: option.icon,
  })),
);

const captainSelectionOptions = computed(() =>
  [
    {
      key: "TopEloTwo",
      label: t("draft_games.captain_selection.top_elo_two"),
    },
    // The host is a captain in this mode, so it's unavailable when the host
    // isn't joining the lobby.
    hostJoins.value
      ? {
          key: "HostAndNext",
          label: t("draft_games.captain_selection.host_and_next"),
        }
      : null,
    {
      key: "RandomTwo",
      label: t("draft_games.captain_selection.random_two"),
    },
    {
      key: "Manual",
      label: t("draft_games.captain_selection.manual"),
    },
  ].filter((option): option is { key: string; label: string } => !!option),
);

watch(hostJoins, (joins) => {
  if (!joins && captainSelection.value === "HostAndNext") {
    captainSelection.value = "TopEloTwo";
  }
});

const draftOrderOptions = computed(() => [
  {
    key: "Snake",
    label: t("draft_games.draft_order.snake"),
  },
  {
    key: "Alternating",
    label: t("draft_games.draft_order.alternating"),
  },
  {
    key: "FrontLoaded",
    label: t("draft_games.draft_order.front_loaded"),
  },
]);

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

const editBaseline = ref<string | null>(null);
const settingsSnapshot = () =>
  JSON.stringify({
    values: form.values,
    mode: mode.value,
    access: access.value,
    requireApproval: requireApproval.value,
    captainSelection: captainSelection.value,
    draftOrder: draftOrder.value,
    team1Id: team1Id.value,
    team2Id: team2Id.value,
    innerSquad: innerSquad.value,
    roster: rosterAssignment.value,
    minElo: rankMin.value ?? null,
    maxElo: rankMax.value ?? null,
  });
const isDirty = computed(
  () =>
    editBaseline.value !== null && settingsSnapshot() !== editBaseline.value,
);
const interacted = ref(false);
onMounted(() => {
  nextTick(() => {
    editBaseline.value = settingsSnapshot();
  });
});
watch(
  () => settingsSnapshot(),
  (snap) => {
    if (!interacted.value) {
      editBaseline.value = snap;
    }
  },
);

const discardEdits = () => {
  if (props.initial?.options) {
    setupOptions(form, props.initial.options);
  }
  mode.value = source?.mode || "Pug";
  access.value = source?.access || "Friends";
  requireApproval.value = source?.require_approval ?? false;
  captainSelection.value = source?.captain_selection || "TopEloTwo";
  draftOrder.value = source?.draft_order || "Snake";
  team1Id.value = source?.team_1_id;
  team2Id.value = source?.team_2_id;
  innerSquad.value = source?.inner_squad ?? false;
  rankRange.value = [source?.min_elo ?? RANK_MIN, source?.max_elo ?? RANK_MAX];
  nextTick(() => {
    editBaseline.value = settingsSnapshot();
  });
};

const matchType = computed(() => form.values.type);

const isDuel = computed(() => matchType.value === "Duel");

const PER_TEAM: Record<string, number> = {
  Duel: 1,
  Wingman: 2,
  Competitive: 5,
  Premier: 5,
  Faceit: 5,
};
const perTeam = computed(() => PER_TEAM[matchType.value] || 5);

const lobbyMemberCount = computed(
  () =>
    (useMatchmakingStore().currentLobby?.players || []).filter(
      (p: any) => p.status !== "Invited",
    ).length,
);

const keepLobbyTogether = ref<boolean>(false);
const showKeepTogether = computed(
  () =>
    lobbyMemberCount.value > 1 &&
    lobbyMemberCount.value <= perTeam.value &&
    ["Host", "Pug"].includes(mode.value),
);

const availableModes = computed(() =>
  modeOptions.filter(
    (option) => !(option.value === "Captains" && isDuel.value),
  ),
);

const modeFilterOptions = computed(() =>
  availableModes.value.map((option) => ({
    key: option.value,
    label: t(option.label),
    icon: option.icon,
  })),
);

const selectedModeDescription = computed(() => {
  const option = modeOptions.find((o) => o.value === mode.value);
  return option ? t(option.desc) : "";
});

watch(matchType, () => {
  if (isDuel.value) {
    mode.value = "Pug";
    if (step.value === 2) {
      step.value = 1;
    }
    return;
  }
  if (!availableModes.value.some((option) => option.value === mode.value)) {
    mode.value = "Pug";
  }
});

if (props.initial?.options) {
  setupOptions(form, props.initial.options);
}

if (props.editing && props.initial?.options?.map_pool?.type === "Custom") {
  const customMapIds = (props.initial.options.map_pool.maps || []).map(
    (m: any) => m.id,
  );
  const desiredPool = JSON.stringify(customMapIds);
  let poolRestoreReady = false;
  const restoreCustomPool = () => {
    if (!poolRestoreReady || interacted.value) {
      return;
    }
    if (!form.values.custom_map_pool) {
      form.setFieldValue("custom_map_pool", true);
      return;
    }
    if (JSON.stringify(form.values.map_pool || []) !== desiredPool) {
      form.setFieldValue("map_pool", customMapIds);
      return;
    }
    if (form.values.map_pool_id) {
      form.setFieldValue("map_pool_id", null);
    }
  };
  onMounted(() => {
    setTimeout(() => {
      poolRestoreReady = true;
      restoreCustomPool();
    }, 500);
  });
  watch(
    () => [
      form.values.custom_map_pool,
      form.values.map_pool_id,
      JSON.stringify(form.values.map_pool || []),
    ],
    restoreCustomPool,
  );
}

const applyRehost = (rehost: any) => {
  if (!rehost) {
    return;
  }
  if (rehost.values) {
    form.setValues({ ...rehost.values });
  }
  if (rehost.mode) {
    mode.value = rehost.mode;
  }
  if (rehost.access) {
    access.value = rehost.access;
  }
  if (
    rehost.require_approval !== undefined &&
    rehost.require_approval !== null
  ) {
    requireApproval.value = rehost.require_approval;
  }
  if (rehost.captain_selection) {
    captainSelection.value = rehost.captain_selection;
  }
  if (rehost.draft_order) {
    draftOrder.value = rehost.draft_order;
  }
  rankRange.value = [rehost.min_elo ?? RANK_MIN, rehost.max_elo ?? RANK_MAX];
  team1Id.value = rehost.team_1_id ?? undefined;
  team2Id.value = rehost.team_2_id ?? undefined;
  innerSquad.value = rehost.inner_squad ?? false;
};

watch(() => props.rehost, applyRehost, { immediate: true });

const submit = form.handleSubmit(async (values: any) => {
  if (submitting.value) {
    return;
  }

  if (mode.value === "Teams" && !team1Id.value) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("draft_games.create.team_1_required_error"),
    });
    step.value = 2;
    return;
  }

  if (values.custom_map_pool) {
    values.map_pool_id = undefined;
  }

  const options = setupOptionsVariables(values, {
    mapPoolId: values.map_pool_id,
  });

  const payload = {
    type: values.type,
    mode: mode.value,
    access: access.value,
    regions: values.regions,
    map_pool_id: values.map_pool_id,
    captain_selection: captainSelection.value,
    draft_order: draftOrder.value,
    require_approval: requireApproval.value,
    min_elo: rankMin.value,
    max_elo: rankMax.value,
    team_1_id: mode.value === "Teams" ? team1Id.value : undefined,
    team_2_id: mode.value === "Teams" ? team2Id.value : undefined,
    inner_squad:
      mode.value === "Teams" && !team2Id.value ? innerSquad.value : false,
    roster: mode.value === "Teams" ? rosterAssignment.value : undefined,
    keep_lobby_together: showKeepTogether.value && keepLobbyTogether.value,
    host_joins: hostJoins.value,
    options,
  };

  submitting.value = true;

  if (props.editing && props.initial) {
    try {
      await useDraftGamesStore().update(props.initial.id, payload);
      emit("created");
    } catch {
    } finally {
      submitting.value = false;
    }
    return;
  }

  try {
    localStorage.setItem(
      REHOST_KEY,
      JSON.stringify({
        mode: mode.value,
        access: access.value,
        captain_selection: captainSelection.value,
        draft_order: draftOrder.value,
        require_approval: requireApproval.value,
        min_elo: rankMin.value ?? null,
        max_elo: rankMax.value ?? null,
        team_1_id: team1Id.value ?? null,
        team_2_id: team2Id.value ?? null,
        inner_squad: innerSquad.value,
        values,
        payload,
      }),
    );
  } catch {}

  try {
    const draftGameId = await useDraftGamesStore().create(payload);
    if (draftGameId) {
      navigateTo(`/draft-room/${draftGameId}`);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("common.error"),
    });
  } finally {
    submitting.value = false;
  }
});
</script>

<template>
  <form v-if="settingsOnly" class="space-y-5" @submit.prevent="submit">
    <div class="flex items-center justify-between">
      <Button
        type="button"
        variant="outline"
        class="gap-2"
        @click="emit('back')"
      >
        <ArrowLeft class="h-4 w-4" />
        {{ $t("draft_games.room.back_to_room") }}
      </Button>
    </div>
    <MatchOptions :form="form" />
    <SettingsSaveBar :form="form" :submitting="submitting" @save="submit" />
  </form>

  <form
    v-else
    class="space-y-5"
    @submit.prevent="submit"
    @pointerdown.capture="interacted = true"
    @keydown.capture="interacted = true"
  >
    <div class="flex items-center gap-2">
      <template v-for="(label, index) in steps" :key="label">
        <button
          type="button"
          :disabled="stepDisabled(index + 1)"
          :title="
            stepDisabled(index + 1) ? $t('draft_games.create.no_formats') : ''
          "
          class="step-pill flex flex-1 basis-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            stepDisabled(index + 1)
              ? 'border-dashed border-border text-muted-foreground/40'
              : step === index + 1
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
                : step > index + 1
                  ? 'border-[hsl(var(--tac-amber)/0.4)] text-muted-foreground'
                  : 'border-border text-muted-foreground/60'
          "
          @click="goToStep(index + 1)"
        >
          <span
            class="grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.6rem] font-bold"
            :class="
              step >= index + 1 && !stepDisabled(index + 1)
                ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                : 'border-border'
            "
          >
            {{ index + 1 }}
          </span>
          <span
            class="hidden font-mono text-[0.62rem] uppercase tracking-[0.16em] sm:inline"
          >
            {{ $t(label) }}
          </span>
        </button>
        <div
          v-if="index < steps.length - 1"
          class="h-px w-4 shrink-0 bg-border sm:w-8"
        ></div>
      </template>
    </div>

    <div class="step-stack relative">
    <Transition name="step">
      <div v-show="step === 2" class="space-y-5">
        <section v-if="!isDuel">
          <AnimatedFilters
            v-model="mode"
            :options="modeFilterOptions"
            square
            size="lg"
            block
          />
          <p class="mt-1.5 text-[0.72rem] leading-snug text-muted-foreground">
            {{ selectedModeDescription }}
          </p>
        </section>

        <Transition name="reveal">
          <section v-if="showKeepTogether">
            <div
              class="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.4)]"
              :class="{
                'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)]':
                  keepLobbyTogether,
              }"
              @click="keepLobbyTogether = !keepLobbyTogether"
            >
              <div class="flex items-center gap-3">
                <Users
                  class="h-5 w-5 shrink-0"
                  :class="
                    keepLobbyTogether
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground'
                  "
                />
                <div>
                  <div
                    class="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em]"
                  >
                    {{ $t("draft_games.create.keep_lobby") }}
                  </div>
                  <div
                    class="text-[0.72rem] leading-snug text-muted-foreground"
                  >
                    {{
                      $t("draft_games.create.keep_lobby_desc", {
                        count: lobbyMemberCount,
                      })
                    }}
                  </div>
                </div>
              </div>
              <Switch
                class="pointer-events-none"
                :model-value="keepLobbyTogether"
              />
            </div>
          </section>
        </Transition>

        <section v-if="mode === 'Teams'">
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("draft_games.create.teams") }}
          </div>
          <p class="mb-2 text-[0.72rem] leading-snug text-muted-foreground">
            {{ $t("draft_games.create.teams_desc") }}
          </p>
          <div
            class="grid grid-cols-1 gap-3"
            :class="{ 'sm:grid-cols-2': !innerSquad }"
          >
            <TeamSearch
              :label="$t('draft_games.create.team_1_required')"
              :model-value="team1Id"
              my-teams
              :min-players="perTeam"
              :exclude="team2Id ? [team2Id] : []"
              @selected="(team) => (team1Id = team.id)"
            />
            <div v-if="!innerSquad" class="flex items-center gap-2">
              <div class="min-w-0 flex-1">
                <TeamSearch
                  :label="$t('draft_games.create.team_2_optional')"
                  :model-value="team2Id"
                  :min-players="perTeam"
                  :exclude="team1Id ? [team1Id] : []"
                  @selected="(team) => (team2Id = team.id)"
                />
              </div>
              <Button
                v-if="team2Id"
                type="button"
                variant="ghost"
                size="icon"
                class="shrink-0 text-muted-foreground hover:text-destructive"
                :title="$t('draft_games.create.clear_team')"
                @click="team2Id = undefined"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Transition name="reveal">
            <div
              v-if="team1Id && !team2Id"
              class="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.4)]"
              :class="{
                'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)]':
                  innerSquad,
              }"
              @click="innerSquad = !innerSquad"
            >
              <div class="flex items-center gap-3">
                <Users
                  class="h-5 w-5 shrink-0"
                  :class="
                    innerSquad
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground'
                  "
                />
                <div>
                  <div
                    class="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em]"
                  >
                    {{ $t("draft_games.create.inner_squad") }}
                  </div>
                  <div class="text-[0.72rem] leading-snug text-muted-foreground">
                    {{
                      innerSquad
                        ? $t("draft_games.create.inner_squad_on_desc")
                        : $t("draft_games.create.inner_squad_off_desc")
                    }}
                  </div>
                </div>
              </div>
              <Switch class="pointer-events-none" :model-value="innerSquad" />
            </div>
          </Transition>

          <div v-if="team1Id" class="mt-4">
            <p class="mb-2 text-[0.72rem] leading-snug text-muted-foreground">
              {{ $t("draft_games.create.roster_desc") }}
            </p>
            <DraftRosterPicker
              v-model="rosterAssignment"
              :team1="team1Selection"
              :team2="innerSquad ? null : team2Selection"
              :per-team="perTeam"
              :inner-squad="innerSquad"
              :initial-assignment="initialAssignment"
            />
          </div>
        </section>

        <Transition name="reveal">
          <section v-if="mode === 'Captains'" class="space-y-4">
            <div class="flex flex-col gap-1.5">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("draft_games.create.captain_selection") }}
              </div>
              <AnimatedFilters
                v-model="captainSelection"
                :options="captainSelectionOptions"
                square
                size="lg"
                block
                fill
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("draft_games.create.draft_order") }}
              </div>
              <AnimatedFilters
                v-model="draftOrder"
                :options="draftOrderOptions"
                square
                size="lg"
                block
                fill
              />
            </div>
          </section>
        </Transition>
      </div>
    </Transition>

    <Transition name="step">
      <div v-show="step === 1">
        <MatchOptions :form="form" />
      </div>
    </Transition>

    <Transition name="step">
      <div v-show="step === 3" class="space-y-5">
        <section v-if="!bothTeamsAssigned">
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("draft_games.create.access") }}
          </div>
          <AnimatedFilters
            v-model="access"
            :options="accessFilterOptions"
            square
            size="lg"
            block
          />
          <p class="mt-1.5 text-[0.72rem] leading-snug text-muted-foreground">
            {{ $t(`draft_games.access.${access.toLowerCase()}_desc`) }}
          </p>
        </section>
        <section v-else>
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("draft_games.create.access") }}
          </div>
          <p class="mt-1.5 text-[0.72rem] leading-snug text-muted-foreground">
            {{ $t("draft_games.create.both_teams_private") }}
          </p>
        </section>

        <section>
          <div
            class="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.4)]"
            :class="{
              'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)]':
                requireApproval,
            }"
            @click="requireApproval = !requireApproval"
          >
            <div class="flex items-center gap-3">
              <Inbox
                class="h-5 w-5 shrink-0"
                :class="
                  requireApproval
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              />
              <div>
                <div
                  class="font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em]"
                >
                  {{ $t("draft_games.create.require_approval") }}
                </div>
                <div class="text-[0.72rem] leading-snug text-muted-foreground">
                  {{ $t("draft_games.create.require_approval_desc") }}
                </div>
              </div>
            </div>
            <Switch
              class="pointer-events-none"
              :model-value="requireApproval"
            />
          </div>
        </section>


        <section>
          <div class="flex items-center justify-between">
            <div :class="tacticalSectionLabelClasses">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("draft_games.create.rank_gate") }}
            </div>
            <span
              class="font-mono text-[0.72rem] tabular-nums text-foreground/70"
            >
              <template v-if="rankGated">
                {{ rankRange[0] }}–{{
                  rankRange[1] === RANK_MAX ? "∞" : rankRange[1]
                }}
              </template>
              <template v-else>{{ $t("draft_games.filters.any") }}</template>
            </span>
          </div>
          <Slider
            v-model="rankRange"
            :min="RANK_MIN"
            :max="RANK_MAX"
            :step="RANK_STEP"
            :min-steps-between-thumbs="1"
            class="mt-3"
          />
        </section>
      </div>
    </Transition>
    </div>

    <div
      v-if="!editing"
      class="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border/60 bg-background/90 py-4 [backdrop-filter:blur(8px)]"
    >
      <Button
        type="button"
        variant="outline"
        :disabled="step === 1"
        class="gap-2"
        @click="prev"
      >
        <ArrowLeft class="h-4 w-4" />
        {{ $t("draft_games.create.back") }}
      </Button>
      <Button
        v-if="step < steps.length"
        type="button"
        class="gap-2"
        @click="next"
      >
        {{ $t("draft_games.create.next") }}
        <ArrowRight class="h-4 w-4" />
      </Button>
      <button
        v-else
        type="submit"
        :class="[
          tacticalCtaButtonClasses,
          'relative h-9 !py-0 disabled:cursor-default',
        ]"
        :disabled="submitting"
      >
        <span
          v-if="submitting"
          class="absolute inset-0 flex items-center justify-center"
        >
          <Spinner />
        </span>
        <span :class="{ invisible: submitting }">
          {{ $t("draft_games.create.deploy") }}
        </span>
        <ArrowRight class="h-4 w-4" :class="{ invisible: submitting }" />
      </button>
    </div>

    <SettingsSaveBar
      v-if="editing"
      contained
      :dirty="isDirty"
      :submitting="submitting"
      @save="submit"
      @discard="discardEdits"
    />
  </form>
</template>

<style scoped>
.step-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.step-leave-active {
  position: absolute;
  inset-inline: 0;
  top: 0;
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.reveal-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    max-height 0.3s ease;
  overflow: hidden;
  max-height: 400px;
}
.reveal-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    max-height 0.2s ease;
  overflow: hidden;
  max-height: 400px;
}
.reveal-enter-from,
.reveal-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
}
</style>
