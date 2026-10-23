<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { CheckCircle2 } from "lucide-vue-next";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import SystemUpdate from "./SystemUpdate.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import SystemStatus from "./SystemStatus.vue";
import DraftRoomNav from "./DraftRoomNav.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import MobileHubButton from "./MobileHubButton.vue";
import HistoryBackButton from "./HistoryBackButton.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { signInWithSteam } from "~/utilities/loginLinks";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useMatchReadyModal } from "~/composables/useMatchReadyModal";

// Signed-in only, and they carry the lobby, quick queue and practice panel
// with them: a visitor who is not signed in never downloads any of that.
const MatchLobbies = defineAsyncComponent(() => import("./MatchLobbies.vue"));
// Not suspensible: almost nobody holds a practice server, so the root Suspense
// must not keep the pre-loader up waiting for a chip that renders nothing.
const UtilityPracticeNav = defineAsyncComponent({
  loader: () => import("~/components/utility/UtilityPracticeNav.vue"),
  suspensible: false,
});

const { isMobile } = useSidebar();
const authStore = useAuthStore();
const matchmakingStore = useMatchmakingStore();
const { openMatchReadyModal } = useMatchReadyModal();

// Genuine matchmaking ready-check only. Active matches (Veto/Live/etc.) are
// already surfaced by the lineup pills in <MatchLobbies>.
const pendingCheckIn = computed(() => {
  const confirmation = matchmakingStore.joinedMatchmakingQueues?.confirmation;
  if (!confirmation || confirmation.matchId) return null;
  return confirmation;
});
</script>

<template>
  <header
    class="flex h-[60px] shrink-0 items-center gap-2 transition-[width] ease-linear bg-background sticky top-0 z-50"
  >
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger class="shrink-0" />
        <HistoryBackButton v-if="isMobile" />
        <Separator orientation="vertical" class="h-4 shrink-0" />
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex items-center gap-4 shrink-0">
        <template v-if="authStore.me">
          <button
            v-if="pendingCheckIn"
            type="button"
            class="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
            :aria-label="$t('matchmaking.check_in')"
            @click="openMatchReadyModal()"
          >
            <span class="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
              ></span>
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
              ></span>
            </span>
            <CheckCircle2 class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">{{
              $t("matchmaking.check_in")
            }}</span>
            <span class="tabular-nums">
              {{ pendingCheckIn.confirmed }}/{{ pendingCheckIn.players }}
            </span>
          </button>

          <UtilityPracticeNav v-if="!isMobile" />

          <DraftRoomNav v-if="!isMobile"></DraftRoomNav>

          <MatchLobbies v-if="!isMobile"></MatchLobbies>
        </template>

        <SystemUpdate v-if="isAdmin"></SystemUpdate>

        <SystemStatus></SystemStatus>

        <MobileHubButton v-if="authStore.me" />

        <!-- On a phone the nav's sign-in card sits behind the menu button, so
             a visitor gets the way in up here too. -->
        <button
          v-if="!authStore.me && isMobile"
          type="button"
          class="inline-flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.18),hsl(var(--tac-amber)/0.07))] px-2.5 text-xs font-semibold transition-transform duration-150 active:scale-[0.97]"
          @click="signInWithSteam()"
        >
          <SteamIcon class="h-3.5 w-3.5 fill-current" />
          {{ $t("pages.play.matchmaking.sign_in") }}
        </button>
      </div>
    </div>
  </header>
</template>

<script lang="ts">
export default {
  computed: {
    isAdmin() {
      return useAuthStore().isAdmin;
    },
  },
};
</script>
