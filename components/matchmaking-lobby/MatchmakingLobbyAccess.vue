<script setup lang="ts">
import { Lock, Unlock } from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
</script>

<template>
  <component
    :is="getIcon(lobby.access)"
    class="h-4 w-4"
    v-if="!lobby.is_captain"
  />

  <Popover v-model:open="popoverOpen" v-else>
    <div class="flex gap-2">
      <PopoverTrigger>
        <Button variant="outline" size="icon">
          <component :is="getIcon(lobby.access)" class="h-4 w-4" />
        </Button>
      </PopoverTrigger>
    </div>

    <PopoverContent>
      <div class="flex justify-center">
        <Button
          v-for="access in [
            e_lobby_access_enum.Open,
            e_lobby_access_enum.Invite,
            e_lobby_access_enum.Private,
          ]"
          :key="access"
          @click="updateLobbyAccess(access)"
          :variant="lobby.access === access ? 'default' : 'outline'"
          size="sm"
          :class="{
            'rounded-r-none': access === e_lobby_access_enum.Open,
            'rounded-none border-x-0': access === e_lobby_access_enum.Invite,
            'rounded-l-none': access === e_lobby_access_enum.Private,
          }"
        >
          <component :is="getIcon(access)" class="h-4 w-4 mr-2" />
          {{ access }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    lobby: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      popoverOpen: false,
    };
  },
  methods: {
    updateLobbyAccess(access: e_lobby_access_enum) {
      this.$apollo.mutate({
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
        title: `Lobby access set to ${access}`,
      });

      this.popoverOpen = false;
    },
    getIcon(access: e_lobby_access_enum) {
      switch (access) {
        case e_lobby_access_enum.Private:
        case e_lobby_access_enum.Invite:
          return Lock;
        case e_lobby_access_enum.Open:
          return Unlock;
        default:
          return Lock;
      }
    },
  },
};
</script>
