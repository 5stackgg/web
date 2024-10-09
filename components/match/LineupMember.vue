<template>
  <template v-if="member.player">
    <div @click="viewPlayer" class="cursor-pointer text-left">
      <PlayerDisplay :player="member.player">
        <template v-slot:avatar-sub>
          <Badge variant="outline" v-if="member.captain"> Captain </Badge>
        </template>

        <template v-slot:name-prefix>
          <span
            class="ml-1 inline-block h-2 w-2 rounded-full"
            :class="{
              ['bg-red-600']: !isOnline && !isReady,
              ['bg-yellow-600']: isOnline && !isReady,
              ['bg-green-600']: isReady,
            }"
            v-if="
              match && match.status === e_match_status_enum.WaitingForCheckIn
            "
          ></span>
        </template>
      </PlayerDisplay>
    </div>
  </template>
  <template v-else>
    <div class="ml-1 flex gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <NuxtImg
              src="/img/logos/discord.svg"
              alt="Discord"
              class="w-5 h-5"
            />
          </TooltipTrigger>
          <TooltipContent>
            This is a Discord user, register your discord id to enable stat
            tracking by typing <Badge variant="secondary">/link</Badge> in the
            officla discord channel.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {{ member.placeholder_name }}
    </div>
  </template>
</template>

<script lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { e_match_status_enum } from "~/generated/zeus";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

export default {
  components: { PlayerDisplay, Avatar, AvatarFallback, AvatarImage },
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
