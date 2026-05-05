<script setup lang="ts">
import { computed } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import DemoPlaybackControls from "~/components/match/DemoPlaybackControls.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import ClipEditorBar from "~/components/clips/ClipEditorBar.vue";
import { Button } from "~/components/ui/button";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useClipEditor } from "~/composables/useClipEditor";

// `meta` controls non-emission rendering — see StreamSessionProgress.vue.
const DEMO_STAGES = [
  { key: "booting", label: "Allocating GPU", meta: "required" as const },
  {
    key: "downloading_cs2",
    label: "Downloading CS2",
    meta: "conditional" as const,
  },
  {
    key: "launching_steam",
    label: "Launching Steam",
    meta: "required" as const,
  },
  { key: "logging_in", label: "Logging in", meta: "implicit" as const },
  {
    key: "downloading_demo",
    label: "Downloading demo",
    meta: "required" as const,
  },
  {
    key: "downloading_workshop_map",
    label: "Downloading workshop map",
    meta: "conditional" as const,
  },
  { key: "launching_cs2", label: "Launching CS2", meta: "required" as const },
  {
    key: "connecting_to_game",
    label: "Loading demo into CS2",
    meta: "required" as const,
  },
  // `playing` is intentionally omitted — WHEP mounts at that moment.
  { key: "live", label: "Demo Loading", meta: "required" as const },
];

defineProps<{
  matchMapId: string;
  isOrganizer: boolean;
}>();

const { store } = useDemoPlayback();
const editor = useClipEditor();

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
    <div class="relative flex-1 min-h-0 w-full">
      <Transition name="boot-live" mode="out-in">
        <WhepPlayer
          v-if="store.isPlaying && whepUrl"
          key="live"
          :whep-url="whepUrl"
          :fallback-url="store.streamUrl"
          class="absolute inset-0"
        />

        <div
          v-else
          key="boot"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 py-8"
        >
          <template v-if="store.sessionRow && !store.isErrored">
            <StreamSessionProgress
              :status="store.status"
              :error-message="store.sessionRow?.error_message"
              :last-status-at="store.sessionRow?.last_status_at"
              :status-history="store.sessionRow?.status_history || []"
              :stages="DEMO_STAGES"
              header-label="Demo session boot"
            />
            <Button size="sm" variant="ghost" @click="closeWindow">
              Cancel
            </Button>
          </template>

          <template v-else-if="store.localStatus === 'starting'">
            <StreamSessionProgress
              status="booting"
              :stages="DEMO_STAGES"
              header-label="Demo session boot"
            />
          </template>

          <template
            v-else-if="store.isErrored || store.localStatus === 'error'"
          >
            <StreamSessionProgress
              status="errored"
              :error-message="
                store.sessionRow?.error_message ?? store.errorMessage
              "
              :last-status-at="store.sessionRow?.last_status_at"
              :status-history="store.sessionRow?.status_history || []"
              :stages="DEMO_STAGES"
              header-label="Demo session boot"
            />
            <Button size="sm" variant="outline" @click="closeWindow">
              Close
            </Button>
          </template>
        </div>
      </Transition>
    </div>

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
.boot-live-enter-active,
.boot-live-leave-active {
  transition:
    opacity 350ms ease,
    transform 350ms ease;
}
.boot-live-enter-from {
  opacity: 0;
  transform: scale(1.02);
}
.boot-live-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

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
