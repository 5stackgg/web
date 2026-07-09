<script setup lang="ts">
import type { Component } from "vue";
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogScrollContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import LeagueSeasonForm from "~/components/league/LeagueSeasonForm.vue";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { toast } from "@/components/ui/toast";
import {
  Trash2,
  ExternalLink,
  ChevronDown,
  PlusCircle,
  HelpCircle,
  ArrowUp,
  ArrowDown,
  UserPlus,
  MoreVertical,
  Unlock,
  Lock,
  Play,
  RotateCcw,
  CopyPlus,
} from "lucide-vue-next";
import SeasonMatchCalendar from "~/components/league/SeasonMatchCalendar.vue";
import LeagueSeriesFormatEditor from "~/components/league/LeagueSeriesFormatEditor.vue";
import LeagueSeasonSettingsEditor from "~/components/league/LeagueSeasonSettingsEditor.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import ProposeTimeDialog from "~/components/league/ProposeTimeDialog.vue";
import SeasonReadiness from "~/components/league/SeasonReadiness.vue";
import LeagueJoinForm from "~/components/league/LeagueJoinForm.vue";
import SeasonRegistrations from "~/components/league/SeasonRegistrations.vue";
import MovementsReview from "~/components/league/MovementsReview.vue";
import SeasonPhaseTimeline from "~/components/league/SeasonPhaseTimeline.vue";
import SeasonBracketViewer from "~/components/league/SeasonBracketViewer.vue";
import SeasonStandings from "~/components/league/SeasonStandings.vue";
import SeasonLeaderboard from "~/components/league/SeasonLeaderboard.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Settings2 } from "lucide-vue-next";
import {
  LEAGUE_SEASON_QUERY,
  LEAGUE_SEASON_SUBSCRIPTION,
  LEAGUE_DIVISIONS_SUBSCRIPTION,
  LEAGUE_SEASONS_LIST_SUBSCRIPTION,
  MY_MANAGED_TEAMS_QUERY,
  REMOVE_TEAM_FROM_SEASON_MUTATION,
  CLONE_SEASON_MUTATION,
  RESTART_SEASON_MUTATION,
  REGISTER_TEAM_MUTATION,
  ADD_ROSTER_PLAYERS_MUTATION,
  UPDATE_ROSTER_STATUS_MUTATION,
  REMOVE_ROSTER_PLAYER_MUTATION,
  UPDATE_TEAM_SEASON_MUTATION,
  UPDATE_SEASON_STATUS_MUTATION,
  UPDATE_SEASON_BEST_OF_MUTATION,
  PROPOSE_TIME_MUTATION,
  RESPOND_PROPOSAL_MUTATION,
  AWARD_FORFEIT_MUTATION,
  UPDATE_MOVEMENT_MUTATION,
  APPROVE_MOVEMENTS_MUTATION,
  DELETE_SEASON_MUTATION,
} from "~/graphql/leagues";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
  tacticalHeaderActionClasses,
  tacticalCtaButtonClasses,
} from "~/utilities/tacticalClasses";

const route = useRoute();
const seasonId = route.params.seasonId as string;
const { client: apolloClient } = useApolloClient();
const { t } = useI18n();
const auth = useAuthStore();

const season = ref<any>(null);
const leagueDivisions = ref<any[]>([]);
const allSeasons = ref<any[]>([]);
const myTeams = ref<any[]>([]);
const loading = ref(true);

const seasonContext = useSeasonContext();
function syncSeasonContext() {
  seasonContext.value = season.value
    ? { id: seasonId, name: season.value.name }
    : null;
}

// Schedule / bracket / stats only have content once play begins, so hide them
// (and reject them as a route tab) until the season is underway.
const seasonStarted = computed(() =>
  ["Live", "Playoffs", "Finished"].includes(season.value?.status),
);

const tab = useRouteTab({
  defaultTab: "overview",
  tabs: () => [
    "overview",
    ...(seasonStarted.value
      ? ["schedule", "bracket", "stats"]
      : ["registrations"]),
    "movements",
    "manage",
  ],
});

async function fetchSeason() {
  const { data } = await apolloClient.query({
    query: LEAGUE_SEASON_QUERY,
    variables: { seasonId },
    fetchPolicy: "network-only",
  });
  season.value = data?.league_seasons_by_pk ?? null;
  leagueDivisions.value = data?.league_divisions ?? [];
  allSeasons.value = data?.league_seasons ?? [];
  syncSeasonContext();
}

// Live updates: proposals, results, registrations, status changes and the
// season list all stream in over the websocket. Hasura allows a single root
// field per subscription, so each piece gets its own subscription.
let subscriptions: Array<{ unsubscribe: () => void }> = [];

function subscribeSeason() {
  subscriptions.push(
    apolloClient
      .subscribe({ query: LEAGUE_SEASON_SUBSCRIPTION, variables: { seasonId } })
      .subscribe({
        next: ({ data }: { data?: any }) => {
          if (data?.league_seasons_by_pk) {
            season.value = data.league_seasons_by_pk;
            syncSeasonContext();
          }
        },
        error: (error: unknown) =>
          console.warn("league season subscription failed", error),
      }),
    apolloClient.subscribe({ query: LEAGUE_DIVISIONS_SUBSCRIPTION }).subscribe({
      next: ({ data }: { data?: any }) => {
        if (data?.league_divisions) {
          leagueDivisions.value = data.league_divisions;
        }
      },
      error: (error: unknown) =>
        console.warn("league divisions subscription failed", error),
    }),
    apolloClient
      .subscribe({ query: LEAGUE_SEASONS_LIST_SUBSCRIPTION })
      .subscribe({
        next: ({ data }: { data?: any }) => {
          if (data?.league_seasons) {
            allSeasons.value = data.league_seasons;
          }
        },
        error: (error: unknown) =>
          console.warn("league seasons subscription failed", error),
      }),
  );
}

onBeforeUnmount(() => {
  subscriptions.forEach((s) => s.unsubscribe());
  subscriptions = [];
  seasonContext.value = null;
});

async function fetchMyTeams() {
  if (!auth.me?.steam_id) {
    return;
  }
  const { data } = await apolloClient.query({
    query: MY_MANAGED_TEAMS_QUERY,
    variables: { steamId: auth.me.steam_id },
    fetchPolicy: "network-only",
  });
  myTeams.value = data?.teams ?? [];
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([fetchSeason(), fetchMyTeams()]);
  } finally {
    loading.value = false;
  }
  subscribeSeason();
});

function onError(error: any) {
  toast({ title: error?.message ?? String(error), variant: "destructive" });
}

const isAdmin = computed(() => season.value?.is_league_admin ?? false);

// Roster sizing is a league setting; older seasons may not carry the column.
const rosterMin = computed(
  () =>
    season.value?.min_roster_size ??
    useApplicationSettingsStore().teamMinRosterSize,
);
const rosterMax = computed(
  () =>
    season.value?.max_roster_size ??
    useApplicationSettingsStore().teamMaxRosterSize,
);
// Lineup rules: exactly `rosterMin` starters + up to `subsCap` substitutes.
const subsCap = computed(() => useApplicationSettingsStore().teamMaxSubs);
const rosterCap = computed(() => rosterMin.value + subsCap.value);
const divisions = computed(() => leagueDivisions.value);
const managedTeamIds = computed(() => myTeams.value.map((team) => team.id));

const registeredTeamIds = computed(() =>
  (season.value?.team_seasons ?? [])
    .filter((ts: any) => ts.status !== "Withdrawn")
    .map((ts: any) => ts.league_team.team_id),
);

const myRegistrations = computed(() =>
  (season.value?.team_seasons ?? []).filter(
    (ts: any) =>
      ts.status !== "Withdrawn" &&
      managedTeamIds.value.includes(ts.league_team.team_id),
  ),
);

// Gates the calendar-feed button on the schedule tab: only a team the viewer
// manages *and* has registered here can be subscribed to from this page.
const myRegisteredTeamId = computed<string | null>(
  () => myRegistrations.value[0]?.league_team?.team_id ?? null,
);

// Division whose schedule/standings are being viewed.
const selectedDivisionId = ref<string>("");
const seasonDivisions = computed(() => season.value?.season_divisions ?? []);
const activeSeasonDivision = computed(() => {
  const withTournament = seasonDivisions.value.filter(
    (sd: any) => sd.tournament_id,
  );
  if (!withTournament.length) {
    return null;
  }
  return (
    withTournament.find(
      (sd: any) => sd.league_division_id === selectedDivisionId.value,
    ) ?? withTournament[0]
  );
});

const regularSeasonBrackets = computed(() => {
  const stage = activeSeasonDivision.value?.tournament?.stages?.find(
    (s: any) => s.order === 1,
  );
  return stage?.brackets ?? [];
});

const playoffStages = computed(() =>
  seasonDivisions.value
    .filter((sd: any) => sd.tournament)
    .map((sd: any) => ({
      division: sd.division,
      tournament: sd.tournament,
      brackets:
        sd.tournament.stages?.find((s: any) => s.order === 2)?.brackets ?? [],
    })),
);

const standingsTeamNames = computed(() => {
  const names: Record<string, string> = {};
  for (const ts of season.value?.team_seasons ?? []) {
    names[ts.id] = ts.league_team.team.name;
  }
  return names;
});

const withdrawnTeamSeasonIds = computed(() =>
  (season.value?.team_seasons ?? [])
    .filter((ts: any) => ts.status === "Withdrawn")
    .map((ts: any) => ts.id),
);
const myTeamSeasonIds = computed(() =>
  myRegistrations.value.map((r: any) => r.id),
);

// ---- Registration ----

const registering = ref(false);
const showRegisterDialog = ref(false);
// Overview register is for the viewer's own teams; the Registrations tab lets
// admins register any team. Tracks which entry opened the modal.
const registerAnyTeam = ref(false);
// Bumped whenever the register modal opens so the form remounts fresh.
const registerFormKey = ref(0);

function openRegister(anyTeam: boolean) {
  registerAnyTeam.value = anyTeam;
  showRegisterDialog.value = true;
}

async function registerTeam(
  teamId: string,
  requestedDivisionId: string | null,
  roster: { playerSteamId: string; status: string }[],
) {
  registering.value = true;
  try {
    await apolloClient.mutate({
      mutation: REGISTER_TEAM_MUTATION,
      variables: {
        teamId,
        seasonId,
        requestedDivisionId,
      },
    });
    await fetchSeason();
    const registration = (season.value?.team_seasons ?? []).find(
      (ts: any) => ts.league_team.team_id === teamId,
    );
    if (registration) {
      // The selection is authoritative, but we diff against the current roster
      // rather than re-upserting everyone: re-inserting an already-active player
      // trips the BEFORE INSERT capacity guard (ON CONFLICT still fires it), so
      // we only insert genuinely new/revived players, update changed statuses,
      // and soft-remove de-selected ones — removals first so capacity frees up.
      const current = (registration.roster ?? []) as any[];
      const currentByPlayer = new Map(
        current.map((m) => [String(m.player_steam_id), m]),
      );
      const selectedIds = new Set(roster.map((r) => String(r.playerSteamId)));

      // 1) Remove de-selected players first (frees roster/lineup capacity).
      const toRemove = current.filter(
        (m) => !selectedIds.has(String(m.player_steam_id)),
      );
      for (const member of toRemove) {
        await apolloClient.mutate({
          mutation: REMOVE_ROSTER_PLAYER_MUTATION,
          variables: {
            teamSeasonId: registration.id,
            playerSteamId: member.player_steam_id,
            removedAt: new Date().toISOString(),
            reason: "De-selected at registration",
          },
        });
      }

      // 2) Update status (promote/demote) for players already on the roster.
      const toUpdate = roster.filter((r) => {
        const existing = currentByPlayer.get(String(r.playerSteamId));
        return existing && existing.status !== r.status;
      });
      for (const r of toUpdate) {
        await apolloClient.mutate({
          mutation: UPDATE_ROSTER_STATUS_MUTATION,
          variables: {
            teamSeasonId: registration.id,
            playerSteamId: r.playerSteamId,
            status: r.status,
          },
        });
      }

      // 3) Insert genuinely new players (or revive previously-removed ones).
      const toInsert = roster.filter(
        (r) => !currentByPlayer.has(String(r.playerSteamId)),
      );
      if (toInsert.length) {
        await apolloClient.mutate({
          mutation: ADD_ROSTER_PLAYERS_MUTATION,
          variables: {
            // `removed_at` isn't insert-permitted; the on_conflict update
            // clause (update_columns includes removed_at) revives previously
            // removed players by nulling it out.
            objects: toInsert.map((r) => ({
              league_team_season_id: registration.id,
              player_steam_id: r.playerSteamId,
              status: r.status,
            })),
          },
        });
      }

      // An admin registering a team on its behalf approves it straight into
      // the chosen division (skips the review queue). Without a division there
      // is nothing to approve into, so it stays Pending for review.
      if (isAdmin.value && requestedDivisionId) {
        await setTeamSeason(registration.id, {
          assigned_division_id: requestedDivisionId,
          status: "Approved",
        });
      }
    }
    toast({ title: t("league.join.registered") });
    showRegisterDialog.value = false;
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    registering.value = false;
  }
}

async function removeRosterPlayer(teamSeasonId: string, steamId: string) {
  try {
    await apolloClient.mutate({
      mutation: REMOVE_ROSTER_PLAYER_MUTATION,
      variables: {
        teamSeasonId,
        playerSteamId: steamId,
        removedAt: new Date().toISOString(),
        reason: "Removed from roster",
      },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

async function addRosterPlayer(
  teamSeasonId: string,
  steamId: string,
  status = "Starter",
) {
  try {
    await apolloClient.mutate({
      mutation: ADD_ROSTER_PLAYERS_MUTATION,
      variables: {
        objects: [
          {
            league_team_season_id: teamSeasonId,
            player_steam_id: steamId,
            status,
          },
        ],
      },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

async function setRosterStatus(
  teamSeasonId: string,
  steamId: string,
  status: string,
) {
  try {
    await apolloClient.mutate({
      mutation: UPDATE_ROSTER_STATUS_MUTATION,
      variables: { teamSeasonId, playerSteamId: steamId, status },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

// Starter = the lineup (target = min roster size); everything else is a sub.
// (`?? "Starter"` is a safety net for rows created before status existed.)
function starters(registration: any) {
  return (registration.roster ?? []).filter(
    (m: any) => (m.status ?? "Starter") === "Starter",
  );
}
function substitutes(registration: any) {
  return (registration.roster ?? []).filter(
    (m: any) => (m.status ?? "Starter") !== "Starter",
  );
}
// A team is "missing a spot" (and shows the add selector) while its roster is
// below the max; new adds fill a starter slot until min is met, then subs.
function hasOpenSpot(registration: any) {
  return (registration.roster?.length ?? 0) < rosterCap.value;
}
function nextAddStatus(registration: any) {
  return starters(registration).length < rosterMin.value
    ? "Starter"
    : "Substitute";
}
// A starter can only move to the bench while there's a free sub slot, and a sub
// can only be promoted while the lineup isn't already full.
function canDemote(registration: any) {
  return substitutes(registration).length < subsCap.value;
}
function canPromote(registration: any) {
  return starters(registration).length < rosterMin.value;
}

function addablePlayers(registration: any) {
  const team = myTeams.value.find(
    (candidate) => candidate.id === registration.league_team.team_id,
  );
  const rostered = new Set(
    registration.roster.map((member: any) => member.player_steam_id),
  );
  return (team?.roster ?? []).filter(
    (member: any) => !rostered.has(member.player_steam_id),
  );
}

function rosterChanges(registration: any) {
  return (registration.roster_history ?? []).filter(
    (change: any) => change.removed_at,
  );
}

// ---- Admin actions ----

const mutating = ref(false);

async function setTeamSeason(teamSeasonId: string, changes: any) {
  if (mutating.value) {
    return;
  }
  mutating.value = true;
  try {
    await apolloClient.mutate({
      mutation: UPDATE_TEAM_SEASON_MUTATION,
      variables: { teamSeasonId, changes },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    mutating.value = false;
  }
}

// ---- Series format (per-week / per-playoff-round best-of) ----

const editWeekBestOf = ref<Record<string, number>>({});
const editPlayoffRoundBestOf = ref<Record<string, number>>({});
const editPlayoffStageType = ref("SingleElimination");
const editPlayoffThirdPlace = ref(false);
const editPlayoffSeats = ref(4);
const savingSeriesFormat = ref(false);

// Broader season settings (schedule / roster / dates).
const editWeeksCount = ref(1);
const editGamesPerWeek = ref(1);
const editStartsAt = ref("");
const editSignupOpens = ref("");
const editSignupCloses = ref("");
const editRosterLockAt = ref("");

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function toIsoOrNull(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}
function dateChanged(local: string, iso: string | null | undefined): boolean {
  const a = local ? new Date(local).getTime() : null;
  const b = iso ? new Date(iso).getTime() : null;
  return a !== b;
}

// Seeded on first load and after a save only — the live subscription
// reassigns `season` on any activity and must not wipe unsaved edits.
let seriesFormatSeeded = false;

function seedSeriesFormat() {
  const value = season.value;
  editWeekBestOf.value = { ...(value?.week_best_of ?? {}) };
  editPlayoffRoundBestOf.value = { ...(value?.playoff_round_best_of ?? {}) };
  editPlayoffStageType.value = value?.playoff_stage_type ?? "SingleElimination";
  editPlayoffThirdPlace.value = value?.playoff_third_place_match ?? false;
  editPlayoffSeats.value = value?.playoff_seats ?? 4;
  editWeeksCount.value = value?.match_weeks_count ?? 1;
  editGamesPerWeek.value = value?.games_per_week ?? 1;
  editStartsAt.value = toLocalInput(value?.starts_at);
  editSignupOpens.value = toLocalInput(value?.signup_opens_at);
  editSignupCloses.value = toLocalInput(value?.signup_closes_at);
  editRosterLockAt.value = toLocalInput(value?.roster_lock_at);
}

watch(season, () => {
  if (!seriesFormatSeeded && season.value) {
    seriesFormatSeeded = true;
    seedSeriesFormat();
  }
});

// The bracket structure is generated at season start; only best-of remains
// editable afterwards.
const playoffStructureLocked = computed(() =>
  ["Live", "Playoffs", "Finished", "Canceled"].includes(
    season.value?.status ?? "",
  ),
);

// How many teams advance can still be tuned during the regular season (the
// playoff bracket isn't generated until the Playoffs phase); it only locks once
// the playoffs actually begin.
const playoffSeatsLocked = computed(() =>
  ["Playoffs", "Finished", "Canceled"].includes(season.value?.status ?? ""),
);

const seriesFormatDirty = computed(
  () =>
    JSON.stringify(editWeekBestOf.value) !==
      JSON.stringify(season.value?.week_best_of ?? {}) ||
    JSON.stringify(editPlayoffRoundBestOf.value) !==
      JSON.stringify(season.value?.playoff_round_best_of ?? {}) ||
    editPlayoffStageType.value !== season.value?.playoff_stage_type ||
    editPlayoffThirdPlace.value !== season.value?.playoff_third_place_match ||
    editPlayoffSeats.value !== (season.value?.playoff_seats ?? 4) ||
    editWeeksCount.value !== (season.value?.match_weeks_count ?? 1) ||
    editGamesPerWeek.value !== (season.value?.games_per_week ?? 1) ||
    dateChanged(editStartsAt.value, season.value?.starts_at) ||
    dateChanged(editSignupOpens.value, season.value?.signup_opens_at) ||
    dateChanged(editSignupCloses.value, season.value?.signup_closes_at) ||
    dateChanged(editRosterLockAt.value, season.value?.roster_lock_at),
);

async function saveSeriesFormat() {
  savingSeriesFormat.value = true;
  try {
    const changes: Record<string, unknown> = {
      week_best_of: editWeekBestOf.value,
      playoff_round_best_of: editPlayoffRoundBestOf.value,
    };
    if (!playoffStructureLocked.value) {
      changes.playoff_stage_type = editPlayoffStageType.value;
      changes.playoff_third_place_match =
        editPlayoffStageType.value === "SingleElimination" &&
        editPlayoffThirdPlace.value;
    }
    if (!playoffSeatsLocked.value) {
      changes.playoff_seats = editPlayoffSeats.value;
    }
    // Dates stay editable; the schedule shape locks once play starts. Roster
    // sizes come from the application defaults, not per-season.
    changes.starts_at = toIsoOrNull(editStartsAt.value);
    changes.signup_opens_at = toIsoOrNull(editSignupOpens.value);
    changes.signup_closes_at = toIsoOrNull(editSignupCloses.value);
    changes.roster_lock_at = toIsoOrNull(editRosterLockAt.value);
    if (!seasonStarted.value) {
      changes.match_weeks_count = editWeeksCount.value;
      changes.games_per_week = editGamesPerWeek.value;
    }
    await apolloClient.mutate({
      mutation: UPDATE_SEASON_BEST_OF_MUTATION,
      variables: { seasonId, changes },
    });
    toast({ title: t("league.series.saved") });
    await fetchSeason();
    seedSeriesFormat();
  } catch (error) {
    onError(error);
  } finally {
    savingSeriesFormat.value = false;
  }
}

// Effective best-of for a playoff bracket, resolved from the native stage
// round keys ("WB:1", "LB:2", "GF") the same way get_bracket_best_of does.
function playoffBestOfLabel(bracket: {
  path: string | null;
  round: number;
}): number {
  const map = season.value?.playoff_round_best_of ?? {};
  const fallback = season.value?.playoff_best_of ?? 1;

  let key = `${bracket.path ?? "WB"}:${bracket.round}`;
  if (
    season.value?.playoff_stage_type === "DoubleElimination" &&
    bracket.path === "WB"
  ) {
    const wbRounds = Math.max(
      Math.ceil(
        Math.log(Math.max(season.value?.playoff_seats ?? 2, 2)) / Math.log(2),
      ),
      1,
    );
    if (bracket.round > wbRounds) {
      key = "GF";
    }
  }
  return map[key] ?? fallback;
}

const confirmCancelSeason = ref(false);
const confirmWithdrawId = ref<string | null>(null);
const confirmDeleteSeason = ref(false);

const { showCreateModal, creatingSeason, createSeason } = useLeagueSeasonCreate(
  (newSeasonId) => {
    if (newSeasonId) {
      navigateTo({
        name: "league-seasons-seasonId",
        params: { seasonId: newSeasonId },
      });
    }
  },
);

async function deleteSeason() {
  confirmDeleteSeason.value = false;
  try {
    await apolloClient.mutate({
      mutation: DELETE_SEASON_MUTATION,
      variables: { seasonId },
    });
    toast({ title: t("league.seasons.deleted") });
    await navigateTo({ name: "league" });
  } catch (error) {
    onError(error);
  }
}

// A declined team can resubmit for review while registration is still open.
async function resubmitRegistration(teamSeasonId: string) {
  await setTeamSeason(teamSeasonId, { status: "Pending" });
}

// Capture the target id before closing so the mutation never sees a null id.
async function withdrawRegistration() {
  const teamSeasonId = confirmWithdrawId.value;
  if (!teamSeasonId) {
    return;
  }
  confirmWithdrawId.value = null;
  await setTeamSeason(teamSeasonId, { status: "Withdrawn" });
}

async function setSeasonStatus(status: string) {
  try {
    await apolloClient.mutate({
      mutation: UPDATE_SEASON_STATUS_MUTATION,
      variables: { seasonId, status },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

// ---- Scheduling ----

async function propose(
  bracketId: string,
  proposedTime: string,
  message: string,
) {
  try {
    await apolloClient.mutate({
      mutation: PROPOSE_TIME_MUTATION,
      variables: { bracketId, proposedTime, message: message || null },
    });
    toast({ title: t("league.schedule.proposed") });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

async function respond(
  proposalId: string,
  status: "Accepted" | "Declined" | "Countered",
) {
  if (mutating.value) {
    return;
  }
  mutating.value = true;
  try {
    await apolloClient.mutate({
      mutation: RESPOND_PROPOSAL_MUTATION,
      variables: { proposalId, status },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    mutating.value = false;
  }
}

async function forfeit(bracketId: string, winningTeamId: string) {
  if (mutating.value) {
    return;
  }
  mutating.value = true;
  try {
    await apolloClient.mutate({
      mutation: AWARD_FORFEIT_MUTATION,
      variables: { bracketId, winningTeamId },
    });
    toast({ title: t("league.schedule.forfeit_awarded") });
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    mutating.value = false;
  }
}

// ---- Admin: remove a team mid-season / roll the season over ----

async function removeTeamFromSeason(teamSeasonId: string) {
  try {
    await apolloClient.mutate({
      mutation: REMOVE_TEAM_FROM_SEASON_MUTATION,
      variables: { teamSeasonId },
    });
    toast({ title: t("league.registrations.removed") });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

const cloning = ref(false);

async function cloneSeason() {
  cloning.value = true;
  try {
    const { data } = await apolloClient.mutate({
      mutation: CLONE_SEASON_MUTATION,
      variables: { seasonId },
    });
    const created = data?.clone_league_season?.[0];
    toast({ title: t("league.rollover.created", { name: created?.name }) });
    if (created?.id) {
      await navigateTo({
        name: "league-seasons-seasonId",
        params: { seasonId: created.id },
      });
    }
  } catch (error) {
    onError(error);
  } finally {
    cloning.value = false;
  }
}

const restarting = ref(false);

async function restartSeason() {
  restarting.value = true;
  try {
    await apolloClient.mutate({
      mutation: RESTART_SEASON_MUTATION,
      variables: { seasonId },
    });
    toast({ title: t("league.restart.done") });
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    restarting.value = false;
  }
}

// ---- Playoff scheduling (captains propose within the next two weeks) ----

const playoffProposeFor = ref<any | null>(null);
// Captured when the dialog opens (a computed would freeze at page load and
// drift stale on a long-lived tab).
const playoffWindowOpens = ref("");
const playoffWindowCloses = ref("");

function openPlayoffPropose(bracket: any) {
  playoffWindowOpens.value = new Date().toISOString();
  playoffWindowCloses.value = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  playoffProposeFor.value = bracket;
}

function managesBracketTeam(bracket: any): boolean {
  return [bracket.team_1?.team_id, bracket.team_2?.team_id].some(
    (teamId) => teamId && managedTeamIds.value.includes(teamId),
  );
}

function bracketReschedulable(bracket: any): boolean {
  if (bracket.finished) {
    return false;
  }
  if (!bracket.tournament_team_id_1 || !bracket.tournament_team_id_2) {
    return false;
  }
  if (!bracket.match) {
    return true;
  }
  return ["Scheduled", "WaitingForCheckIn"].includes(bracket.match.status);
}

function pendingProposals(bracket: any): any[] {
  return (bracket.scheduling_proposals ?? []).filter(
    (proposal: any) => proposal.status === "Pending",
  );
}

function canRespondToProposal(bracket: any, proposal: any): boolean {
  if (proposal.status !== "Pending") {
    return false;
  }
  if (isAdmin.value) {
    return true;
  }
  return (
    managesBracketTeam(bracket) &&
    proposal.proposed_by_steam_id !== auth.me?.steam_id
  );
}

function onPlayoffProposeSubmit(proposedTime: string, message: string) {
  if (playoffProposeFor.value) {
    void propose(playoffProposeFor.value.id, proposedTime, message);
  }
}

// ---- Movements ----

async function overrideMovement(movementId: string, divisionId: string | null) {
  try {
    await apolloClient.mutate({
      mutation: UPDATE_MOVEMENT_MUTATION,
      variables: { movementId, finalToDivisionId: divisionId },
    });
    await fetchSeason();
  } catch (error) {
    onError(error);
  }
}

async function approveMovements() {
  if (mutating.value) {
    return;
  }
  mutating.value = true;
  try {
    await apolloClient.mutate({
      mutation: APPROVE_MOVEMENTS_MUTATION,
      variables: { seasonId },
    });
    toast({ title: t("league.movements.approved_all") });
    await fetchSeason();
  } catch (error) {
    onError(error);
  } finally {
    mutating.value = false;
  }
}

// Header status pill — mirrors the tournament page's status chip.
const STATUS_TIER: Record<string, string> = {
  RegistrationOpen: "open",
  Setup: "pending",
  RegistrationClosed: "pending",
  Live: "live",
  Playoffs: "live",
  Finished: "finished",
  Canceled: "ended",
};
const STATUS_TIER_CLASSES: Record<string, string> = {
  live: "border-destructive/55 bg-destructive/15 text-destructive",
  open: "border-success/55 bg-success/15 text-success",
  pending:
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]",
  finished:
    "border-[hsl(var(--topnav-accent)/0.5)] bg-[hsl(var(--topnav-accent)/0.15)] text-[hsl(var(--topnav-accent))]",
  ended: "border-border bg-muted/40 text-muted-foreground",
};
const statusTierClass = computed(
  () =>
    STATUS_TIER_CLASSES[STATUS_TIER[season.value?.status] ?? "ended"] ??
    STATUS_TIER_CLASSES.ended,
);

const STATUS_ACTIONS: Record<
  string,
  { label: string; next: string; icon: Component }[]
> = {
  Setup: [
    { label: "open_registration", next: "RegistrationOpen", icon: Unlock },
  ],
  RegistrationOpen: [
    { label: "close_registration", next: "RegistrationClosed", icon: Lock },
  ],
  RegistrationClosed: [
    { label: "start_season", next: "Live", icon: Play },
    { label: "reopen_registration", next: "RegistrationOpen", icon: Unlock },
  ],
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-5 py-6">
      <div v-if="loading" class="py-12 text-center text-muted-foreground">
        {{ $t("common.loading") }}
      </div>

      <template v-else-if="season">
        <TacticalPageHeader inline-actions>
          <template #description>
            <DropdownMenu>
              <DropdownMenuTrigger
                class="inline-flex items-center gap-1 hover:text-[hsl(var(--tac-amber))]"
              >
                {{ $t("league.seasons.title") }}
                <ChevronDown class="h-3 w-3 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                class="max-h-80 w-56 overflow-y-auto"
              >
                <DropdownMenuItem v-for="s in allSeasons" :key="s.id" as-child>
                  <NuxtLink
                    :to="{
                      name: 'league-seasons-seasonId',
                      params: { seasonId: s.id },
                    }"
                    class="flex cursor-pointer items-center justify-between gap-3"
                  >
                    <span
                      :class="{
                        'font-semibold text-[hsl(var(--tac-amber))]':
                          s.id === seasonId,
                      }"
                      >{{ s.name }}</span
                    >
                    <span class="text-xs text-muted-foreground">{{
                      $t(`league.season_status.${s.status}`)
                    }}</span>
                  </NuxtLink>
                </DropdownMenuItem>
                <template v-if="isAdmin">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="showCreateModal = true">
                    <PlusCircle />
                    {{ $t("league.season_form.title") }}
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <NuxtLink
                      :to="{ name: 'settings-application-leagues' }"
                      class="flex cursor-pointer items-center"
                    >
                      <Settings2 class="mr-2 h-4 w-4" />
                      {{ $t("league.list.settings") }}
                    </NuxtLink>
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </template>
          <template #title>{{ season.name }}</template>
          <template #actions>
            <Button
              v-if="!isAdmin && season.can_register && !myRegistrations.length"
              :class="[tacticalHeaderActionClasses, 'gap-2']"
              @click="openRegister(false)"
            >
              <PlusCircle class="h-4 w-4" />
              {{ $t("league.join.title") }}
            </Button>

            <HoverCard
              v-if="
                isAdmin &&
                ['Setup', 'RegistrationOpen', 'RegistrationClosed'].includes(
                  season.status,
                )
              "
              :open-delay="120"
            >
              <HoverCardTrigger as-child>
                <span
                  :class="[
                    'inline-flex h-9 cursor-help items-center gap-2 whitespace-nowrap rounded border px-[0.7rem] font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]',
                    statusTierClass,
                  ]"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
                  {{ $t(`league.season_status.${season.status}`) }}
                </span>
              </HoverCardTrigger>
              <HoverCardContent align="end" class="w-80">
                <div :class="[tacticalSectionLabelClasses, '!mb-3']">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{ $t("league.readiness.title") }}
                </div>
                <SeasonReadiness :season="season" :divisions="divisions" />
              </HoverCardContent>
            </HoverCard>
            <span
              v-else
              :class="[
                'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded border px-[0.7rem] font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em]',
                statusTierClass,
              ]"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
              {{ $t(`league.season_status.${season.status}`) }}
            </span>

            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-9 w-9 border-[hsl(var(--tac-amber)/0.45)] bg-background/45 text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
                >
                  <MoreVertical class="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-56">
                <DropdownMenuItem
                  v-for="action in STATUS_ACTIONS[season.status] ?? []"
                  :key="action.next"
                  @click="setSeasonStatus(action.next)"
                >
                  <component :is="action.icon" />
                  {{ $t(`league.actions.${action.label}`) }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="season.status === 'Finished'"
                  :disabled="cloning"
                  @click="cloneSeason"
                >
                  <CopyPlus />
                  {{ $t("league.rollover.create_next") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="season.status === 'Canceled'"
                  :disabled="restarting"
                  @click="restartSeason"
                >
                  <RotateCcw />
                  {{ $t("league.restart.action") }}
                </DropdownMenuItem>
                <template
                  v-if="!['Finished', 'Canceled'].includes(season.status)"
                >
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive"
                    @click="confirmCancelSeason = true"
                  >
                    {{ $t("league.actions.cancel_season") }}
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </template>
        </TacticalPageHeader>

        <SeasonPhaseTimeline :season="season" />

        <Tabs v-model="tab">
          <TabsList
            variant="underline"
            :class="[tacticalTabsListClasses, 'h-auto flex-wrap']"
          >
            <TabsTrigger value="overview" :class="tacticalTabsTriggerClasses">
              {{ $t("league.tabs.overview") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="seasonStarted"
              value="schedule"
              :class="tacticalTabsTriggerClasses"
            >
              {{ $t("league.tabs.schedule") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="seasonStarted"
              value="bracket"
              :class="tacticalTabsTriggerClasses"
            >
              {{ $t("league.tabs.bracket") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="seasonStarted"
              value="stats"
              :class="tacticalTabsTriggerClasses"
            >
              {{ $t("league.tabs.stats") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="season.movements?.length"
              value="movements"
              :class="tacticalTabsTriggerClasses"
            >
              {{ $t("league.tabs.movements") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="isAdmin && !seasonStarted"
              value="registrations"
              :class="[tacticalTabsTriggerClasses, 'ml-auto']"
            >
              {{ $t("league.manage.registrations") }}
            </TabsTrigger>
            <TabsTrigger
              v-if="isAdmin"
              value="manage"
              :class="[
                tacticalTabsTriggerClasses,
                'data-[state=active]:!bg-[hsl(var(--tac-amber)/0.16)]',
                seasonStarted ? 'ml-auto' : '',
              ]"
            >
              <Settings2
                class="mr-1.5 inline-block h-3.5 w-3.5 align-middle"
              />{{ $t("league.manage.title") }}
            </TabsTrigger>
          </TabsList>

          <!-- ===== Overview ===== -->
          <TabsContent value="overview" class="tab-panel-in space-y-5 pt-4">
            <!-- Standings (focused on the viewer's team) -->
            <SeasonStandings
              :season-divisions="seasonDivisions"
              :team-names="standingsTeamNames"
              :playoff-seats="season.playoff_seats"
              :withdrawn-team-season-ids="withdrawnTeamSeasonIds"
              :my-team-season-ids="myTeamSeasonIds"
            />

            <!-- Registered → how-it-works + my team side by side; otherwise
                 how-it-works centered with the register CTA. -->
            <div
              class="grid items-start gap-5"
              :class="myRegistrations.length ? 'lg:grid-cols-2' : ''"
            >
              <!-- How the league works, with a register CTA at the bottom -->
              <section
                class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
                :class="
                  myRegistrations.length ? '' : 'mx-auto w-full max-w-3xl'
                "
              >
                <span :class="tacticalSectionLabelClasses">
                  <HelpCircle class="mr-1 h-3.5 w-3.5" />
                  {{ $t("league.about.title") }}
                </span>
                <ol
                  class="mt-2 space-y-2.5 text-sm text-muted-foreground [counter-reset:step]"
                >
                  <li
                    v-for="step in [
                      'register',
                      'placement',
                      'weekly',
                      'default_night',
                      'roster_lock',
                      'playoffs',
                      'movement',
                    ]"
                    :key="step"
                    class="flex gap-3 [counter-increment:step]"
                  >
                    <span
                      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] font-mono text-xs font-bold text-[hsl(var(--tac-amber))] before:content-[counter(step)]"
                    ></span>
                    <span>{{ $t(`league.about.${step}`) }}</span>
                  </li>
                </ol>

                <div
                  v-if="season.can_register && !myRegistrations.length"
                  class="mt-5 flex justify-end border-t border-border pt-4"
                >
                  <button
                    type="button"
                    :class="[tacticalCtaButtonClasses, 'gap-2']"
                    @click="openRegister(false)"
                  >
                    <PlusCircle class="h-4 w-4" />
                    {{ $t("league.join.register") }}
                  </button>
                </div>
              </section>

              <!-- My team(s) — right column when registered -->
              <div v-if="myRegistrations.length" class="space-y-5">
                <section
                  v-for="registration in myRegistrations"
                  :key="registration.id"
                  class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
                >
                  <!-- Team name + status + withdraw -->
                  <div class="mb-4 flex flex-wrap items-center gap-2.5">
                    <span :class="[tacticalSectionLabelClasses, '!mb-0']">
                      <span :class="tacticalSectionTickClasses"></span>
                      {{ registration.league_team.team.name }}
                    </span>
                    <Badge variant="outline">{{ registration.status }}</Badge>
                    <Button
                      v-if="
                        ['Pending', 'Waitlisted', 'Approved'].includes(
                          registration.status,
                        ) &&
                        [
                          'Setup',
                          'RegistrationOpen',
                          'RegistrationClosed',
                        ].includes(season.status)
                      "
                      size="sm"
                      variant="ghost"
                      class="ml-auto h-7 gap-1.5 text-muted-foreground hover:text-destructive"
                      @click="confirmWithdrawId = registration.id"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      {{ $t("league.my_team.withdraw") }}
                    </Button>
                  </div>

                  <div
                    v-if="registration.status === 'Declined'"
                    class="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3"
                  >
                    <p class="text-sm text-destructive">
                      {{
                        registration.decline_reason
                          ? $t("league.my_team.declined_with_reason", {
                              reason: registration.decline_reason,
                            })
                          : $t("league.my_team.declined")
                      }}
                    </p>
                    <Button
                      v-if="season.status === 'RegistrationOpen'"
                      size="sm"
                      variant="outline"
                      class="mt-2"
                      @click="resubmitRegistration(registration.id)"
                    >
                      {{ $t("league.my_team.resubmit") }}
                    </Button>
                  </div>

                  <!-- Starters -->
                  <div
                    class="mb-1.5 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {{ $t("team.members.starters") }}
                    <span
                      class="tabular-nums"
                      :class="
                        starters(registration).length === rosterMin
                          ? 'text-success'
                          : 'text-[hsl(var(--tac-amber))]'
                      "
                    >
                      {{ starters(registration).length }}/{{ rosterMin }}
                    </span>
                  </div>
                  <ul class="grid gap-1.5 sm:grid-cols-2">
                    <li
                      v-for="member in starters(registration)"
                      :key="member.player_steam_id"
                      class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                    >
                      <PlayerDisplay :player="member.player" />
                      <div
                        v-if="!season.is_roster_locked"
                        class="flex shrink-0 items-center gap-0.5"
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          class="h-7 w-7 text-muted-foreground"
                          :disabled="!canDemote(registration)"
                          :title="
                            canDemote(registration)
                              ? $t('league.my_team.make_sub')
                              : $t('league.my_team.subs_full', { max: subsCap })
                          "
                          @click="
                            setRosterStatus(
                              registration.id,
                              member.player_steam_id,
                              'Substitute',
                            )
                          "
                        >
                          <ArrowDown class="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="h-7 w-7 text-muted-foreground hover:text-destructive"
                          @click="
                            removeRosterPlayer(
                              registration.id,
                              member.player_steam_id,
                            )
                          "
                        >
                          <Trash2 class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                    <li
                      v-if="!starters(registration).length"
                      class="text-sm text-muted-foreground sm:col-span-2"
                    >
                      {{ $t("league.my_team.no_starters") }}
                    </li>
                  </ul>

                  <!-- Substitutes -->
                  <template v-if="substitutes(registration).length">
                    <div
                      class="mb-1.5 mt-4 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {{ $t("team.members.substitutes") }}
                      <span class="tabular-nums">
                        {{ substitutes(registration).length }}/{{ subsCap }}
                      </span>
                    </div>
                    <ul class="grid gap-1.5 sm:grid-cols-2">
                      <li
                        v-for="member in substitutes(registration)"
                        :key="member.player_steam_id"
                        class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2"
                      >
                        <PlayerDisplay :player="member.player" />
                        <div
                          v-if="!season.is_roster_locked"
                          class="flex shrink-0 items-center gap-0.5"
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            class="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--tac-amber))]"
                            :disabled="!canPromote(registration)"
                            :title="
                              canPromote(registration)
                                ? $t('league.my_team.make_starter')
                                : $t('league.my_team.lineup_full', {
                                    max: rosterMin,
                                  })
                            "
                            @click="
                              setRosterStatus(
                                registration.id,
                                member.player_steam_id,
                                'Starter',
                              )
                            "
                          >
                            <ArrowUp class="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="h-7 w-7 text-muted-foreground hover:text-destructive"
                            @click="
                              removeRosterPlayer(
                                registration.id,
                                member.player_steam_id,
                              )
                            "
                          >
                            <Trash2 class="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    </ul>
                  </template>

                  <!-- Add player — only while a roster spot is open -->
                  <DropdownMenu
                    v-if="
                      !season.is_roster_locked &&
                      hasOpenSpot(registration) &&
                      addablePlayers(registration).length
                    "
                  >
                    <DropdownMenuTrigger as-child>
                      <Button size="sm" variant="outline" class="mt-4 gap-1.5">
                        <UserPlus class="h-3.5 w-3.5" />
                        {{ $t("league.my_team.add_players") }}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      class="max-h-64 w-56 overflow-y-auto"
                    >
                      <DropdownMenuItem
                        v-for="member in addablePlayers(registration)"
                        :key="member.player_steam_id"
                        @click="
                          addRosterPlayer(
                            registration.id,
                            member.player_steam_id,
                            nextAddStatus(registration),
                          )
                        "
                      >
                        {{ member.player.name }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div
                    v-if="rosterChanges(registration).length"
                    class="mt-4 space-y-1.5"
                  >
                    <div
                      class="text-xs uppercase tracking-wider text-muted-foreground"
                    >
                      {{ $t("league.my_team.roster_changes") }}
                    </div>
                    <ul class="space-y-1">
                      <li
                        v-for="change in rosterChanges(registration)"
                        :key="change.player_steam_id"
                        class="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span class="line-through">{{
                          change.player.name
                        }}</span>
                        <span v-if="change.removed_reason"
                          >· {{ change.removed_reason }}</span
                        >
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <!-- ===== Schedule ===== -->
          <TabsContent value="schedule" class="tab-panel-in space-y-5 pt-4">
            <div
              v-if="
                seasonDivisions.filter((sd: any) => sd.tournament_id).length > 1
              "
              class="flex flex-wrap gap-1.5"
            >
              <Button
                v-for="sd in seasonDivisions.filter(
                  (sd: any) => sd.tournament_id,
                )"
                :key="sd.id"
                size="sm"
                :variant="
                  activeSeasonDivision?.id === sd.id ? 'default' : 'outline'
                "
                @click="selectedDivisionId = sd.league_division_id"
              >
                {{ sd.division.name }}
              </Button>
            </div>

            <SeasonMatchCalendar
              v-if="activeSeasonDivision"
              :weeks="season.match_weeks"
              :brackets="regularSeasonBrackets"
              :managed-team-ids="managedTeamIds"
              :is-admin="isAdmin"
              :my-steam-id="auth.me?.steam_id"
              :busy="mutating"
              :week-best-of="season.week_best_of"
              :default-best-of="season.default_best_of"
              :my-team-id="myRegisteredTeamId"
              :season-name="season.name"
              @propose="propose"
              @respond="respond"
              @forfeit="forfeit"
            />
            <p v-else class="py-8 text-center text-sm text-muted-foreground">
              {{ $t("league.schedule.not_started") }}
            </p>
          </TabsContent>

          <!-- ===== Player leaderboard ===== -->
          <TabsContent value="stats" class="tab-panel-in space-y-5 pt-4">
            <SeasonLeaderboard :season-id="seasonId" />
          </TabsContent>

          <!-- ===== Bracket ===== -->
          <TabsContent value="bracket" class="tab-panel-in space-y-5 pt-4">
            <SeasonBracketViewer
              :season-id="seasonId"
              :season-divisions="seasonDivisions"
              :regular-season-stage-type="season.regular_season_stage_type"
              :playoff-stage-type="season.playoff_stage_type"
            />

            <!-- Playoff match scheduling (captains propose times) -->
            <section
              v-for="entry in playoffStages.filter(
                (e: any) => e.brackets.length,
              )"
              :key="entry.tournament.id"
              class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
            >
              <span :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{
                  $t("league.playoffs.scheduling", {
                    division: entry.division.name,
                  })
                }}
              </span>

              <ul class="space-y-1.5">
                <li
                  v-for="bracket in entry.brackets"
                  :key="bracket.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <span class="flex items-center gap-2">
                    <Badge variant="outline" size="sm" class="font-mono">
                      {{ bracket.path ?? "WB" }} R{{ bracket.round }}
                    </Badge>
                    <Badge
                      variant="outline"
                      size="sm"
                      class="font-mono"
                      :class="
                        playoffBestOfLabel(bracket) > 1
                          ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                          : 'text-muted-foreground'
                      "
                    >
                      BO{{ playoffBestOfLabel(bracket) }}
                    </Badge>
                    {{ bracket.team_1?.name ?? "TBD" }}
                    <span class="text-xs text-muted-foreground">vs</span>
                    {{ bracket.team_2?.name ?? "TBD" }}
                  </span>
                  <span class="flex flex-wrap items-center gap-1.5">
                    <Badge
                      v-if="!bracket.match && bracket.scheduled_at"
                      variant="secondary"
                      size="sm"
                      class="font-mono"
                    >
                      {{ new Date(bracket.scheduled_at).toLocaleString() }}
                    </Badge>
                    <Button
                      v-if="
                        bracketReschedulable(bracket) &&
                        (managesBracketTeam(bracket) || isAdmin)
                      "
                      size="sm"
                      variant="outline"
                      class="h-7"
                      @click="openPlayoffPropose(bracket)"
                    >
                      {{ $t("league.schedule.propose") }}
                    </Button>
                    <NuxtLink
                      v-if="bracket.match"
                      :to="{
                        name: 'matches-id',
                        params: { id: bracket.match.id },
                      }"
                    >
                      <Button size="sm" variant="ghost" class="h-7">
                        {{ $t("league.schedule.view_match") }}
                      </Button>
                    </NuxtLink>
                  </span>

                  <ul
                    v-if="pendingProposals(bracket).length"
                    class="mt-1.5 w-full space-y-1"
                  >
                    <li
                      v-for="proposal in pendingProposals(bracket)"
                      :key="proposal.id"
                      class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-xs"
                    >
                      <span>
                        <span class="font-mono">{{
                          new Date(proposal.proposed_time).toLocaleString()
                        }}</span>
                        <span class="ml-1.5 text-muted-foreground">
                          {{ $t("league.schedule.proposed_by") }}
                          {{ proposal.proposed_by?.name ?? "?" }}
                        </span>
                      </span>
                      <span
                        v-if="canRespondToProposal(bracket, proposal)"
                        class="flex gap-1"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          class="h-6 px-2"
                          @click="respond(proposal.id, 'Accepted')"
                        >
                          {{ $t("league.schedule.accept") }}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          class="h-6 px-2 text-muted-foreground"
                          @click="respond(proposal.id, 'Declined')"
                        >
                          {{ $t("league.schedule.decline") }}
                        </Button>
                      </span>
                    </li>
                  </ul>
                </li>
              </ul>
            </section>

            <ProposeTimeDialog
              v-if="playoffProposeFor"
              :open="!!playoffProposeFor"
              :week-opens-at="playoffWindowOpens"
              :week-closes-at="playoffWindowCloses"
              :matchup="`${playoffProposeFor.team_1?.name ?? 'TBD'} vs ${playoffProposeFor.team_2?.name ?? 'TBD'}`"
              :scope="`${season.name} · ${$t('league.tabs.bracket')} ${playoffProposeFor.path ?? 'WB'} R${playoffProposeFor.round}`"
              @update:open="(open) => !open && (playoffProposeFor = null)"
              @submit="onPlayoffProposeSubmit"
            />
          </TabsContent>

          <!-- ===== Movements ===== -->
          <TabsContent value="movements" class="tab-panel-in pt-4 space-y-5">
            <div v-if="season.relegation_playoffs?.length" class="space-y-2">
              <div :class="[tacticalSectionLabelClasses, 'mb-1']">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("league.movements.relegation_playoffs") }}
              </div>
              <NuxtLink
                v-for="rp in season.relegation_playoffs"
                :key="rp.id"
                :to="
                  rp.tournament
                    ? {
                        name: 'league-seasons-seasonId-tournaments-tournamentId',
                        params: { seasonId, tournamentId: rp.tournament.id },
                      }
                    : undefined
                "
                class="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span>
                  {{ rp.higher_division?.name }} ↔
                  {{ rp.lower_division?.name }}
                </span>
                <Badge
                  variant="outline"
                  :class="
                    rp.resolved_at
                      ? 'border-success/50 text-success'
                      : 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
                  "
                >
                  {{
                    rp.resolved_at
                      ? $t("league.movements.playoff_resolved")
                      : (rp.tournament?.status ?? "—")
                  }}
                </Badge>
              </NuxtLink>
            </div>

            <MovementsReview
              :movements="season.movements ?? []"
              :divisions="divisions"
              :is-admin="isAdmin"
              :busy="mutating"
              @override="overrideMovement"
              @approve-all="approveMovements"
            />
          </TabsContent>

          <!-- ===== Registrations (admin, pre-start only) ===== -->
          <TabsContent
            v-if="isAdmin && !seasonStarted"
            value="registrations"
            class="tab-panel-in space-y-5 pt-4"
          >
            <SeasonRegistrations
              :team-seasons="season.team_seasons"
              :divisions="divisions"
              :min-roster-size="rosterMin"
              :season-live="['Live', 'Playoffs'].includes(season.status)"
              :busy="mutating"
              @assign="
                (teamSeasonId, divisionId) =>
                  setTeamSeason(teamSeasonId, {
                    assigned_division_id: divisionId,
                  })
              "
              @set-status="
                (teamSeasonId, status, reason) =>
                  setTeamSeason(teamSeasonId, {
                    status,
                    ...(status === 'Declined'
                      ? { decline_reason: reason ?? null }
                      : {}),
                  })
              "
              @remove="removeTeamFromSeason"
            >
              <template #actions>
                <button
                  v-if="!['Finished', 'Canceled'].includes(season.status)"
                  type="button"
                  class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-3 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.2)]"
                  @click="openRegister(true)"
                >
                  <PlusCircle class="h-3.5 w-3.5" />
                  {{ $t("league.join.title_admin") }}
                </button>
              </template>
            </SeasonRegistrations>
          </TabsContent>

          <!-- ===== Manage (admin) ===== -->
          <TabsContent
            v-if="isAdmin"
            value="manage"
            class="tab-panel-in space-y-5 pt-4"
          >
            <!-- Season setup (schedule / roster / dates) -->
            <section
              class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
            >
              <span :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("league.settings.title") }}
              </span>
              <p class="mb-4 text-xs text-muted-foreground">
                {{ $t("league.settings.hint") }}
              </p>
              <LeagueSeasonSettingsEditor
                :schedule-locked="seasonStarted"
                v-model:weeks-count="editWeeksCount"
                v-model:games-per-week="editGamesPerWeek"
                v-model:starts-at="editStartsAt"
                v-model:signup-opens="editSignupOpens"
                v-model:signup-closes="editSignupCloses"
                v-model:roster-lock-at="editRosterLockAt"
              />
            </section>

            <!-- Series format -->
            <section
              class="rounded-lg border border-border bg-[hsl(var(--card)/0.4)] p-5"
            >
              <span :class="tacticalSectionLabelClasses">
                <span :class="tacticalSectionTickClasses"></span>
                {{ $t("league.series.title") }}
              </span>
              <p class="mb-4 text-xs text-muted-foreground">
                {{ $t("league.series.hint") }}
              </p>
              <LeagueSeriesFormatEditor
                :weeks-count="season.match_weeks_count"
                v-model:playoff-seats="editPlayoffSeats"
                :seats-locked="playoffSeatsLocked"
                :default-best-of="season.default_best_of"
                :playoff-best-of="season.playoff_best_of"
                :structure-locked="playoffStructureLocked"
                v-model:week-best-of="editWeekBestOf"
                v-model:playoff-round-best-of="editPlayoffRoundBestOf"
                v-model:playoff-stage-type="editPlayoffStageType"
                v-model:playoff-third-place-match="editPlayoffThirdPlace"
              />
            </section>

            <!-- Floating save bar for the series-format edits -->
            <SettingsSaveBar
              v-if="tab === 'manage'"
              :dirty="seriesFormatDirty"
              :submitting="savingSeriesFormat"
              :action-label="$t('league.series.save')"
              @save="saveSeriesFormat"
              @discard="seedSeriesFormat"
            />

            <!-- Danger zone -->
            <section
              class="rounded-lg border border-destructive/40 bg-destructive/5 p-5"
            >
              <span
                :class="tacticalSectionLabelClasses"
                class="!text-destructive"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-destructive"
                ></span>
                {{ $t("league.manage.danger_zone") }}
              </span>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-if="!['Finished', 'Canceled'].includes(season.status)"
                  variant="destructive"
                  size="sm"
                  @click="confirmCancelSeason = true"
                >
                  {{ $t("league.actions.cancel_season") }}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  @click="confirmDeleteSeason = true"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                  {{ $t("common.delete") }}
                </Button>
              </div>
            </section>
          </TabsContent>
        </Tabs>

        <AlertDialog
          :open="confirmCancelSeason"
          @update:open="(open: boolean) => (confirmCancelSeason = open)"
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ $t("league.confirm.cancel_season_title") }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{ $t("league.confirm.cancel_season_description") }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                @click="
                  confirmCancelSeason = false;
                  setSeasonStatus('Canceled');
                "
              >
                {{ $t("league.actions.cancel_season") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          :open="!!confirmWithdrawId"
          @update:open="(open: boolean) => !open && (confirmWithdrawId = null)"
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ $t("league.confirm.withdraw_title") }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{ $t("league.confirm.withdraw_description") }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel @click="confirmWithdrawId = null">{{
                $t("common.cancel")
              }}</AlertDialogCancel>
              <Button variant="destructive" @click="withdrawRegistration">
                {{ $t("league.my_team.withdraw") }}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          :open="confirmDeleteSeason"
          @update:open="(open: boolean) => (confirmDeleteSeason = open)"
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{{
                $t("league.seasons.delete_title")
              }}</AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t("league.seasons.delete_description", { name: season.name })
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel @click="confirmDeleteSeason = false">
                {{ $t("common.cancel") }}
              </AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                @click="deleteSeason"
              >
                {{ $t("common.delete") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog v-model:open="showCreateModal">
          <DialogScrollContent class="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{{ $t("league.season_form.title") }}</DialogTitle>
            </DialogHeader>
            <LeagueSeasonForm
              :submitting="creatingSeason"
              @submit="createSeason"
            />
          </DialogScrollContent>
        </Dialog>

        <!-- Register a team (large modal) -->
        <Dialog
          v-model:open="showRegisterDialog"
          @update:open="(open: boolean) => open && registerFormKey++"
        >
          <DialogScrollContent class="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{{
                registerAnyTeam
                  ? $t("league.join.title_admin")
                  : $t("league.join.title")
              }}</DialogTitle>
              <DialogDescription>
                {{ $t("league.join.cta_hint") }}
              </DialogDescription>
            </DialogHeader>
            <LeagueJoinForm
              :key="registerFormKey"
              :teams="myTeams"
              :divisions="divisions"
              :min-roster-size="rosterMin"
              :max-roster-size="rosterMax"
              :registered-team-ids="registeredTeamIds"
              :can-select-any-team="registerAnyTeam"
              :submitting="registering"
              @register="registerTeam"
            />
          </DialogScrollContent>
        </Dialog>
      </template>

      <div v-else class="py-12 text-center text-muted-foreground">
        {{ $t("league.not_found") }}
      </div>
    </div>
  </PageTransition>
</template>
