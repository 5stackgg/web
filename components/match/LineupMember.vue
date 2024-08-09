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
         <span class="flex h-2 w-2 rounded-full" :class="{
          ['bg-red-600']: !isOnline,
          ['bg-yellow-600']: isOnline && !isReady,
          ['bg-green-600']: isOnline && isReady,
      }"></span>
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

export default {
  components: { Avatar, AvatarFallback, AvatarImage },
  props: {
    member: {
      type: Object,
      required: true,
    },
    lineup_id: {
      type: String,
      required: true,
    },
  },
  methods: {
    viewPlayer() {
      this.$router.push(`/players/${this.member.steam_id}`);
    },
  },
  computed: {
    lobby() {
      return useMatchLobbyStore().lobbies[this.$route.params.id];
    },
    isOnline() {
      return !!this.lobby?.get(this.member.player.steam_id);
    },
    isReady() {
      return false;
    }
  }
};
</script>
