import { ref, computed, watch, onScopeDispose } from "vue";
import QRCode from "qrcode";
import {
  cameraPlayerJoinUrl,
  cameraPlayerPath,
  fetchCameraStatus,
} from "~/composables/useCameraApi";

// Everything needed to get a player's camera publishing: the QR/popup links,
// and whether the feed has actually gone live. Shared so the blocking overlay
// and the check-in prompt behave identically.
//
// There is no token to wait for any more -- the link is just the match's camera
// page, and whoever opens it signs in. `enabled` is still worth having: a
// caller can mount this before it knows whether the match wants cameras at all
// (the check-in card builds one per match), and a match with camera_required
// off should not be polling readiness every 1.5s for as long as the page is
// open.
export function useCameraSetup(
  matchId: () => string,
  enabled: () => boolean = () => true,
) {
  const qrDataUrl = ref<string | null>(null);
  const ready = ref(false);
  // Distinguishes "not connected" from "we have not looked yet", so a player
  // who already connected never sees a flash of the blocking state.
  const checked = ref(false);

  const joinUrl = computed(() => cameraPlayerJoinUrl(matchId()));

  // The poll re-arms from inside its own await, so clearing the pending timer is
  // not enough to stop it -- a request already in flight when the scope disposes
  // would schedule the next one and run for the life of the tab.
  let stopped = false;
  let running = false;

  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  async function pollStatus() {
    if (stopped) {
      return;
    }

    ready.value = (await fetchCameraStatus(matchId())).ready;
    checked.value = true;

    if (stopped) {
      return;
    }

    statusTimer = setTimeout(pollStatus, 1500);
  }

  watch(
    joinUrl,
    async (url) => {
      qrDataUrl.value = url
        ? await QRCode.toDataURL(url, { width: 260, margin: 1 })
        : null;
    },
    { immediate: true },
  );

  // Same origin as the tab that opened it, rather than the configured web
  // domain: you are already on the app, and pointing at another deployment
  // means the popup can land somewhere that has not shipped this page yet.
  //
  // Landscape on purpose: the join page picks portrait or landscape capture
  // from the window's own orientation, so a narrow popup would ask a landscape
  // webcam for a portrait frame and letterbox it.
  function openOnThisComputer() {
    window.open(
      cameraPlayerPath(matchId()),
      "camera-connect",
      "width=900,height=700",
    );
  }

  function stop() {
    stopped = true;
    running = false;
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    // Deliberately does not close the popup: it is the thing publishing the
    // camera, and it has to outlive whatever opened it.
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    stopped = false;

    void pollStatus();
  }

  watch(
    enabled,
    (on) => {
      if (on) {
        start();
        return;
      }

      stop();
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return { joinUrl, qrDataUrl, ready, checked, openOnThisComputer, stop };
}
