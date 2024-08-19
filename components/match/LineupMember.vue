<template>
  <div @click="viewPlayer" class="cursor-pointer">
    <template v-if="member.player">
      <Avatar class="mx-3">
        <AvatarImage
          :src="member.player.avatar_url"
          :alt="member.player.name"
          v-if="member.player.avatar_url"
        />
        <AvatarFallback>{{ member.player.name }}</AvatarFallback>
      </Avatar>
      <div class="flex">
        <span
          class="flex h-2 w-2 rounded-full"
          :class="{
            ['bg-red-600']: !isOnline && !isReady,
            ['bg-yellow-600']: isOnline && !isReady,
            ['bg-green-600']: isReady,
          }"
          v-if="match && match.status === e_match_status_enum.WaitingForCheckIn"
        ></span>
        {{ member.player.name }}
      </div>
      <Badge variant="outline" v-if="member.captain"> Captain </Badge>
    </template>
    <template v-else>
      {{ member.name }}
    </template>
  </div>
</template>

<script lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { e_match_status_enum } from "~/generated/zeus";

export default {
  components: { Avatar, AvatarFallback, AvatarImage },
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
