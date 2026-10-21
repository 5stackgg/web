import { toast } from "~/components/ui/toast";
import { matchFixMenu, type FixProblemMenu } from "~/utilities/fixProblem";
import { e_sides_enum } from "~/generated/zeus";
import {
  DEMO_LINEUPS,
  DEMO_LIVE_ROUND,
  DEMO_LIVE_ROUND_DAMAGE,
  DEMO_LIVE_ROUND_KILLS,
  DEMO_MATCH_ID,
  DEMO_VETO_CLOCK,
  DEMO_VETO_ORDER,
  demoMatch,
  demoPick,
  demoPicks,
  demoRewindRounds,
  withDecider,
  type DemoPick,
  type DemoStep,
} from "~/utilities/demoMatch";
import { vetoTimelineSteps, type VetoStep } from "~/utilities/rewind";
import { mapVetoSteps } from "~/utilities/vetoLineups";
import { useMatchRoundsFocus } from "~/composables/useMatchRoundsFocus";
import { useVetoOverride } from "~/composables/useVetoOverride";
import { serverNow } from "~/stores/ServerClockStore";

export type { DemoStep };

const MORE_TIME = 30;
const START_PICKS = 4;
// How long a step you jump to shows the end of the step before it.
const JUMP_LEAD_MS = 1500;

type Translate = (key: string, values?: Record<string, unknown>) => string;

// Every fix is on offer in the demo, whatever the viewer's role.
const ALLOWED = {
  bracket: true,
  canSetWinner: true,
  canReboot: true,
  canReparse: true,
};

// The demo's Fix a Problem, built from its match the way a real match's is.
export function demoFixMenu(
  t: Translate,
  state: { step: DemoStep; paused?: boolean; picks?: DemoPick[] },
): FixProblemMenu {
  const picks = state.picks ?? withDecider(demoPicks(8));
  return matchFixMenu(
    t,
    demoMatch({
      step: state.step,
      paused: state.paused,
      picks,
      deadline: new Date().toISOString(),
      rounds: demoRewindRounds({ finished: state.step === "finished" }),
    }),
    picks,
    ALLOWED,
  );
}

const clockFrom = (seconds: number) =>
  new Date(serverNow() + seconds * 1000).toISOString();

export function useDemoMatch() {
  const { t } = useI18n();

  const step = ref<DemoStep>("live");
  // The step being jumped to, while the end of the one before it shows.
  const pending = ref<DemoStep | null>(null);
  const shownStep = computed(() => pending.value ?? step.value);
  const lastRound = ref(false);
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

  const picks = ref<DemoPick[]>(demoPicks(START_PICKS));
  const deadline = ref(clockFrom(DEMO_VETO_CLOCK));
  const vetoFixOpen = ref(false);
  const vetoFixStep = ref(1);
  const { enabled: vetoOverride } = useVetoOverride(() => DEMO_MATCH_ID);

  const rounds = computed(() =>
    demoRewindRounds({
      live: live.value,
      undoneFrom: undoneFrom.value,
      connected: connected.value,
      lastRound: lastRound.value,
    }),
  );

  const finishedRounds = computed(() =>
    demoRewindRounds({ finished: true, connected: true }),
  );

  const roundsData = computed(() =>
    step.value === "finished" ? finishedRounds.value : rounds.value,
  );

  // The veto is over once the match has moved past it.
  const allPicks = computed(() =>
    step.value === "veto" ? picks.value : withDecider(demoPicks(8)),
  );

  const match = computed(() =>
    demoMatch({
      step: step.value,
      paused: paused.value,
      picks: allPicks.value,
      deadline: deadline.value,
      rounds: roundsData.value,
    }),
  );

  const vetoBoardSteps = computed(() =>
    mapVetoSteps(match.value, allPicks.value),
  );
  const vetoSteps = computed<VetoStep[]>(() =>
    vetoTimelineSteps(vetoBoardSteps.value, (id) => id),
  );
  const vetoDone = computed(() => picks.value.length);
  // Nobody chooses the Decider, so the last step anyone took is the one
  // before it, and taking that back takes the Decider with it.
  const lastVetoStep = computed(() =>
    picks.value.at(-1)?.type === "Decider"
      ? picks.value.length - 1
      : picks.value.length,
  );
  const vetoTurn = computed(() =>
    step.value === "veto"
      ? (DEMO_VETO_ORDER[picks.value.length] ?? null)
      : null,
  );

  const lineupName = (lineup: 1 | 2 | null) =>
    lineup ? DEMO_LINEUPS[lineup].name : "";

  function say(title: string, description?: string) {
    toast({ title, description });
  }

  function togglePause() {
    paused.value = !paused.value;
  }

  function startRewind(round?: number | null) {
    fixOpen.value = false;
    tab.value = "rounds";
    target.value = round ?? live.value;
    rewinding.value = true;
    focusRounds.value += 1;
  }

  // Fix a Problem and a map card's restore button ask for the Rounds tab the
  // way they do on a real match.
  const roundsFocus = useMatchRoundsFocus();
  watch(
    () => roundsFocus.request.value,
    (request) => {
      if (request?.matchId === DEMO_MATCH_ID) {
        startRewind(request.round);
      }
    },
  );

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

  function rewindVeto(from: number) {
    const cleared = picks.value.length - from + 1;
    const next = vetoSteps.value[from - 1];
    picks.value = picks.value.slice(0, from - 1);
    vetoFixOpen.value = false;
    deadline.value = clockFrom(DEMO_VETO_CLOCK);
    say(
      t("faq.demo.veto_rewound_title", { step: from, count: cleared }),
      next ? againLabel(next) : undefined,
    );
  }

  function undoLast() {
    if (lastVetoStep.value > 0) {
      rewindVeto(lastVetoStep.value);
    }
  }

  // The board's choice, made the way MatchMapVeto sends it: a side goes with
  // the map picked just before it.
  function vetoMove(choice: { itemId?: string; side?: string }, auto = false) {
    const turn = vetoTurn.value;
    if (!turn || turn.type === "Decider") {
      return;
    }
    const map =
      turn.type === "Side" ? picks.value.at(-1)?.map.id : choice.itemId;
    if (!map || (turn.type === "Side" && !choice.side)) {
      return;
    }
    picks.value = withDecider([
      ...picks.value,
      demoPick(turn.type, turn.lineup, map, {
        side: (choice.side as e_sides_enum | undefined) ?? null,
        auto,
      }),
    ]);
    deadline.value = clockFrom(DEMO_VETO_CLOCK);
  }

  // When a team's clock runs out the api chooses for them.
  let autoTimer: ReturnType<typeof setTimeout> | undefined;
  watch(
    [vetoTurn, deadline],
    ([turn, until]) => {
      clearTimeout(autoTimer);
      if (!import.meta.client || !turn || turn.type === "Decider") {
        return;
      }
      autoTimer = setTimeout(
        () => {
          const taken = new Set(picks.value.map((pick) => pick.map.id));
          const open = match.value.options.map_pool.maps.find(
            (map) => !taken.has(map.id),
          );
          vetoMove(
            turn.type === "Side"
              ? { side: e_sides_enum.CT }
              : { itemId: open?.id },
            true,
          );
        },
        Math.max(0, new Date(until).getTime() - serverNow()),
      );
    },
    { immediate: true },
  );

  watch(step, (now, before) => {
    fixOpen.value = false;
    flow.value = null;
    rewinding.value = false;
    vetoFixOpen.value = false;
    if (now === "veto" && before !== "veto") {
      deadline.value = clockFrom(DEMO_VETO_CLOCK);
    }
    if (now === "finished") {
      paused.value = false;
    }
  });

  // A step you pick starts from the end of the one before it, so the move
  // into it plays: live from the finished veto, finished from the map's last
  // round. Nothing comes before the veto, so it starts afresh.
  let jumpTimer: ReturnType<typeof setTimeout> | undefined;
  function jumpTo(next: DemoStep) {
    clearTimeout(jumpTimer);
    pending.value = null;
    lastRound.value = false;
    if (next === "veto") {
      picks.value = demoPicks(START_PICKS);
      deadline.value = clockFrom(DEMO_VETO_CLOCK);
      step.value = "veto";
      return;
    }
    if (next === "live") {
      picks.value = withDecider(demoPicks(8));
      step.value = "veto";
    } else {
      live.value = DEMO_LIVE_ROUND;
      undoneFrom.value = null;
      paused.value = false;
      lastRound.value = true;
      step.value = "live";
    }
    pending.value = next;
    jumpTimer = setTimeout(() => {
      pending.value = null;
      lastRound.value = false;
      step.value = next;
    }, JUMP_LEAD_MS);
  }

  onBeforeUnmount(() => {
    clearTimeout(jumpTimer);
    clearTimeout(autoTimer);
    vetoOverride.value = false;
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
    picks.value = demoPicks(START_PICKS);
    deadline.value = clockFrom(DEMO_VETO_CLOCK);
    vetoFixOpen.value = false;
    vetoOverride.value = false;
  }

  const fixItems = computed(() =>
    matchFixMenu(t, match.value, allPicks.value, ALLOWED),
  );

  function selectFix(key: string) {
    fixOpen.value = false;
    switch (key) {
      case "restore":
        roundsFocus.focus(DEMO_MATCH_ID);
        return;
      case "undo_last":
        undoLast();
        return;
      case "mispick":
        vetoFixStep.value = Math.max(1, lastVetoStep.value);
        vetoFixOpen.value = true;
        return;
      case "redo":
        vetoFixStep.value = 1;
        vetoFixOpen.value = true;
        return;
      case "act":
        vetoOverride.value = true;
        say(
          t("match.fix_menu.act_toast", {
            team: lineupName(vetoTurn.value?.lineup ?? null),
          }),
        );
        return;
      case "time":
        deadline.value = new Date(
          new Date(deadline.value).getTime() + MORE_TIME * 1000,
        ).toISOString();
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
    shownStep,
    jumpTo,
    connected,
    tab,
    fixOpen,
    flow,
    focusRounds,
    rounds,
    finishedRounds,
    roundsData,
    live,
    liveKills,
    liveDamage,
    rewinding,
    target,
    paused,
    match,
    picks: allPicks,
    vetoBoardSteps,
    vetoSteps,
    vetoDone,
    vetoFixOpen,
    vetoFixStep,
    vetoOverride,
    fixItems,
    togglePause,
    startRewind,
    restore,
    rewindVeto,
    vetoMove,
    selectFix,
    reset,
  };
}
