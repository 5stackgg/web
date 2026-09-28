import { watch } from "vue";
import {
  installTabFlash,
  trackBellCount,
  useTabFlash,
} from "~/composables/useTabFlash";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useNotificationStore } from "~/stores/NotificationStore";

// Flashes the tab's title and icon while it is hidden. Chat signals from the
// chat hooks themselves (useChatTabSetup, useIncomingDirectMessages) and an
// organizer call from useCameraTalkback; this owns what can be read off a
// store. Never touches the app badge, which follows the bell on its own.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    if (window.location.pathname.startsWith("/chat/")) {
      return;
    }

    installTabFlash();

    nuxtApp.runWithContext(() => {
      // A layout-less window the app opened (camera, replay, stream deck, the
      // match and file pop-outs) sits beside the main window, which already
      // alerts for everything a store can tell it. It keeps only what it
      // raises itself, like the camera page's organizer call.
      if (window.opener && useRoute().meta.layout === false) {
        return;
      }

      const flash = useTabFlash();
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

      trackBellCount(() => ({
        loaded: notificationStore.notificationsLoaded,
        count: notificationStore.unreadPersonalAlertCount,
      }));
    });
  });
});
