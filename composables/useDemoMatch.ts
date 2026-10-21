import { toast } from "~/components/ui/toast";
import { fixProblemItems, type FixProblemMenu } from "~/utilities/fixProblem";
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";
import {
  DEMO_LINEUPS,
  DEMO_LIVE_ROUND,
  DEMO_LIVE_ROUND_DAMAGE,
  DEMO_LIVE_ROUND_KILLS,
  DEMO_MAP_POOL,
  DEMO_VETO,
  demoRewindRounds,
} from "~/utilities/demoMatch";
import { type VetoStep } from "~/utilities/rewind";
import mapLabel from "~/utilities/mapLabel";

export type DemoStep = "veto" | "live" | "finished";

const VETO_CLOCK = 45;
const MORE_TIME = 30;

type Translate = (key: string, values?: Record<string, unknown>) => string;

// The demo's Fix a Problem, built by the same rules as a real match's.
export function demoFixMenu(
  t: Translate,
  state: {
    step: DemoStep;
    paused?: boolean;
    picks?: VetoStep[];
    current?: VetoStep | null;
  },
): FixProblemMenu {
  const picks = state.picks ?? [];
  const last = picks.at(-1);
  const team = (lineup: 1 | 2 | null) =>
    lineup ? DEMO_LINEUPS[lineup].name : "";
  const status =
    state.step === "veto"
      ? e_match_status_enum.Veto
      : state.step === "live"
        ? e_match_status_enum.Live
        : e_match_status_enum.Finished;
  return fixProblemItems(t, {
    status,
    stepLabel:
      state.step === "veto"
        ? t("match.admin_bar.steps.veto")
        : state.step === "finished"
          ? t("match.admin_bar.steps.finished")
          : state.paused
            ? t("match.admin_bar.steps.paused")
            : t("match.admin_bar.steps.live"),
    hasWinner: state.step === "finished",
    currentMapStatus:
      state.step === "live" ? (state.paused ? "Paused" : "Live") : null,
    mapsStarted: state.step !== "veto",
    rush: false,
    bracket: true,
    mapVeto: true,
    vetoPicks: state.step === "veto" ? picks.length : 9,
    vetoTeam: state.current ? team(state.current.lineup) : null,
    vetoClockRunning: state.step === "veto" && !!state.current,
    lastPick: last
      ? { team: team(last.lineup), map: mapLabel({ name: last.map }) }
      : null,
    canSetWinner: true,
    canReboot: true,
    canReparse: true,
  });
}

export function useDemoMatch() {
  const { t } = useI18n();

  const step = ref<DemoStep>("live");
  const connected = ref(false);
  const tab = ref<"scoreboard" | "rounds">("scoreboard");
  const fixOpen = ref(false);
  const flow = ref<string | null>(null);
  const focusRounds = ref(0);

  const live = ref(DEMO_LIVE_ROUND);
  const undoneFrom = ref<number | null>(null);
  const liveKills = ref(DEMO_LIVE_ROUND_KILLS);
  const liveDamage = ref(DEMO_LIVE_ROUND_DAMAGE);
  const rewinding = ref(false);
  const target = ref<number | null>(null);
  const paused = ref(false);

  const vetoPicks = ref<VetoStep[]>(DEMO_VETO.slice(0, 4));
  const vetoFixOpen = ref(false);
  const vetoFixStep = ref(1);
  const actingForTeam = ref(false);
  const clock = ref(VETO_CLOCK);

  const rounds = computed(() =>
    demoRewindRounds({
      live: live.value,
      undoneFrom: undoneFrom.value,
      connected: connected.value,
    }),
  );

  const finishedRounds = computed(() =>
    demoRewindRounds({ finished: true, connected: true }),
  );

  const vetoSteps = computed<VetoStep[]>(() =>
    DEMO_VETO.map((pattern, index) => vetoPicks.value[index] ?? pattern),
  );
  const vetoDone = computed(() => vetoPicks.value.length);
  const vetoCurrent = computed(() => DEMO_VETO[vetoDone.value] ?? null);

  const lineupName = (lineup: 1 | 2 | null) =>
    lineup ? DEMO_LINEUPS[lineup].name : "";

  const fakeMatch = computed(() => ({
    status:
      step.value === "veto"
        ? e_match_status_enum.Veto
        : step.value === "live"
          ? e_match_status_enum.Live
          : e_match_status_enum.Finished,
    options: { map_veto: true, region_veto: false, knife_round: false },
    match_maps: [
      {
        is_current_map: true,
        status:
          step.value === "finished"
            ? e_match_map_status_enum.Finished
            : paused.value
              ? e_match_map_status_enum.Paused
              : e_match_map_status_enum.Live,
      },
    ],
  }));

  function say(title: string, description?: string) {
    toast({ title, description });
  }

  function resume() {
    paused.value = false;
  }

  function startRewind(round?: number) {
    fixOpen.value = false;
    tab.value = "rounds";
    target.value = round ?? live.value;
    rewinding.value = true;
    focusRounds.value += 1;
  }

  function restore(round: number) {
    const lastUndone = undoneFrom.value === null ? 0 : DEMO_LIVE_ROUND - 1;
    if (round < live.value) {
      undoneFrom.value = round;
    } else if (round > live.value) {
      undoneFrom.value = round <= lastUndone ? round : null;
    }
    live.value = round;
    liveKills.value = 0;
    liveDamage.value = 0;
    rewinding.value = false;
    target.value = null;
    paused.value = true;
    say(
      t("faq.demo.restored_title", { round }),
      t("faq.demo.restored_description"),
    );
  }

  function rewindVeto(from: number) {
    const cleared = vetoPicks.value.length - from + 1;
    vetoPicks.value = vetoPicks.value.slice(0, from - 1);
    vetoFixOpen.value = false;
    clock.value = VETO_CLOCK;
    const next = DEMO_VETO[from - 1];
    say(
      t("faq.demo.veto_rewound_title", { step: from, count: cleared }),
      againLabel(next),
    );
  }

  function againLabel(next: VetoStep) {
    const team = lineupName(next.lineup);
    switch (next.type) {
      case "Ban":
        return t("match.veto_rewind.again_ban", { team });
      case "Pick":
        return t("match.veto_rewind.again_pick", { team });
      case "Side":
        return t("match.veto_rewind.again_side", { team });
      default:
        return t("match.veto_rewind.again_decider");
    }
  }

  function undoLast() {
    if (vetoDone.value > 0) {
      rewindVeto(vetoDone.value);
    }
  }

  function chooseForTeam(map: string, side?: VetoStep["side"]) {
    const current = vetoCurrent.value;
    if (!current) {
      return;
    }
    const picks = [...vetoPicks.value, { ...current, map, side }];
    const remaining = DEMO_VETO.length - 1;
    if (picks.length === remaining) {
      const used = new Set(picks.map((pick) => pick.map));
      const decider = DEMO_MAP_POOL.find((candidate) => !used.has(candidate));
      if (decider) {
        picks.push({ ...DEMO_VETO[remaining], map: decider });
      }
    }
    vetoPicks.value = picks;
    actingForTeam.value = false;
    clock.value = VETO_CLOCK;
  }

  let clockTimer: ReturnType<typeof setInterval> | undefined;
  watch(
    [step, vetoCurrent],
    ([now, current]) => {
      clearInterval(clockTimer);
      if (now === "veto" && current && import.meta.client) {
        clockTimer = setInterval(() => {
          clock.value = Math.max(0, clock.value - 1);
        }, 1000);
      }
    },
    { immediate: true },
  );

  watch(step, () => {
    fixOpen.value = false;
    flow.value = null;
    rewinding.value = false;
    vetoFixOpen.value = false;
    actingForTeam.value = false;
    if (step.value === "finished") {
      resume();
    }
  });

  onBeforeUnmount(() => {
    clearInterval(clockTimer);
  });

  function reset() {
    connected.value = false;
    tab.value = "scoreboard";
    fixOpen.value = false;
    live.value = DEMO_LIVE_ROUND;
    undoneFrom.value = null;
    liveKills.value = DEMO_LIVE_ROUND_KILLS;
    liveDamage.value = DEMO_LIVE_ROUND_DAMAGE;
    rewinding.value = false;
    target.value = null;
    paused.value = false;
    vetoPicks.value = DEMO_VETO.slice(0, 4);
    vetoFixOpen.value = false;
    actingForTeam.value = false;
    clock.value = VETO_CLOCK;
  }

  const fixItems = computed(() =>
    demoFixMenu(t, {
      step: step.value,
      paused: paused.value,
      picks: vetoPicks.value,
      current: vetoCurrent.value,
    }),
  );

  function selectFix(key: string) {
    fixOpen.value = false;
    switch (key) {
      case "restore":
        startRewind();
        return;
      case "undo_last":
        undoLast();
        return;
      case "mispick":
        vetoFixStep.value = Math.max(1, vetoDone.value);
        vetoFixOpen.value = true;
        return;
      case "redo":
        vetoFixStep.value = 1;
        vetoFixOpen.value = true;
        return;
      case "act":
        actingForTeam.value = true;
        return;
      case "time":
        clock.value += MORE_TIME;
        say(t("match.fix_menu.time_added", { seconds: MORE_TIME }));
        return;
      case "reparse":
        say(
          t("match.actions.reparse_demos_started"),
          t("faq.demo.nothing_changed"),
        );
        return;
      case "reboot":
        flow.value = "server";
        return;
      case "restart":
        flow.value = step.value === "finished" ? "replay" : "restart";
        return;
      default:
        flow.value = key;
    }
  }

  return {
    step,
    connected,
    tab,
    fixOpen,
    flow,
    focusRounds,
    rounds,
    finishedRounds,
    live,
    liveKills,
    liveDamage,
    rewinding,
    target,
    paused,
    vetoSteps,
    vetoDone,
    vetoCurrent,
    vetoFixOpen,
    vetoFixStep,
    actingForTeam,
    clock,
    fakeMatch,
    fixItems,
    lineupName,
    againLabel,
    startRewind,
    restore,
    resume,
    rewindVeto,
    undoLast,
    chooseForTeam,
    selectFix,
    reset,
  };
}
