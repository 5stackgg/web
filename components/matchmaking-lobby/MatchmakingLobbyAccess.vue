<script setup lang="ts">
import {
  ChevronDown,
  Handshake,
  Unlock,
  SendHorizontal,
} from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
</script>

<template>
  <!-- `labelled` (the /play seat row) names the setting beside its icon. -->
  <span
    v-if="!isCaptain && labelled"
    class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] text-muted-foreground"
  >
    <component :is="getIcon(lobby.access)" class="size-3.5" />
    {{ accessLabel(lobby.access) }}
  </span>
  <component
    :is="getIcon(lobby.access)"
    class="h-4 w-4"
    v-else-if="!isCaptain"
  />

  <div
    :class="
      labelled
        ? 'relative'
        : 'relative group transition-transform hover:scale-110 hover:z-10'
    "
    v-else
  >
    <Popover v-model:open="popoverOpen">
      <PopoverTrigger :as-child="labelled">
        <Button
          v-if="labelled"
          variant="outline"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-[12.5px] font-medium max-sm:px-2"
          :aria-label="`${$t('matchmaking.lobby.access')}: ${accessLabel(lobby.access)}`"
        >
          <component :is="getIcon(lobby.access)" class="size-3.5" />
          <span class="max-sm:hidden">{{ accessLabel(lobby.access) }}</span>
          <ChevronDown class="size-3 opacity-50" />
        </Button>
        <Button
          v-else
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
              {{ accessLabel(access) }}
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
    labelled: {
      type: Boolean,
      default: false,
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
            access: this.accessLabel(access),
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
    accessLabel(access: e_lobby_access_enum) {
      return this.$t(`matchmaking.lobby.access_values.${access}`);
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
