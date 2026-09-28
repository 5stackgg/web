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
    <StreamCanvas
      :whep-url="whepUrl"
      :fallback-url="store.streamUrl"
      :is-live="store.isPlaying"
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

    <Transition name="editor-slide">
      <ClipEditorBar
        v-if="store.isPlaying && editor.active.value && store.matchMapId"
        :match-map-id="store.matchMapId"
        class="shrink-0"
      />
    </Transition>

    <Transition name="controls-slide">
      <DemoPlaybackControls v-if="store.isPlaying" class="shrink-0" />
    </Transition>
  </div>
</template>

<style scoped>
.controls-slide-enter-active {
  transition:
    opacity 300ms ease,
    transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.controls-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.editor-slide-enter-active,
.editor-slide-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.editor-slide-enter-from,
.editor-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
