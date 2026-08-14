<script setup lang="ts">
import { ref, computed } from "vue";
import { LucideMic } from "lucide-vue-next";
import VoiceSettingsButton from "~/components/voice/VoiceSettingsButton.vue";
import type { MicPipeline } from "~/composables/useMicPipeline";

// The organizer hears this feed, so the microphone gets the same setup the party
// hub gives it: device, mic check, sensitivity, output and noise suppression.
// Reachable before going live rather than after discovering the wrong mic
// mid-match.
const props = defineProps<{ pipeline: MicPipeline }>();

defineEmits<{ (e: "closed"): void }>();

const settingsRef = ref<{ open: () => void } | null>(null);

// Both setup rows are the hit area, not the control inside them: on a phone,
// held one-handed, a 28px icon next to a two-line label is the wrong target.
function open() {
  settingsRef.value?.open();
}

const dotOpacity = computed(
  () => 0.25 + Math.min(1, props.pipeline.inputLevel.value * 4) * 0.75,
);
</script>

<template>
  <div
    class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2 transition-colors hover:border-border/80 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    role="button"
    tabindex="0"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors"
        :class="
          pipeline.live.value
            ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
            : 'border-border bg-muted/40 text-muted-foreground'
        "
      >
        <LucideMic class="h-3.5 w-3.5" />
        <span
          v-if="pipeline.live.value"
          class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 transition-opacity duration-75"
          :style="{ opacity: dotOpacity }"
        ></span>
      </span>

      <div class="flex min-w-0 flex-col">
        <span class="truncate text-xs font-medium">
          {{ $t("camera.mic") }}
        </span>
        <span class="truncate text-[10px] text-muted-foreground">
          {{ $t("camera.mic_hint") }}
        </span>
      </div>
    </div>

    <!-- The gear stays as the affordance -- the row is the hit area, but
         nothing on screen would say so without it. -->
    <span class="shrink-0" @click.stop>
      <VoiceSettingsButton
        ref="settingsRef"
        :pipeline="pipeline"
        keep-alive
        class="h-8 w-8"
        @closed="$emit('closed')"
      />
    </span>
  </div>
</template>
