import { ref, computed, watch, onScopeDispose } from "vue";
import gql from "graphql-tag";
import { useQuery } from "@vue/apollo-composable";
import QRCode from "qrcode";
import { cameraPlayerJoinUrl, fetchCameraStatus } from "~/composables/useCameraApi";

const MY_CAMERA_TOKEN = gql`
  query MyCameraToken($matchId: uuid!) {
    match_camera_tokens(where: { match_id: { _eq: $matchId } }, limit: 1) {
      token
    }
  }
`;

// Everything needed to get a player's camera publishing: their own token, the
// QR/popup links built from it, and whether the feed has actually gone live.
// Shared so the blocking overlay and the check-in prompt behave identically.
export function useCameraSetup(matchId: () => string) {
  const { result, refetch } = useQuery<{
    match_camera_tokens: Array<{ token: string }>;
  }>(MY_CAMERA_TOKEN, () => ({ matchId: matchId() }), {
    fetchPolicy: "network-only",
  });

  const token = computed(
    () => result.value?.match_camera_tokens?.[0]?.token ?? null,
  );

  const qrDataUrl = ref<string | null>(null);
  const ready = ref(false);
  // Distinguishes "not connected" from "we have not looked yet", so a player
  // who already connected never sees a flash of the blocking state.
  const checked = ref(false);

  const joinUrl = computed(() =>
    token.value ? cameraPlayerJoinUrl(matchId(), token.value) : null,
  );

  // A plain polling loop rather than watch(token): the row is minted
  // server-side, so this can start before it exists, and a watch does not
  // re-fire on undefined -> undefined — one miss would wedge it until reload.
  let tokenTimer: ReturnType<typeof setTimeout> | null = null;
  function pollForToken() {
    if (token.value) {
      return;
    }

    tokenTimer = setTimeout(async () => {
      await refetch();
      pollForToken();
    }, 1500);
  }

  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  async function pollStatus() {
    if (!token.value) {
      statusTimer = setTimeout(pollStatus, 1500);
      return;
    }

    ready.value = (await fetchCameraStatus(token.value)).ready;
    checked.value = true;

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

  // Landscape on purpose: the join page picks portrait or landscape capture
  // from the window's own orientation, so a narrow popup would ask a landscape
  // webcam for a portrait frame and letterbox it.
  function openOnThisComputer() {
    if (joinUrl.value) {
      window.open(joinUrl.value, "camera-connect", "width=900,height=700");
    }
  }

  function stop() {
    if (tokenTimer) {
      clearTimeout(tokenTimer);
      tokenTimer = null;
    }
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    // Deliberately does not close the popup: it is the thing publishing the
    // camera, and it has to outlive whatever opened it.
  }

  pollForToken();
  void pollStatus();

  onScopeDispose(stop);

  return { token, joinUrl, qrDataUrl, ready, checked, openOnThisComputer, stop };
}
