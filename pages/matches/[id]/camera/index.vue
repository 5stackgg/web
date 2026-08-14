<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Button } from "~/components/ui/button";
import {
  LucideShieldCheck,
  LucideSwitchCamera,
  LucideVideo,
} from "lucide-vue-next";
import DeviceSelect from "~/components/media/DeviceSelect.vue";
import TopoBackground from "@/layouts/components/TopoBackground.vue";
import CameraStatusBar from "~/components/camera/CameraStatusBar.vue";
import CameraStage from "~/components/camera/CameraStage.vue";
import CameraTalkback from "~/components/camera/CameraTalkback.vue";
import CameraMediaOverlay from "~/components/camera/CameraMediaOverlay.vue";
import CameraMicRow from "~/components/camera/CameraMicRow.vue";
import CameraTeamVoiceRow from "~/components/camera/CameraTeamVoiceRow.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import { useAudioSettings } from "~/composables/useAudioSettings";
import { useMicPipeline } from "~/composables/useMicPipeline";
import { useCameraPipeline } from "~/composables/useCameraPipeline";
import { useCameraPublisher } from "~/composables/useCameraPublisher";
import { useCameraTalkback } from "~/composables/useCameraTalkback";
import { cameraPlayerPublishUrl } from "~/composables/useCameraApi";

definePageMeta({
  layout: false,
});

const PREVIEW_KEY = "5stack:camera:preview";

const route = useRoute();
const matchId = computed(() => String(route.params.id));

const stageRef = ref<InstanceType<typeof CameraStage> | null>(null);

const publisher = useCameraPublisher();
const { phase, errorMessage } = publisher;

const talkback = useCameraTalkback(() => matchId.value);
const { talking, muted: talkMuted } = talkback;

// The microphone goes through exactly the same pipeline as a voice channel:
// same device choice, same noise suppression, same gate, same mic check. An
// organizer listening to a camera feed is listening to a player's microphone,
// so there is no reason for it to behave differently here.
const audioSettings = useAudioSettings();
const mic = useMicPipeline({
  onTrack: (track) => {
    void publisher.replaceAudio(track);
  },
});

const camera = useCameraPipeline({
  onTrack: (track) => {
    // While cropping, the canvas is the published surface and this is only the
    // source it draws from -- swapping the sender would publish the raw camera
    // and throw the player's framing away.
    if (stageRef.value?.isCropping()) {
      return;
    }

    void publisher.replaceVideo(track);
  },
});
const {
  devices: cameras,
  realDevices: realCameras,
  deviceId: cameraDeviceId,
  canFlip,
  pending: mediaPending,
  errorKind: mediaErrorKind,
} = camera;

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Private browsing — the choice just won't persist.
  }
}

const previewHidden = ref(readStored(PREVIEW_KEY) === "hidden");

// Hiding is only ever offered as a way to save the player's machine some work
// once they are already live. During setup the preview is always on -- framing
// yourself is the whole point of the step, and a stored "hidden" from an
// earlier match must not leave someone setting up against a blank stage.
const previewVisible = computed(
  () => phase.value !== "connected" || !previewHidden.value,
);

function togglePreview() {
  previewHidden.value = !previewHidden.value;
  writeStored(PREVIEW_KEY, previewHidden.value ? "hidden" : null);
}

// Metered while they are still setting up, so the indicator moves as they talk
// and they can tell the microphone works before going live. Once live it costs
// nothing until they open the settings, which turns it back on for the meter.
function syncMetering() {
  mic.setMetering(phase.value !== "connected" && previewVisible.value);
}

watch([phase, previewVisible], syncMetering);

// Local only -- nothing is published until they press connect. Framing, device
// and zoom are all things you want settled before you are on the broadcast.
async function startPreview() {
  // Asked for together so the browser prompts once, then split: the camera
  // stays with its pipeline and the microphone goes to the one that gates,
  // meters and owns it -- the same one a voice channel uses.
  const opened = await camera.start({
    audio: audioSettings.micConstraints(),
    onAudio: (audio) => mic.start(audio),
    forgetAudioDevice: () => audioSettings.setMicDevice(""),
    rememberedAudioDevice: () => audioSettings.micDeviceId.value,
  });

  if (!opened) {
    return;
  }

  syncMetering();
  await stageRef.value?.adopt();
}

async function setCamera(deviceId: string) {
  if (await camera.setDevice(deviceId)) {
    await stageRef.value?.adopt();
    return;
  }

  if (!camera.stream()) {
    await startPreview();
  }
}

async function flipCamera() {
  if (await camera.flip()) {
    await stageRef.value?.adopt();
  }
}

async function connect() {
  if (!camera.stream()) {
    await startPreview();
  }

  if (!camera.stream()) {
    return;
  }

  // The already-running preview is what goes live, cropped exactly as they left
  // it. The microphone comes off the pipeline rather than the camera stream, so
  // what the organizer hears is what the mic check played back.
  const connected = await publisher.connect(
    cameraPlayerPublishUrl(matchId.value),
    {
      video: stageRef.value?.croppedTrack() ?? camera.track(),
      audio: mic.track(),
    },
    "include",
  );

  if (connected) {
    // Only start watching for a call now: the connect click was the user
    // gesture that lets the incoming stream play with audio.
    talkback.start();
  }
}

// Held whole rather than destructured: a `$apollo` binding in `<script setup>`
// collides with the property vue-apollo's global mixin sets on every instance,
// and the failed proxy write takes the whole app down on boot.
const nuxtApp = useNuxtApp();
const myLineupId = ref<string | null>(null);
// Who can watch this feed depends on the match. The page has to say so before
// anyone points a camera at themselves, and "match officials" alone stopped
// being the whole answer once teammate viewing became reachable.
const allowTeammates = ref(false);
const voiceEnabled = computed(
  () => useApplicationSettingsStore().voiceChatMatchesEnabled,
);

// The route names a match, not a team, so the lineup has to be looked up. The
// session is guaranteed here -- the route requires a login -- but this stays
// best effort, and the control simply does not appear if it comes back empty.
async function resolveMyLineup() {
  if (!useAuthStore().me) {
    return;
  }

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      fetchPolicy: "network-only",
      query: generateQuery({
        matches_by_pk: [
          { id: matchId.value },
          {
            id: true,
            lineup_1: {
              id: true,
              is_on_lineup: true,
              coach: { steam_id: true },
            },
            lineup_2: {
              id: true,
              is_on_lineup: true,
              coach: { steam_id: true },
            },
            options: { camera_allow_teammates: true },
          },
        ],
      }),
    });

    const match = (data as any)?.matches_by_pk;

    allowTeammates.value = match?.options?.camera_allow_teammates === true;
    const mySteamId = useAuthStore().me?.steam_id;

    // Coaches are on this page too, and talking to the side they coach is the
    // whole job, so `is_on_lineup` alone would have left them the one person
    // here with a camera and no way to reach their team.
    myLineupId.value =
      [match?.lineup_1, match?.lineup_2].find(
        (lineup: any) =>
          lineup?.is_on_lineup ||
          (mySteamId && lineup?.coach?.steam_id === mySteamId),
      )?.id ?? null;
  } catch {
    // Not signed in on this device, or not on this match. Either way there is
    // no channel to offer.
  }
}

onMounted(() => {
  void camera.refreshDevices();
  void startPreview();
  void resolveMyLineup();
});
</script>

<template>
  <!-- layout: false drops the app shell, so the standard background comes in
       explicitly rather than leaving this page on flat black. -->
  <TopoBackground />

  <div
    class="relative z-10 flex min-h-screen flex-col overflow-hidden text-foreground"
  >
    <main
      class="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-4 py-6"
    >
      <CameraStatusBar
        :phase="phase"
        :preview-visible="previewVisible"
        @toggle-preview="togglePreview"
      />

      <CameraStage
        ref="stageRef"
        :pipeline="camera"
        :preview-visible="previewVisible"
        :interactive="!mediaErrorKind && !mediaPending"
        @output-track="publisher.replaceVideo"
      >
        <template #overlay>
          <CameraTalkback
            :el="talkback.talkEl"
            :talking="talking"
            :muted="talkMuted"
            @toggle-audio="talkback.toggleAudio"
          />

          <CameraMediaOverlay
            :pending="mediaPending"
            :error-kind="mediaErrorKind"
            @retry="startPreview"
          />
        </template>
      </CameraStage>

      <p
        class="text-center font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground/70"
      >
        {{ $t("camera.reframe_gesture") }}
      </p>

      <DeviceSelect
        v-if="realCameras.length > 1"
        :icon="LucideVideo"
        :devices="cameras"
        :model-value="cameraDeviceId"
        :active="true"
        @update:model-value="setCamera"
      />

      <Button
        v-if="canFlip"
        class="w-full"
        variant="outline"
        size="sm"
        @click="flipCamera"
      >
        <LucideSwitchCamera class="h-3.5 w-3.5" />
        {{ $t("camera.flip") }}
      </Button>

      <CameraMicRow
        v-if="!mediaErrorKind"
        :pipeline="mic"
        @closed="syncMetering"
      />

      <CameraTeamVoiceRow
        v-if="myLineupId && !mediaErrorKind && voiceEnabled"
        :pipeline="mic"
        :lineup-id="myLineupId"
      />

      <template v-if="phase !== 'connected'">
        <Button
          class="w-full"
          size="lg"
          variant="tactical"
          :loading="phase === 'connecting'"
          :disabled="!!mediaErrorKind || mediaPending"
          @click="connect"
        >
          <LucideVideo class="h-4 w-4" />
          {{ $t("camera.connect") }}
        </Button>

        <p
          v-if="phase === 'error' && errorMessage"
          class="break-words text-center font-mono text-[11px] leading-relaxed text-destructive"
        >
          {{ errorMessage }}
        </p>

        <p
          class="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground/70"
        >
          <LucideShieldCheck class="mt-px h-3.5 w-3.5 shrink-0" />
          {{ $t("camera.permission_hint") }}
        </p>
      </template>

      <p
        class="border-t pt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70"
      >
        {{
          allowTeammates ? $t("camera.reason_teammates") : $t("camera.reason")
        }}
      </p>
    </main>
  </div>
</template>
