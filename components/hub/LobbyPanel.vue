<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Merge, Waves, MessageCircle, LogOut } from "lucide-vue-next";
import MatchLobbyExpanded from "~/components/matchmaking-lobby/MatchLobbyExpanded.vue";
import MatchmakingLobbyAccess from "~/components/matchmaking-lobby/MatchmakingLobbyAccess.vue";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import Empty from "~/components/ui/empty/Empty.vue";
import { useInvites } from "@/composables/useInvites";

const { t } = useI18n();
const { hasLobbyInvites } = useInvites();
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
    <div class="flex-1 px-3 pt-3 flex flex-col gap-4 overflow-hidden">
      <!-- Scrollable main content (invites + squad) -->
      <div class="flex-[3] min-h-0 flex flex-col gap-4 overflow-y-auto">
        <!-- Lobby invites -->
        <Transition name="lobby-item">
          <div v-if="hasLobbyInvites" class="flex flex-col gap-3">
            <div
              class="inline-flex items-center gap-[0.35rem] text-[0.68rem] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
            >
              <Merge class="h-3 w-3" />
              <span>{{ $t("layouts.lobby_panel.lobby_invites") }}</span>
            </div>
            <LobbyInvites />
            <Separator class="my-3 opacity-60" />
          </div>
        </Transition>

        <!-- Squad ↔ create-lobby swap -->
        <Transition name="lobby-swap" mode="out-in" @after-enter="onSquadEntered">
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
        </Transition>
      </div>

      <!-- Voice & Discord row just above lobby chat -->
      <Transition name="lobby-item">
        <div
          v-if="currentLobby && squadReady"
          class="border-t border-zinc-800 pt-3 mt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400"
        >
          <div class="flex items-center gap-2">
            <Waves class="h-3.5 w-3.5 text-indigo-400" />
            <span class="font-semibold tracking-wide uppercase">
              {{ $t("layouts.lobby_panel.voice_discord") }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              size="xs"
              :variant="hasDiscordLinked ? 'secondary' : 'outline'"
              class="h-7 gap-1 rounded-full border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800/80 text-[11px] px-3"
              :disabled="!supportsDiscordBot || hasDiscordLinked"
              @click="linkDiscord"
            >
              <MessageCircle class="h-3 w-3" />
              <span v-if="hasDiscordLinked">
                {{ $t("layouts.lobby_panel.discord_linked") }}
              </span>
              <span v-else>
                {{ $t("layouts.lobby_panel.link_discord") }}
              </span>
            </Button>
          </div>
        </div>
      </Transition>

      <!-- Dedicated bottom lobby chat area (~25% height) -->
      <Transition name="lobby-item">
        <div
          v-if="currentLobby && squadReady"
          class="h-[250px] lg:flex-[1] lg:h-auto lg:min-h-[160px] lg:max-h-[40%] shrink-0 border-t border-zinc-800 pt-3 flex flex-col gap-2"
        >
          <div
            class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide"
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
    supportsDiscordBot() {
      return useApplicationSettingsStore().supportsDiscordBot;
    },
    hasDiscordLinked() {
      return useAuthStore().hasDiscordLinked;
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
    linkDiscord() {
      const hasDiscordLinked = useAuthStore().hasDiscordLinked;
      if (hasDiscordLinked || !this.supportsDiscordBot) {
        return;
      }
      const config = useRuntimeConfig();
      const redirect = encodeURIComponent(window.location.toString());
      window.location.href = `https://${config.public.webDomain}/auth/discord?redirect=${redirect}`;
    },
  },
};
</script>

<style scoped>
/* Squad ↔ create-lobby crossfade */
.lobby-swap-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.lobby-swap-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}
.lobby-swap-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.lobby-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* Sections fading/sliding in (invites, voice, chat). Voice/chat are gated on
   `squadReady` so they only mount once the squad has entered — preventing the
   bottom from reserving layout (and popping in) before the top. */
.lobby-item-enter-active {
  transition:
    opacity 0.3s ease 0.04s,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.04s;
}
.lobby-item-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}
.lobby-item-enter-from,
.lobby-item-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
