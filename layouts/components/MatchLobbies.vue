<script lang="ts" setup>
import { ChevronDown, Merge } from "lucide-vue-next";
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

  <template v-if="currentLobby">
    <MatchLobby :lobby="currentLobby" />
  </template>

  <template v-else>
    <Button
      @click="createLobby"
      size="default"
      class="relative group h-12 overflow-hidden rounded bg-transparent px-5 text-white shadow-lg hover:shadow transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
    >
      <span
        class="absolute inset-0 rounded p-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
      >
        <span class="block h-full w-full bg-zinc-900/90"></span>
      </span>

      <span
        class="pointer-events-none absolute inset-0 rounded bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 ease-out"
      ></span>

      <div class="relative flex items-center gap-2 z-10">
        <Merge class="h-5 w-5 drop-shadow-sm" />
        <span class="font-semibold">Create Lobby</span>
      </div>
    </Button>
  </template>
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
    currentMatch() {
      if (!this.matchId) {
      }
      return (this.myMatches as any[]).find((match) => {
        return match.id === this.matchId;
      });
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
  },
};
</script>
