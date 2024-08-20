<template>
  <div @click="viewPlayer" class="cursor-pointer text-left">
    <template v-if="member.player">
      <div class="grid grid-cols-[64px_1fr] items-center">
        <div class="mx-3 my-3 flex flex-col items-center">
          <PlayerDisplay :player="member.player">
            <Badge variant="outline" class="mt-3" v-if="member.captain">
              Captain
            </Badge>
          </PlayerDisplay>
        </div>
        <div class="ml-3">
          {{ member.player.name }}
          <span
            class="flex h-2 w-2 rounded-full"
            :class="{
              ['bg-red-600']: !isOnline && !isReady,
              ['bg-yellow-600']: isOnline && !isReady,
              ['bg-green-600']: isReady,
            }"
            v-if="
              match && match.status === e_match_status_enum.WaitingForCheckIn
            "
          ></span>
        </div>
      </div>
    </template>
    <template v-else>
      {{ member.name }}
    </template>
  </div>
</template>

<script lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

export default {
  components: {PlayerDisplay, Avatar, AvatarFallback, AvatarImage },
  props: {
    member: {
      type: Object,
      required: true,
    },
    match: {
      type: Object,
      required: false,
    },
  },
  methods: {
    viewPlayer() {
      this.$router.push(`/players/${this.member.steam_id}`);
    },
  },
  computed: {
    e_match_status_enum() {
      return e_match_status_enum;
    },
    lobby() {
      return useMatchLobbyStore().lobbies[this.$route.params.id];
    },
    isOnline() {
      return !!this.lobby?.get(this.member.player.steam_id);
    },
    isReady() {
      return this.member.checked_in;
    },
  },
};
</script>
