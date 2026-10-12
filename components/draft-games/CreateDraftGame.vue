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
  UserMinus,
  Lock,
  X,
} from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
import { useQuery } from "@vue/apollo-composable";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import matchOptionsValidator from "~/utilities/match-options-validator";
import {
  canSetGameMode,
  setupOptions,
  setupOptionsVariables,
} from "~/utilities/setupOptions";
import { generateQuery } from "~/graphql/graphqlGen";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { Fold } from "~/components/ui/transitions";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import MatchOptions from "~/components/MatchOptions.vue";
import DraftModePicker from "~/components/draft-games/DraftModePicker.vue";
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

const mode = ref<string>(source?.mode || "Pug");
const access = ref<string>(source?.access || "Friends");
const requireApproval = ref<boolean>(source?.require_approval ?? false);
const captainSelection = ref<string>(source?.captain_selection || "TopEloTwo");
const draftOrder = ref<string>(source?.draft_order || "Snake");

// Organizers can open a lobby they manage without being added as a player via
// the "Host Only" toggle in the lobby rules section. Defaults on (host plays).
const hostJoins = ref<boolean>(true);
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

const rosterAssignment = ref<
  Array<{ steam_id: string; lineup: number | null; side: number | null }>
>([]);

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

// A draft room only offers modes flagged for draft lobbies (competitive_safe
// curates this list, nothing else -- custom modes never count toward ELO).
// Otherwise mirrors MatchOptions's "available" rule: enabled, and loadable on
// the server runtime.
const applicationSettings = useApplicationSettingsStore();
const modesQueryEnabled = computed(
  () => canSetGameMode() && applicationSettings.gamePluginsEnabled,
);
const { result: gameModesResult } = useQuery(
  generateQuery({
    game_modes: [
      {},
      {
        id: true,
        name: true,
        description: true,
        enabled: true,
        competitive_safe: true,
        supported_runtimes: [{}, true],
      },
    ],
  }),
  null,
  () => ({ fetchPolicy: "cache-first", enabled: modesQueryEnabled.value }),
);
const draftEligibleModes = computed<Array<Record<string, any>>>(() =>
  ((gameModesResult.value as any)?.game_modes ?? []).filter(
    (gameMode: Record<string, any>) =>
      gameMode.enabled &&
      gameMode.competitive_safe &&
      (gameMode.supported_runtimes ?? []).includes(
        applicationSettings.gameServerPluginRuntime,
      ),
  ),
);
// With nothing but Competitive to pick, the section has one answer -- drop it
// rather than make the host scroll past it.
const hasModeStep = computed(() => draftEligibleModes.value.length > 0);

const formatSection = ref<HTMLElement | null>(null);

const sectionNumbers = computed(() => {
  const order = ["format", "settings"];
  if (hasModeStep.value) {
    order.push("mode");
  }
  order.push("rules");
  return Object.fromEntries(order.map((key, index) => [key, index + 1]));
});

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

// Once the list has settled, a rehosted/edited room carrying a mode that is no
// longer offered here (archived, pulled from draft lobbies, role lost) falls
// back to Competitive instead of silently submitting the stale id. Settled
// means the settings too: the list is filtered on the plugin runtime, which
// is a default until the settings subscription delivers.
const modesSettled = computed(
  () =>
    applicationSettings.settingsLoaded &&
    (!modesQueryEnabled.value || gameModesResult.value !== undefined),
);
watch(
  [modesSettled, draftEligibleModes, () => form.values.game_mode_id],
  ([settled, modes, selected]) => {
    if (
      settled &&
      selected &&
      !modes.some((gameMode) => gameMode.id === selected)
    ) {
      form.setFieldValue("game_mode_id", "");
    }
  },
);

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
  Rush: 3,
  Competitive: 5,
  Premier: 5,
  Faceit: 5,
};
const perTeam = computed(() => PER_TEAM[matchType.value] || 5);

// A team lobby only seats `perTeam` players a side, so anyone the host benched
// in the roster picker can only reach the match through a substitute slot.
const TEAM_MODE_MIN_SUBSTITUTES = 2;
watch(
  () => [mode.value, team1Id.value, team2Id.value],
  () => {
    if (props.editing || props.settingsOnly) {
      return;
    }
    if (mode.value !== "Teams" || !team1Id.value) {
      return;
    }
    if ((form.values.number_of_substitutes ?? 0) >= TEAM_MODE_MIN_SUBSTITUTES) {
      return;
    }
    form.setFieldValue("number_of_substitutes", TEAM_MODE_MIN_SUBSTITUTES);
  },
  { immediate: true },
);

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

// Mirrors get_draft_game_pattern so the host sees the exact pick sequence
// this lobby size produces.
const draftPattern = computed(() => {
  const picks = perTeam.value * 2 - 2;
  const perSide = perTeam.value - 1;
  const counts: Record<number, number> = { 1: 0, 2: 0 };
  const pattern: Array<number> = [];
  for (let index = 0; index < picks; index++) {
    let side: number;
    if (draftOrder.value === "Alternating") {
      side = index % 2 === 0 ? 1 : 2;
    } else if (draftOrder.value === "FrontLoaded") {
      side = index === 0 ? 1 : index <= 2 ? 2 : index % 2 === 1 ? 1 : 2;
    } else {
      side =
        Math.floor(index / 2) % 2 === 0
          ? index % 2 === 0
            ? 1
            : 2
          : index % 2 === 0
            ? 2
            : 1;
    }
    if (counts[side] >= perSide) {
      side = side === 1 ? 2 : 1;
    }
    counts[side]++;
    pattern.push(side);
  }
  return pattern;
});

const modeLabel = computed(() => {
  const option = modeOptions.find((o) => o.value === mode.value);
  return option ? t(option.label) : "";
});

const accessLabel = computed(() => {
  const option = accessOptions.find((o) => o.value === access.value);
  return option ? t(option.label) : "";
});

const formatLine = computed(() =>
  [matchType.value, `${perTeam.value}v${perTeam.value}`]
    .filter(Boolean)
    .join(" · "),
);

const rankLabel = computed(() =>
  rankGated.value
    ? `${rankRange.value[0]}–${
        rankRange.value[1] === RANK_MAX ? "∞" : rankRange.value[1]
      }`
    : t("draft_games.filters.any"),
);

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
    formatSection.value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
    class="create-draft"
    @submit.prevent="submit"
    @pointerdown.capture="interacted = true"
    @keydown.capture="interacted = true"
  >
    <div class="create-draft-grid">
      <div class="create-draft-sections space-y-4">
        <section
          ref="formatSection"
          class="scroll-mt-4 rounded-xl border border-border bg-card/40 p-5"
          aria-labelledby="create-draft-format"
        >
          <h2
            id="create-draft-format"
            class="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ sectionNumbers.format }} ·
            {{ $t("draft_games.create.step_format") }}
          </h2>
          <div class="space-y-5">
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
            <p v-else class="text-[0.72rem] leading-snug text-muted-foreground">
              {{ $t("draft_games.create.no_formats") }}
            </p>

            <Fold :open="showKeepTogether">
              <section>
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
            </Fold>

            <!-- Picking Teams used to detonate this whole section (two combos +
                 the roster picker) in one frame while its neighbours animated. -->
            <Fold :open="mode === 'Teams'">
            <section>
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
                  :ineligible="
                    team2Id
                      ? { [team2Id]: $t('team.search.ineligible.other_side') }
                      : {}
                  "
                  @selected="(team) => (team1Id = team.id)"
                />
                <div v-if="!innerSquad" class="flex items-center gap-2">
                  <div class="min-w-0 flex-1">
                    <TeamSearch
                      :label="$t('draft_games.create.team_2_optional')"
                      :model-value="team2Id"
                      :min-players="perTeam"
                      :ineligible="
                        team1Id
                          ? { [team1Id]: $t('team.search.ineligible.other_side') }
                          : {}
                      "
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

              <Fold :open="!!team1Id && !team2Id">
                <div
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
              </Fold>

              <Fold :open="!!team1Id">
              <div class="mt-4">
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
              </Fold>
            </section>
            </Fold>

            <Fold :open="mode === 'Captains'">
              <section class="space-y-4">
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
                  <ol
                    v-if="draftPattern.length"
                    class="mt-1 flex flex-wrap gap-1"
                    :aria-label="$t('draft_games.room.pick_order')"
                  >
                    <li
                      v-for="(side, index) in draftPattern"
                      :key="index"
                      class="order-chip"
                      :class="side === 2 ? 'is-bravo' : ''"
                    >
                      <span class="text-muted-foreground">{{ index + 1 }}</span>
                      T{{ side }}
                    </li>
                  </ol>
                </div>
              </section>
            </Fold>
          </div>
        </section>

        <section
          class="rounded-xl border border-border bg-card/40 p-5"
          aria-labelledby="create-draft-settings"
        >
          <h2
            id="create-draft-settings"
            class="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ sectionNumbers.settings }} ·
            {{ $t("draft_games.create.step_settings") }}
          </h2>
          <MatchOptions :form="form" hide-game-mode />
        </section>

        <section
          v-if="hasModeStep"
          class="rounded-xl border border-border bg-card/40 p-5"
          aria-labelledby="create-draft-mode"
        >
          <h2
            id="create-draft-mode"
            class="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ sectionNumbers.mode }} ·
            {{ $t("draft_games.create.step_mode") }}
          </h2>
          <p class="mb-3 text-sm text-muted-foreground">
            {{ $t("draft_games.create.mode_description") }}
          </p>
          <DraftModePicker :form="form" :modes="draftEligibleModes" />
        </section>

        <section
          class="rounded-xl border border-border bg-card/40 p-5"
          aria-labelledby="create-draft-rules"
        >
          <h2
            id="create-draft-rules"
            class="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em]"
          >
            <span :class="tacticalSectionTickClasses"></span>
            {{ sectionNumbers.rules }} ·
            {{ $t("draft_games.create.step_rules") }}
          </h2>
          <div class="space-y-5">
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

            <section>
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("draft_games.create.require_approval") }}
              </div>
              <div
                class="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.4)]"
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
                  <div class="text-[0.72rem] leading-snug text-muted-foreground">
                    {{ $t("draft_games.create.require_approval_desc") }}
                  </div>
                </div>
                <Switch
                  class="pointer-events-none"
                  :model-value="requireApproval"
                />
              </div>
            </section>

            <section v-if="canHostForOthers && !editing">
              <div :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("draft_games.create.host_only") }}
              </div>
              <div
                class="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-[hsl(var(--tac-amber)/0.4)]"
                :class="{
                  'border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)]':
                    !hostJoins,
                }"
                @click="hostJoins = !hostJoins"
              >
                <div class="flex items-center gap-3">
                  <UserMinus
                    class="h-5 w-5 shrink-0"
                    :class="
                      !hostJoins
                        ? 'text-[hsl(var(--tac-amber))]'
                        : 'text-muted-foreground'
                    "
                  />
                  <div class="text-[0.72rem] leading-snug text-muted-foreground">
                    {{ $t("draft_games.create.host_only_desc") }}
                  </div>
                </div>
                <Switch class="pointer-events-none" :model-value="!hostJoins" />
              </div>
            </section>
          </div>
        </section>
      </div>

      <aside
        v-if="!editing"
        class="create-draft-aside"
        :aria-label="$t('draft_games.create.preview')"
      >
        <div class="space-y-4 rounded-xl border border-border bg-card/40 p-5">
          <div>
            <div
              class="font-sans text-sm font-bold uppercase tracking-[0.18em]"
            >
              {{ modeLabel }}
            </div>
            <div
              class="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ formatLine }}
            </div>
          </div>

          <div v-if="mode === 'Captains' && draftPattern.length">
            <div class="summary-label mb-2">
              {{ $t("draft_games.room.pick_order") }}
            </div>
            <ol class="flex flex-wrap gap-1">
              <li
                v-for="(side, index) in draftPattern"
                :key="index"
                class="order-chip"
                :class="side === 2 ? 'is-bravo' : ''"
              >
                T{{ side }}
              </li>
            </ol>
          </div>

          <dl
            class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-dotted border-border pt-3 text-sm"
          >
            <dt class="summary-label">
              {{ $t("draft_games.create.access") }}
            </dt>
            <dd class="font-semibold">{{ accessLabel }}</dd>
            <dt class="summary-label">
              {{ $t("draft_games.create.rank_range") }}
            </dt>
            <dd class="font-semibold tabular-nums">{{ rankLabel }}</dd>
            <dt class="summary-label">
              {{ $t("draft_games.create.require_approval") }}
            </dt>
            <dd class="font-semibold">
              {{
                requireApproval
                  ? $t("draft_games.bar.on")
                  : $t("draft_games.bar.off")
              }}
            </dd>
          </dl>
        </div>

        <button
          type="button"
          :class="[
            tacticalCtaButtonClasses,
            'create-draft-cta relative h-12 w-full !py-0 disabled:cursor-default',
          ]"
          :disabled="submitting"
          @click="submit"
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
      </aside>
    </div>

    <div v-if="!editing" class="create-draft-bar">
      <span
        class="min-w-0 flex-1 truncate font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ modeLabel }} · {{ formatLine }}
      </span>
      <button
        type="button"
        :class="[
          tacticalCtaButtonClasses,
          'relative h-9 !py-0 disabled:cursor-default',
        ]"
        :disabled="submitting"
        @click="submit"
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
.create-draft {
  container-type: inline-size;
}
.create-draft-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1.25rem;
}
.create-draft-sections {
  flex: 999 1 640px;
  min-width: 0;
}
.create-draft-aside {
  display: flex;
  flex: 1 1 300px;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
}
.create-draft-cta {
  display: none;
}
.create-draft-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  border-top: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--background) / 0.9);
  padding: 1rem 0;
  backdrop-filter: blur(8px);
}
@container (min-width: 980px) {
  .create-draft-aside {
    position: sticky;
    top: 1rem;
  }
  .create-draft-cta {
    display: inline-flex;
  }
  .create-draft-bar {
    display: none;
  }
}
.summary-label {
  align-self: center;
  font-family: var(--font-mono, monospace);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground));
}
.order-chip {
  --chip: var(--tac-amber);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 0.3rem;
  border: 1px solid hsl(var(--chip) / 0.45);
  background: hsl(var(--chip) / 0.08);
  padding: 0.15rem 0.4rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  font-weight: 700;
  color: hsl(var(--chip));
}
.order-chip.is-bravo {
  --chip: var(--tac-blue);
}
</style>
