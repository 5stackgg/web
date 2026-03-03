<script lang="ts" setup>
import QuickMatchLobby from "~/components/hub/QuickMatchLobby.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const isElevatedUser = computed(() =>
  useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer),
);
</script>

<template>
  <div
    class="hidden md:flex h-12 items-center gap-2 rounded-md border shadow-sm backdrop-blur-sm transition-all duration-150 py-1"
    :class="{
      'flex-col h-auto w-full p-2 gap-3': showSwitch,
      'cursor-pointer': canRoute,
      'border-zinc-700/70 bg-[#18181b]/95': isElevatedUser,
      'hover:border-emerald-400/70 hover:bg-[#020617]/95 hover:shadow-md':
        canRoute && isElevatedUser,
      'border-zinc-900/90 bg-[#09090b]/95': !isElevatedUser,
      'hover:border-emerald-400/60 hover:bg-black/95 hover:shadow-md':
        canRoute && !isElevatedUser,
    }"
    @click="goToMatch"
  >
    <div
      class="flex h-12 min-w-0 items-center justify-center gap-1 rounded-sm px-4 text-green-400 text-xs font-medium"
      :class="{
        'animate-pulse': pulse,
        'bg-accent/70': isElevatedUser,
        'bg-zinc-900/80': !isElevatedUser,
      }"
    >
      {{ match.e_match_status.description }}
    </div>

    <QuickMatchLobby :match="match" :join-lobby="joinLobby"></QuickMatchLobby>
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
    joinLobby: {
      default: true,
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
