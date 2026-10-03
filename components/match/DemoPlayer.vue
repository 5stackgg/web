<script setup lang="ts">
import { computed, ref } from "vue";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import DesktopSnapshot from "~/components/match/DesktopSnapshot.vue";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";
import StreamStatusPanel from "~/components/match/StreamStatusPanel.vue";
import StreamBootStatus from "~/components/match/StreamBootStatus.vue";
import DemoPlaybackControls from "~/components/match/DemoPlaybackControls.vue";
import ClipEditorBar from "~/components/clips/ClipEditorBar.vue";
import { Button } from "~/components/ui/button";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useWhepStatusCopy } from "~/composables/useWhepStatusCopy";
import { useClipEditor } from "~/composables/useClipEditor";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const props = defineProps<{
  matchMapId: string;
  isOrganizer: boolean;
}>();

const { store, skipShaders } = useDemoPlayback();
const editor = useClipEditor();
const authStore = useAuthStore();

const skippingShaders = ref(false);
function onSkipShaders() {
  if (skippingShaders.value) return;
  skippingShaders.value = true;
  skipShaders();
}
// Boot stage names, the pod desktop and skip-shaders are operator info —
// streamer+ only. (`/stream-deck/*` already has middleware/streamer.ts; the
// demo page has no middleware, so we gate inline.) Everyone else sees the
// replay caption with a step count.
const canSeeBoot = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.streamer),
);

const { copyFor } = useWhepStatusCopy();
// The route param is a sentinel in /demo/dev attach mode; the store holds
// the resolved id once the session starts.
const replayMapId = computed(() =>
  props.matchMapId === "dev" ? store.matchMapId : props.matchMapId,
);

// Replays aren't latency-bound the way a live match is — a seek already
// takes cs2 a second or two — so spend 150ms of buffer on even frame
// pacing instead of rendering every frame the instant it decodes.
const DEMO_JITTER_BUFFER_MS = 150;

const whepUrl = computed(() => {
  if (!store.streamUrl) return null;
  // streamUrl is the HLS base; translate to WHEP on the same host.
  return store.streamUrl.replace(/\/?$/, "/whep");
});

function closeWindow() {
  window.close();
  // Bounce home if the close was rejected (page wasn't opened via window.open).
  setTimeout(() => {
    if (!window.closed) {
      window.location.href = "/";
    }
  }, 50);
}
</script>

<template>
  <div class="flex flex-col bg-black h-full min-h-0">
    <!-- Revealed at `playing`, but the WebRTC handshake starts at `live`
         (the pod is already publishing its loading screen), so the
         picture is up the moment the boot screen fades. -->
    <StreamCanvas
      :whep-url="whepUrl"
      :fallback-url="store.streamUrl"
      :is-live="store.isPlaying"
      :preconnect="store.isLive"
      :jitter-buffer-ms="DEMO_JITTER_BUFFER_MS"
      mode="demo"
      :show-boot="true"
      class="flex-1 min-h-0"
    >
      <template #status="{ phase, message, retry }">
        <StreamMatchCard :match-map-id="replayMapId">
          <StreamStatusPanel
            :title="copyFor(phase).title"
            :hint="phase === 'failed' ? message : copyFor(phase).hint"
            :tone="copyFor(phase).tone"
            :progress="copyFor(phase).progress"
          >
            <template v-if="phase === 'failed'" #actions>
              <Button size="sm" @click="retry">
                {{ $t("match.stream.try_again") }}
              </Button>
            </template>
          </StreamStatusPanel>
        </StreamMatchCard>
      </template>

      <template #boot>
        <StreamMatchCard :match-map-id="replayMapId">
          <template v-if="canSeeBoot && store.sessionRow?.id" #corner>
            <DesktopSnapshot
              kind="demo"
              :id="store.sessionRow.id"
              class="absolute right-4 top-16 w-72 overflow-hidden rounded-[3px] border border-border/50 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.85)] max-sm:hidden"
            />
          </template>
          <!-- `status` is the unified surface from the store (sessionRow
               .status when present, else localStatus) so there's no
               dead-air frame between page mount and the first sub tick. -->
          <StreamBootStatus
            mode="demo"
            :status="store.isErrored ? 'errored' : store.status"
            :error-message="
              store.sessionRow?.error_message ?? store.errorMessage
            "
            :last-status-at="store.sessionRow?.last_status_at"
            :histories="[store.sessionRow?.status_history || []]"
            :title="$t('match.stream.loading_replay')"
            :failed-title="$t('match.stream.replay_failed')"
            :show-stage="canSeeBoot"
            :can-skip="canSeeBoot"
            :skipping="skippingShaders"
            @skip="onSkipShaders"
          >
            <template #actions="{ errored }">
              <Button size="sm" variant="outline" @click="closeWindow">
                {{ errored ? $t("common.close") : $t("common.cancel") }}
              </Button>
            </template>
          </StreamBootStatus>
        </StreamMatchCard>
      </template>
    </StreamCanvas>

    <Transition name="editor-fade">
      <ClipEditorBar
        v-if="store.isPlaying && editor.active.value && store.matchMapId"
        :match-map-id="store.matchMapId"
        class="shrink-0"
      />
    </Transition>

    <Transition name="controls-fade">
      <DemoPlaybackControls v-if="store.isPlaying" class="shrink-0" />
    </Transition>
  </div>
</template>

<style scoped>
/* Short, opacity-only fades: the bars arrive with the picture instead of
   sliding in after it. */
.controls-fade-enter-active {
  transition: opacity 150ms ease;
}
.controls-fade-enter-from {
  opacity: 0;
}

.editor-fade-enter-active,
.editor-fade-leave-active {
  transition: opacity 150ms ease;
}
.editor-fade-enter-from,
.editor-fade-leave-to {
  opacity: 0;
}
</style>
