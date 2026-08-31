<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { CheckCircle2, ShieldAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import CheckInDeadline from "~/components/match/CheckInDeadline.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { toast } from "~/components/ui/toast";
import { e_tournament_status_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useAuthStore } from "~/stores/AuthStore";
import { dateLocale } from "~/utilities/dateLocale";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  tournament: Record<string, any>;
  // The new tournaments columns, fetched separately by TournamentDetail so a
  // pre-migration schema can only break this panel, never the whole page.
  registration?: Record<string, any> | null;
  // Every tournament_team with its check-in stamp and roster stamps. Empty
  // until the parent's check-in subscription resolves.
  teams?: Array<Record<string, any>> | null;
  myTeamId?: string | null;
  // The viewer's own tournament_free_agents row, when they have one. An
  // undrafted free agent has no tournament_teams row at all, so nothing else
  // in this panel can see them.
  myFreeAgent?: Record<string, any> | null;
}>();

const emit = defineEmits<{ (e: "register"): void }>();

const { t } = useI18n();
const { client } = useApolloClient();

// The window boundaries are wall-clock, not row changes: nothing in the
// database moves at the moment check-in opens or closes, so a panel driven
// only by the subscription would sit on a stale state until some unrelated
// write woke it. One second, and only while check-in is actually required --
// most tournaments do not require it at all, and there the panel renders
// nothing while every computed below it is invalidated sixty times a minute.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | null = null;

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

const me = computed(() => useAuthStore().me);

const checkInRequired = computed(
  () => props.registration?.check_in_required === true,
);

// onMounted, so the interval is never started during SSR, and watched rather
// than read once: `registration` is fetched separately and arrives after the
// first render.
onMounted(() => {
  watch(
    checkInRequired,
    (required) => {
      stopTicker();

      if (!required) {
        return;
      }

      now.value = Date.now();
      ticker = setInterval(() => {
        now.value = Date.now();
      }, 1000);
    },
    { immediate: true },
  );
});

onBeforeUnmount(stopTicker);

const checkInSetting = computed<string>(
  () => props.registration?.check_in_setting ?? "Captains",
);

const startMs = computed(() => {
  const start = props.tournament?.start;
  if (!start) {
    return null;
  }
  const ms = new Date(start).getTime();
  return Number.isNaN(ms) ? null : ms;
});

// The organizer configures offsets; only the close edge is ever written to the
// row (check_in_ends_at, stamped when the job opens the window). The open edge
// therefore has to be reconstructed from start minus the offset.
const opensAtMs = computed(() => {
  const minutes = props.registration?.check_in_opens_before_minutes;
  if (startMs.value === null || minutes == null) {
    return null;
  }
  return startMs.value - Number(minutes) * 60_000;
});

const closesAtMs = computed(() => {
  const stamped = props.registration?.check_in_ends_at;
  if (stamped) {
    const ms = new Date(stamped).getTime();
    if (!Number.isNaN(ms)) {
      return ms;
    }
  }
  const minutes = props.registration?.check_in_closes_before_minutes;
  if (startMs.value === null || minutes == null) {
    return null;
  }
  return startMs.value - Number(minutes) * 60_000;
});

const opensAtIso = computed(() =>
  opensAtMs.value === null ? null : new Date(opensAtMs.value).toISOString(),
);
const closesAtIso = computed(() =>
  closesAtMs.value === null ? null : new Date(closesAtMs.value).toISOString(),
);
const startIso = computed(() =>
  startMs.value === null ? null : new Date(startMs.value).toISOString(),
);

// check_in_started is a one-way latch on the server, so OR-ing the local clock
// into it can only ever make the panel earlier, never resurrect a closed
// window. That matters because the row is not written until the job ticks.
const windowStarted = computed(() => {
  if (!checkInRequired.value) {
    return false;
  }
  if (props.registration?.check_in_started === true) {
    return true;
  }
  return opensAtMs.value !== null && now.value >= opensAtMs.value;
});

const windowOpen = computed(
  () =>
    windowStarted.value &&
    closesAtMs.value !== null &&
    now.value < closesAtMs.value,
);

const windowClosed = computed(() => windowStarted.value && !windowOpen.value);

const myTeam = computed(() => {
  const teams = props.teams ?? [];
  if (props.myTeamId) {
    return teams.find((team) => team.id === props.myTeamId) ?? null;
  }
  const steamId = me.value?.steam_id;
  if (!steamId) {
    return null;
  }
  return (
    teams.find(
      (team) =>
        team.owner_steam_id === steamId ||
        (team.roster ?? []).some(
          (member: Record<string, any>) => member.player_steam_id === steamId,
        ),
    ) ?? null
  );
});

const myTeamCheckedIn = computed(() => !!myTeam.value?.checked_in_at);

// checkIntoTournament stamps an undrafted free agent's own row and returns
// before it ever looks at check_in_setting, and ProcessTournamentCheckIn
// UNIONs free agents into the "confirm your spot" push. A team-shaped panel is
// why twenty people got that push and had nowhere to act on it.
const freeAgent = computed(() =>
  !myTeam.value && props.myFreeAgent ? props.myFreeAgent : null,
);

const isFreeAgent = computed(() => freeAgent.value !== null);

const freeAgentCheckedIn = computed(() => !!freeAgent.value?.checked_in_at);

function teamName(team: Record<string, any> | null | undefined) {
  return team?.name || team?.team?.name || t("common.untitled");
}

function teamInitials(team: Record<string, any> | null | undefined) {
  const source =
    team?.short_name || team?.team?.short_name || teamName(team) || "?";
  return String(source).slice(0, 2).toUpperCase();
}

function formatClock(iso: string | null) {
  if (!iso) {
    return "--:--";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const opensAtLabel = computed(() => formatClock(opensAtIso.value));
const closesAtLabel = computed(() => formatClock(closesAtIso.value));

const checkedInTeamCount = computed(
  () => (props.teams ?? []).filter((team) => !!team.checked_in_at).length,
);

const isPlayersMode = computed(() => checkInSetting.value === "Players");
const isAdminMode = computed(() => checkInSetting.value === "Admin");

const minPlayers = computed(
  () => Number(props.tournament?.min_players_per_lineup) || 0,
);

// Stable order first — captain, then roster admins, then alphabetical — so the
// list does not reshuffle under the reader every time someone confirms.
const myRoster = computed(() => {
  const roster = [...((myTeam.value?.roster as any[]) ?? [])];
  const captainSteamId = myTeam.value?.captain_steam_id;
  return roster.sort((a, b) => {
    const aCaptain = a.player_steam_id === captainSteamId ? 0 : 1;
    const bCaptain = b.player_steam_id === captainSteamId ? 0 : 1;
    if (aCaptain !== bCaptain) {
      return aCaptain - bCaptain;
    }
    const aAdmin = a.role === "Admin" ? 0 : 1;
    const bAdmin = b.role === "Admin" ? 0 : 1;
    if (aAdmin !== bAdmin) {
      return aAdmin - bAdmin;
    }
    return String(a.player?.name ?? "").localeCompare(
      String(b.player?.name ?? ""),
    );
  });
});

const myRosterCheckedInCount = computed(
  () => myRoster.value.filter((member) => !!member.checked_in_at).length,
);

// The trigger rolls a team up once ANY min_players_per_lineup members have
// confirmed — it does not care which. So "not needed" is the surplus at the
// tail of the un-confirmed players, recomputed as people check in, rather than
// a fixed starter/substitute split the schema does not actually have.
const myRosterRows = computed(() => {
  let stillNeeded = Math.max(0, minPlayers.value - myRosterCheckedInCount.value);
  return myRoster.value.map((member) => {
    const checkedIn = !!member.checked_in_at;
    let state: "checked_in" | "waiting" | "not_needed";
    if (checkedIn) {
      state = "checked_in";
    } else if (stillNeeded > 0) {
      stillNeeded -= 1;
      state = "waiting";
    } else {
      state = "not_needed";
    }
    return {
      key: String(member.player_steam_id),
      player: member.player,
      isCaptain: member.player_steam_id === myTeam.value?.captain_steam_id,
      isMe: member.player_steam_id === me.value?.steam_id,
      checkedInAt: member.checked_in_at,
      state,
    };
  });
});

const myRosterEntry = computed(() =>
  myRoster.value.find(
    (member) => member.player_steam_id === me.value?.steam_id,
  ),
);

// can_manage IS can_manage_tournament_team — the predicate the API accepts. It
// is true for a tournament_team_roster row with role = 'Admin' and for the
// linked team's own owner/captain/Admin as well, none of which re-deriving from
// captain_steam_id/owner_steam_id would find.
const canManageMyTeam = computed(() => myTeam.value?.can_manage === true);

// Marking OTHER teams present, which is Admin mode and the organizer alone.
const canMarkTeamsPresent = computed(
  () =>
    windowOpen.value &&
    isAdminMode.value &&
    props.tournament?.is_organizer === true,
);

// Confirming for MYSELF. The API enforces the same rules; offering a button
// the server will reject is worse than offering none, so the gate is
// duplicated verbatim.
const canCheckInSelf = computed(() => {
  if (!windowOpen.value) {
    return false;
  }
  // The action stamps an undrafted free agent's own row and returns before it
  // ever reaches the check_in_setting switch, so the mode never gates them —
  // including in Admin mode, where nobody would mark a team-less player in.
  if (isFreeAgent.value) {
    return !freeAgentCheckedIn.value;
  }
  if (isAdminMode.value) {
    return false;
  }
  if (isPlayersMode.value) {
    return !!myRosterEntry.value && !myRosterEntry.value.checked_in_at;
  }
  return canManageMyTeam.value && !myTeamCheckedIn.value;
});

const registrationOpen = computed(
  () =>
    props.tournament?.status === e_tournament_status_enum.RegistrationOpen,
);

// An organizer watching a Captains-mode window is reading the field, not being
// asked to do anything — the open state has to speak to them differently. A
// free agent is a participant, not an observer, even with no team row.
const isObserver = computed(() => !myTeam.value && !isFreeAgent.value);

const openHeading = computed(() => {
  if (isFreeAgent.value) {
    return t("tournament.check_in.free_agent_heading");
  }
  if (isObserver.value && !isAdminMode.value) {
    return t("tournament.check_in.observer_heading");
  }
  if (isPlayersMode.value) {
    return t("tournament.check_in.players_heading");
  }
  if (isAdminMode.value) {
    return t("tournament.check_in.admin_heading");
  }
  return t("tournament.check_in.confirm_heading");
});

const openHint = computed(() => {
  if (isFreeAgent.value) {
    return t("tournament.check_in.free_agent_hint", {
      time: closesAtLabel.value,
    });
  }
  if (isObserver.value && !isAdminMode.value) {
    return t("tournament.check_in.observer_hint", { time: closesAtLabel.value });
  }
  if (isPlayersMode.value) {
    return t("tournament.check_in.players_hint", { count: minPlayers.value });
  }
  if (isAdminMode.value) {
    return t("tournament.check_in.admin_hint");
  }
  return t("tournament.check_in.confirm_hint", { time: closesAtLabel.value });
});

const openChip = computed(() => {
  if (isPlayersMode.value && !isObserver.value && !isFreeAgent.value) {
    return t("tournament.check_in.players_progress", {
      checked: myRosterCheckedInCount.value,
      required: minPlayers.value,
    });
  }
  if (isObserver.value && !isAdminMode.value) {
    return t("tournament.check_in.chip_open");
  }
  return t("tournament.check_in.chip_action_needed");
});

const pendingHint = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_opens_at_hint")
    : t("tournament.check_in.opens_at_hint"),
);

const doneHeading = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_done_heading", {
        time: closesAtLabel.value,
      })
    : t("tournament.check_in.done_heading", { time: closesAtLabel.value }),
);

const doneHint = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_done_hint", {
        time: formatClock(freeAgent.value?.checked_in_at),
      })
    : t("tournament.check_in.done_hint", {
        team: teamName(myTeam.value),
        time: formatClock(myTeam.value?.checked_in_at),
      }),
);

const missedChip = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_chip_waitlisted")
    : t("tournament.check_in.chip_removed"),
);

const missedHeading = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_missed_heading")
    : t("tournament.check_in.missed_heading"),
);

const missedHint = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_missed_hint", {
        time: closesAtLabel.value,
      })
    : t("tournament.check_in.missed_hint", { time: closesAtLabel.value }),
);

const missedContact = computed(() =>
  isFreeAgent.value
    ? t("tournament.check_in.free_agent_missed_contact")
    : t("tournament.check_in.missed_contact"),
);

// Six mutually exclusive states, resolved once so the template is a switch
// rather than a pile of overlapping v-ifs.
const state = computed<
  "hidden" | "before" | "pending" | "open" | "done" | "missed"
>(() => {
  if (!checkInRequired.value) {
    return "hidden";
  }

  // Before anything else: an Admin-mode organizer is the only route by which
  // ANY team gets marked present, and those buttons live in the open state
  // alone. Letting their own team's stamp collapse the panel to "done" takes
  // the whole field list — and every other team's only check-in — with it.
  if (
    isAdminMode.value &&
    props.tournament?.is_organizer === true &&
    windowOpen.value
  ) {
    return "open";
  }

  if (isFreeAgent.value) {
    if (freeAgentCheckedIn.value) {
      return "done";
    }
    if (windowClosed.value) {
      return "missed";
    }
    if (windowOpen.value) {
      return "open";
    }
    return "pending";
  }

  if (!myTeam.value) {
    // Nobody should learn about the requirement at T-15. Anyone who could
    // still enter sees it while entering is still possible.
    if (
      registrationOpen.value &&
      !windowClosed.value &&
      props.tournament?.can_join
    ) {
      return "before";
    }
    // An organizer with no team of their own still needs the field in front of
    // them — in Admin mode to act on it, otherwise to know whether the hold is
    // coming.
    if (props.tournament?.is_organizer && windowOpen.value) {
      return "open";
    }
    return "hidden";
  }

  if (myTeamCheckedIn.value) {
    return "done";
  }
  if (windowClosed.value) {
    return "missed";
  }
  if (windowOpen.value) {
    return "open";
  }
  return "pending";
});

async function runAction(
  mutation: Record<string, any>,
  failureTitle: string,
): Promise<void> {
  try {
    await client.mutate({
      // The check-in actions ship with the tournament check-in migration;
      // their zeus types only exist once `yarn codegen` has been run against
      // that schema, so the literal is asserted rather than inferred.
      mutation: generateMutation(mutation as any),
    });
  } catch (error: unknown) {
    toast({
      title: failureTitle,
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  }
}

async function checkIn(teamId?: string | null) {
  const tournamentTeamId = teamId ?? myTeam.value?.id;
  // The free-agent branch of the action is reached only by sending no team at
  // all — an explicit null would still be a team argument to resolve.
  if (!tournamentTeamId && !isFreeAgent.value) {
    return;
  }
  await runAction(
    {
      checkIntoTournament: [
        {
          tournament_id: props.tournament.id,
          ...(tournamentTeamId ? { tournament_team_id: tournamentTeamId } : {}),
        },
        {
          success: true,
        },
      ],
    },
    t("tournament.check_in.failed"),
  );
}
</script>

<template>
  <section
    v-if="state !== 'hidden'"
    :class="[
      'relative mt-4 rounded-lg border px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]',
      state === 'missed'
        ? 'border-destructive/50'
        : state === 'open'
          ? 'border-[hsl(var(--tac-amber)_/_0.45)]'
          : 'border-border',
    ]"
  >
    <!-- BEFORE REGISTERING -->
    <template v-if="state === 'before'">
      <div
        class="rounded-md border border-[hsl(var(--tac-amber)_/_0.45)] bg-[hsl(var(--tac-amber)_/_0.08)] px-4 py-3 text-sm leading-relaxed text-muted-foreground"
      >
        <strong class="text-foreground">
          {{ $t("tournament.check_in.required_title") }}
        </strong>
        {{
          $t("tournament.check_in.required_window", {
            opens: opensAtLabel,
            closes: closesAtLabel,
          })
        }}
      </div>

      <div
        class="mt-4 flex flex-wrap items-center justify-between gap-5 max-sm:flex-col max-sm:items-start"
      >
        <div class="min-w-0">
          <h3
            class="m-0 font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
          >
            {{ $t("tournament.check_in.register_heading") }}
          </h3>
          <p class="mt-1 text-[0.8rem] text-muted-foreground">
            {{ $t("tournament.check_in.register_hint") }}
          </p>
        </div>
        <Button
          :class="[tacticalCtaButtonClasses, 'shrink-0 max-sm:w-full']"
          @click="emit('register')"
        >
          {{ $t("tournament.check_in.register_cta") }}
        </Button>
      </div>
    </template>

    <!-- WINDOW NOT OPEN YET -->
    <template v-else-if="state === 'pending'">
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div class="min-w-0">
          <TournamentChip>
            {{ $t("tournament.check_in.chip_required") }}
          </TournamentChip>
          <h3
            class="mb-1 mt-[0.6rem] font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
          >
            {{
              $t("tournament.check_in.opens_at_heading", { time: opensAtLabel })
            }}
          </h3>
          <p class="text-[0.8rem] text-muted-foreground">
            {{ pendingHint }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <div
            class="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("tournament.check_in.opens_in") }}
          </div>
          <CheckInDeadline
            :cancels-at="opensAtIso"
            variant="standalone"
            :prefix-label="$t('tournament.check_in.a11y_opens_in')"
            :help-label="$t('tournament.check_in.a11y_opens_help')"
          />
        </div>
      </div>
    </template>

    <!-- WINDOW OPEN -->
    <template v-else-if="state === 'open'">
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div class="min-w-0">
          <TournamentChip :tone="isObserver && !isAdminMode ? 'muted' : 'amber'">
            {{ openChip }}
          </TournamentChip>
          <h3
            class="mb-1 mt-[0.6rem] font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
          >
            {{ openHeading }}
          </h3>
          <p
            class="max-w-[62ch] text-[0.8rem] leading-relaxed text-muted-foreground"
          >
            {{ openHint }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-6 max-sm:w-full">
          <div class="text-right">
            <div
              class="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("tournament.check_in.closes_in") }}
            </div>
            <CheckInDeadline
              :cancels-at="closesAtIso"
              variant="standalone"
              :prefix-label="$t('tournament.check_in.a11y_closes_in')"
              :help-label="$t('tournament.check_in.a11y_closes_help')"
            />
          </div>
          <!-- Button, not a bare <button>: it tracks the returned promise, so
               a second click while the action is in flight is impossible. -->
          <Button
            v-if="canCheckInSelf"
            :class="[tacticalCtaButtonClasses, 'px-6 py-3.5']"
            @click="checkIn()"
          >
            <CheckCircle2 class="h-4 w-4" />
            {{ $t("tournament.check_in.check_in") }}
          </Button>
        </div>
      </div>

      <!-- A free agent has neither a roster nor a stake in the field: their
           whole action is the button above. -->
      <template v-if="!isFreeAgent">
        <div class="my-4 h-px bg-border"></div>

        <!-- Players mode: the reader's own roster, not the field. An organizer
             with no team of their own falls through to the field list below. -->
        <TransitionGroup
          v-if="isPlayersMode && !isObserver"
          tag="div"
          class="flex flex-col gap-1.5"
          enter-active-class="transition-[opacity,transform] [transition-duration:380ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
          enter-from-class="opacity-0 translate-y-2 motion-reduce:translate-y-0"
          leave-active-class="absolute w-full transition-opacity duration-150 ease-in motion-reduce:![transition-duration:1ms]"
          leave-to-class="opacity-0"
          move-class="transition-transform duration-300 ease-out motion-reduce:!transition-none"
        >
          <div
            v-for="row in myRosterRows"
            :key="row.key"
            class="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-1.5"
            :class="{ 'opacity-55': row.state === 'not_needed' }"
          >
            <PlayerDisplay
              :player="row.player"
              size="xs"
              :linkable="true"
              :show-elo="false"
              :show-online="false"
              :show-role="false"
            />
            <div class="flex shrink-0 items-center gap-2">
              <TournamentChip>
                {{
                  row.isCaptain
                    ? $t("tournament.check_in.role_captain")
                    : row.state === "not_needed"
                      ? $t("tournament.check_in.role_sub")
                      : $t("tournament.check_in.role_starter")
                }}
              </TournamentChip>
              <TournamentChip
                :tone="
                  row.state === 'checked_in'
                    ? 'ok'
                    : row.state === 'waiting'
                      ? 'warn'
                      : 'muted'
                "
              >
                {{
                  row.state === "checked_in"
                    ? $t("tournament.check_in.checked_in")
                    : row.state === "waiting"
                      ? $t("tournament.check_in.waiting")
                      : $t("tournament.check_in.not_needed")
                }}
              </TournamentChip>
            </div>
          </div>
        </TransitionGroup>

        <!-- Captains / Admin mode: the state of the field. -->
        <template v-else>
          <div
            class="mb-2 flex items-center justify-between gap-3 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span>{{ $t("tournament.check_in.field_status") }}</span>
            <span>
              {{
                $t("tournament.check_in.field_count", {
                  checked: checkedInTeamCount,
                  total: (teams ?? []).length,
                })
              }}
            </span>
          </div>
          <TransitionGroup
            tag="div"
            class="flex flex-col gap-1.5"
            enter-active-class="transition-[opacity,transform] [transition-duration:380ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
            enter-from-class="opacity-0 translate-y-2 motion-reduce:translate-y-0"
            leave-active-class="absolute w-full transition-opacity duration-150 ease-in motion-reduce:![transition-duration:1ms]"
            leave-to-class="opacity-0"
            move-class="transition-transform duration-300 ease-out motion-reduce:!transition-none"
          >
            <div
              v-for="team in teams ?? []"
              :key="team.id"
              class="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2"
              :class="{
                'border-[hsl(var(--tac-amber)_/_0.4)]': team.id === myTeam?.id,
              }"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[hsl(var(--tac-amber)_/_0.35)] bg-[hsl(var(--tac-amber)_/_0.08)] font-mono text-[0.55rem] font-bold uppercase tracking-[0.08em] text-[hsl(var(--tac-amber))]"
                >
                  {{ teamInitials(team) }}
                </span>
                <span class="truncate text-sm font-semibold text-foreground">
                  {{ teamName(team) }}
                </span>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <TournamentChip :tone="team.checked_in_at ? 'ok' : 'warn'">
                  {{
                    team.checked_in_at
                      ? $t("tournament.check_in.checked_in_at", {
                          time: formatClock(team.checked_in_at),
                        })
                      : $t("tournament.check_in.waiting")
                  }}
                </TournamentChip>
                <Button
                  v-if="canMarkTeamsPresent && !team.checked_in_at"
                  variant="outline"
                  size="sm"
                  class="h-7"
                  @click="checkIn(team.id)"
                >
                  {{ $t("tournament.check_in.mark_present") }}
                </Button>
              </div>
            </div>
          </TransitionGroup>
        </template>
      </template>
    </template>

    <!-- CHECKED IN -->
    <template v-else-if="state === 'done'">
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div class="min-w-0">
          <TournamentChip tone="ok">
            {{ $t("tournament.check_in.checked_in") }}
          </TournamentChip>
          <h3
            class="mb-1 mt-[0.6rem] font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
          >
            {{ doneHeading }}
          </h3>
          <p class="text-[0.8rem] text-muted-foreground">
            {{ doneHint }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <div
            class="mb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("tournament.check_in.starts_in") }}
          </div>
          <!-- Nothing auto-cancels at kickoff, so the match readout's
               "Auto-cancels in" copy and its tooltip must not be inherited. -->
          <CheckInDeadline
            :cancels-at="startIso"
            variant="standalone"
            :prefix-label="$t('tournament.check_in.a11y_starts_in')"
            :help-label="null"
          />
        </div>
      </div>
    </template>

    <!-- MISSED -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-5">
        <div class="min-w-0">
          <TournamentChip tone="bad">
            {{ missedChip }}
          </TournamentChip>
          <h3
            class="mb-1 mt-[0.6rem] font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
          >
            {{ missedHeading }}
          </h3>
          <p class="text-[0.8rem] text-muted-foreground">
            {{ missedHint }}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled class="shrink-0">
          {{ $t("tournament.check_in.check_in") }}
        </Button>
      </div>

      <div
        class="mt-4 flex items-start gap-2.5 rounded-md border border-destructive/45 bg-destructive/10 px-4 py-3 text-[0.82rem] leading-relaxed text-destructive"
      >
        <ShieldAlert class="mt-px h-4 w-4 shrink-0" />
        <span>{{ missedContact }}</span>
      </div>
    </template>
  </section>
</template>
