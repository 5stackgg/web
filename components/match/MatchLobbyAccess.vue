<script setup lang="ts">
import { Lock, Unlock, Send, Handshake } from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <component
    :is="getIcon(match.options.lobby_access)"
    class="h-4 w-4"
    v-if="!match.is_organizer"
  />

  <Popover v-model:open="popoverOpen" v-else>
    <div class="flex gap-2">
      <div
        v-if="match.invite_code"
        class="flex py-1 pr-2 items-center bg-secondary rounded-md"
      >
        <ClipBoard :data="matchInviteLink" />
        <span class="text-sm font-medium">{{ match.invite_code }}</span>
      </div>

      <PopoverTrigger>
        <Button variant="outline" size="icon">
          <component
            :is="getIcon(match.options.lobby_access)"
            class="h-4 w-4"
          />
        </Button>
      </PopoverTrigger>
    </div>

    <PopoverContent>
      <div class="flex justify-center">
        <Button
          v-for="access in [
            e_lobby_access_enum.Open,
            e_lobby_access_enum.Friends,
            e_lobby_access_enum.Invite,
            e_lobby_access_enum.Private,
          ]"
          :key="access"
          @click="updateLobbyAccess(access)"
          :variant="
            match.options.lobby_access === access ? 'default' : 'outline'
          "
          size="sm"
          :class="{
            'rounded-r-none': access === e_lobby_access_enum.Open,
            'rounded-none border-x-0':
              access === e_lobby_access_enum.Invite ||
              access === e_lobby_access_enum.Friends,
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
    match: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      popoverOpen: false,
    };
  },
  computed: {
    matchInviteLink() {
      const currentRoute = new URL(window.location.href);
      currentRoute.search = "";
      const baseUrl = currentRoute.toString();
      return `${baseUrl}?invite=${this.match.invite_code}`;
    },
  },
  methods: {
    updateLobbyAccess(access: e_lobby_access_enum) {
      this.$apollo.mutate({
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: this.match.options.id,
              },
              _set: {
                lobby_access: access,
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
          return Lock;
        case e_lobby_access_enum.Invite:
          return Send;
        case e_lobby_access_enum.Open:
          return Unlock;
        case e_lobby_access_enum.Friends:
          return Handshake;
      }
    },
  },
};
</script>
