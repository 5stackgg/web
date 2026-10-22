<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import {
  ArrowRight,
  Play,
  MessagesSquare,
  Inbox,
  UserPlus,
  LogOut,
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
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import DraftSettingsBar from "~/components/draft-games/DraftSettingsBar.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import DraftPlayerCard from "~/components/draft-games/DraftPlayerCard.vue";
import DraftBackupsPanel from "~/components/draft-games/DraftBackupsPanel.vue";
import DraftActionButton from "~/components/draft-games/DraftActionButton.vue";
import DraftRoomHeader from "~/components/draft-games/DraftRoomHeader.vue";
import DraftHeaderAction from "~/components/draft-games/DraftHeaderAction.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import DraftRequestQueue from "~/components/draft-games/DraftRequestQueue.vue";
import DraftOpenSlot from "~/components/draft-games/DraftOpenSlot.vue";
import DraftSettingsSheet from "~/components/draft-games/DraftSettingsSheet.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import DraftAdminBar from "~/components/draft-games/DraftAdminBar.vue";
import DraftRoomMenu from "~/components/draft-games/DraftRoomMenu.vue";
import DraftCheckInBox from "~/components/draft-games/DraftCheckInBox.vue";
import DraftCancelDialog from "~/components/draft-games/DraftCancelDialog.vue";
import {
  RANK_SLOTS_KEY,
  rankSlotsFor,
} from "~/components/draft-games/playerRanks";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
import { playerBlockErrorKey } from "~/utilities/playerBlocks";
import { useCountdown } from "~/composables/useCountdown";
import { STARTING_STATUSES, vetoMapsSet } from "~/utilities/vetoStage";
import {
  mapVetoPicking,
  mapVetoTurn,
  vetoLineups,
} from "~/utilities/vetoLineups";
import { resolveAvatarUrl, type AvatarWidth } from "~/utilities/avatarUrl";
import { teamMonogram } from "~/components/watch/watchTicker";
import type {
  DraftHeaderPhase,
  DraftHeaderSeat,
  DraftHeaderSide,
  DraftHeaderState,
} from "~/components/draft-games/draftRoomHeader";

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
  // A side's backups sit in the match as its substitutes, so the count is
  // the starters'.
  const backups = new Set(
    props.room.players
      .filter((p: any) => p.status === "Waitlist")
      .map((p: any) => p.steam_id),
  );
  const states = Object.entries(map)
    .filter(([steamId]) => !backups.has(steamId))
    .map(([, checkedIn]) => checkedIn);
  return { ready: states.filter(Boolean).length, total: states.length };
});

const me = computed(() => useAuthStore().me);
const perTeam = computed(() => props.room.capacity / 2);

const settingsOpen = ref(false);
const settingsEditing = ref(false);
const openSettings = (editing: boolean) => {
  settingsEditing.value = editing;
  settingsOpen.value = true;
};

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

// An organizer can delete the room until its match is being made; from then
// on the match's own Cancel takes over.
const canCancelDraft = computed(
  () =>
    isOrganizer.value &&
    !props.room.match_id &&
    ["Open", "Filled", "SelectingCaptains", "Drafting"].includes(
      props.room.status,
    ),
);
const cancelOpen = ref(false);
const isHostAssigning = computed(() => isHostMode.value && notStarted.value);

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

provide(
  RANK_SLOTS_KEY,
  computed(() =>
    rankSlotsFor(props.room.players.map((member: any) => member.player)),
  ),
);
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
        steamId: member.steam_id,
        player: member.player,
        mine: member.steam_id === me.value?.steam_id,
        auto: !!pick?.auto_picked,
      };
    }
    const current = isDrafting.value && index === draftedCount.value;
    const captain = (lineup === 1 ? team1Captain : team2Captain).value;
    let name = t("draft_games.room.pick_slot", { n: index + 1 });
    if (current) {
      name = isMyTurn.value
        ? t("draft_games.room.your_pick")
        : captain
          ? t("draft_games.room.is_picking", {
              name: captain.player?.name ?? "",
            })
          : t("draft_games.room.on_the_clock");
    }
    return {
      no: index + 1,
      lineup,
      state: current ? ("current" as const) : ("upcoming" as const),
      name,
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

const leaveWaitlist = () =>
  runGuarded("leave", () => useDraftGamesStore().leave(props.room.id));

const leaveRoom = () =>
  runGuarded("leave", async () => {
    await useDraftGamesStore().leave(props.room.id);
    await navigateTo("/play");
  });

const extendRoom = () =>
  runGuarded("extend", () => useDraftGamesStore().extend(props.room.id));

const showInvite = computed(
  () => props.room.access === "Invite" && !!props.room.invite_code,
);

const copyInvite = async () => {
  const url = `${window.location.origin}/draft-room/${props.room.id}?invite=${props.room.invite_code}`;
  await navigator.clipboard?.writeText(url);
  toast({ title: t("draft_games.room.invite_copied") });
};

const remainingToFill = computed(
  () => props.room.capacity - accepted.value.length,
);

const showQueue = computed(
  () => props.room.require_approval && props.room.status === "Open",
);

const memberIds = computed(() =>
  props.room.players.map((p: any) => p.steam_id),
);

// While captains pick, the pool keeps the tallest height it has had since the
// draft started: a picked player leaves a gap instead of the box shrinking
// every other pick.
const poolBox = ref<HTMLElement | null>(null);
const { height: poolHeight } = useElementSize(poolBox);
const poolHold = ref(0);
watch([isDrafting, poolHeight], ([drafting, height]) => {
  poolHold.value = drafting ? Math.max(poolHold.value, Math.ceil(height)) : 0;
});

// A leaving card would keep its cell for its fade and the rest would jump
// over once it went. Pinned where it stands and out of the flow, the rest
// slide over at once while it fades.
const pinLeaver = (el: Element) => {
  const card = el as HTMLElement;
  const { offsetTop, offsetLeft, offsetWidth, offsetHeight } = card;
  Object.assign(card.style, {
    position: "absolute",
    top: `${offsetTop}px`,
    left: `${offsetLeft}px`,
    width: `${offsetWidth}px`,
    height: `${offsetHeight}px`,
  });
};

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

const start = () => {
  return runGuarded("start", () => useDraftGamesStore().start(props.room.id));
};

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);
const avatarOf = (player: any, size: AvatarWidth) =>
  resolveAvatarUrl(
    player?.custom_avatar_url || player?.avatar_url,
    apiDomain.value,
    size,
  ) ?? null;

const headerPhase = computed<DraftHeaderPhase>(() => {
  if (inStartStage.value || inMatchStarting.value) {
    return "starting";
  }
  if (inVeto.value) {
    return "veto";
  }
  if (isCheckIn.value) {
    return "checkin";
  }
  if (isDrafting.value) {
    return "draft";
  }
  if (notStarted.value) {
    return "lobby";
  }
  return "between";
});

const mySide = computed<1 | 2 | null>(() =>
  inLineup.value ? myMembership.value.lineup : null,
);

const sideTitle = (lineup: 1 | 2) =>
  isTeamsMode.value
    ? sideName(lineup) || t("draft_games.room.team", { team: lineup })
    : draftSideLabel(lineup);

// A captains draft's stacks carry its pick order.
const orderedStacks = computed(
  () => props.room.mode === "Captains" && pattern.value.length > 0,
);
// From the map veto on, the stacks are just the lineups: no pick numbers.
const pickOrderShown = computed(
  () => orderedStacks.value && !inVeto.value && !inMatchStarting.value,
);

const headerSeat = (
  key: string,
  member: any | null,
  extra: Partial<DraftHeaderSeat> = {},
): DraftHeaderSeat => ({
  key,
  player: member
    ? {
        steamId: member.steam_id,
        name: member.player?.name ?? "",
        src: avatarOf(member.player, 64),
      }
    : null,
  captain: false,
  no: null,
  current: false,
  auto: false,
  mine: !!member && member.steam_id === me.value?.steam_id,
  ...extra,
});

// The captain, then each of the side's picks, made or still to come. A starter
// the draft didn't place (a backup swapped in for a no-show) takes the first
// open seat.
const seatsFor = (lineup: 1 | 2, players: any[]): DraftHeaderSeat[] => {
  if (!orderedStacks.value) {
    return Array.from(
      { length: Math.max(perTeam.value, players.length) },
      (_, i) =>
        players[i]
          ? headerSeat(players[i].steam_id, players[i])
          : headerSeat(`open-${i}`, null),
    );
  }
  const captain = players.find((member: any) => member.is_captain);
  const seats = [
    headerSeat("captain", captain ?? null, { captain: true }),
    ...pickTrack.value
      .filter((cell) => cell.lineup === lineup)
      .map((cell) =>
        headerSeat(
          `pick-${cell.no}`,
          cell.state === "done"
            ? { steam_id: cell.steamId, player: cell.player }
            : null,
          {
            no: cell.no,
            current: cell.state === "current",
            auto: cell.state === "done" && cell.auto,
          },
        ),
      ),
  ];
  const seated = new Set(seats.map((seat) => seat.player?.steamId));
  for (const member of players.filter((m: any) => !seated.has(m.steam_id))) {
    const open = seats.findIndex((seat) => !seat.player && !seat.current);
    if (open > 0) {
      seats[open] = headerSeat(seats[open].key, member);
    }
  }
  return seats;
};

const headerSides = computed<[DraftHeaderSide, DraftHeaderSide]>(
  () =>
    ([1, 2] as const).map((lineup) => {
      const players = startersFor(lineup);
      const name = sideTitle(lineup);
      return {
        name,
        // A pickup's sides are named after nobody, so the captain's face stands
        // in for a crest, as on the match page.
        crest:
          isTeamsMode.value || !players[0]
            ? null
            : avatarOf(players[0].player, 128),
        monogram: teamMonogram(name),
        seats: seatsFor(lineup, players),
        ordered: pickOrderShown.value,
        captainName:
          players.find((member: any) => member.is_captain)?.player?.name ?? "",
        mine: mySide.value === lineup,
      };
    }) as [DraftHeaderSide, DraftHeaderSide],
);

const bestOf = computed<number>(
  () => props.match?.options?.best_of ?? props.room.options?.best_of ?? 1,
);
const winsNeeded = computed(() =>
  bestOf.value > 1 ? Math.ceil(bestOf.value / 2) : 0,
);

const myCheckedIn = computed(
  () => !!checkInBySteamId.value?.[me.value?.steam_id ?? ""],
);

// The match's own lineup, which takes in a side's backups as substitutes.
const inMatchLineup = computed(
  () => checkInBySteamId.value?.[me.value?.steam_id ?? ""] !== undefined,
);

const canCheckIn = computed(
  () =>
    headerPhase.value === "checkin" &&
    !!props.match?.can_check_in &&
    inMatchLineup.value &&
    !myCheckedIn.value,
);

const inviteOpen = computed(
  () =>
    !props.room.match_id &&
    !["CreatingMatch", "Completed", "Canceled"].includes(props.room.status),
);

type DraftHeaderActionKind = "accept" | "decline" | "leave" | "join" | "start";

const headerActions = computed<DraftHeaderActionKind[]>(() => {
  if (isInvited.value) {
    return inviteOpen.value ? ["decline", "accept"] : ["decline"];
  }
  if (notStarted.value && isWaitlisted.value) {
    return ["leave"];
  }
  const actions: DraftHeaderActionKind[] = [];
  if (notStarted.value && isMember.value && !isHost.value) {
    actions.push("leave");
  }
  if (canJoin.value) {
    actions.push("join");
  }
  if (showStart.value) {
    actions.push("start");
  }
  return actions;
});

const regionVetoing = computed(
  () => !!props.match?.options?.region_veto && !props.match?.region,
);

const vetoTurn = computed<1 | 2 | null>(() => {
  const match = props.match;
  if (!match) {
    return null;
  }
  if (regionVetoing.value) {
    if (match.lineup_1?.is_picking_region_veto) {
      return 1;
    }
    if (match.lineup_2?.is_picking_region_veto) {
      return 2;
    }
    return null;
  }
  return mapVetoTurn(match);
});

// The scorebug has the veto's seconds; the board's card keeps just the time
// left, along its own top edge.
const vetoDeadline = computed(() =>
  inVeto.value && vetoTurn.value
    ? (props.match?.veto_pick_expires_at ?? null)
    : null,
);
const { urgent: vetoUrgent, meter: vetoMeter } = useCountdown(
  vetoDeadline,
  computed(() => props.match?.options?.veto_pick_timeout ?? 0),
);

const vetoMine = computed(() => {
  const match = props.match;
  if (!match) {
    return false;
  }
  if (regionVetoing.value) {
    return !!(
      match.lineup_1?.can_pick_region_veto ||
      match.lineup_2?.can_pick_region_veto
    );
  }
  return mapVetoPicking(match, false);
});

const startMap = computed(() => props.match?.match_maps?.[0]?.map ?? null);

const startLabelText = computed(() =>
  props.room.mode === "Captains"
    ? t("draft_games.header.start_draft")
    : t("draft_games.room.start_match"),
);

const joinLabel = computed(() =>
  props.room.require_approval
    ? t("draft_games.header.request")
    : lobbyFull.value
      ? t("draft_games.room.join_waitlist")
      : t("draft_games.header.join"),
);

const lobbyCopy = (): Pick<
  DraftHeaderState,
  "tone" | "hot" | "title" | "detail"
> => {
  const capacity = props.room.capacity;
  const open = capacity - accepted.value.length;
  const quiet = (title: string, detail = "") => ({
    tone: "muted" as const,
    hot: false,
    title,
    detail,
  });
  const loud = (title: string, detail = "") => ({
    tone: "amber" as const,
    hot: true,
    title,
    detail,
  });

  if (isInvited.value) {
    return loud(
      t("draft_games.header.invited_title"),
      t("draft_games.header.invited_detail"),
    );
  }
  if (hasRequested.value) {
    return quiet(
      t("draft_games.header.requested_title"),
      t("draft_games.header.requested_detail"),
    );
  }
  if (isWaitlisted.value) {
    const side = myMembership.value?.lineup ?? null;
    const place =
      waitlist.value
        .filter((p: any) => (p.lineup ?? null) === side)
        .findIndex((p: any) => p.steam_id === me.value?.steam_id) + 1;
    return quiet(
      t("draft_games.header.backup_title", { n: place }),
      t("draft_games.header.backup_detail"),
    );
  }
  if (showStart.value) {
    if (!regionsAvailable.value) {
      return quiet(
        t("draft_games.header.no_regions_title"),
        t("draft_games.header.no_regions_detail"),
      );
    }
    if (isTeamsMode.value) {
      if (!props.room.team_1_id) {
        return quiet(
          t("draft_games.header.teams_pick_title"),
          t("draft_games.header.teams_pick_detail"),
        );
      }
      if (!startReady.value) {
        const short = team1Count.value < perTeam.value ? 1 : 2;
        const need =
          perTeam.value - (short === 1 ? team1Count.value : team2Count.value);
        return quiet(
          t("draft_games.header.teams_fill_title"),
          t(
            "draft_games.header.teams_fill_detail",
            { team: sideTitle(short), count: need },
            need,
          ),
        );
      }
      return loud(
        t("draft_games.header.teams_ready_title"),
        t("draft_games.header.ready_match_detail"),
      );
    }
    if (isHostMode.value) {
      return startReady.value
        ? loud(
            t("draft_games.header.teams_ready_title"),
            t("draft_games.header.ready_match_detail"),
          )
        : quiet(
            t("draft_games.header.host_fill_title"),
            t("draft_games.header.host_fill_detail"),
          );
    }
    if (open > 0) {
      return quiet(
        t("draft_games.header.waiting_title", { count: open }, open),
        t("draft_games.header.unlocks_detail", {
          action: startLabelText.value,
          capacity,
        }),
      );
    }
    if (isManualCaptains.value && !manualCaptainsReady.value) {
      return quiet(
        t("draft_games.header.choose_captains_title"),
        t("draft_games.room.choose_captains_hint"),
      );
    }
    if (isManualCaptains.value) {
      return loud(
        t("draft_games.header.captains_set_title"),
        t("draft_games.header.captains_set_detail", {
          one: team1Captain.value?.player?.name ?? "",
          two: team2Captain.value?.player?.name ?? "",
        }),
      );
    }
    return loud(
      t("draft_games.header.ready_title", { capacity }),
      props.room.mode === "Captains"
        ? t("draft_games.header.ready_draft_detail")
        : t("draft_games.header.ready_match_detail"),
    );
  }
  if (isMember.value) {
    return {
      tone: "success",
      hot: false,
      title: t("draft_games.header.member_title"),
      detail:
        open > 0
          ? t("draft_games.header.member_waiting", { count: open }, open)
          : t("draft_games.header.member_full"),
    };
  }
  if (canJoin.value) {
    if (props.room.require_approval) {
      return loud(
        t("draft_games.header.approval_title"),
        t("draft_games.header.approval_detail"),
      );
    }
    if (lobbyFull.value) {
      return quiet(
        t("draft_games.header.full_title"),
        t("draft_games.header.full_detail"),
      );
    }
    return loud(
      t("draft_games.header.seats_open", { count: open }, open),
      t("draft_games.header.join_detail"),
    );
  }
  return quiet(
    t("draft_games.header.seats_filled", {
      filled: accepted.value.length,
      capacity,
    }),
  );
};

const header = computed<DraftHeaderState>(() => {
  const phase = headerPhase.value;
  const match = props.match;
  const capacity = props.room.capacity;

  if (phase === "lobby") {
    return {
      phase,
      ...lobbyCopy(),
      box: { kind: "vs" },
      onClock: null,
    };
  }

  if (phase === "draft") {
    const side = currentLineup.value as 1 | 2;
    const captain = currentCaptain.value;
    const n = Math.min(draftedCount.value + 1, pattern.value.length);
    const total = pattern.value.length;
    const box = {
      kind: "clock" as const,
      deadline: props.room.pick_deadline ?? null,
      total: 30,
      side,
      caption: pickProgress.value,
    };
    if (isMyTurn.value) {
      return {
        phase,
        tone: "amber",
        hot: true,
        title: t("draft_games.header.your_pick_title"),
        detail: autoPickName.value
          ? t("draft_games.header.your_pick_detail", {
              n,
              total,
              name: autoPickName.value,
            })
          : t("draft_games.header.pick_plain", { n, total }),
        box,
        onClock: side,
      };
    }
    let detail = t("draft_games.header.pick_plain", { n, total });
    if (myCaptainLineup.value) {
      const next = pattern.value.findIndex(
        (lineup, index) => index >= n && lineup === myCaptainLineup.value,
      );
      if (next === n) {
        detail = t("draft_games.header.pick_next", { n, total });
      } else if (next > 0) {
        detail = t("draft_games.header.pick_later", {
          n,
          total,
          next: next + 1,
        });
      }
    }
    return {
      phase,
      tone: "muted",
      hot: false,
      title: captain
        ? t("draft_games.header.picking_title", {
            name: captain.player?.name ?? "",
            team: sideTitle(side),
          })
        : t("draft_games.header.selecting_title"),
      detail,
      box,
      onClock: side,
    };
  }

  if (phase === "checkin") {
    const total = checkInProgress.value?.total ?? capacity;
    const ready = checkInProgress.value?.ready ?? 0;
    const missing = total - ready;
    const base = {
      phase,
      box: { kind: "checkin" as const },
      onClock: null,
    };
    if (canCheckIn.value) {
      return {
        ...base,
        tone: "amber",
        hot: true,
        title: t("draft_games.header.checkin_title"),
        detail: checkInWindowOver.value
          ? t("draft_games.header.checkin_count", { ready, total })
          : t("draft_games.header.checkin_detail", { ready, total }),
      };
    }
    if (canReplaceNoShows.value && !isTeamsMode.value && missing > 0) {
      return {
        ...base,
        tone: "amber",
        hot: false,
        title: t(
          "draft_games.header.no_shows_title",
          { count: missing },
          missing,
        ),
        detail: t("draft_games.header.no_shows_detail"),
      };
    }
    if (inMatchLineup.value && myCheckedIn.value) {
      return {
        ...base,
        tone: "success",
        hot: false,
        title: t("draft_games.header.checked_title"),
        detail: t(
          "draft_games.header.checked_detail",
          { count: missing },
          missing,
        ),
      };
    }
    return {
      ...base,
      tone: "muted",
      hot: false,
      title: t("draft_games.header.checkin_watch_title"),
      detail: t("draft_games.header.checkin_count", { ready, total }),
    };
  }

  if (phase === "veto") {
    const turn = vetoTurn.value;
    const lineups = match ? vetoLineups(match, t) : null;
    const acting = turn && lineups ? lineups[turn - 1] : null;
    const region = regionVetoing.value;
    const step = String(match?.map_veto_type ?? "").toLowerCase();
    const kind = region
      ? "region"
      : ["ban", "pick", "side"].includes(step)
        ? step
        : "ban";
    const box = {
      kind: "clock" as const,
      deadline: match?.veto_pick_expires_at ?? null,
      total: match?.options?.veto_pick_timeout ?? 0,
      side: turn,
      caption: region
        ? t("draft_games.header.box_region_veto")
        : t("draft_games.header.box_map_veto"),
    };
    if (vetoMine.value) {
      return {
        phase,
        tone: "amber",
        hot: true,
        title: t(`draft_games.header.veto_you_${kind}`),
        detail: t(`draft_games.header.veto_you_${kind}_detail`),
        box,
        onClock: turn,
      };
    }
    return {
      phase,
      tone: "muted",
      hot: false,
      title: acting
        ? t(`draft_games.header.veto_them_${kind}`, { team: acting.name })
        : region
          ? t("draft_games.header.box_region_veto")
          : t("draft_games.header.box_map_veto"),
      detail: region
        ? t("draft_games.header.veto_region_detail")
        : t("draft_games.header.veto_detail", { count: bestOf.value }),
      box,
      onClock: turn,
    };
  }

  if (phase === "starting") {
    const map = startMap.value;
    return {
      phase,
      tone: "success",
      hot: false,
      title: t("draft_games.header.starting_title"),
      detail: map
        ? t("draft_games.header.starting_detail", { map: mapLabel(map) })
        : t("draft_games.header.starting_detail_plain"),
      box: map
        ? {
            kind: "map",
            label: mapLabel(map),
            patch: map.patch ?? null,
            caption: t("draft_games.header.box_booting"),
          }
        : { kind: "vs" },
      onClock: null,
    };
  }

  const canceled =
    props.room.status === "Canceled" || match?.status === "Canceled";
  const choosing =
    props.room.mode === "Captains" &&
    ["Filled", "SelectingCaptains"].includes(props.room.status);
  return {
    phase,
    tone: canceled ? "muted" : "success",
    hot: false,
    title: canceled
      ? t("draft_games.header.canceled_title")
      : choosing
        ? t("draft_games.header.selecting_title")
        : t("draft_games.header.creating_title"),
    detail: canceled
      ? ""
      : choosing
        ? t("draft_games.header.selecting_detail")
        : t("draft_games.header.creating_detail"),
    box: { kind: "vs" },
    onClock: null,
  };
});
</script>

<template>
  <div class="draft-room space-y-4">
    <DraftSettingsSheet
      :open="settingsOpen"
      :room="room"
      :match="match"
      :editing="settingsEditing"
      :can-edit="canManage"
      @close="settingsOpen = false"
      @edit="settingsEditing = true"
    />

    <div class="sr-only" aria-live="polite">{{ pickAnnouncement }}</div>

    <!-- Laid out by the lobby's own width, not the viewport's: the sidebar and
         the hub dock take a different share at every screen size, and the
         chat rail only fits beside the board once the lobby itself is wide. -->
    <div class="draft-room-body">
      <div class="draft-main min-w-0 space-y-4">
        <DraftRoomHeader
          :state="header"
          :seats="{ filled: accepted.length, capacity: room.capacity }"
          :sides="headerSides"
          :wins-needed="winsNeeded"
        >
          <template #menu>
            <MatchActions v-if="match" :match="match" />
            <DraftRoomMenu
              v-else-if="canCancelDraft"
              @cancel="cancelOpen = true"
            />
          </template>
          <template v-if="headerPhase !== 'lobby' && headerActions.length" #cta>
            <DraftHeaderAction
              v-if="headerActions.includes('decline')"
              variant="secondary"
              :label="$t('draft_games.room.decline_invite')"
              :action="() => respondInvite(false)"
            />
            <DraftHeaderAction
              v-if="headerActions.includes('accept')"
              :label="$t('draft_games.room.accept_invite')"
              :action="() => respondInvite(true)"
            />
          </template>
          <template #checkin>
            <DraftCheckInBox
              :match="match"
              :deadline="checkInDeadline"
              :ready="checkInProgress?.ready ?? 0"
              :total="checkInProgress?.total ?? room.capacity"
              :can-check-in="canCheckIn"
              :checked-in="inMatchLineup && myCheckedIn"
            />
          </template>
          <template #actions>
            <HeightSwap axis="x" class="draft-header-buttons">
              <div
                v-if="headerActions.length"
                :key="headerActions.join('+')"
                class="flex w-full items-center gap-2"
              >
                <DraftHeaderAction
                  v-if="headerActions.includes('decline')"
                  variant="secondary"
                  :label="$t('draft_games.room.decline_invite')"
                  :action="() => respondInvite(false)"
                />
                <DraftHeaderAction
                  v-if="headerActions.includes('accept')"
                  :label="$t('draft_games.room.accept_invite')"
                  :action="() => respondInvite(true)"
                />
                <DraftHeaderAction
                  v-if="headerActions.includes('leave')"
                  variant="secondary"
                  :icon="LogOut"
                  :label="
                    isWaitlisted
                      ? $t('draft_games.room.leave_waitlist')
                      : $t('draft_games.room.leave')
                  "
                  :action="isWaitlisted ? leaveWaitlist : leaveRoom"
                />
                <DraftHeaderAction
                  v-if="headerActions.includes('join')"
                  :icon="UserPlus"
                  :label="joinLabel"
                  :action="joinRoom"
                />
                <DraftHeaderAction
                  v-if="headerActions.includes('start')"
                  :icon="Play"
                  :label="startLabelText"
                  :locked="!startReady || !regionsAvailable"
                  :reason="header.detail"
                  :action="start"
                />
              </div>
            </HeightSwap>
            <DraftRoomMenu
              v-if="canManage"
              large
              edit
              :invite="showInvite"
              :closes-at="room.expires_at"
              @edit="openSettings(true)"
              @extend="extendRoom"
              @copy-invite="copyInvite"
              @cancel="cancelOpen = true"
            />
          </template>
          <template #lobby>
            <DraftSettingsBar
              :room="room"
              :match="match"
              @open-settings="openSettings(false)"
            />
          </template>
        </DraftRoomHeader>

        <!-- Region availability flips with the fleet, not with anything the room
             did, so the warning eases in rather than shoving the room down. -->
        <Transition name="collapse">
          <div
            v-if="!regionsAvailable && notStarted"
            class="grid grid-rows-[1fr]"
          >
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
                hide-check-in
                :check-in-deadline="checkInDeadline"
                :check-in-deadline-help="checkInDeadlineHelp"
              />
            </div>
          </div>
        </Transition>

        <!-- One stage folds shut, then the next unfolds from the top: the
             match page's hand-off from the veto to its map cards, played the
             other way, so check-in to veto reads as one move. -->
        <Transition
          mode="out-in"
          enter-active-class="stage-unfold"
          leave-active-class="stage-fold"
          enter-from-class="stage-unfold-from"
          leave-to-class="stage-folded"
        >
          <div :key="stage" class="grid grid-rows-[1fr]">
            <div
              v-if="inVeto"
              class="veto-stage relative rounded-xl border border-border bg-card/40 p-6 [backdrop-filter:blur(8px)]"
            >
              <span
                ref="vetoMeter"
                class="veto-stage-meter"
                :class="{ 'is-on': !!vetoDeadline, 'is-urgent': vetoUrgent }"
                :style="{
                  '--side':
                    vetoTurn === 2 ? 'var(--tac-blue)' : 'var(--tac-amber)',
                }"
                aria-hidden="true"
              ></span>
              <MatchRegionVeto
                :match="match"
                :match-id="room.match_id"
                :status-line="false"
                class="pb-6"
              />
              <MatchMapVeto
                :match="match"
                :match-id="room.match_id"
                :stage="false"
                :status-line="false"
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

                      <HeightGlide>
                        <div
                          ref="poolBox"
                          :style="
                            poolHold
                              ? { minHeight: `${poolHold}px` }
                              : undefined
                          "
                        >
                          <TransitionGroup
                            name="pool"
                            tag="div"
                            class="draft-pool-grid"
                            @before-leave="pinLeaver"
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
                                      :disabled="
                                        side === 1 ? team1Full : team2Full
                                      "
                                      :action="
                                        () => assign(player.steam_id, side)
                                      "
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
                                        side === 1
                                          ? !!team1Captain
                                          : !!team2Captain
                                      "
                                      :action="
                                        () =>
                                          designateCaptain(
                                            player.steam_id,
                                            side,
                                          )
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
                              v-for="n in canInvite && !isHostMode
                                ? openSlots
                                : 0"
                              :key="`slot-${pool.length + n}`"
                              class="draft-open-slot"
                              :exclude="memberIds"
                              @selected="add"
                            />
                          </TransitionGroup>
                        </div>
                      </HeightGlide>

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
                                @before-leave="pinLeaver"
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
                                @before-leave="pinLeaver"
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

    <MatchAdminBottomBar v-if="match?.is_organizer" :match="match" draft />
    <DraftAdminBar
      v-else-if="canCancelDraft && !notStarted"
      :room="room"
      @cancel="cancelOpen = true"
    />
    <DraftCancelDialog
      v-if="canCancelDraft"
      v-model:open="cancelOpen"
      :room-id="room.id"
    />

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
.stage-fold {
  transition:
    grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease-in;
}
.stage-unfold {
  transition: grid-template-rows 0.46s cubic-bezier(0.22, 1, 0.36, 1);
}
.stage-fold > *,
.stage-unfold > * {
  min-height: 0;
  overflow: hidden;
}
.stage-folded {
  grid-template-rows: 0fr;
  opacity: 0;
}
.stage-unfold-from {
  grid-template-rows: 0fr;
}
.veto-stage-meter {
  position: absolute;
  top: -1px;
  inset-inline: 0.75rem;
  height: 2px;
  border-radius: 2px;
  background: hsl(var(--side));
  transform-origin: left;
  transform: scaleX(var(--countdown, 0));
  opacity: 0;
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.veto-stage-meter.is-on {
  opacity: 1;
}
.veto-stage-meter.is-urgent {
  background: hsl(var(--destructive));
}
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
.draft-match-info.is-empty {
  margin-top: 0 !important;
}
.draft-pair-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr);
}
.draft-pool-grid {
  position: relative;
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
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
.pool-move {
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
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
  .starting-map {
    animation: none;
  }
  .collapse-enter-active,
  .collapse-leave-active,
  .cta-enter-active,
  .cta-leave-active,
  .stage-fold,
  .stage-unfold,
  .veto-stage-meter {
    transition-duration: 1ms;
  }
}
</style>
