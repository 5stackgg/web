<script lang="ts" setup>
import MatchLobby from "./MatchLobby.vue";
</script>

<template>
  <div
    class="hidden md:flex h-9 items-center gap-2 rounded-sm border transition-colors bg-background"
    :class="{
      'flex-col h-auto': showSwitch,
      'cursor-pointer': canRoute,
      'hover:border-gray-600': canRoute,
    }"
    @click="goToMatch"
  >
    <div
      class="flex h-9 min-w-0 items-center justify-center gap-1 rounded-sm bg-accent/70 px-4 text-green-400 text-xs font-medium"
      :class="{
        'animate-pulse': pulse,
      }"
    >
      {{ match.e_match_status.description }}
    </div>

    <MatchLobby :match="match"></MatchLobby>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      required: true,
    },
    showSwitch: {
      default: false,
      type: Boolean,
    },
    pulse: {
      default: false,
      type: Boolean,
    },
  },
  methods: {
    goToMatch() {
      this.$router.push({
        name: "matches-id",
        params: { id: this.match.id },
      });
    },
  },
  computed: {
    canRoute() {
      return this.$route.params?.id !== this.match?.id;
    },
  },
};
</script>
