<script setup lang="ts">
import { ref, onScopeDispose } from "vue";
import { X, GripHorizontal } from "lucide-vue-next";
import CallGrid from "~/components/voice/CallGrid.vue";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

// The call, floating, for browsers with no Picture-in-Picture.
//
// Firefox and Safari report pictureInPictureEnabled false, so on those the
// pop-out was simply a button that did nothing. This is not the same thing --
// it cannot leave the browser or sit above a full-screen game, which is most of
// why the real one is worth having -- but it answers the need that is actually
// common: keeping the call in view while you read something else on the page.
//
// It draws the real tiles rather than compositing a canvas, because there is no
// stream to hand anyone here. That also means it costs nothing extra: the same
// <video> elements, the same peer connections.
defineProps<{
  participants: Array<VoiceParticipant>;
  peerVideo: Map<string, MediaStream>;
  localVideo: MediaStream | null;
  mySteamId: string | null;
  selfMuted: boolean;
  onToggleSelfMute?: () => void;
}>();

const emit = defineEmits<{ (e: "close"): void }>();

// Bottom-right by default, out of the way of the hub rail. Dragged position is
// deliberately not persisted: it is a transient window for a transient call.
const x = ref<number | null>(null);
const y = ref<number | null>(null);

let startX = 0;
let startY = 0;
let originX = 0;
let originY = 0;
let dragging = false;

function onMove(event: PointerEvent) {
  if (!dragging) {
    return;
  }

  // Clamped so it can never be dragged somewhere it cannot be dragged back
  // from -- a panel half off the top of the viewport has no grip left.
  const width = 288;
  const height = 200;

  x.value = Math.min(
    Math.max(8, originX + (event.clientX - startX)),
    window.innerWidth - width - 8,
  );
  y.value = Math.min(
    Math.max(8, originY + (event.clientY - startY)),
    window.innerHeight - height - 8,
  );
}

function onUp() {
  dragging = false;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
}

function onDown(event: PointerEvent) {
  const panel = (event.currentTarget as HTMLElement).closest(
    "[data-call-panel]",
  ) as HTMLElement | null;

  if (!panel) {
    return;
  }

  const box = panel.getBoundingClientRect();

  dragging = true;
  startX = event.clientX;
  startY = event.clientY;
  originX = box.left;
  originY = box.top;

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

onScopeDispose(onUp);
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-[opacity,transform] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      leave-to-class="opacity-0 translate-y-2 scale-95"
      appear
    >
      <div
        data-call-panel
        class="fixed z-[60] w-72 overflow-hidden rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur"
        :style="
          x === null
            ? { right: '1.5rem', bottom: '1.5rem' }
            : { left: `${x}px`, top: `${y}px` }
        "
      >
        <div
          class="flex cursor-grab items-center gap-2 border-b border-border/60 bg-background/40 px-2.5 py-1.5 active:cursor-grabbing"
          @pointerdown="onDown"
        >
          <GripHorizontal class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span
            class="min-w-0 flex-1 truncate font-sans text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ $t("voice.call.floating_title") }}
          </span>
          <button
            type="button"
            class="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            :aria-label="$t('voice.call.pop_in')"
            @click="emit('close')"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>

        <div class="p-2">
          <CallGrid
            :participants="participants"
            :peer-video="peerVideo"
            :local-video="localVideo"
            :my-steam-id="mySteamId"
            :self-muted="selfMuted"
            :on-toggle-self-mute="onToggleSelfMute"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
