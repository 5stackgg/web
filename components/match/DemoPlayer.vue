<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";
import DemoPlaybackControls from "~/components/match/DemoPlaybackControls.vue";
import ClipEditorBar from "~/components/clips/ClipEditorBar.vue";
import { Button } from "~/components/ui/button";
import { useDemoPlayback } from "~/composables/useDemoPlayback";
import { useClipEditor } from "~/composables/useClipEditor";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

// `meta` controls non-emission rendering — see StreamSessionProgress.vue.
const DEMO_STAGES = computed(() => [
  {
    key: "booting",
    label: t("live_stages.booting"),
    meta: "required" as const,
  },
  {
    key: "downloading_demo",
    label: t("live_stages.downloading_demo"),
    meta: "required" as const,
    // Background curl in game-streamer.sh; run-demo.sh only blocks on
    // the file when it hits launching_cs2, so treat it as in-flight
    // until then.
    concurrentUntil: "launching_cs2",
  },
  {
    key: "downloading_cs2",
    label: t("live_stages.downloading_cs2"),
    meta: "conditional" as const,
  },
  {
    key: "launching_steam",
    label: t("live_stages.launching_steam"),
    meta: "required" as const,
  },
  {
    key: "logging_in",
    label: t("live_stages.logging_in"),
    meta: "implicit" as const,
  },
  {
    key: "downloading_workshop_map",
    label: t("live_stages.downloading_workshop_map"),
    meta: "conditional" as const,
  },
  {
    key: "launching_cs2",
    label: t("live_stages.launching_cs2"),
    meta: "required" as const,
  },
  {
    key: "connecting_to_game",
    label: t("live_stages.loading_demo_into_cs2"),
    meta: "required" as const,
  },
  // `playing` is intentionally omitted — WHEP mounts at that moment.
  {
    key: "live",
    label: t("live_stages.demo_loading"),
    meta: "required" as const,
  },
]);

defineProps<{
  matchMapId: string;
  isOrganizer: boolean;
}>();

const { store } = useDemoPlayback();
const editor = useClipEditor();
const authStore = useAuthStore();
// Boot pipeline is operator info — gate the stepper to streamer+.
// (`/stream-deck/*` already has middleware/streamer.ts; the demo page
// has no middleware, so we gate inline.)
const canSeeBoot = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.streamer),
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
      :stages="DEMO_STAGES"
      header-label="Demo session boot"
      :show-boot="true"
      class="flex-1 min-h-0"
    >
      <template #boot>
        <!-- Streamer+ only. The stepper exposes pod-internal stages
             (Allocating GPU, Launching Steam, …) — operator info, not
             viewer info. Regulars get an empty canvas until WHEP is
             actually publishing. -->
        <template v-if="canSeeBoot">
          <!-- One stepper, always rendered. `status` is the unified
             surface from the store (sessionRow.status when present,
             else localStatus) so we never get a dead-air frame between
             page mount and the first subscription tick. -->
          <StreamSessionProgress
            :status="store.status"
            :error-message="
              store.sessionRow?.error_message ?? store.errorMessage
            "
            :last-status-at="store.sessionRow?.last_status_at"
            :status-history="store.sessionRow?.status_history || []"
            :stages="DEMO_STAGES"
            header-label="Demo session boot"
          />
          <Button
            v-if="store.isErrored || store.localStatus === 'error'"
            size="sm"
            variant="outline"
            @click="closeWindow"
          >
            {{ $t("common.close") }}
          </Button>
          <Button v-else size="sm" variant="ghost" @click="closeWindow">
            {{ $t("common.cancel") }}
          </Button>
        </template>
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
