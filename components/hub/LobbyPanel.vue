<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Merge, LogOut } from "lucide-vue-next";
import VoiceChannelCard from "~/components/voice/VoiceChannelCard.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { currentHub } from "~/composables/useHubState";
import MatchLobbyExpanded from "~/components/matchmaking-lobby/MatchLobbyExpanded.vue";
import MatchmakingLobbyAccess from "~/components/matchmaking-lobby/MatchmakingLobbyAccess.vue";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import Empty from "~/components/ui/empty/Empty.vue";
import { useInvites } from "@/composables/useInvites";
import { useVoiceSession } from "~/composables/useVoiceSession";

const { t } = useI18n();
const { hasLobbyInvites } = useInvites();

// Party voice can be turned off platform-wide without touching match voice.
// Handing the channel a null id (rather than only hiding the controls) means
// flipping the setting off also drops anyone already in the call.
const voiceChatEnabled = computed(
  () => useApplicationSettingsStore().voiceChatLobbiesEnabled,
);

// The same session every other voice control drives, hosted by the app layout.
// This panel used to own a connection of its own, which worked -- it lives in
// the hub, so it already outlived navigation -- but it meant two microphone
// pipelines existed and only the registry's conflict prompt kept one of them
// quiet. One session is one microphone.
const session = useVoiceSession();

const lobbyId = computed(() =>
  voiceChatEnabled.value
    ? (((useMatchmakingStore().currentLobby as any)?.id as string) ?? null)
    : null,
);

// The hub keeps every panel it has ever opened mounted and hides it with
// v-show, so being mounted proves nothing about being on screen. Handed to the
// card, which is what Picture-in-Picture follows -- and scoped to this channel,
// because sitting on this tab during a *match* call this panel shows nothing of
// it, which is exactly the case Picture-in-Picture exists for.
function lobbyOnScreen() {
  return useRightSidebar().rightSidebarOpen.value && currentHub() === "lobby";
}

// Leaving the party ends the call: the channel it belonged to is gone.
watch(lobbyId, (next, previous) => {
  if (previous && next !== previous && session.isChannel(previous)) {
    void session.leave();
  }
});
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 pt-3 pb-3 flex-shrink-0 border-b border-border">
      <div
        class="flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-bold tracking-[0.24em] uppercase text-muted-foreground"
      >
        <span class="w-2 h-[2px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("layouts.hub.lobby") }}
      </div>
    </div>
    <div class="flex-1 px-3 pt-3 flex flex-col overflow-hidden">
      <!-- Scrollable main content (invites + squad) -->
      <div class="flex-[3] min-h-0 flex flex-col overflow-y-auto">
        <!-- Lobby invites. Folds its height shut instead of vanishing with a
             one-frame gap collapse -- the section spacing rides inside the
             clipped row. -->
        <Transition
          enter-active-class="lobby-fold"
          enter-from-class="lobby-fold-collapsed"
          leave-active-class="lobby-fold"
          leave-to-class="lobby-fold-collapsed"
        >
          <div v-if="hasLobbyInvites" class="grid grid-rows-[1fr]">
            <div class="min-h-0">
              <div class="flex flex-col gap-3 pb-4">
            <div
              class="inline-flex items-center gap-[0.35rem] text-[0.68rem] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
            >
              <Merge class="h-3 w-3" />
              <span>{{ $t("layouts.lobby_panel.lobby_invites") }}</span>
            </div>
            <LobbyInvites />
            <Separator class="my-3 opacity-60" />
              </div>
            </div>
          </div>
        </Transition>

        <!-- Squad ↔ create-lobby swap: measured height, one motion. -->
        <HeightSwap @settled="onSquadEntered">
          <!-- Matchmaking lobby -->
          <div v-if="currentLobby" key="squad" class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col gap-1">
                <div
                  class="inline-flex items-center gap-[0.35rem] text-[0.68rem] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
                >
                  {{ $t("layouts.lobby_panel.your_squad") }}
                </div>
                <p class="text-[11px] text-muted-foreground">
                  {{ $t("layouts.lobby_panel.squad_description") }}
                </p>
              </div>
              <div class="flex items-center gap-2 md:hidden">
                <MatchmakingLobbyAccess :lobby="currentLobby" />
                <Button
                  size="icon"
                  variant="destructive"
                  class="rounded-full transition-colors duration-200"
                  @click="leaveCurrentLobby"
                  :title="$t('matchmaking.lobby.leave')"
                >
                  <LogOut class="h-3 w-3" />
                </Button>
              </div>
            </div>

            <MatchLobbyExpanded :lobby="currentLobby" />
          </div>

          <!-- Create lobby — only when not in a lobby or match -->
          <Empty v-else key="empty" class="px-3 pb-5 pt-4">
            <p class="text-sm text-muted-foreground text-center max-w-xs">
              {{ $t("layouts.lobby_panel.create_lobby_description") }}
            </p>
            <div
              class="inline-flex rounded-full p-[1.5px] bg-[linear-gradient(135deg,hsl(40_58%_60%)_0%,hsl(33_62%_55%)_50%,hsl(24_56%_52%)_100%)] shadow-[0_4px_14px_-8px_hsl(var(--tac-amber)/0.3)] transition-shadow duration-300 hover:shadow-[0_6px_18px_-8px_hsl(var(--tac-amber)/0.4)]"
            >
              <Button
                variant="ghost"
                @click="createLobby"
                :loading="creatingLobby"
                size="default"
                class="rounded-full border-0 bg-zinc-950/95 px-7 py-2 text-[hsl(var(--tac-amber))] transition-colors duration-300 hover:bg-zinc-900/95 hover:text-[hsl(var(--tac-amber))] focus-visible:ring-[hsl(var(--tac-amber))]"
              >
                <Merge class="h-5 w-5" />
                <span class="font-semibold">
                  {{ $t("layouts.lobby_panel.create_lobby_button") }}
                </span>
              </Button>
            </div>
          </Empty>
        </HeightSwap>
      </div>

      <!-- Voice only. Discord linking used to live here, but it is account
           plumbing for the bot rather than anything to do with the call, and
           it left an orphan line under the controls. -->
      <!-- The party's voice channel, drawn by the same card the match page and
           the draft room use. This panel used to arrange its own controls, which
           is how the hub ended up offering a different set of them to the same
           call depending on where you opened it. It folds open into the column
           instead of claiming its full box on frame one; the divider and top
           margin ride inside the clipped row. -->
      <Transition
        enter-active-class="lobby-fold"
        enter-from-class="lobby-fold-collapsed"
        leave-active-class="lobby-fold"
        leave-to-class="lobby-fold-collapsed"
      >
        <div
          v-if="currentLobby && squadReady && voiceChatEnabled && lobbyId"
          class="shrink-0 grid grid-rows-[1fr]"
        >
          <div class="min-h-0">
            <VoiceChannelCard
              class="mt-4 border-t border-zinc-800 pt-3"
              dense
              show-empty
              :framed="false"
              kind="lobby"
              :channel-id="lobbyId"
              :label="$t('layouts.voice_panel.party_comms')"
              :visible-when="lobbyOnScreen"
            />
          </div>
        </div>
      </Transition>

      <!-- Dedicated bottom lobby chat area (~25% height). A flex-sized dock,
           so its reveal animates flex-basis/grow rather than content height --
           the squad area above shrinks continuously as the dock grows into
           its share instead of losing it in one frame. The divider lives on
           the inner header so the collapsed dock floors at a true zero. -->
      <Transition
        enter-active-class="lobby-dock"
        enter-from-class="lobby-dock-collapsed"
        leave-active-class="lobby-dock"
        leave-to-class="lobby-dock-collapsed"
      >
        <div
          v-if="currentLobby && squadReady"
          class="flex-[1_1_250px] min-h-0 lg:flex-[1] lg:min-h-[160px] lg:max-h-[40%] flex flex-col gap-2"
        >
          <div
            class="border-t border-zinc-800 pt-3 mt-4 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide"
          >
            {{ $t("chat.lobby_chat") }}
          </div>
          <ChatLobby
            v-if="(currentLobby as any)?.id"
            instance="matchmaking"
            type="matchmaking"
            :lobby-id="(currentLobby as any).id"
            :frameless="true"
            class="flex-1 min-h-0"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script lang="ts">
import { e_match_status_enum, e_player_roles_enum } from "~/generated/zeus";
import { useChatTabs } from "~/composables/useChatTabs";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      playMatchFoundSound: useSound().playMatchFoundSound,
      // Gates the bottom sections (voice/chat) so they only render once the
      // squad has finished animating in — otherwise they mount immediately and
      // reserve their layout space before the top, causing a jarring jump.
      squadReady: false,
    };
  },
  mounted() {
    // Panel re-opened while already in a lobby: no enter transition fires, so
    // mark ready up front.
    if (this.currentLobby) this.squadReady = true;
  },
  watch: {
    currentLobby(newLobby: any, oldLobby: any) {
      // Reset only when entering a lobby (wait for the squad transition) or
      // leaving one — NOT on plain lobby-data updates (e.g. a player joining),
      // which would otherwise make voice/chat flicker out and back.
      if (!newLobby || !oldLobby) {
        this.squadReady = false;
      }
    },
    myMatches: {
      immediate: true,
      handler() {
        if (this.myMatches.length === 0) return;
        const match = this.myMatches
          .sort((a: any, b: any) => {
            if (a.started_at && !b.started_at) return -1;
            if (!a.started_at && b.started_at) return 1;
            if (a.started_at && b.started_at) {
              const diff =
                new Date(a.started_at).getTime() -
                new Date(b.started_at).getTime();
              if (diff !== 0) return diff;
            }
            return (
              this.getStatusPriority(a.status) -
              this.getStatusPriority(b.status)
            );
          })
          .at(0);
        if (match) this.selectLobby((match as any).id);
      },
    },
    currentMatch: {
      immediate: true,
      handler(currentMatch: any, oldMatch: any) {
        if (!currentMatch || currentMatch?.id === oldMatch?.id) return;
        const current = this.currentMatch as any;
        switch (current?.status) {
          case e_match_status_enum.Veto:
          case e_match_status_enum.Live:
            if (oldMatch && currentMatch.status !== oldMatch.status) {
              this.playMatchFoundSound();
            }
            break;
          case e_match_status_enum.WaitingForCheckIn: {
            const lineupPlayers = current.lineup_1.lineup_players.concat(
              current.lineup_2.lineup_players,
            );
            const me = lineupPlayers.find(
              (p: any) => p.player.steam_id === this.me.steam_id,
            );
            if (me?.checked_in === false) this.playMatchFoundSound();
            break;
          }
        }
        this.joinGlobalMatchChat(currentMatch);
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    myMatches() {
      return useMatchLobbyStore().myMatches;
    },
    currentLobby() {
      return useMatchmakingStore().currentLobby;
    },
    currentMatch() {
      return (this.myMatches as any[]).find(
        (m) => m.id === useMatchmakingStore().viewingMatchId,
      );
    },
    isElevatedUser() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    creatingLobby() {
      return useMatchmakingStore().creatingLobby;
    },
  },
  methods: {
    onSquadEntered() {
      // Fires for whichever element finished entering the swap; only the squad
      // (currentLobby set) should unlock the bottom sections.
      if (this.currentLobby) this.squadReady = true;
    },
    matchName(match: any) {
      return (
        match.label ||
        `${match.lineup_1?.name ?? this.$t("common.tbd")} vs ${match.lineup_2?.name ?? this.$t("common.tbd")}`
      );
    },
    goToMatch(match: any) {
      this.$router.push({ name: "matches-id", params: { id: match.id } });
    },
    getStatusPriority(status: e_match_status_enum): number {
      switch (status) {
        case e_match_status_enum.Live:
          return 1;
        case e_match_status_enum.WaitingForServer:
          return 2;
        case e_match_status_enum.Veto:
          return 3;
        case e_match_status_enum.WaitingForCheckIn:
          return 4;
        default:
          return 999;
      }
    },
    selectLobby(matchId: string) {
      useMatchmakingStore().viewingMatchId = matchId;
    },
    joinGlobalMatchChat(match: any) {
      if (!match) return;
      const { openTab, setActiveTab } = useChatTabs();
      const id = `match:${match.id}`;
      openTab({
        id,
        label:
          match.label ||
          `${match.lineup_1?.name ?? this.$t("common.tbd")} vs ${match.lineup_2?.name ?? this.$t("common.tbd")}`,
        instance: "match",
        type: "match",
        lobbyId: match.id,
        pinned: true,
      });
      setActiveTab(id);
    },
    createLobby() {
      return useMatchmakingStore().createLobby();
    },
    async leaveCurrentLobby() {
      const lobby = this.currentLobby as any;
      if (!lobby || !this.me?.steam_id) return;

      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          delete_lobby_players_by_pk: [
            {
              lobby_id: lobby.id,
              steam_id: this.me.steam_id,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
};
</script>

<style scoped>
/* One clock for every fold in this column. Content-sized sections (invites,
   the voice card) collapse their grid row; spacing rides inside the clipped
   cell so no flex gap is left to snap when an element unmounts. Voice/chat
   stay gated on `squadReady` so they reveal after the squad has landed. */
.lobby-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.lobby-fold > * {
  overflow: hidden;
}
.lobby-fold-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* The chat dock is sized by flex, not by its content, so its reveal animates
   the flex sizing itself -- the squad area above shrinks continuously into
   the new distribution instead of losing the dock's share in one frame. */
.lobby-dock {
  transition:
    flex-basis 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    flex-grow 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
  overflow: hidden;
}
.lobby-dock-collapsed {
  flex-basis: 0px;
  flex-grow: 0;
  min-height: 0;
  max-height: none;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lobby-fold,
  .lobby-dock {
    transition-duration: 1ms;
  }
}
</style>
