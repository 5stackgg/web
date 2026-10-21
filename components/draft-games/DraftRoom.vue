<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowRight,
  Swords,
  Play,
  MessagesSquare,
  Inbox,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useElementSize } from "@vueuse/core";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "~/components/ui/alert-dialog";
import { Spinner } from "~/components/ui/spinner";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import mapLabel from "~/utilities/mapLabel";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import VoiceChannelCard from "~/components/voice/VoiceChannelCard.vue";
import { matchHasEnded } from "~/utilities/matchTeamLobby";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import DraftSettingsBar from "~/components/draft-games/DraftSettingsBar.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import DraftPlayerCard from "~/components/draft-games/DraftPlayerCard.vue";
import DraftBackupsPanel from "~/components/draft-games/DraftBackupsPanel.vue";
import DraftClock from "~/components/draft-games/DraftClock.vue";
import DraftPickTrack from "~/components/draft-games/DraftPickTrack.vue";
import DraftActionButton from "~/components/draft-games/DraftActionButton.vue";
import DraftSelfStatus from "~/components/draft-games/DraftSelfStatus.vue";
import DraftRequestQueue from "~/components/draft-games/DraftRequestQueue.vue";
import DraftOpenSlot from "~/components/draft-games/DraftOpenSlot.vue";
import DraftSettingsSheet from "~/components/draft-games/DraftSettingsSheet.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
import { playerBlockErrorKey } from "~/utilities/playerBlocks";
import { useCountdown } from "~/composables/useCountdown";
import { STARTING_STATUSES, vetoMapsSet } from "~/utilities/vetoStage";

const props = defineProps<{
  room: any;
  match?: any;
  inviteCode?: string;
  // The map veto's picks, when the caller has them (the FAQ's demo draft).
  vetoPicks?: any[];
}>();

const { t } = useI18n();

// After the last pick the veto box stays: the board turns into the start
// stage while the server boots, until the room hands over to the match page.
const inStartStage = computed(
  () =>
    !!props.room.match_id &&
    vetoMapsSet(props.match) &&
    STARTING_STATUSES.includes(props.match?.status),
);

// Match info is often empty here (during the veto); then it adds no gap above
// the board, so the board's top lines up with the chat rail's.
const matchInfoEl = ref<HTMLElement | null>(null);
const { height: matchInfoHeight } = useElementSize(matchInfoEl);

const inVeto = computed(
  () =>
    !!props.room.match_id &&
    (props.match?.status === "Veto" || inStartStage.value),
);

const inMatchStarting = computed(
  () =>
    !!props.room.match_id &&
    ["WaitingForServer", "CreatingMatch", "Live"].includes(props.match?.status),
);

const checkInBySteamId = computed(() => {
  const match = props.match;
  if (!match || match.status !== "WaitingForCheckIn") {
    return null;
  }
  const map: Record<string, boolean> = {};
  for (const lineup of [match.lineup_1, match.lineup_2]) {
    for (const lp of lineup?.lineup_players || []) {
      map[lp.steam_id] = !!lp.checked_in;
    }
  }
  return map;
});

const isCheckIn = computed(
  () => !!props.room.match_id && props.match?.status === "WaitingForCheckIn",
);

// A draft match gives everyone a minute to check in from when the draft made
// it. Running out cancels nothing: the host swaps a backup in for whoever is
// missing, and the match's own auto-cancel stays behind it as the safety net.
const DRAFT_CHECK_IN_SECONDS = 60;

const checkInEndsAt = computed(() => {
  const createdAt = props.match?.created_at;
  if (!isCheckIn.value || !createdAt) {
    return null;
  }
  return new Date(
    new Date(createdAt).getTime() + DRAFT_CHECK_IN_SECONDS * 1000,
  ).toISOString();
});

const { seconds: checkInSeconds } = useCountdown(
  checkInEndsAt,
  ref(DRAFT_CHECK_IN_SECONDS),
);

const checkInWindowOver = computed(
  () => !!checkInEndsAt.value && checkInSeconds.value === 0,
);

const checkInDeadline = computed(() =>
  checkInWindowOver.value ? props.match?.cancels_at : checkInEndsAt.value,
);

const checkInDeadlineHelp = computed(() =>
  checkInWindowOver.value
    ? undefined
    : t("draft_games.room.check_in_window_help"),
);

const checkInProgress = computed(() => {
  const map = checkInBySteamId.value;
  if (!map) {
    return null;
  }
  const states = Object.values(map);
  return { ready: states.filter(Boolean).length, total: states.length };
});

const me = computed(() => useAuthStore().me);
const perTeam = computed(() => props.room.capacity / 2);

const settingsOpen = ref(false);

const isHostMode = computed(() => props.room.mode === "Host");
const isHost = computed(() => me.value?.steam_id === props.room.host_steam_id);
const isOrganizer = computed(() => !!props.room.is_organizer);
const isDrafting = computed(() => props.room.status === "Drafting");

const myMembership = computed(() =>
  props.room.players.find((p: any) => p.steam_id === me.value?.steam_id),
);
// `lineup` is which side a player sits on and `status` is whether they start
// there: a Waitlist row with a lineup is that side's backup, never a starter.
const isMember = computed(() => myMembership.value?.status === "Accepted");
const isLobbyPhase = computed(
  () => !props.room.match_id && ["Open", "Filled"].includes(props.room.status),
);
// Once the match exists there is a single conversation: the match chat.
// Only switch after lineup players exist — the server's match-chat join gate
// checks lineup membership, so joining before finalize() inserts them would
// silently reject and never retry.
const matchChatReady = computed(
  () =>
    !!props.room.match_id &&
    props.match?.id === props.room.match_id &&
    ((props.match?.lineup_1?.lineup_players?.length ?? 0) > 0 ||
      (props.match?.lineup_2?.lineup_players?.length ?? 0) > 0),
);
const chatType = computed(() => (matchChatReady.value ? "match" : "draft"));
const chatLobbyId = computed(() =>
  matchChatReady.value ? props.room.match_id : props.room.id,
);
// The match page derives its team room from `lineup.is_on_lineup`, but the
// draft subscription does not select that field — `myMembership.lineup` is the
// side (1 or 2) this viewer was drafted onto, which maps to the same lineup id.
// Accepted only: the server's match_team join gate checks the real
// match_lineups row, and a Waitlist backup was never inserted into it.
const myMatchLineupId = computed(() => {
  if (
    !matchChatReady.value ||
    myMembership.value?.lineup == null ||
    myMembership.value?.status !== "Accepted"
  ) {
    return null;
  }
  return myMembership.value.lineup === 1
    ? props.match?.lineup_1_id
    : props.match?.lineup_2_id;
});
// Voice closes a few minutes after the match reaches a terminal status and the
// API stops admitting the channel with it; team chat keeps working, which is why
// this is not simply myMatchLineupId.
const myVoiceLineupId = computed(() =>
  matchHasEnded(props.match) ? null : myMatchLineupId.value,
);
const teamChatLobbyId = computed(() =>
  myMatchLineupId.value ? `${props.match.id}:${myMatchLineupId.value}` : null,
);
const inLineup = computed(
  () =>
    myMembership.value?.lineup != null &&
    myMembership.value?.status === "Accepted",
);
const canChat = computed(() => {
  if (matchChatReady.value) {
    return inLineup.value || isOrganizer.value;
  }
  return isLobbyPhase.value || isMember.value || isOrganizer.value;
});
const isWaitlisted = computed(() => myMembership.value?.status === "Waitlist");
const hasRequested = computed(() => myMembership.value?.status === "Requested");
const isInvited = computed(() => myMembership.value?.status === "Invited");
const acceptedCount = computed(
  () => props.room.players.filter((p: any) => p.status === "Accepted").length,
);
const lobbyFull = computed(() => acceptedCount.value >= props.room.capacity);
const canJoin = computed(
  () =>
    !myMembership.value && props.room.status === "Open" && !props.room.match_id,
);
const joinRoom = () => {
  if (!me.value) {
    navigateTo(`/login?next=/draft-room/${props.room.id}`);
    return;
  }
  return runGuarded("join", () =>
    useDraftGamesStore().join(props.room.id, props.inviteCode),
  );
};
const notStarted = computed(
  () => !props.room.match_id && props.room.status === "Open",
);
const isHostAssigning = computed(() => isHostMode.value && notStarted.value);
const isAssembling = computed(
  () =>
    !isHostMode.value &&
    ["Open", "Filled", "SelectingCaptains"].includes(props.room.status),
);

const accepted = computed(() =>
  props.room.players.filter((p: any) => p.status === "Accepted"),
);
const requests = computed(() =>
  props.room.players.filter((p: any) => p.status === "Requested"),
);
const waitlist = computed(() =>
  props.room.players
    .filter((p: any) => p.status === "Waitlist")
    .sort((a: any, b: any) =>
      String(a.joined_at || "").localeCompare(String(b.joined_at || "")),
    ),
);
const invited = computed(() =>
  props.room.players
    .filter((p: any) => p.status === "Invited")
    .sort((a: any, b: any) =>
      String(a.joined_at || "").localeCompare(String(b.joined_at || "")),
    ),
);

const pool = computed(() =>
  accepted.value
    .filter((p: any) => p.lineup === null || p.lineup === undefined)
    .sort((a: any, b: any) =>
      String(a.joined_at || "").localeCompare(String(b.joined_at || "")),
    ),
);

const appSettings = useApplicationSettingsStore();
const eloSource = ref<"elo" | "cs2" | "faceit">("elo");
const rankSources = computed(() => {
  const sources = [{ key: "elo", label: "5Stack" }];
  if (appSettings.linkedAccountsEnabled) {
    sources.push({ key: "cs2", label: "CS2" });
  }
  if (appSettings.faceitEnabled) {
    sources.push({ key: "faceit", label: "Faceit" });
  }
  return sources;
});
const rankMatchType = computed(() =>
  eloSource.value === "cs2"
    ? "Premier"
    : eloSource.value === "faceit"
      ? "Faceit"
      : null,
);
const setEloSource = (key: string) => {
  eloSource.value = key as "elo" | "cs2" | "faceit";
};

const acceptedFull = computed(
  () => accepted.value.length >= props.room.capacity,
);

const hasAssignedTeams = computed(() =>
  accepted.value.some((p: any) => p.lineup === 1 || p.lineup === 2),
);
const showTeamPanels = computed(() =>
  props.room.mode === "Pug" ? hasAssignedTeams.value : true,
);

// Captain first, then pick order -- the draft's, or the order a Host lobby
// placed players on the side.
const startersFor = (lineup: number) =>
  [...props.room.players]
    .filter((p: any) => p.lineup === lineup && p.status !== "Waitlist")
    .sort(
      (a: any, b: any) =>
        Number(b.is_captain) - Number(a.is_captain) ||
        (a.pick_order ?? 99) - (b.pick_order ?? 99) ||
        String(a.joined_at || "").localeCompare(String(b.joined_at || "")),
    );

const team1 = computed(() => startersFor(1));
const team2 = computed(() => startersFor(2));

const byJoinedAt = (a: any, b: any) =>
  String(a.joined_at || "").localeCompare(String(b.joined_at || ""));

// Backups are pinned to the side they would sub for. Anyone still unsided
// (joined an open lobby off the street) gets their own bucket.
const backupsFor = (lineup: number) =>
  props.room.players
    .filter((p: any) => p.status === "Waitlist" && p.lineup === lineup)
    .sort(byJoinedAt);

// Anyone in the lobby without a side — someone who joined a half-open Teams
// lobby, or a player dragged out of both rosters. They have nowhere else to
// show up, so they get their own bucket to be slotted from.
const unsidedPlayers = computed(() =>
  props.room.players
    .filter((p: any) => {
      if (p.lineup != null || !["Accepted", "Waitlist"].includes(p.status)) {
        return false;
      }
      // An inner squad's shared pool already lists every waitlisted player.
      return !(props.room.inner_squad && p.status === "Waitlist");
    })
    .sort(byJoinedAt),
);

// An inner squad is one roster split in two, so its backups stay in a single
// pool that can start on either side.
const innerSquadBackups = computed(() =>
  props.room.players
    .filter((p: any) => p.status === "Waitlist")
    .sort(byJoinedAt),
);

const currentLineup = computed(() => props.room.current_pick_lineup);

const currentCaptain = computed(() =>
  props.room.players.find(
    (p: any) => p.is_captain && p.lineup === currentLineup.value,
  ),
);

const myCaptainLineup = computed(() => {
  const player = props.room.players.find(
    (p: any) => p.steam_id === me.value?.steam_id && p.is_captain,
  );
  return player?.lineup;
});

const isMyTurn = computed(
  () =>
    isDrafting.value &&
    !isHostMode.value &&
    myCaptainLineup.value === currentLineup.value,
);

const canAssign = computed(() => isHostAssigning.value && isOrganizer.value);

const canManage = computed(() => isOrganizer.value && notStarted.value);

const canInvite = computed(
  () =>
    isOrganizer.value &&
    !props.room.match_id &&
    !["Completed", "Canceled"].includes(props.room.status),
);

const openSlots = computed(() =>
  Math.max(0, props.room.capacity - accepted.value.length),
);

const pending = ref<Set<string>>(new Set());

const isPending = (key: string) => pending.value.has(key);

const runGuarded = async (key: string, action: () => Promise<unknown>) => {
  if (pending.value.has(key)) {
    return;
  }
  pending.value = new Set(pending.value).add(key);
  try {
    await action();
  } catch (error: any) {
    const blockedKey = playerBlockErrorKey(error?.message);
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: blockedKey ? t(blockedKey) : error?.message,
    });
  } finally {
    const next = new Set(pending.value);
    next.delete(key);
    pending.value = next;
  }
};

const kickTarget = ref<string | null>(null);

const kick = (steamId: string) => {
  kickTarget.value = steamId;
};

const confirmKick = () => {
  const steamId = kickTarget.value;
  kickTarget.value = null;
  if (!steamId) {
    return;
  }
  // Once the match exists, leaving the lobby no longer takes anyone out of it.
  return runGuarded(`kick:${steamId}`, () =>
    isCheckIn.value
      ? useDraftGamesStore().replaceNoShow(props.room.id, steamId)
      : useDraftGamesStore().kick(props.room.id, steamId),
  );
};

const add = (steamId: string) => {
  return runGuarded(`add:${steamId}`, () =>
    useDraftGamesStore().add(props.room.id, steamId),
  );
};

// Added with the lineup in one shot -- adding then assigning would flash the
// player through the lobby pool on the way to their slot.
const addToTeam = (steamId: string, lineup: number) => {
  return runGuarded(`add:${steamId}`, () =>
    useDraftGamesStore().add(props.room.id, steamId, lineup),
  );
};

const respondInvite = (accept: boolean) => {
  return runGuarded(`respond:${accept}`, () =>
    useDraftGamesStore().respondInvite(props.room.id, accept),
  );
};

const clockAccent = computed(() =>
  currentLineup.value === 2 ? "var(--tac-blue)" : "var(--tac-amber)",
);

const statusLabel = computed(() => {
  if (isMyTurn.value) {
    return "draft_games.room.your_pick";
  }
  if (currentLineup.value === 1) {
    return "draft_games.room.alpha_picking";
  }
  if (currentLineup.value === 2) {
    return "draft_games.room.bravo_picking";
  }
  return "draft_games.room.standby";
});

const draftedCount = computed(
  () =>
    props.room.players.filter((p: any) => !p.is_captain && p.lineup != null)
      .length,
);

const pattern = computed<Array<number>>(() => props.room.pattern ?? []);

const draftSideLabel = (lineup: number) =>
  t(
    lineup === 1
      ? "draft_games.room.team_alpha"
      : "draft_games.room.team_bravo",
  );

// pick_order counts within one side (captain 0, then 1, 2...), while the board
// numbers picks across the whole draft, so the nth pick of a side is the nth
// time that side appears in the pattern.
const overallPickNumber = (lineup: number, order: number) => {
  let seen = 0;
  for (let index = 0; index < pattern.value.length; index++) {
    if (pattern.value[index] !== lineup) {
      continue;
    }
    seen++;
    if (seen === order) {
      return index + 1;
    }
  }
  return null;
};

// Only a captains draft fills sides in pattern order; Pug's auto-split and
// Host assignment number each side 1..n themselves.
const pickLabelsFor = (players: Array<any>) =>
  props.room.mode !== "Captains"
    ? {}
    : Object.fromEntries(
        players.map((player: any) => [
          player.steam_id,
          player.is_captain
            ? "C"
            : String(
                overallPickNumber(player.lineup, player.pick_order) ??
                  player.pick_order ??
                  "",
              ),
        ]),
      );

const upcomingPicksFor = (lineup: number) =>
  isDrafting.value
    ? pattern.value
        .map((side, index) => ({ side, no: index + 1 }))
        .filter((pick) => pick.side === lineup && pick.no > draftedCount.value)
        .map((pick) => pick.no)
    : [];

const clockPick = computed(() =>
  isDrafting.value ? draftedCount.value + 1 : null,
);

const pickTrack = computed(() => {
  const seen: Record<number, number> = {};
  return pattern.value.map((lineup, index) => {
    seen[lineup] = (seen[lineup] ?? 0) + 1;
    const order = seen[lineup];
    const member = props.room.players.find(
      (p: any) =>
        p.lineup === lineup &&
        !p.is_captain &&
        p.status !== "Waitlist" &&
        p.pick_order === order,
    );
    if (member) {
      const pick = (props.room.picks || []).find(
        (entry: any) => entry.picked?.steam_id === member.steam_id,
      );
      return {
        no: index + 1,
        lineup,
        state: "done" as const,
        name: member.player?.name ?? "",
        avatar: member.player?.custom_avatar_url || member.player?.avatar_url,
        auto: !!pick?.auto_picked,
      };
    }
    const current = isDrafting.value && index === draftedCount.value;
    return {
      no: index + 1,
      lineup,
      state: current ? ("current" as const) : ("upcoming" as const),
      name: current
        ? t(
            isMyTurn.value
              ? "draft_games.room.your_pick"
              : "draft_games.room.on_the_clock",
          )
        : draftSideLabel(lineup),
    };
  });
});

const pickProgress = computed(() =>
  t("draft_games.room.pick_of", {
    n: Math.min(draftedCount.value + 1, pattern.value.length),
    total: pattern.value.length,
  }),
);

// Same rule as the server's auto-pick: highest elo_snapshot, ties to whoever
// joined first (the pool is already in join order and the sort is stable).
const autoPickName = computed(
  () =>
    [...pool.value].sort(
      (a: any, b: any) => (b.elo_snapshot || 0) - (a.elo_snapshot || 0),
    )[0]?.player?.name,
);

const hasPicks = computed(() => (props.room.picks?.length || 0) > 0);

const { seconds: pickSeconds } = useCountdown(
  computed(() => props.room.pick_deadline),
  ref(30),
);

const freshSteamIds = ref<Array<string>>([]);
const pickAnnouncement = ref("");

watch(
  () => props.room.picks?.length ?? 0,
  (count, previous) => {
    if (previous === undefined || count <= previous) {
      return;
    }
    const latest = props.room.picks[count - 1];
    const steamId = latest?.picked?.steam_id;
    if (!steamId) {
      return;
    }
    freshSteamIds.value = [...freshSteamIds.value, steamId];
    pickAnnouncement.value = t("draft_games.room.picked_announce", {
      captain: latest.captain?.name ?? "",
      player: latest.picked?.name ?? "",
    });
    setTimeout(() => {
      freshSteamIds.value = freshSteamIds.value.filter((id) => id !== steamId);
    }, 2400);
  },
  { immediate: true },
);

const hasSelfStatus = computed(
  () =>
    canJoin.value ||
    hasRequested.value ||
    isWaitlisted.value ||
    isInvited.value,
);

const leaveWaitlist = () =>
  runGuarded("leave", () => useDraftGamesStore().leave(props.room.id));

const remainingToFill = computed(
  () => props.room.capacity - accepted.value.length,
);

const showQueue = computed(
  () => props.room.require_approval && props.room.status === "Open",
);

const memberIds = computed(() =>
  props.room.players.map((p: any) => p.steam_id),
);

const draftPick = (steamId: string) => {
  return runGuarded("pick", () =>
    useDraftGamesStore().pick(props.room.id, steamId),
  );
};
const assign = (steamId: string, lineup: number) => {
  return runGuarded(`assign:${steamId}`, () =>
    useDraftGamesStore().teamAssign(props.room.id, steamId, lineup),
  );
};
const unassign = (steamId: string) => {
  return runGuarded(`assign:${steamId}`, () =>
    useDraftGamesStore().teamAssign(props.room.id, steamId, null),
  );
};

const isTeamsMode = computed(() => props.room.mode === "Teams");

const team1Count = computed(() => team1.value.length);
const team2Count = computed(() => team2.value.length);
const team1Full = computed(() => team1Count.value >= perTeam.value);
const team2Full = computed(() => team2Count.value >= perTeam.value);

// In Host mode players pick their own team rather than the host assigning them.
const canSelfPick = (player: any) =>
  isHostAssigning.value && player.steam_id === me.value?.steam_id;

// Manual captain selection: the host designates the two captains before the
// draft begins.
const isManualCaptains = computed(
  () =>
    props.room.mode === "Captains" && props.room.captain_selection === "Manual",
);
const team1Captain = computed(() =>
  props.room.players.find((p: any) => p.is_captain && p.lineup === 1),
);
const team2Captain = computed(() =>
  props.room.players.find((p: any) => p.is_captain && p.lineup === 2),
);
const manualCaptainsReady = computed(
  () => !!team1Captain.value && !!team2Captain.value,
);
const canDesignateCaptain = computed(
  () => isManualCaptains.value && canManage.value,
);

const designateCaptain = (steamId: string, lineup: number) =>
  runGuarded(`captain:${steamId}`, () =>
    useDraftGamesStore().setCaptain(props.room.id, steamId, lineup),
  );

const canReplaceNoShows = computed(
  () => checkInWindowOver.value && isOrganizer.value,
);

// The backups are already in join order, so the first one is next in line.
const nextBackup = computed(() => waitlist.value[0]);

const swapLabel = computed(() =>
  nextBackup.value
    ? t("draft_games.room.swap_in", { name: nextBackup.value.player?.name })
    : null,
);

const swapInBackup = (steamId: string) => {
  const backup = nextBackup.value;
  if (!backup) {
    return;
  }
  return runGuarded(`swap:${steamId}`, () =>
    useDraftGamesStore().replaceNoShow(props.room.id, steamId, backup.steam_id),
  );
};

const makeSideCaptain = (steamId: string, lineup: number) =>
  runGuarded(`captain:${steamId}`, () =>
    useDraftGamesStore().makeSideCaptain(props.room.id, steamId, lineup),
  );

const onTeamRemove = (steamId: string) => {
  if (isManualCaptains.value) {
    return runGuarded(`captain:${steamId}`, () =>
      useDraftGamesStore().clearCaptain(props.room.id, steamId),
    );
  }
  return unassign(steamId);
};

const stage = computed(() => {
  if (inVeto.value) return "veto";
  if (inMatchStarting.value) return "starting";
  if (isTeamsMode.value) return "teams";
  return "assemble";
});

const teamForSide = (lineup: number): string | undefined => {
  if (lineup === 1) {
    return props.room.team_1_id;
  }
  return (
    props.room.team_2_id ||
    (props.room.inner_squad ? props.room.team_1_id : undefined)
  );
};

const sideName = (lineup: number): string => {
  if (props.room.inner_squad && props.room.team_1?.name) {
    return `${props.room.team_1.name} ${lineup === 1 ? "1" : "2"}`;
  }
  const team = lineup === 1 ? props.room.team_1 : props.room.team_2;
  return team?.name || "";
};

const myTeamIds = computed(
  () => new Set((me.value?.teams || []).map((team: any) => team.id)),
);

const canManageSide = (lineup: number) => {
  if (!notStarted.value) {
    return false;
  }
  if (isOrganizer.value) {
    return true;
  }
  const teamId = teamForSide(lineup);
  return !!teamId && myTeamIds.value.has(teamId);
};

const sideFull = (lineup: number) =>
  startersFor(lineup).length >= perTeam.value;

const startLabel = (lineup: number) =>
  sideFull(lineup)
    ? t("draft_games.room.side_full")
    : t("draft_games.room.start_for", {
        team: sideName(lineup) || t("draft_games.room.team", { team: lineup }),
      });

const startPlayer = (steamId: string, lineup: number) =>
  runGuarded(`swap:${steamId}`, () =>
    useDraftGamesStore().setSlot(props.room.id, steamId, lineup, "Accepted"),
  );

// Pulling someone out of a lineup demotes them to that side's backups rather
// than dropping them from the lobby — kicking is a separate, explicit action.
const benchPlayer = (steamId: string, lineup: number | null) =>
  runGuarded(`swap:${steamId}`, () =>
    useDraftGamesStore().setSlot(props.room.id, steamId, lineup, "Waitlist"),
  );

const dragSteamId = ref<string | null>(null);
const dragBackupsSide = ref<number | null>(null);

const draggedPlayer = computed(() =>
  props.room.players.find((p: any) => p.steam_id === dragSteamId.value),
);

const onDragStart = (steamId: string) => {
  dragSteamId.value = steamId;
};

const onDragEnd = () => {
  dragSteamId.value = null;
  dragBackupsSide.value = null;
};

// A drop is only offered where it would change something the dragger is
// allowed to change, so nothing silently no-ops on release.
const canDropAsStarter = (lineup: number) => {
  const player = draggedPlayer.value;
  if (!player || !canManageSide(lineup)) {
    return false;
  }
  if (player.lineup === lineup && player.status !== "Waitlist") {
    return false;
  }
  return !sideFull(lineup);
};

const canDropAsBackup = (lineup: number | null) => {
  const player = draggedPlayer.value;
  if (!player) {
    return false;
  }
  if (lineup !== null && !canManageSide(lineup)) {
    return false;
  }
  return player.lineup !== lineup || player.status !== "Waitlist";
};

const dropAsStarter = (lineup: number, steamId: string) => {
  if (!canDropAsStarter(lineup)) {
    return;
  }
  onDragEnd();
  return startPlayer(steamId, lineup);
};

const dropAsBackup = (lineup: number | null, steamId: string) => {
  if (!canDropAsBackup(lineup)) {
    return;
  }
  onDragEnd();
  return benchPlayer(steamId, lineup);
};

const onBackupsDragOver = (lineup: number | null, event: DragEvent) => {
  if (!canDropAsBackup(lineup)) {
    return;
  }
  event.preventDefault();
  dragBackupsSide.value = lineup ?? 0;
};

const canDragPlayer = (player: any) =>
  player.lineup == null
    ? canManageSide(1) || canManageSide(2)
    : canManageSide(player.lineup);

const showStart = computed(() => isOrganizer.value && notStarted.value);

const regionsAvailable = computed(
  () => appSettings.availableRegions.length > 0,
);

const startReady = computed(() => {
  if (props.room.mode === "Teams") {
    // The match lineups are exactly what the lobby assigned now, so starting
    // short would boot a match with an under-filled side.
    return (
      !!props.room.team_1_id &&
      team1Count.value === perTeam.value &&
      team2Count.value === perTeam.value
    );
  }
  if (props.room.mode === "Host") {
    return (
      team1Count.value === perTeam.value && team2Count.value === perTeam.value
    );
  }
  if (isManualCaptains.value) {
    return (
      accepted.value.length === props.room.capacity && manualCaptainsReady.value
    );
  }
  return accepted.value.length === props.room.capacity;
});

const startHint = computed(() => {
  if (props.room.mode === "Teams") {
    return props.room.team_1_id
      ? "draft_games.room.assign_all"
      : "draft_games.room.pick_teams";
  }
  if (props.room.mode === "Host") {
    return "draft_games.room.assign_all";
  }
  if (isManualCaptains.value && !manualCaptainsReady.value) {
    return "draft_games.room.pick_captains";
  }
  return "draft_games.room.need_full";
});

const start = () => {
  return runGuarded("start", () => useDraftGamesStore().start(props.room.id));
};
</script>

<template>
  <div class="draft-room space-y-4">
    <DraftSettingsBar
      :room="room"
      :match="match"
      @open-settings="settingsOpen = true"
    />

    <DraftSettingsSheet
      v-if="isOrganizer"
      :open="settingsOpen"
      :room-id="room.id"
      @close="settingsOpen = false"
    />

    <!-- Region availability flips with the fleet, not with anything the room
         did, so the warning eases in rather than shoving the room down. -->
    <Transition name="collapse">
      <div v-if="!regionsAvailable && notStarted" class="grid grid-rows-[1fr]">
        <div class="collapse-clip">
          <Alert variant="destructive" class="bg-red-600 text-white">
            <AlertTitle>
              {{ $t("match.region_veto.no_regions_available") }}
            </AlertTitle>
            <AlertDescription>
              {{ $t("draft_games.room.no_regions_available_description") }}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </Transition>

    <div class="sr-only" aria-live="polite">{{ pickAnnouncement }}</div>

    <!-- Laid out by the lobby's own width, not the viewport's: the sidebar and
         the hub dock take a different share at every screen size, and the
         chat rail only fits beside the board once the lobby itself is wide. -->
    <div class="draft-room-body">
      <div class="draft-main min-w-0 space-y-4">
        <!-- Below the rail breakpoint the rail stacks under the board, so the
             viewer's own join or invite prompt moves above it. -->
        <Transition name="collapse">
          <div
            v-if="hasSelfStatus"
            class="draft-status-top grid grid-rows-[1fr]"
          >
            <div class="collapse-clip">
              <DraftSelfStatus
                inline
                :can-join="canJoin"
                :has-requested="hasRequested"
                :is-waitlisted="isWaitlisted"
                :is-invited="isInvited"
                :lobby-full="lobbyFull"
                :require-approval="!!room.require_approval"
                @join="joinRoom"
                @leave="leaveWaitlist"
                @respond="respondInvite"
              />
            </div>
          </div>
        </Transition>

        <!-- Match info appears when the match is made -- it folds into the
             column with the room's collapse idiom instead of fading in at
             full height and shoving the board down. -->
        <Transition name="collapse">
          <div
            v-if="match"
            ref="matchInfoEl"
            class="draft-match-info grid grid-rows-[1fr]"
            :class="{ 'is-empty': matchInfoHeight === 0 }"
          >
            <div class="collapse-clip">
              <MatchInfo
                :match="match"
                hide-booting
                :check-in-deadline="checkInDeadline"
                :check-in-deadline-help="checkInDeadlineHelp"
              />
            </div>
          </div>
        </Transition>

        <!-- Stages are wildly different heights (the veto board vs one small
             starting card), so they trade through a measured height swap --
             the column eases between them instead of collapsing hundreds of
             pixels on the handoff frame. -->
        <HeightSwap>
          <div :key="stage" class="space-y-4">
            <div
              v-if="inVeto"
              class="veto-stage rounded-xl border border-border bg-card/40 p-6 [backdrop-filter:blur(8px)]"
            >
              <MatchRegionVeto
                :match="match"
                :match-id="room.match_id"
                class="pb-6"
              />
              <MatchMapVeto
                :match="match"
                :match-id="room.match_id"
                :stage="false"
                :picks="vetoPicks"
              />
            </div>

            <div
              v-else-if="inMatchStarting"
              class="rounded-xl border border-[hsl(var(--tac-amber)/0.25)] bg-card/40 p-8 [backdrop-filter:blur(8px)]"
            >
              <div class="flex flex-col items-center gap-5 text-center">
                <div class="flex flex-wrap justify-center gap-3">
                  <div
                    v-for="(m, i) in match.match_maps"
                    :key="m.id"
                    class="starting-map relative h-24 w-40 overflow-hidden rounded-lg border border-border"
                    :style="{ '--i': i }"
                  >
                    <img
                      v-if="m.map?.poster"
                      :src="m.map.poster"
                      class="h-full w-full object-cover"
                      :alt="mapLabel(m.map)"
                    />
                    <span
                      class="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white"
                    >
                      {{ mapLabel(m.map) }}
                    </span>
                  </div>
                </div>
                <div
                  class="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
                >
                  <Spinner class="h-4 w-4" />
                  {{ $t("draft_games.room.match_starting") }}
                </div>
              </div>
            </div>

            <div v-else-if="isTeamsMode" class="space-y-4">
              <div
                class="teams-matchup relative flex flex-col items-center gap-6 rounded-xl border border-border bg-card/40 p-8 [backdrop-filter:blur(8px)]"
              >
                <div
                  class="grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-4"
                >
                  <div class="team-slot amber">
                    <span class="team-tick"></span>
                    <span class="truncate">{{
                      sideName(1) || $t("draft_games.room.team", { team: 1 })
                    }}</span>
                  </div>
                  <div class="vs-badge">
                    <Swords class="h-4 w-4" />
                    {{ $t("draft_games.room.vs") }}
                  </div>
                  <div class="team-slot blue justify-end text-right">
                    <span class="truncate">{{
                      sideName(2) || $t("draft_games.room.team", { team: 2 })
                    }}</span>
                    <span class="team-tick blue-tick"></span>
                  </div>
                </div>

                <!-- The hint and the CTA share one row height, so swapping between
                 them never moves the rosters below. Check-in is the one state
                 allowed to grow: it carries a button as well as the readout,
                 and that happens once, at the very end, where a single settle
                 costs less than making people leave to find it. -->
                <div
                  v-if="showStart || isCheckIn"
                  class="flex min-h-14 w-full items-center justify-center"
                >
                  <Transition name="cta" mode="out-in">
                    <!-- Check-in is asked for here, not only on the match page.
                     The draft room is where everyone already is when the match
                     reaches this state, and telling them "waiting for check in"
                     without offering the button is a dead end -- they had to go
                     find the match page to do the one thing being asked of
                     them. CheckIntoMatch self-gates on can_check_in, so anyone
                     who cannot (a coach, an organizer watching) still just sees
                     the count. -->
                    <div
                      v-if="isCheckIn"
                      key="checkin"
                      class="flex w-full flex-col items-center gap-2.5"
                    >
                      <div
                        class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
                      >
                        <span
                          class="relative grid h-2 w-2 place-items-center"
                          aria-hidden="true"
                        >
                          <span
                            class="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--tac-amber)/0.5)]"
                          ></span>
                          <span
                            class="h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
                          ></span>
                        </span>
                        {{
                          checkInProgress
                            ? $t(
                                "draft_games.room.checking_in",
                                checkInProgress,
                              )
                            : $t("draft_games.room.match_starting")
                        }}
                      </div>

                      <CheckIntoMatch
                        v-if="match"
                        :match="match"
                        :deadline="checkInDeadline"
                        :deadline-help="checkInDeadlineHelp"
                        class="w-64"
                      />
                    </div>

                    <Button
                      v-else-if="startReady"
                      key="start"
                      variant="tactical"
                      type="button"
                      :disabled="isPending('start') || !regionsAvailable"
                      :class="[
                        tacticalCtaButtonClasses,
                        'justify-center px-10 py-3.5 text-base',
                      ]"
                      @click="start"
                    >
                      <Spinner v-if="isPending('start')" class="h-5 w-5" />
                      <Play v-else class="h-5 w-5" />
                      {{
                        isPending("start")
                          ? $t("draft_games.room.starting")
                          : $t("draft_games.room.start_match")
                      }}
                    </Button>

                    <div
                      v-else
                      key="hint"
                      class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {{ $t(startHint) }}
                    </div>
                  </Transition>
                </div>
              </div>

              <div class="draft-pair-grid items-stretch">
                <DraftTeamPanel
                  :title="
                    sideName(1) || $t('draft_games.room.team', { team: 1 })
                  "
                  :players="team1"
                  :per-team="perTeam"
                  accent="amber"
                  :host-steam-id="room.host_steam_id"
                  :check-in-by-steam-id="checkInBySteamId"
                  :removable="canManageSide(1)"
                  :draggable="canManageSide(1)"
                  :droppable="canDropAsStarter(1)"
                  :drag-steam-id="dragSteamId"
                  @remove="(steamId) => benchPlayer(steamId, 1)"
                  @dragstart="onDragStart"
                  @dragend="onDragEnd"
                  @drop="(steamId) => dropAsStarter(1, steamId)"
                />
                <DraftTeamPanel
                  :title="
                    sideName(2) || $t('draft_games.room.team', { team: 2 })
                  "
                  :players="team2"
                  :per-team="perTeam"
                  accent="blue"
                  :host-steam-id="room.host_steam_id"
                  :check-in-by-steam-id="checkInBySteamId"
                  :removable="canManageSide(2)"
                  :draggable="canManageSide(2)"
                  :droppable="canDropAsStarter(2)"
                  :drag-steam-id="dragSteamId"
                  @remove="(steamId) => benchPlayer(steamId, 2)"
                  @dragstart="onDragStart"
                  @dragend="onDragEnd"
                  @drop="(steamId) => dropAsStarter(2, steamId)"
                />
              </div>

              <!-- One shared pool for an inner squad (a single roster split in two),
               otherwise a section per side plus a bucket for anyone unsided. -->
              <template v-if="room.inner_squad">
                <DraftBackupsPanel
                  :title="$t('draft_games.room.backups')"
                  :players="innerSquadBackups"
                  accent="neutral"
                  :match-type="rankMatchType"
                  :host-steam-id="room.host_steam_id"
                  :drag-steam-id="dragSteamId"
                  :droppable="canDropAsBackup(null)"
                  @dragstart="onDragStart"
                  @dragend="onDragEnd"
                  @drop="(steamId) => dropAsBackup(null, steamId)"
                >
                  <template #action="{ player }">
                    <div class="flex items-center gap-1.5">
                      <DraftActionButton
                        v-for="side in [1, 2]"
                        :key="`start-${side}`"
                        v-show="canManageSide(side)"
                        icon="start"
                        :tone="side === 1 ? 'amber' : 'blue'"
                        :side="side"
                        :label="startLabel(side)"
                        :disabled="
                          isPending(`swap:${player.steam_id}`) || sideFull(side)
                        "
                        :action="() => startPlayer(player.steam_id, side)"
                      />
                      <DraftActionButton
                        v-if="
                          canManageSide(player.lineup ?? 1) &&
                          player.steam_id !== room.host_steam_id
                        "
                        icon="remove"
                        :label="$t('draft_games.room.kick')"
                        :action="() => kick(player.steam_id)"
                      />
                    </div>
                  </template>
                </DraftBackupsPanel>
              </template>

              <div v-else class="draft-pair-grid items-stretch">
                <DraftBackupsPanel
                  v-for="side in [1, 2]"
                  :key="`backups-${side}`"
                  :title="
                    $t('draft_games.room.side_backups', {
                      team:
                        sideName(side) ||
                        $t('draft_games.room.team', { team: side }),
                    })
                  "
                  :players="backupsFor(side)"
                  :accent="side === 1 ? 'amber' : 'blue'"
                  :match-type="rankMatchType"
                  :host-steam-id="room.host_steam_id"
                  :drag-steam-id="dragSteamId"
                  :droppable="canDropAsBackup(side)"
                  :empty-label="$t('draft_games.room.no_backups')"
                  @dragstart="onDragStart"
                  @dragend="onDragEnd"
                  @drop="(steamId) => dropAsBackup(side, steamId)"
                >
                  <template #action="{ player }">
                    <div class="flex items-center gap-1.5">
                      <DraftActionButton
                        v-if="canManageSide(side)"
                        icon="start"
                        :tone="side === 1 ? 'amber' : 'blue'"
                        :side="side"
                        :label="startLabel(side)"
                        :disabled="
                          isPending(`swap:${player.steam_id}`) || sideFull(side)
                        "
                        :action="() => startPlayer(player.steam_id, side)"
                      />
                      <DraftActionButton
                        v-if="
                          canManageSide(side) &&
                          player.steam_id !== room.host_steam_id
                        "
                        icon="remove"
                        :label="$t('draft_games.room.kick')"
                        :action="() => kick(player.steam_id)"
                      />
                    </div>
                  </template>
                </DraftBackupsPanel>
              </div>

              <!-- Only exists while someone is sideless -- it empties as they are
               slotted, so it folds shut rather than vanishing. -->
              <Transition name="collapse">
                <div
                  v-if="unsidedPlayers.length > 0"
                  class="grid grid-rows-[1fr]"
                >
                  <div class="collapse-clip">
                    <DraftBackupsPanel
                      :title="$t('draft_games.room.unassigned_backups')"
                      :players="unsidedPlayers"
                      accent="neutral"
                      :match-type="rankMatchType"
                      :host-steam-id="room.host_steam_id"
                      :drag-steam-id="dragSteamId"
                      :droppable="canDropAsBackup(null)"
                      @dragstart="onDragStart"
                      @dragend="onDragEnd"
                      @drop="(steamId) => dropAsBackup(null, steamId)"
                    >
                      <template #action="{ player }">
                        <div class="flex items-center gap-1.5">
                          <DraftActionButton
                            v-for="side in [1, 2]"
                            :key="`slot-${side}`"
                            v-show="canManageSide(side)"
                            icon="start"
                            :tone="side === 1 ? 'amber' : 'blue'"
                            :side="side"
                            :label="startLabel(side)"
                            :disabled="
                              isPending(`swap:${player.steam_id}`) ||
                              sideFull(side)
                            "
                            :action="() => startPlayer(player.steam_id, side)"
                          />
                          <DraftActionButton
                            v-if="
                              canManage &&
                              player.steam_id !== room.host_steam_id
                            "
                            icon="remove"
                            :label="$t('draft_games.room.kick')"
                            :action="() => kick(player.steam_id)"
                          />
                        </div>
                      </template>
                    </DraftBackupsPanel>
                  </div>
                </div>
              </Transition>
            </div>

            <div v-else class="w-full space-y-4">
              <!-- In Host mode this whole panel is the CTA: it does not exist until
               both sides are filled, so it expands into place rather than
               appearing under the cursor mid-assignment. -->
              <Transition name="collapse">
                <div
                  v-if="isAssembling || isDrafting || (showStart && startReady)"
                  class="grid grid-rows-[1fr]"
                >
                  <div class="collapse-clip">
                    <div
                      class="theater relative flex flex-col items-center gap-5 rounded-xl border border-border bg-card/40 p-5 [backdrop-filter:blur(8px)]"
                    >
                      <Transition name="cta" mode="out-in">
                        <div
                          v-if="isAssembling"
                          key="assemble"
                          class="flex flex-col items-center gap-4 py-3 text-center"
                        >
                          <div
                            class="assemble-count font-mono text-5xl font-bold leading-none tabular-nums"
                          >
                            {{ accepted.length
                            }}<span class="text-2xl text-muted-foreground/40"
                              >/{{ room.capacity }}</span
                            >
                          </div>

                          <div
                            class="flex flex-wrap items-center justify-center gap-1.5"
                          >
                            <span
                              v-for="slot in room.capacity"
                              :key="slot"
                              class="slot"
                              :class="{
                                'slot--filled': slot <= accepted.length,
                                'slot--next': slot === accepted.length + 1,
                              }"
                            ></span>
                          </div>

                          <div
                            v-if="accepted.length >= room.capacity"
                            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[hsl(var(--tac-amber))]"
                          >
                            {{ $t("draft_games.room.squad_ready") }}
                          </div>
                        </div>

                        <div
                          v-else-if="isDrafting"
                          key="drafting"
                          class="flex w-full flex-col gap-4"
                        >
                          <div class="flex items-center gap-4">
                            <DraftClock
                              compact
                              :deadline="room.pick_deadline"
                              :accent="clockAccent"
                              :pulse="isMyTurn"
                            />
                            <div class="min-w-0 flex-1">
                              <div
                                class="status-banner font-sans text-sm font-bold uppercase tracking-[0.18em]"
                                :class="isMyTurn ? 'is-mine' : ''"
                                :style="{ '--accent': clockAccent }"
                              >
                                <template v-if="isMyTurn">
                                  {{ $t("draft_games.room.your_pick") }}
                                </template>
                                <template v-else-if="currentCaptain">
                                  {{
                                    $t("draft_games.room.captain_picking", {
                                      name: currentCaptain.player.name,
                                    })
                                  }}
                                </template>
                                <template v-else>
                                  {{ $t(statusLabel) }}
                                </template>
                              </div>
                              <div
                                v-if="pattern.length"
                                class="mt-1 text-xs leading-relaxed text-muted-foreground"
                              >
                                {{ pickProgress }}
                                <template v-if="isMyTurn && autoPickName">
                                  {{
                                    $t("draft_games.room.auto_pick_hint", {
                                      name: autoPickName,
                                    })
                                  }}
                                </template>
                              </div>
                            </div>
                          </div>
                          <DraftPickTrack
                            v-if="pickTrack.length"
                            :cells="pickTrack"
                          />
                        </div>
                      </Transition>

                      <Transition name="cta">
                        <Button
                          v-if="showStart && startReady"
                          variant="tactical"
                          type="button"
                          :disabled="isPending('start') || !regionsAvailable"
                          :class="[
                            tacticalCtaButtonClasses,
                            'justify-center px-10 py-3.5 text-base',
                          ]"
                          @click="start"
                        >
                          <Spinner v-if="isPending('start')" class="h-5 w-5" />
                          <Play v-else class="h-5 w-5" />
                          {{
                            isPending("start")
                              ? $t("draft_games.room.starting")
                              : $t("draft_games.room.start_match")
                          }}
                        </Button>
                      </Transition>
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- Pug lobbies have no sides until the draft assigns them, so the
               roster columns grow in instead of appearing under the pool. -->
              <Transition name="collapse">
                <div v-if="showTeamPanels" class="grid grid-rows-[1fr]">
                  <div class="collapse-clip">
                    <div class="draft-pair-grid items-start">
                      <DraftTeamPanel
                        :title="$t('draft_games.room.team_alpha')"
                        :players="team1"
                        :per-team="perTeam"
                        accent="amber"
                        :host-steam-id="room.host_steam_id"
                        :check-in-by-steam-id="checkInBySteamId"
                        :active="isDrafting && currentLineup === 1"
                        :pick-labels="pickLabelsFor(team1)"
                        :upcoming-picks="upcomingPicksFor(1)"
                        :clock-pick="currentLineup === 1 ? clockPick : null"
                        :fresh-steam-ids="freshSteamIds"
                        :removable="
                          canAssign || (isManualCaptains && canManage)
                        "
                        :self-steam-id="
                          isHostAssigning ? me?.steam_id : undefined
                        "
                        :captainable="canAssign"
                        :no-show-actions="canReplaceNoShows"
                        :swap-label="swapLabel"
                        :addable="canAssign && !team1Full"
                        :exclude-steam-ids="memberIds"
                        @add="(steamId) => addToTeam(steamId, 1)"
                        @remove="onTeamRemove"
                        @captain="(steamId) => makeSideCaptain(steamId, 1)"
                        @swap="swapInBackup"
                        @kick="kick"
                      />
                      <DraftTeamPanel
                        :title="$t('draft_games.room.team_bravo')"
                        :players="team2"
                        :per-team="perTeam"
                        accent="blue"
                        :host-steam-id="room.host_steam_id"
                        :check-in-by-steam-id="checkInBySteamId"
                        :active="isDrafting && currentLineup === 2"
                        :pick-labels="pickLabelsFor(team2)"
                        :upcoming-picks="upcomingPicksFor(2)"
                        :clock-pick="currentLineup === 2 ? clockPick : null"
                        :fresh-steam-ids="freshSteamIds"
                        :removable="
                          canAssign || (isManualCaptains && canManage)
                        "
                        :self-steam-id="
                          isHostAssigning ? me?.steam_id : undefined
                        "
                        :captainable="canAssign"
                        :no-show-actions="canReplaceNoShows"
                        :swap-label="swapLabel"
                        :addable="canAssign && !team2Full"
                        :exclude-steam-ids="memberIds"
                        @add="(steamId) => addToTeam(steamId, 2)"
                        @remove="onTeamRemove"
                        @captain="(steamId) => makeSideCaptain(steamId, 2)"
                        @swap="swapInBackup"
                        @kick="kick"
                      />
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- Both hints are transient instructions -- they retire the moment
               the thing they ask for is done, so they fold away instead of
               blinking out from under the rosters. -->
              <Transition name="collapse">
                <div
                  v-if="isHostAssigning && isOrganizer"
                  class="grid grid-rows-[1fr]"
                >
                  <div class="collapse-clip">
                    <div
                      class="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/40 px-4 py-3 text-center [backdrop-filter:blur(8px)]"
                    >
                      <div
                        class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {{ $t("draft_games.room.host_assigning") }}
                      </div>
                      <div class="text-xs text-muted-foreground/70">
                        {{ $t("draft_games.room.host_hint") }}
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>

              <Transition name="collapse">
                <div
                  v-if="canDesignateCaptain && !manualCaptainsReady"
                  class="grid grid-rows-[1fr]"
                >
                  <div class="collapse-clip">
                    <div
                      class="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/40 px-4 py-3 text-center [backdrop-filter:blur(8px)]"
                    >
                      <div
                        class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        {{ $t("draft_games.room.choose_captains") }}
                      </div>
                      <div class="text-xs text-muted-foreground/70">
                        {{ $t("draft_games.room.choose_captains_hint") }}
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>

              <!-- A Host lobby has no pool until someone is waiting in it. -->
              <Transition name="collapse">
                <div
                  v-if="
                    !isHostMode ||
                    pool.length > 0 ||
                    waitlist.length > 0 ||
                    invited.length > 0
                  "
                  class="grid grid-rows-[1fr]"
                >
                  <div class="collapse-clip">
                    <div
                      class="rounded-xl border border-border bg-card/40 p-5 [backdrop-filter:blur(8px)]"
                    >
                      <div class="mb-3 flex items-center gap-2">
                        <span class="pool-tick"></span>
                        <h3
                          class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                        >
                          {{ $t("draft_games.room.pool") }}
                          <span class="ml-1 text-foreground/70"
                            >({{ pool.length }})</span
                          >
                        </h3>
                        <AnimatedFilters
                          v-if="rankSources.length > 1"
                          :model-value="eloSource"
                          :options="rankSources"
                          square
                          class="ml-auto"
                          @update:model-value="setEloSource"
                        />
                      </div>

                      <TransitionGroup
                        name="pool"
                        tag="div"
                        class="draft-pool-grid"
                      >
                        <DraftPlayerCard
                          v-for="player in pool"
                          :key="player.steam_id"
                          :member="player"
                          accent="neutral"
                          :match-type="rankMatchType"
                          :is-host="player.steam_id === room.host_steam_id"
                        >
                          <template #action>
                            <div class="flex items-center gap-1.5">
                              <Button
                                v-if="isMyTurn"
                                variant="tactical"
                                type="button"
                                :class="[
                                  tacticalCtaButtonClasses,
                                  'h-7 gap-1 !px-3 !py-0 text-[0.7rem]',
                                ]"
                                :disabled="isPending('pick')"
                                @click="draftPick(player.steam_id)"
                              >
                                {{ $t("draft_games.room.draft") }}
                                <ArrowRight class="h-3 w-3" />
                              </Button>
                              <template
                                v-else-if="canAssign || canSelfPick(player)"
                              >
                                <DraftActionButton
                                  v-for="side in [1, 2]"
                                  :key="`assign-${side}`"
                                  icon="add"
                                  :tone="side === 1 ? 'amber' : 'blue'"
                                  :side="side"
                                  :label="
                                    $t('draft_games.room.add_to_team', {
                                      team: draftSideLabel(side),
                                    })
                                  "
                                  :disabled="side === 1 ? team1Full : team2Full"
                                  :action="() => assign(player.steam_id, side)"
                                />
                              </template>
                              <template v-else-if="canDesignateCaptain">
                                <DraftActionButton
                                  v-for="side in [1, 2]"
                                  :key="`captain-${side}`"
                                  icon="captain"
                                  :tone="side === 1 ? 'amber' : 'blue'"
                                  :side="side"
                                  :label="
                                    $t('draft_games.room.captain_of', {
                                      team: draftSideLabel(side),
                                    })
                                  "
                                  :disabled="
                                    side === 1 ? !!team1Captain : !!team2Captain
                                  "
                                  :action="
                                    () =>
                                      designateCaptain(player.steam_id, side)
                                  "
                                />
                              </template>
                              <DraftActionButton
                                v-if="
                                  canManage &&
                                  player.steam_id !== room.host_steam_id
                                "
                                icon="remove"
                                :label="$t('draft_games.room.kick')"
                                :action="() => kick(player.steam_id)"
                              />
                            </div>
                          </template>
                        </DraftPlayerCard>

                        <!-- Key by absolute grid position (pool.length + n), not relative
                   index, so adding a player only removes the boundary slot — the
                   rest keep their key and position and never reflow. -->
                        <DraftOpenSlot
                          v-for="n in canInvite && !isHostMode ? openSlots : 0"
                          :key="`slot-${pool.length + n}`"
                          class="draft-open-slot"
                          :exclude="memberIds"
                          @selected="add"
                        />
                      </TransitionGroup>

                      <Transition name="cta">
                        <div
                          v-if="pool.length === 0 && openSlots === 0"
                          class="py-6 text-center text-xs text-muted-foreground/50"
                        >
                          {{ $t("draft_games.room.empty_pool") }}
                        </div>
                      </Transition>

                      <Transition name="collapse">
                        <div
                          v-if="waitlist.length > 0"
                          class="grid grid-rows-[1fr]"
                        >
                          <div class="collapse-clip">
                            <div
                              class="mt-5 border-t border-dotted border-border/70 pt-4"
                            >
                              <div class="flex items-center gap-2">
                                <span class="pool-tick"></span>
                                <h3
                                  class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                                >
                                  {{ $t("draft_games.room.backups") }}
                                  <span class="ml-1 text-foreground/70"
                                    >({{ waitlist.length }})</span
                                  >
                                </h3>
                              </div>
                              <!-- Backups were read as match substitutes; they
                                   only ever take a seat that opens. -->
                              <p
                                class="mb-3 mt-1 text-xs text-muted-foreground/70"
                              >
                                {{ $t("draft_games.room.backups_hint") }}
                              </p>
                              <TransitionGroup
                                name="pool"
                                tag="div"
                                class="draft-pool-grid"
                              >
                                <DraftPlayerCard
                                  v-for="(player, index) in waitlist"
                                  :key="player.steam_id"
                                  :member="player"
                                  accent="neutral"
                                  :match-type="rankMatchType"
                                  :is-host="
                                    player.steam_id === room.host_steam_id
                                  "
                                >
                                  <template #action>
                                    <div class="flex items-center gap-2">
                                      <span
                                        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                                      >
                                        #{{ Number(index) + 1 }}
                                      </span>
                                      <DraftActionButton
                                        v-if="
                                          canManage &&
                                          player.steam_id !== room.host_steam_id
                                        "
                                        icon="remove"
                                        :label="$t('draft_games.room.kick')"
                                        :action="() => kick(player.steam_id)"
                                      />
                                    </div>
                                  </template>
                                </DraftPlayerCard>
                              </TransitionGroup>
                            </div>
                          </div>
                        </div>
                      </Transition>

                      <Transition name="collapse">
                        <div
                          v-if="canManage && invited.length > 0"
                          class="grid grid-rows-[1fr]"
                        >
                          <div class="collapse-clip">
                            <div
                              class="mt-5 border-t border-dotted border-border/70 pt-4"
                            >
                              <div class="mb-3 flex items-center gap-2">
                                <span class="pool-tick"></span>
                                <h3
                                  class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                                >
                                  {{ $t("draft_games.room.invited") }}
                                  <span class="ml-1 text-foreground/70"
                                    >({{ invited.length }})</span
                                  >
                                </h3>
                              </div>
                              <TransitionGroup
                                name="pool"
                                tag="div"
                                class="draft-pool-grid"
                              >
                                <DraftPlayerCard
                                  v-for="player in invited"
                                  :key="player.steam_id"
                                  :member="player"
                                  accent="neutral"
                                  :match-type="rankMatchType"
                                  :is-host="
                                    player.steam_id === room.host_steam_id
                                  "
                                >
                                  <template #action>
                                    <div class="flex items-center gap-2">
                                      <span
                                        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                                      >
                                        {{
                                          $t(
                                            "draft_games.room.invite_pending_short",
                                          )
                                        }}
                                      </span>
                                      <DraftActionButton
                                        icon="remove"
                                        :label="
                                          $t('draft_games.room.cancel_invite')
                                        "
                                        :action="() => kick(player.steam_id)"
                                      />
                                    </div>
                                  </template>
                                </DraftPlayerCard>
                              </TransitionGroup>
                            </div>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </HeightSwap>

        <Transition name="collapse">
          <div v-if="hasPicks && !isDrafting" class="grid grid-rows-[1fr]">
            <div class="collapse-clip">
              <div class="rounded-xl border border-border bg-card/40 p-4">
                <h3
                  class="mb-3 flex items-center gap-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
                >
                  <span class="pool-tick"></span>
                  {{ $t("draft_games.room.draft_log") }}
                </h3>
                <DraftPickTrack :cells="pickTrack" />
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="cta">
          <div
            v-if="isMyTurn"
            class="draft-pickbar sticky bottom-0 z-10 items-center gap-3 rounded-t-lg border-t border-[hsl(var(--tac-amber)/0.45)] bg-background/95 px-3 py-2.5 [backdrop-filter:blur(8px)]"
          >
            <div class="min-w-0 flex-1">
              <div
                class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
              >
                {{ $t("draft_games.room.your_pick") }} · {{ pickProgress }}
              </div>
              <div
                v-if="autoPickName"
                class="truncate text-xs text-muted-foreground"
              >
                {{
                  $t("draft_games.room.auto_pick_hint", { name: autoPickName })
                }}
              </div>
            </div>
            <span
              class="font-mono text-lg font-bold tabular-nums text-[hsl(var(--tac-amber))]"
            >
              {{ pickSeconds }}
            </span>
          </div>
        </Transition>
      </div>

      <!-- On a wide lobby the self-status banners live in this column rather
           than above the room: they appear and disappear as the lobby fills,
           and full width they shoved the whole roster down every time. -->
      <div class="draft-rail flex flex-col">
        <DraftSelfStatus
          class="draft-status-rail"
          :can-join="canJoin"
          :has-requested="hasRequested"
          :is-waitlisted="isWaitlisted"
          :is-invited="isInvited"
          :lobby-full="lobbyFull"
          :require-approval="!!room.require_approval"
          @join="joinRoom"
          @leave="leaveWaitlist"
          @respond="respondInvite"
        />

        <!-- Capped rather than left to fill the rail. The rail is a full
             viewport tall but starts well down the page, and the page is too
             short to scroll the remainder into view, so anything pinned to the
             rail's bottom edge -- the message box -- was unreachable. -->
        <div
          class="draft-chat flex min-h-[440px] flex-col overflow-hidden rounded-xl border border-border bg-card/40"
        >
          <div v-if="showQueue" class="flex min-h-0 flex-1 flex-col">
            <div
              class="flex items-center gap-2 border-b border-border/60 px-4 py-2.5"
            >
              <Inbox class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
              <h3
                class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("draft_games.room.queue") }}
              </h3>
              <span class="dock-count ml-auto">{{ requests.length }}</span>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <DraftRequestQueue
                compact
                class="h-full"
                :draft-game-id="room.id"
                :requests="requests"
                :can-manage="isOrganizer"
                :full="acceptedFull"
              />
            </div>
          </div>

          <div
            class="flex flex-col"
            :class="
              showQueue
                ? 'h-72 shrink-0 border-t border-border/60'
                : 'min-h-0 flex-1'
            "
          >
            <div
              class="flex items-center gap-2 border-b border-border/60 px-4 py-2.5"
            >
              <MessagesSquare
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
              <h3
                class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("draft_games.room.comms") }}
              </h3>
            </div>
            <!-- The FAQ's demo draft brings its own: a live chat needs a real
                 room. -->
            <slot name="chat">
              <div v-if="me" class="flex min-h-0 flex-1 flex-col">
                <ChatLobby
                  class="min-h-0 flex-1"
                  instance="draft-room"
                  :type="chatType"
                  :lobby-id="chatLobbyId"
                  :team-lobby-id="teamChatLobbyId ?? undefined"
                  :frameless="true"
                  :can-send="canChat"
                  :readonly-hint="$t('draft_games.room.chat_players_only')"
                />
              </div>
              <div
                v-else
                class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center"
              >
                <p class="text-xs text-muted-foreground">
                  {{ $t("draft_games.room.login_to_chat") }}
                </p>
                <NuxtLink
                  :to="`/login?redirect=/draft-room/${room.id}`"
                  class="text-xs font-medium text-[hsl(var(--tac-amber))] underline underline-offset-4"
                >
                  {{ $t("draft_games.room.login") }}
                </NuxtLink>
              </div>
            </slot>
          </div>
        </div>

        <!-- Below the Lobby Chat dock and outside it. Inside that card it read
             as the bottom of the message list -- the dock owns the border, so
             anything within it belongs to the chat no matter how it is styled. -->
        <Transition name="collapse">
          <div
            v-if="me && myMatchLineupId && inLineup"
            class="grid shrink-0 grid-rows-[1fr]"
          >
            <!-- The top margin rides inside the clipped row so the rail does
                 not hold a 12px gap open while the card is folding away. -->
            <div class="collapse-clip">
              <!-- Always present, because it is now the only way in. The strip
                   on the chat composer existed to start a call before this
                   section appeared -- which left the same three controls on
                   screen twice as soon as it had. -->
              <!-- The FAQ's demo draft has no voice: a channel needs a real
                   room, like the chat. -->
              <slot name="voice">
                <VoiceChannelCard
                  v-if="myVoiceLineupId"
                  show-empty
                  class="mt-3"
                  kind="match"
                  :channel-id="myVoiceLineupId"
                  :label="$t('layouts.voice_panel.team_comms')"
                />
              </slot>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <MatchAdminBottomBar v-if="match?.is_organizer" :match="match" />

    <AlertDialog
      :open="kickTarget !== null"
      @update:open="(open) => !open && (kickTarget = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("draft_games.room.kick_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t(
                isCheckIn
                  ? "draft_games.room.remove_no_show_description"
                  : "draft_games.room.kick_confirm_description",
              )
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="kickTarget = null">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <Button variant="destructive" @click="confirmKick">
            {{ $t("draft_games.room.kick") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.pool-tick {
  display: inline-block;
  height: 2px;
  width: 10px;
  background: hsl(var(--tac-amber));
}
.cta-enter-active,
.cta-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.cta-enter-from,
.cta-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
/* The room is a live board -- panels appear and retire under people while they
   are reading it, so they use the app's height-collapse idiom (grid-template-rows
   1fr -> 0fr on a wrapper with a clipped child) and the rest of the column
   slides instead of snapping. */
.collapse-enter-active,
.collapse-leave-active {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
/* Most of these wrappers sit in space-y-4 columns, which put a margin-top on
   them from outside; the collapse animates it to zero too, or the fold would
   end with a 16px snap when the element unmounts. !important because
   Tailwind's space-y selector is more specific than a scoped class. */
.collapse-enter-from,
.collapse-leave-to {
  grid-template-rows: 0fr;
  margin-top: 0 !important;
  opacity: 0;
  transform: translateY(-4px);
}
/* Clipped only while the row is animating. Left on permanently it would cut
   the active roster's outer glow and any drop shadow off at the panel edge. */
.collapse-enter-active .collapse-clip,
.collapse-leave-active .collapse-clip {
  overflow: hidden;
}
.draft-room-body {
  container-type: inline-size;
  container-name: draft-room;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
}
.draft-main,
.draft-rail {
  flex: 1 1 100%;
}
.draft-match-info.is-empty + * {
  margin-top: 0 !important;
}
.draft-pair-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}
.draft-pool-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
}
.draft-status-rail {
  display: none;
}
.draft-pickbar {
  display: flex;
}
@container draft-room (min-width: 520px) {
  .draft-pair-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container draft-room (min-width: 760px) {
  .draft-pickbar {
    display: none;
  }
}
@container draft-room (min-width: 1100px) {
  .draft-main {
    flex: 1 1 0%;
  }
  .draft-rail {
    flex: 0 0 340px;
    position: sticky;
    top: 1rem;
    height: calc(100vh - 2rem);
  }
  .draft-chat {
    min-height: 380px;
    max-height: 34rem;
    flex: 1 1 0%;
  }
  .draft-status-top {
    display: none;
  }
  .draft-status-top + * {
    margin-top: 0 !important;
  }
  .draft-status-rail {
    display: block;
  }
}
.team-slot {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.team-slot .team-tick {
  height: 22px;
  width: 4px;
  border-radius: 2px;
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 8px hsl(var(--tac-amber) / 0.6);
}
.team-slot .blue-tick {
  background: hsl(var(--tac-blue));
  box-shadow: 0 0 8px hsl(var(--tac-blue) / 0.6);
}
.vs-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber) / 0.12);
  border: 1px solid hsl(var(--tac-amber) / 0.4);
}
.theater::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 0.75rem;
  background: radial-gradient(
    ellipse at top,
    hsl(var(--tac-amber) / 0.07),
    transparent 60%
  );
  pointer-events: none;
}
.assemble-count {
  text-shadow: 0 0 24px hsl(var(--tac-amber) / 0.3);
}
.slot {
  height: 6px;
  width: 18px;
  border-radius: 2px;
  border: 1px solid hsl(var(--border));
  background: transparent;
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    box-shadow 0.3s ease;
}
.slot--filled {
  border-color: hsl(var(--tac-amber));
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 8px hsl(var(--tac-amber) / 0.55);
}
.slot--next {
  border-color: hsl(var(--tac-amber) / 0.6);
  animation: slot-pulse 1.4s ease-in-out infinite;
}
@keyframes slot-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
.status-banner {
  color: hsl(var(--muted-foreground));
}
.status-banner.is-mine {
  color: hsl(var(--accent));
  text-shadow: 0 0 16px hsl(var(--accent) / 0.5);
  animation: banner-flash 1.2s ease-in-out infinite;
}
@keyframes banner-flash {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
.dock-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  font-family: var(--font-sans);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground));
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.dock-toggle:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--tac-amber) / 0.05);
}
.dock-count {
  display: inline-grid;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  border: 1px solid hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.12);
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  font-weight: 700;
  color: hsl(var(--tac-amber));
}
/* Only fade cards in/out — deliberately no `pool-move` rule so the grid never
   FLIP-slides on add/pick/kick (the reflow settles instantly instead of every
   card sliding, which shifted anything anchored to the grid and read as jank).
   Leave fades in place (no `position: absolute`, which in a multi-column grid
   would snap the departing card to full width and yank the rest up). */
.pool-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.pool-leave-active {
  transition: all 0.18s ease;
}
.pool-enter-from,
.pool-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}
/* Open slots are placeholders — no enter/leave flash either. */
.draft-open-slot.pool-enter-active,
.draft-open-slot.pool-leave-active {
  transition: none;
}
.draft-open-slot.pool-enter-from,
.draft-open-slot.pool-leave-to {
  opacity: 1;
  transform: none;
}
.starting-map {
  animation: starting-map-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i) * 90ms + 150ms);
}
@keyframes starting-map-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .slot--next,
  .status-banner.is-mine,
  .starting-map {
    animation: none;
  }
  .collapse-enter-active,
  .collapse-leave-active,
  .cta-enter-active,
  .cta-leave-active {
    transition-duration: 1ms;
  }
}
</style>
