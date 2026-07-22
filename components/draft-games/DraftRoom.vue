<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowRight,
  ArrowUp,
  Swords,
  Play,
  X,
  MessagesSquare,
  Inbox,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
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
import ChatLobby from "~/components/chat/ChatLobby.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import DraftSettingsBar from "~/components/draft-games/DraftSettingsBar.vue";
import DraftTeamPanel from "~/components/draft-games/DraftTeamPanel.vue";
import DraftPlayerCard from "~/components/draft-games/DraftPlayerCard.vue";
import DraftBackupsPanel from "~/components/draft-games/DraftBackupsPanel.vue";
import DraftClock from "~/components/draft-games/DraftClock.vue";
import DraftLog from "~/components/draft-games/DraftLog.vue";
import DraftRequestQueue from "~/components/draft-games/DraftRequestQueue.vue";
import DraftOpenSlot from "~/components/draft-games/DraftOpenSlot.vue";
import DraftSettingsSheet from "~/components/draft-games/DraftSettingsSheet.vue";
import DraftCoinFlip from "~/components/draft-games/DraftCoinFlip.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  room: any;
  match?: any;
  inviteCode?: string;
}>();

const { t } = useI18n();

const inVeto = computed(
  () => !!props.room.match_id && props.match?.status === "Veto",
);

const vetoPhaseLabel = computed(() =>
  props.match?.options?.region_veto && !props.match?.region
    ? "draft_games.bar.region_veto"
    : "draft_games.bar.map_veto",
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
  () =>
    !props.room.match_id && ["Open", "Filled"].includes(props.room.status),
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

const startersFor = (lineup: number) =>
  [...props.room.players]
    .filter((p: any) => p.lineup === lineup && p.status !== "Waitlist")
    .sort((a: any, b: any) => (a.pick_order ?? 0) - (b.pick_order ?? 0));

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

const showCoinFlip = ref(false);
const coinFlipShown = ref(false);
watch(
  () => props.room.status,
  (status) => {
    if (
      status === "Drafting" &&
      props.room.mode === "Captains" &&
      !coinFlipShown.value
    ) {
      coinFlipShown.value = true;
      showCoinFlip.value = true;
    }
  },
  { immediate: true },
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

const hasPicks = computed(() => (props.room.picks?.length || 0) > 0);

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
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
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
  return runGuarded(`kick:${steamId}`, () =>
    useDraftGamesStore().kick(props.room.id, steamId),
  );
};

const add = (steamId: string) => {
  return runGuarded(`add:${steamId}`, () =>
    useDraftGamesStore().add(props.room.id, steamId),
  );
};

const addToTeam = (steamId: string, lineup: number) => {
  return runGuarded(`add:${steamId}`, async () => {
    await useDraftGamesStore().add(props.room.id, steamId);
    await useDraftGamesStore().teamAssign(props.room.id, steamId, lineup);
  });
};

const respondInvite = (accept: boolean) => {
  return runGuarded(`respond:${accept}`, () =>
    useDraftGamesStore().respondInvite(props.room.id, accept),
  );
};

const clockAccent = computed(() =>
  currentLineup.value === 2 ? "200 90% 62%" : "var(--tac-amber)",
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

const pickTimeline = computed(() =>
  (props.room.pattern ?? []).map((lineup: number, index: number) => ({
    lineup,
    state:
      index < draftedCount.value
        ? "done"
        : index === draftedCount.value
          ? "current"
          : "upcoming",
  })),
);

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
    props.room.mode === "Captains" &&
    props.room.captain_selection === "Manual",
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
  return props.room.team_2_id || (props.room.inner_squad ? props.room.team_1_id : undefined);
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

const sideFull = (lineup: number) => startersFor(lineup).length >= perTeam.value;

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
      accepted.value.length === props.room.capacity &&
      manualCaptainsReady.value
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
    <DraftCoinFlip
      v-if="showCoinFlip"
      :room="room"
      @done="showCoinFlip = false"
    />

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

    <Alert
      v-if="!regionsAvailable && notStarted"
      variant="destructive"
      class="bg-red-600 text-white"
    >
      <AlertTitle>
        {{ $t("match.region_veto.no_regions_available") }}
      </AlertTitle>
      <AlertDescription>
        {{ $t("draft_games.room.no_regions_available_description") }}
      </AlertDescription>
    </Alert>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div class="min-w-0 space-y-4">
        <Transition name="phase">
          <MatchInfo v-if="match" :match="match" hide-booting />
        </Transition>

        <Transition name="stage" mode="out-in">
          <div :key="stage" class="space-y-4">
        <div
          v-if="inVeto"
          class="veto-stage rounded-xl border border-[hsl(var(--tac-amber)/0.25)] bg-card/40 p-6 [backdrop-filter:blur(8px)]"
        >
          <div class="mb-5 flex items-center justify-center gap-2">
            <h3
              class="font-sans text-base font-bold uppercase tracking-[0.2em]"
            >
              {{ $t(vetoPhaseLabel) }}
            </h3>
          </div>
          <MatchRegionVeto
            :match="match"
            :match-id="room.match_id"
            class="pb-6"
          />
          <MatchMapVeto :match="match" :match-id="room.match_id" />
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
                  :alt="m.map?.name"
                />
                <span
                  class="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-center font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white"
                >
                  {{ m.map?.name }}
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

            <!-- The hint, the CTA and the check-in readout share one fixed-height
                 row. Swapping content instead of mounting and unmounting keeps
                 this panel the same height from an empty lobby right through to
                 check-in, so the rosters below never jump. -->
            <div
              v-if="showStart || isCheckIn"
              class="flex h-14 w-full items-center justify-center"
            >
              <Transition name="cta" mode="out-in">
                <div
                  v-if="isCheckIn"
                  key="checkin"
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
                      ? $t("draft_games.room.checking_in", checkInProgress)
                      : $t("draft_games.room.match_starting")
                  }}
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

          <div class="grid items-stretch gap-4 sm:grid-cols-2">
            <DraftTeamPanel
              :title="sideName(1) || $t('draft_games.room.team', { team: 1 })"
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
                  <Button
                    v-for="side in [1, 2]"
                    :key="`start-${side}`"
                    v-show="canManageSide(side)"
                    variant="ghost"
                    class="start-btn"
                    :disabled="
                      isPending(`swap:${player.steam_id}`) || sideFull(side)
                    "
                    :title="
                      sideFull(side)
                        ? $t('draft_games.room.side_full')
                        : $t('draft_games.room.start_player')
                    "
                    @click="startPlayer(player.steam_id, side)"
                  >
                    {{ side === 1 ? "A" : "B" }}
                  </Button>
                  <Button
                    v-if="
                      canManageSide(player.lineup ?? 1) &&
                      player.steam_id !== room.host_steam_id
                    "
                    variant="ghost"
                    class="kick-btn"
                    :title="$t('draft_games.room.kick')"
                    @click="kick(player.steam_id)"
                  >
                    <X class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </template>
            </DraftBackupsPanel>
          </template>

          <div v-else class="grid items-stretch gap-4 sm:grid-cols-2">
            <DraftBackupsPanel
              v-for="side in [1, 2]"
              :key="`backups-${side}`"
              :title="
                $t('draft_games.room.side_backups', {
                  team: sideName(side) || $t('draft_games.room.team', { team: side }),
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
                  <Button
                    v-if="canManageSide(side)"
                    variant="ghost"
                    class="start-btn"
                    :disabled="
                      isPending(`swap:${player.steam_id}`) || sideFull(side)
                    "
                    :title="
                      sideFull(side)
                        ? $t('draft_games.room.side_full')
                        : $t('draft_games.room.start_player')
                    "
                    @click="startPlayer(player.steam_id, side)"
                  >
                    <ArrowUp class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    v-if="
                      canManageSide(side) &&
                      player.steam_id !== room.host_steam_id
                    "
                    variant="ghost"
                    class="kick-btn"
                    :title="$t('draft_games.room.kick')"
                    @click="kick(player.steam_id)"
                  >
                    <X class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </template>
            </DraftBackupsPanel>
          </div>

          <DraftBackupsPanel
            v-if="unsidedPlayers.length > 0"
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
                <Button
                  v-for="side in [1, 2]"
                  :key="`slot-${side}`"
                  v-show="canManageSide(side)"
                  variant="ghost"
                  class="start-btn"
                  :disabled="
                    isPending(`swap:${player.steam_id}`) || sideFull(side)
                  "
                  :title="
                    sideFull(side)
                      ? $t('draft_games.room.side_full')
                      : sideName(side) || $t('draft_games.room.start_player')
                  "
                  @click="startPlayer(player.steam_id, side)"
                >
                  {{ side === 1 ? "A" : "B" }}
                </Button>
                <Button
                  v-if="canManage && player.steam_id !== room.host_steam_id"
                  variant="ghost"
                  class="kick-btn"
                  :title="$t('draft_games.room.kick')"
                  @click="kick(player.steam_id)"
                >
                  <X class="h-3.5 w-3.5" />
                </Button>
              </div>
            </template>
          </DraftBackupsPanel>
        </div>

        <div v-else class="w-full space-y-4">
          <div
            v-if="isAssembling || isDrafting || (showStart && startReady)"
            class="theater relative flex flex-col items-center gap-5 rounded-xl border border-border bg-card/40 p-5 [backdrop-filter:blur(8px)]"
          >
            <div
              v-if="isAssembling"
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

              <div class="flex flex-wrap items-center justify-center gap-1.5">
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

            <template v-else-if="isDrafting">
              <DraftClock
                :deadline="room.pick_deadline"
                :accent="clockAccent"
                :pulse="isMyTurn"
              >
                {{ $t("draft_games.room.on_the_clock") }}
              </DraftClock>
              <div
                class="status-banner text-center font-sans text-sm font-bold uppercase tracking-[0.18em]"
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

              <div v-if="pickTimeline.length" class="pick-order-strip">
                <span class="pick-order-label">
                  {{ $t("draft_games.room.pick_order") }}
                </span>
                <div class="pick-order-track">
                  <span
                    v-for="(slot, index) in pickTimeline"
                    :key="index"
                    class="pick-order-chip"
                    :class="[
                      `is-${slot.state}`,
                      slot.lineup === 1 ? 'is-alpha' : 'is-bravo',
                    ]"
                  >
                    {{ slot.lineup === 1 ? "T1" : "T2" }}
                  </span>
                </div>
              </div>
            </template>

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
          </div>

          <div
            v-if="showTeamPanels"
            class="grid items-start gap-4 sm:grid-cols-2"
          >
            <DraftTeamPanel
              :title="$t('draft_games.room.team_alpha')"
              :players="team1"
              :per-team="perTeam"
              accent="amber"
              :host-steam-id="room.host_steam_id"
              :check-in-by-steam-id="checkInBySteamId"
              :active="isDrafting && currentLineup === 1"
              :removable="canAssign || (isManualCaptains && canManage)"
              :self-steam-id="isHostAssigning ? me?.steam_id : undefined"
              :addable="canAssign && !team1Full"
              :exclude-steam-ids="memberIds"
              @add="(steamId) => addToTeam(steamId, 1)"
              @remove="onTeamRemove"
            />
            <DraftTeamPanel
              :title="$t('draft_games.room.team_bravo')"
              :players="team2"
              :per-team="perTeam"
              accent="blue"
              :host-steam-id="room.host_steam_id"
              :check-in-by-steam-id="checkInBySteamId"
              :active="isDrafting && currentLineup === 2"
              :removable="canAssign || (isManualCaptains && canManage)"
              :self-steam-id="isHostAssigning ? me?.steam_id : undefined"
              :addable="canAssign && !team2Full"
              :exclude-steam-ids="memberIds"
              @add="(steamId) => addToTeam(steamId, 2)"
              @remove="onTeamRemove"
            />
          </div>

          <div
            v-if="isHostAssigning && isOrganizer"
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

          <div
            v-if="canDesignateCaptain && !manualCaptainsReady"
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

          <div
            v-if="
              !isHostMode ||
              pool.length > 0 ||
              waitlist.length > 0 ||
              invited.length > 0
            "
            class="rounded-xl border border-border bg-card/40 p-5 [backdrop-filter:blur(8px)]"
          >
            <div class="mb-3 flex items-center gap-2">
              <span class="pool-tick"></span>
              <h3
                class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("draft_games.room.pool") }}
                <span class="ml-1 text-foreground/70">({{ pool.length }})</span>
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
              class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
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
                    <template v-else-if="canAssign || canSelfPick(player)">
                      <Button
                        variant="ghost"
                        class="assign-btn assign-amber"
                        :disabled="team1Full"
                        @click="assign(player.steam_id, 1)"
                      >
                        1
                      </Button>
                      <Button
                        variant="ghost"
                        class="assign-btn assign-blue"
                        :disabled="team2Full"
                        @click="assign(player.steam_id, 2)"
                      >
                        2
                      </Button>
                    </template>
                    <template v-else-if="canDesignateCaptain">
                      <Button
                        variant="ghost"
                        class="assign-btn assign-amber"
                        :title="$t('draft_games.room.make_captain')"
                        :disabled="!!team1Captain"
                        @click="designateCaptain(player.steam_id, 1)"
                      >
                        C1
                      </Button>
                      <Button
                        variant="ghost"
                        class="assign-btn assign-blue"
                        :title="$t('draft_games.room.make_captain')"
                        :disabled="!!team2Captain"
                        @click="designateCaptain(player.steam_id, 2)"
                      >
                        C2
                      </Button>
                    </template>
                    <Button
                      v-if="canManage && player.steam_id !== room.host_steam_id"
                      variant="ghost"
                      class="kick-btn"
                      :title="$t('draft_games.room.kick')"
                      @click="kick(player.steam_id)"
                    >
                      <X class="h-3.5 w-3.5" />
                    </Button>
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

            <div
              v-if="pool.length === 0 && openSlots === 0"
              class="py-6 text-center text-xs text-muted-foreground/50"
            >
              {{ $t("draft_games.room.empty_pool") }}
            </div>

            <div
              v-if="waitlist.length > 0"
              class="mt-5 border-t border-dotted border-border/70 pt-4"
            >
              <div class="mb-3 flex items-center gap-2">
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
              <TransitionGroup
                name="pool"
                tag="div"
                class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                <DraftPlayerCard
                  v-for="(player, index) in waitlist"
                  :key="player.steam_id"
                  :member="player"
                  accent="neutral"
                  :match-type="rankMatchType"
                  :is-host="player.steam_id === room.host_steam_id"
                >
                  <template #action>
                    <div class="flex items-center gap-2">
                      <span
                        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        #{{ Number(index) + 1 }}
                      </span>
                      <Button
                        v-if="
                          canManage && player.steam_id !== room.host_steam_id
                        "
                        variant="ghost"
                        class="kick-btn"
                        :title="$t('draft_games.room.kick')"
                        @click="kick(player.steam_id)"
                      >
                        <X class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </template>
                </DraftPlayerCard>
              </TransitionGroup>
            </div>

            <div
              v-if="canManage && invited.length > 0"
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
                class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                <DraftPlayerCard
                  v-for="player in invited"
                  :key="player.steam_id"
                  :member="player"
                  accent="neutral"
                  :match-type="rankMatchType"
                  :is-host="player.steam_id === room.host_steam_id"
                >
                  <template #action>
                    <div class="flex items-center gap-2">
                      <span
                        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {{ $t("draft_games.room.invite_pending_short") }}
                      </span>
                      <Button
                        variant="ghost"
                        class="kick-btn"
                        :title="$t('draft_games.room.cancel_invite')"
                        @click="kick(player.steam_id)"
                      >
                        <X class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </template>
                </DraftPlayerCard>
              </TransitionGroup>
            </div>
          </div>
        </div>
          </div>
        </Transition>

        <div
          v-if="hasPicks"
          class="rounded-xl border border-border bg-card/40 p-4"
        >
          <DraftLog :picks="room.picks" />
        </div>
      </div>

      <!-- Self-status banners live in this column rather than above the room:
           they appear and disappear as the lobby fills, and full width they
           shoved the whole roster down every time. -->
      <div
        class="flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
      >
        <Transition name="banner">
          <div
            v-if="canJoin || hasRequested || isWaitlisted"
            class="self-banner mb-3 flex flex-col items-start gap-2 rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-3"
          >
            <span
              class="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              {{
                hasRequested
                  ? $t("draft_games.room.request_pending")
                  : isWaitlisted
                    ? $t("draft_games.room.waitlist_pending")
                    : lobbyFull
                      ? $t("draft_games.room.waitlist_prompt")
                      : room.require_approval
                        ? $t("draft_games.room.request_prompt")
                        : $t("draft_games.room.join_prompt")
              }}
            </span>
            <button
              v-if="canJoin"
              type="button"
              :class="tacticalCtaButtonClasses"
              @click="joinRoom"
            >
              {{
                room.require_approval
                  ? $t("draft_games.card.request")
                  : lobbyFull
                    ? $t("draft_games.room.join_waitlist")
                    : $t("draft_games.card.join")
              }}
            </button>
            <button
              v-else-if="isWaitlisted"
              type="button"
              class="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              @click="
                runGuarded('leave', () => useDraftGamesStore().leave(room.id))
              "
            >
              {{ $t("draft_games.room.leave_waitlist") }}
            </button>
            <span
              v-else
              class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
            >
              {{ $t("draft_games.card.requested") }}
            </span>
          </div>
        </Transition>

        <Transition name="banner">
          <div
            v-if="isInvited"
            class="self-banner mb-3 flex flex-col items-start gap-2 rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-3"
          >
            <span
              class="font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("draft_games.room.invite_pending") }}
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                :class="tacticalCtaButtonClasses"
                @click="respondInvite(true)"
              >
                {{ $t("draft_games.room.accept_invite") }}
              </button>
              <button
                type="button"
                class="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                @click="respondInvite(false)"
              >
                {{ $t("draft_games.room.decline_invite") }}
              </button>
            </div>
          </div>
        </Transition>

        <div
          class="flex min-h-[440px] flex-col overflow-hidden rounded-xl border border-border bg-card/40 xl:min-h-0 xl:flex-1"
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
            <MessagesSquare class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
            <h3
              class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("draft_games.room.comms") }}
            </h3>
          </div>
          <ChatLobby
            v-if="me"
            class="min-h-0 flex-1"
            instance="draft-room"
            :type="chatType"
            :lobby-id="chatLobbyId"
            :frameless="true"
            :can-send="canChat"
            :readonly-hint="$t('draft_games.room.chat_players_only')"
          />
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
        </div>
        </div>
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
            {{ $t("draft_games.room.kick_confirm_description") }}
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
/* The banner collapses its own height and bottom margin so the chat panel
   below it slides rather than jumping when a slot opens. */
.self-banner {
  max-height: 16rem;
}
.banner-enter-active,
.banner-leave-active {
  overflow: hidden;
  transition:
    max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    margin-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.banner-enter-from,
.banner-leave-to {
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-width: 0;
  opacity: 0;
  transform: translateY(-4px);
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
  background: hsl(200 90% 62%);
  box-shadow: 0 0 8px hsl(200 90% 62% / 0.6);
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
.pick-order-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.pick-order-label {
  font-family: var(--font-mono, monospace);
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  color: hsl(var(--muted-foreground));
}
.pick-order-track {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
}
.pick-order-chip {
  --chip: var(--tac-amber);
  min-width: 1.9rem;
  padding: 0.15rem 0.4rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--chip) / 0.5);
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-align: center;
  color: hsl(var(--chip));
  background: hsl(var(--chip) / 0.08);
  transition: all 0.15s ease;
}
.pick-order-chip.is-bravo {
  --chip: 200 90% 62%;
}
.pick-order-chip.is-done {
  opacity: 0.4;
}
.pick-order-chip.is-current {
  background: hsl(var(--chip) / 0.22);
  box-shadow: 0 0 12px hsl(var(--chip) / 0.5);
  transform: scale(1.08);
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
.assign-btn {
  display: grid;
  place-items: center;
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
  border-radius: 0.3rem;
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  font-size: 0.72rem;
  border: 1px solid;
  transition: all 0.15s ease;
}
.assign-btn:disabled,
.kick-btn:disabled {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}
.assign-amber {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.1);
}
.assign-amber:hover {
  background: hsl(var(--tac-amber) / 0.25);
}
.assign-blue {
  color: hsl(200 90% 62%);
  border-color: hsl(200 90% 62% / 0.4);
  background: hsl(200 90% 62% / 0.1);
}
.assign-blue:hover {
  background: hsl(200 90% 62% / 0.25);
}
.kick-btn {
  display: grid;
  place-items: center;
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
  border-radius: 0.3rem;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  transition: all 0.15s ease;
}
.kick-btn:hover {
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.12);
}
/* Same box as .kick-btn so the two backup actions read as a matched pair. */
.start-btn {
  display: grid;
  place-items: center;
  height: 1.75rem;
  width: 1.75rem;
  padding: 0;
  border-radius: 0.3rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.68rem;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  transition: all 0.15s ease;
}
.start-btn:hover:not(:disabled) {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.5);
  background: hsl(var(--tac-amber) / 0.12);
}
.start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
.phase-enter-active {
  transition:
    opacity 0.45s ease,
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.phase-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.phase-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.99);
}
.phase-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.stage-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.stage-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.stage-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.985);
}
.stage-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.99);
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
  .stage-enter-active,
  .stage-leave-active,
  .phase-enter-active,
  .phase-leave-active {
    transition-duration: 1ms;
  }
}
</style>
