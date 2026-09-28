import { watch } from "vue";
import { installTabFlash, useTabFlash } from "~/composables/useTabFlash";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useNotificationStore } from "~/stores/NotificationStore";

// The bell's subscriptions start at zero and land a moment after sign-in, so a
// rise inside this window is the bell loading, not something new arriving.
const BELL_SETTLE_MS = 10_000;

// Flashes the tab's title and icon while it is hidden. Chat signals from the
// chat hooks themselves (useChatTabSetup, useIncomingDirectMessages) and an
// organizer call from useCameraTalkback; this owns everything that can be read
// off a store. Never touches the app badge, which follows the bell on its own.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    if (window.location.pathname.startsWith("/chat/")) {
      return;
    }

    installTabFlash();

    nuxtApp.runWithContext(() => {
      const flash = useTabFlash();
      const authStore = useAuthStore();
      const matchmakingStore = useMatchmakingStore();
      const notificationStore = useNotificationStore();

      watch(
        () => matchmakingStore.joinedMatchmakingQueues?.confirmation,
        (confirmation) => {
          if (
            !confirmation ||
            confirmation.isReady ||
            confirmation.matchId
          ) {
            flash.clear("match_found");
            return;
          }

          flash.signal("match_found", confirmation.confirmationId);
        },
        { immediate: true },
      );

      let bellSettlesAt = 0;
      let bellBaseline: number | null = null;
      let bellSignalled = 0;

      const takeBellBaseline = () => {
        bellBaseline = notificationStore.unreadNonChatNotificationCount;
        bellSignalled = 0;
      };

      watch(
        () => authStore.me?.steam_id,
        (steamId) => {
          bellSettlesAt = steamId ? Date.now() + BELL_SETTLE_MS : 0;
        },
        { immediate: true },
      );

      if (document.visibilityState === "hidden") {
        takeBellBaseline();
      }

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          takeBellBaseline();
          return;
        }

        bellBaseline = null;
      });

      // Only what arrived since the tab was hidden counts; a drop (read on
      // another device, or preferences loading) never flashes.
      watch(
        () => notificationStore.unreadNonChatNotificationCount,
        (count) => {
          if (bellBaseline === null) {
            return;
          }

          if (Date.now() < bellSettlesAt) {
            takeBellBaseline();
            return;
          }

          while (bellSignalled < count - bellBaseline) {
            bellSignalled += 1;
            flash.signal("bell");
          }
        },
      );
    });
  });
});
