<script setup lang="ts">
import { LucideVolume2, LucideVolumeX } from "lucide-vue-next";
import type { Ref } from "vue";

// The element itself belongs to useCameraTalkback -- it owns the peer
// connection that fills it -- so it is handed down and bound by function ref
// rather than declared here.
const props = defineProps<{
  el: Ref<HTMLVideoElement | null>;
  talking: boolean;
  muted: boolean;
}>();

defineEmits<{ (e: "toggle-audio"): void }>();

function bind(el: Element | null) {
  props.el.value = (el as HTMLVideoElement | null) ?? null;
}
</script>

<template>
  <div
    v-show="talking"
    class="absolute right-2 top-2 z-20 w-1/3 overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.5)] bg-black shadow-lg"
  >
    <div class="relative aspect-video">
      <video
        :ref="bind"
        class="absolute inset-0 h-full w-full object-contain"
        autoplay
        playsinline
      ></video>
    </div>

    <div
      class="flex items-center justify-between gap-1 border-t border-[hsl(var(--tac-amber)/0.35)] px-1.5 py-1"
    >
      <span
        class="truncate font-mono text-[0.5rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("camera.talk_label") }}
      </span>
      <button
        type="button"
        class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
        :aria-label="muted ? $t('camera.talk_unmute') : $t('camera.talk_mute')"
        :title="muted ? $t('camera.talk_unmute') : $t('camera.talk_mute')"
        @click="$emit('toggle-audio')"
      >
        <component
          :is="muted ? LucideVolumeX : LucideVolume2"
          class="h-2.5 w-2.5"
        />
      </button>
    </div>
  </div>
</template>
