<script setup lang="ts">
import { PlusIcon, LogOut } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
</script>

<template>
  <div class="flex flex-col min-h-[220px] gap-3">
    <!-- Squad list -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div v-if="lobby?.players?.length" class="flex flex-col gap-1.5">
        <div
          v-for="slot in sortedPlayers"
          :key="slot.player.steam_id"
          class="group flex items-center gap-3 rounded-md px-2 py-1.5 border border-transparent hover:border-border hover:bg-muted/40 transition-colors"
        >
          <PlayerDisplay
            :player="slot.player"
            :showOnline="true"
            :showFlag="true"
            :showName="true"
            :showRole="true"
            :showElo="true"
            size="sm"
            class="shrink-0"
          >
            <template #avatar-sub v-if="slot.captain">
              <Badge
                variant="outline"
                class="hidden md:inline-flex text-[10px] px-1 py-0"
              >
                {{ $t("match.player.captain") }}
              </Badge>
            </template>
          </PlayerDisplay>

          <div class="flex items-center gap-2 mt-0.5">
            <span
              v-if="slot.status === 'Invited'"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              :class="statusClasses(slot.status)"
            >
              {{ slot.status }}
            </span>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <!-- Remove from lobby (captain only, not self) -->
            <Button
              v-if="
                (slot.status === 'Invited' || slot.status === 'Accepted') &&
                slot.player.steam_id !== me?.steam_id &&
                isCaptain
              "
              size="icon"
              variant="ghost"
              class="h-7 w-7 text-red-400 hover:text-red-200 hover:bg-red-900/50"
              @click="removeFromLobby(lobby.id, slot.player.steam_id)"
            >
              <LogOut class="h-3.5 w-3.5 rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex items-center justify-center py-6 text-[12px] text-zinc-500"
      >
        Waiting for players to join your lobby. Use the Invite button above to
        add friends.
      </div>

      <!-- Large invite button below members -->
      <div v-if="isCaptain" class="mt-3">
        <PlayerSearch
          :label="$t('matchmaking.lobby.invite_player')"
          :self="false"
          @selected="(player) => inviteToLobby(player.steam_id)"
          :registeredOnly="true"
          :exclude="lobby?.players.map((player) => player.player.steam_id)"
        >
          <Button
            variant="outline"
            class="w-full justify-center gap-2 border-dashed border-zinc-700 text-xs"
          >
            <PlusIcon class="h-3 w-3" />
            <span>{{ $t("matchmaking.lobby.invite_player") }}</span>
          </Button>
        </PlayerSearch>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lobby: {
      type: Object,
      required: true,
    },
  },
  emits: ["open-voice-settings", "open-discord-integration"],
  computed: {
    me() {
      return useAuthStore().me;
    },
    isCaptain() {
      const me = this.lobby?.players.find(({ player }: { player: any }) => {
        return this.me.steam_id === player.steam_id;
      });
      return me?.captain;
    },
    maxPlayersLabel() {
      // Fallback if max size is not available on the lobby object.
      return this.lobby?.max_players || "?";
    },
    sortedPlayers() {
      const players = [...(this.lobby?.players ?? [])];
      if (!this.me?.steam_id) return players;

      return players.sort((a: any, b: any) => {
        const meId = this.me.steam_id;
        const aIsMe = a.player.steam_id === meId;
        const bIsMe = b.player.steam_id === meId;
        if (aIsMe && !bIsMe) return -1;
        if (!aIsMe && bIsMe) return 1;
        return 0;
      });
    },
  },
  methods: {
    statusClasses(status: string) {
      switch (status) {
        case "Invited":
          return "bg-amber-500/10 text-amber-300 border border-amber-500/40";
        case "Accepted":
          return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40";
        default:
          return "bg-zinc-700/40 text-zinc-200 border border-zinc-600/60";
      }
    },
    openVoiceSettings() {
      this.$emit("open-voice-settings");
    },
    openDiscordIntegration() {
      this.$emit("open-discord-integration");
    },
    async inviteToLobby(steam_id: string) {
      await useMatchmakingStore().inviteToLobby(steam_id);
    },
    async removeFromLobby(lobby_id: string, steam_id: string) {
      this.$apollo.mutate({
        mutation: generateMutation({
          delete_lobby_players_by_pk: [
            {
              lobby_id,
              steam_id,
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
