<script setup lang="ts">
import { Handshake, Unlock, SendHorizontal } from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
</script>

<template>
  <component :is="getIcon(lobby.access)" class="h-4 w-4" v-if="!isCaptain" />

  <div
    class="relative group transition-transform hover:scale-110 hover:z-10"
    v-else
  >
    <Popover v-model:open="popoverOpen">
      <PopoverTrigger>
        <Button
          variant="outline"
          size="icon"
          class="rounded-full bg-secondary hover:bg-secondary/80 transition-colors duration-200"
        >
          <component :is="getIcon(lobby.access)" class="h-2 w-2" />
        </Button>
      </PopoverTrigger>

      <PopoverContent class="w-80">
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="font-medium text-sm">
              {{ $t("matchmaking.lobby.access") }}
            </h4>
            <p class="text-sm text-muted-foreground">
              {{ $t("matchmaking.lobby.access_description") }}
            </p>
          </div>

          <div class="flex justify-center">
            <Button
              v-for="access in [
                e_lobby_access_enum.Open,
                e_lobby_access_enum.Friends,
                e_lobby_access_enum.Invite,
              ]"
              :key="access"
              @click="updateLobbyAccess(access)"
              :variant="lobby.access === access ? 'default' : 'outline'"
              size="sm"
              :class="{
                'rounded-r-none': access === e_lobby_access_enum.Open,
                'rounded-none border-x-0':
                  access === e_lobby_access_enum.Friends,
                'rounded-l-none': access === e_lobby_access_enum.Invite,
              }"
            >
              <component :is="getIcon(access)" class="h-4 w-4 mr-2" />
              {{ access }}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

interface LobbyPlayer {
  player: {
    steam_id: string;
  };
  captain: boolean;
}

interface Lobby {
  id: string;
  access: e_lobby_access_enum;
  players: LobbyPlayer[];
}

export default {
  props: {
    lobby: {
      type: Object as () => Lobby,
      required: true,
    },
  },
  data() {
    return {
      popoverOpen: false,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isCaptain() {
      return (
        this.lobby?.players.find(
          ({ player }: LobbyPlayer) => player.steam_id === this.me.steam_id,
        )?.captain ?? false
      );
    },
  },
  methods: {
    async updateLobbyAccess(access: e_lobby_access_enum) {
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            update_lobbies_by_pk: [
              {
                pk_columns: {
                  id: this.lobby.id,
                },
                _set: {
                  access: access,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("matchmaking.lobby.access_updated", {
            access,
          }),
        });

        this.popoverOpen = false;
      } catch (error) {
        console.error("Failed to update lobby access:", error);
        toast({
          title: this.$t("error.generic"),
          variant: "destructive",
        });
      }
    },
    getIcon(access: e_lobby_access_enum) {
      switch (access) {
        case e_lobby_access_enum.Friends:
          return Handshake;
        case e_lobby_access_enum.Invite:
          return SendHorizontal;
        case e_lobby_access_enum.Open:
          return Unlock;
      }
    },
  },
};
</script>
