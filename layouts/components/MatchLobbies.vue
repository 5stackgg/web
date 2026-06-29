<script lang="ts" setup>
import { ChevronDown, Merge, Play } from "lucide-vue-next";
import MatchLobbySelector from "./MatchLobbySelector.vue";
import MatchLobby from "~/components/matchmaking-lobby/MatchLobby.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const isElevatedUser = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer),
);
</script>

<template>
  <div v-if="currentMatch" class="flex items-center">
    <MatchLobbySelector
      :match="currentMatch"
      :pulse="true"
      :class="{ 'rounded-r-none border-r-0': myMatches.length > 1 }"
    />

    <template v-if="myMatches.length > 1">
      <Popover v-model:open="choosingLobby">
        <PopoverTrigger>
          <Button
            variant="outline"
            size="default"
            class="h-12 px-3 rounded-l-none border-l"
            :class="{
              'bg-[#18181b]/95 border-zinc-700/70 hover:bg-[#020617]/95 hover:border-emerald-400/70':
                isElevatedUser,
              'bg-[#09090b]/95 border-zinc-900/90 hover:bg-black/95 hover:border-emerald-400/60':
                !isElevatedUser,
            }"
          >
            <ChevronDown class="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="p-2 flex flex-col gap-2 border-none">
          <template v-for="match in myMatches as any[]" :key="match.id">
            <MatchLobbySelector
              @click="selectLobby(match.id)"
              :match="match"
              :show-switch="true"
              :join-lobby="false"
              v-if="match.id !== (currentMatch as any)?.id"
            />
          </template>
        </PopoverContent>
      </Popover>
    </template>
  </div>

  <Transition name="lobby-nav" mode="out-in">
    <div v-if="currentLobby" key="lobby" class="flex items-center">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 scale-50 -translate-x-2"
        enter-to-class="opacity-100 scale-100 translate-x-0"
        leave-from-class="opacity-100 scale-100 translate-x-0"
        leave-to-class="opacity-0 scale-50 -translate-x-2"
      >
        <NuxtLink
          v-if="showPlayButton"
          to="/play"
          :title="$t('layouts.lobby_panel.find_match')"
          class="group/play relative isolate mr-2 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] no-underline [background:linear-gradient(135deg,var(--tac-amber-cta-from)_0%,hsl(var(--tac-amber))_50%,var(--tac-amber-cta-to)_100%)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_20px_-6px_hsl(var(--tac-amber)/0.6)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_12px_32px_-6px_hsl(var(--tac-amber)/0.8),0_0_24px_hsl(var(--tac-amber)/0.35)] active:translate-y-0"
        >
          <Play
            class="relative z-[1] h-4 w-4 fill-current transition-transform duration-300 group-hover/play:scale-110"
          />
          <span
            class="pointer-events-none absolute inset-0 z-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,hsl(0_0%_100%_/_0.4)_50%,transparent_100%)] transition-transform duration-500 group-hover/play:translate-x-full"
            aria-hidden="true"
          ></span>
        </NuxtLink>
      </Transition>

      <MatchLobby :lobby="currentLobby" />
    </div>

    <Button
      v-else
      key="create"
      variant="ghost"
      @click="createLobby"
      :loading="creatingLobby"
      size="default"
      class="relative group h-12 overflow-hidden rounded bg-transparent px-5 text-[hsl(var(--tac-amber))] shadow-lg hover:bg-transparent hover:text-[hsl(var(--tac-amber))] hover:shadow transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
    >
      <span
        class="absolute inset-0 rounded p-[1.5px] bg-[linear-gradient(135deg,hsl(40_58%_60%)_0%,hsl(33_62%_55%)_50%,hsl(24_56%_52%)_100%)]"
      >
        <span class="block h-full w-full rounded-[2.5px] bg-zinc-900/90"></span>
      </span>

      <span
        class="pointer-events-none absolute inset-0 rounded bg-[hsl(var(--tac-amber)/0.12)] opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 ease-out"
      ></span>

      <div class="relative flex items-center gap-2 z-10">
        <Merge class="h-5 w-5 drop-shadow-sm" />
        <span class="font-semibold">{{
          $t("layouts.lobby_panel.create_lobby_button")
        }}</span>
      </div>
    </Button>
  </Transition>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import { useChatTabs } from "~/composables/useChatTabs";
export default {
  data() {
    return {
      choosingLobby: false,
      playMatchFoundSound: useSound().playMatchFoundSound,
    };
  },
  watch: {
    myMatches: {
      immediate: true,
      handler() {
        if (this.myMatches.length === 0) {
          return;
        }

        const match = this.myMatches
          .sort((a: any, b: any) => {
            if (a.started_at && !b.started_at) {
              return -1;
            }
            if (!a.started_at && b.started_at) {
              return 1;
            }

            if (a.started_at && b.started_at) {
              const dateDiff =
                new Date(a.started_at).getTime() -
                new Date(b.started_at).getTime();
              if (dateDiff !== 0) {
                return dateDiff;
              }
            }

            return (
              this.getStatusPriority(a.status) -
              this.getStatusPriority(b.status)
            );
          })
          .at(0);

        if (!match) {
          return;
        }

        this.selectLobby((match as any).id);
      },
    },
    currentMatch: {
      immediate: true,
      handler(currentMatch: any, oldMatch: any) {
        if (!currentMatch || currentMatch?.id === oldMatch?.id) {
          return;
        }

        const current = this.currentMatch as any;

        switch (current?.status) {
          case e_match_status_enum.Veto:
          case e_match_status_enum.Live:
            if (oldMatch && currentMatch.status !== oldMatch.status) {
              this.playMatchFoundSound();
            }
            break;
          case e_match_status_enum.WaitingForCheckIn:
            const matchLineups = current.lineup_1.lineup_players.concat(
              current.lineup_2.lineup_players,
            );
            const meInMatch = matchLineups.find((lobby: any) => {
              return lobby.player.steam_id === this.me.steam_id;
            });

            if (meInMatch.checked_in === false) {
              this.playMatchFoundSound();
            }
            break;
        }

        // Automatically open the global match lobby chat when the user is in a match.
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
    creatingLobby() {
      return useMatchmakingStore().creatingLobby;
    },
    isLobbyLeader() {
      const lobby = this.currentLobby as any;
      const me = lobby?.players?.find((p: any) => {
        return p.player.steam_id === this.me?.steam_id;
      });
      return !!me?.captain;
    },
    showPlayButton() {
      return (
        this.isLobbyLeader &&
        (this.matchmakingAllowed || this.canCreateMatch) &&
        this.$route.name !== "play" &&
        this.myMatches.length === 0 &&
        !this.myDraftGame
      );
    },
    myDraftGame() {
      return useDraftGamesStore().myDraftGame;
    },
    matchmakingAllowed() {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
    currentMatch() {
      const matches = this.myMatches as any[];
      if (matches.length === 0) {
        return undefined;
      }
      // Honor an explicit selection (multi-match switcher), but always fall
      // back to the most relevant match so the selector renders whenever the
      // user is in a match — even before `viewingMatchId` has been set.
      return (
        matches.find((match) => match.id === this.matchId) ?? matches.at(0)
      );
    },
    onMatchPage() {
      return this.$route.path === `/matches/${this.currentMatch?.id}`;
    },
    matchId() {
      return useMatchmakingStore().viewingMatchId;
    },
  },
  methods: {
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
      this.choosingLobby = false;
      useMatchmakingStore().viewingMatchId = matchId;
    },
    joinGlobalMatchChat(match: any) {
      if (!match) {
        return;
      }

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
  },
};
</script>

<style scoped>
/* Header lobby nav: create-button ↔ lobby-bar swap */
.lobby-nav-enter-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.lobby-nav-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}
.lobby-nav-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
.lobby-nav-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}
</style>
