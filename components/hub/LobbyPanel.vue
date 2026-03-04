<script setup lang="ts">
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

const { hasLobbyInvites } = useInvites();
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
      <!-- Scrollable main content (invites + squad) -->
      <div class="flex-[3] min-h-0 flex flex-col gap-6 overflow-y-auto">
        <!-- Lobby invites -->
        <template v-if="hasLobbyInvites">
          <div class="flex flex-col gap-3">
            <div
              class="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2"
            >
              <Merge class="h-3 w-3 text-zinc-500" />
              <span>{{ $t("layouts.lobby_panel.lobby_invites") }}</span>
            </div>
            <LobbyInvites />
            <Separator class="my-3 opacity-60" />
          </div>
        </template>

        <!-- Matchmaking lobby -->
        <template v-if="currentLobby">
          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col gap-1">
                <div class="text-sm font-semibold text-zinc-200 tracking-wide">
                  {{ $t("layouts.lobby_panel.your_squad") }}
                </div>
                <p class="text-[11px] text-zinc-500">
                  {{ $t("layouts.lobby_panel.squad_description") }}
                </p>
              </div>
              <div class="flex items-center gap-2">
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
        </template>

        <!-- Create lobby — only when not in a lobby or match -->
        <template v-if="!currentLobby">
          <Empty class="px-4 pb-5 pt-4">
            <p class="text-sm text-zinc-400 text-center max-w-xs">
              {{ $t("layouts.lobby_panel.create_lobby_description") }}
            </p>
            <Button
              @click="createLobby"
              size="default"
              class="relative group overflow-hidden rounded-full bg-transparent px-7 py-2 text-white shadow-lg hover:shadow-md transition-all duration-300 focus-visible:outline-none border border-zinc-700/80"
            >
              <span
                class="absolute inset-0 rounded-full p-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
              >
                <span class="block h-full w-full bg-zinc-950/95 rounded-full" />
              </span>
              <span
                class="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
              <div class="relative flex items-center gap-2 z-10">
                <Merge class="h-5 w-5" />
                <span class="font-semibold">
                  {{ $t("layouts.lobby_panel.create_lobby_button") }}
                </span>
              </div>
            </Button>
          </Empty>
        </template>
      </div>

      <!-- Voice & Discord row just above lobby chat -->
      <template v-if="currentLobby">
        <div
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
      </template>

      <!-- Dedicated bottom lobby chat area (~25% height) -->
      <template v-if="currentLobby">
        <div
          class="flex-[1] min-h-[160px] max-h-[40%] border-t border-zinc-800 pt-3 flex flex-col gap-2"
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
      </template>
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
    };
  },
  watch: {
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
  },
  methods: {
    matchName(match: any) {
      return (
        match.label ||
        `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`
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
          `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`,
        instance: "match",
        type: "match",
        lobbyId: match.id,
        pinned: true,
      });
      setActiveTab(id);
    },
    createLobby() {
      useMatchmakingStore().createLobby();
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
