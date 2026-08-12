<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import gql from "graphql-tag";
import { useQuery } from "@vue/apollo-composable";
import QRCode from "qrcode";
import { Button } from "~/components/ui/button";
import {
  LucideArrowLeft,
  LucideLoader2,
  LucideMonitor,
  LucideSmartphone,
} from "lucide-vue-next";
import { cameraPlayerJoinUrl, fetchCameraStatus } from "~/composables/useCameraApi";

const props = defineProps<{
  matchId: string;
}>();

// The match page unmounts this component in response, which is what actually
// makes the overlay go away.
const emit = defineEmits<{ (e: "ready"): void }>();

const MY_CAMERA_TOKEN = gql`
  query MyCameraToken($matchId: uuid!) {
    match_camera_tokens(where: { match_id: { _eq: $matchId } }, limit: 1) {
      token
    }
  }
`;

const { result, refetch } = useQuery<{
  match_camera_tokens: Array<{ token: string }>;
}>(
  MY_CAMERA_TOKEN,
  { matchId: props.matchId },
  { fetchPolicy: "network-only" },
);

const token = computed(
  () => result.value?.match_camera_tokens?.[0]?.token ?? null,
);

const step = ref<"choose" | "mobile" | "pc">("choose");
const qrDataUrl = ref<string | null>(null);
const checked = ref(false);

const joinUrl = computed(() =>
  token.value ? cameraPlayerJoinUrl(props.matchId, token.value) : null,
);

// A plain polling loop rather than watch(token): the row is minted server-side
// once the match flips Live, so this can mount before it exists, and a watch
// does not re-fire on undefined -> undefined — one miss would wedge the overlay
// until a full reload.
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
pollForToken();

let statusTimer: ReturnType<typeof setTimeout> | null = null;
async function pollStatus() {
  if (!token.value) {
    statusTimer = setTimeout(pollStatus, 1500);
    return;
  }

  const { ready } = await fetchCameraStatus(token.value);
  checked.value = true;

  if (ready) {
    emit("ready");
    return;
  }

  statusTimer = setTimeout(pollStatus, 1500);
}
pollStatus();

watch(
  joinUrl,
  async (url) => {
    qrDataUrl.value = url
      ? await QRCode.toDataURL(url, { width: 260, margin: 1 })
      : null;
  },
  { immediate: true },
);

// Landscape on purpose: the join page picks portrait or landscape capture from
// the window's own orientation, so a narrow popup would ask a landscape webcam
// for a portrait frame and letterbox it.
function connectOnThisComputer() {
  step.value = "pc";

  if (joinUrl.value) {
    window.open(joinUrl.value, "camera-connect", "width=900,height=700");
  }
}

onBeforeUnmount(() => {
  if (tokenTimer) {
    clearTimeout(tokenTimer);
  }
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  // Deliberately not closing the popup: this component unmounts *because* the
  // camera connected, and that window has to survive the rest of the match.
});
</script>

<template>
  <!-- Held back until the first status check lands, so someone who connected
       earlier and reloaded never sees a flash of the blocking overlay. -->
  <div
    v-if="checked"
    class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
  >
    <div
      class="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg"
    >
      <h2 class="text-lg font-semibold">{{ $t("camera.title") }}</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ $t("camera.subtitle") }}
      </p>

      <div v-if="!token" class="mt-6 flex flex-col items-center gap-2">
        <LucideLoader2 class="h-5 w-5 animate-spin text-muted-foreground" />
        <p class="text-xs text-muted-foreground">
          {{ $t("camera.preparing") }}
        </p>
      </div>

      <template v-else-if="step === 'choose'">
        <div class="mt-6 flex flex-col gap-3">
          <Button class="w-full" @click="step = 'mobile'">
            <LucideSmartphone class="mr-2 h-4 w-4" />
            {{ $t("camera.choose_mobile") }}
          </Button>
          <Button
            class="w-full"
            variant="secondary"
            @click="connectOnThisComputer"
          >
            <LucideMonitor class="mr-2 h-4 w-4" />
            {{ $t("camera.choose_pc") }}
          </Button>
        </div>
      </template>

      <template v-else>
        <div class="mt-6 flex flex-col items-center gap-3">
          <template v-if="step === 'mobile'">
            <p class="text-sm">{{ $t("camera.scan") }}</p>
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt=""
              class="rounded-lg bg-white p-2"
            />
          </template>

          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <LucideLoader2 class="h-3.5 w-3.5 animate-spin" />
            {{ $t("camera.waiting") }}
          </div>

          <Button variant="ghost" size="sm" @click="step = 'choose'">
            <LucideArrowLeft class="mr-2 h-3.5 w-3.5" />
            {{ $t("camera.back") }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
