<script setup lang="ts">
import { computed } from "vue";
import { Plus, Trophy } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { loginLinks } from "~/utilities/loginLinks";
import type { e_player_roles_enum } from "~/generated/zeus";

const authStore = useAuthStore();
const settingsStore = useApplicationSettingsStore();

const isGuest = computed(() => !authStore.me?.steam_id);
const canCreateMatch = computed(() => settingsStore.canCreateMatch);
const canCreateTournament = computed(() => {
  const role = settingsStore.tournamentCreateRole;
  return (
    !!authStore.me &&
    !!role &&
    authStore.isRoleAbove(role as e_player_roles_enum)
  );
});

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const primaryClasses =
  "bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]";
</script>

<template>
  <section class="grid gap-2 pb-4">
    <h2
      class="m-0 text-[clamp(1.375rem,2.4vw,1.875rem)] font-bold leading-tight [text-wrap:balance]"
    >
      {{ $t("pages.watch.cold_start.title") }}
    </h2>
    <p class="m-0 max-w-[62ch] text-sm text-muted-foreground">
      {{ $t("pages.watch.cold_start.description") }}
    </p>

    <div class="mt-2 flex flex-wrap gap-2">
      <Button
        v-if="isGuest"
        size="sm"
        :class="['hit', primaryClasses]"
        @click="signIn"
      >
        <SteamIcon class="h-4 w-4" />
        {{ $t("pages.watch.cold_start.sign_in") }}
      </Button>
      <template v-else>
        <Button
          v-if="canCreateMatch"
          as-child
          size="sm"
          :class="['hit', primaryClasses]"
        >
          <NuxtLink to="/matches/create">
            <Plus />
            {{ $t("pages.watch.cold_start.start_match") }}
          </NuxtLink>
        </Button>
        <Button
          v-if="canCreateTournament"
          as-child
          size="sm"
          variant="outline"
          class="hit"
        >
          <NuxtLink to="/tournaments/create">
            <Trophy />
            {{ $t("pages.watch.cold_start.create_tournament") }}
          </NuxtLink>
        </Button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: max(100%, 2.75rem);
    height: max(100%, 2.75rem);
    transform: translate(-50%, -50%);
  }
}
</style>
