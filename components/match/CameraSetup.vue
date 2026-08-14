<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  LucideCheckCircle2,
  LucideLoader2,
  LucideMonitor,
} from "lucide-vue-next";

// No token any more -- the link is just the match's camera page, and whoever
// opens it signs in. The QR image is the only thing still built asynchronously,
// so it is what "not ready yet" now means.
defineProps<{
  qrDataUrl: string | null;
  ready: boolean;
}>();

const emit = defineEmits<{ (e: "openOnThisComputer"): void }>();
</script>

<template>
  <!-- Reserved height, and every state swaps inside it on opacity alone: the
       modal that hosts this must never resize while a transition runs. -->
  <div class="relative flex min-h-[21rem] flex-col justify-center">
    <Transition name="camera-fade">
      <div
        v-if="ready"
        key="ready"
        class="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-8 text-center"
      >
        <span class="relative mb-1 flex h-8 w-8 items-center justify-center">
          <span
            class="absolute inset-0 animate-ping rounded-full bg-emerald-500/25"
          ></span>
          <LucideCheckCircle2 class="relative h-7 w-7 text-emerald-400" />
        </span>
        <p class="text-sm font-medium text-emerald-400">
          {{ $t("camera.connected") }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ $t("camera.keep_open") }}
        </p>
      </div>

      <div v-else key="waiting" class="flex flex-col gap-4">
        <div
          class="flex flex-col items-center gap-3 rounded-xl border bg-card/40 p-4"
        >
          <span
            class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("camera.scan") }}
          </span>

          <div
            class="relative flex h-[172px] w-[172px] items-center justify-center rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-white"
          >
            <Transition name="camera-fade">
              <img
                v-if="qrDataUrl"
                key="qr"
                :src="qrDataUrl"
                alt=""
                class="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)]"
              />
              <LucideLoader2
                v-else
                key="pending"
                class="h-5 w-5 animate-spin text-zinc-400"
              />
            </Transition>
          </div>

          <div class="flex items-center gap-2">
            <span class="relative flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
              ></span>
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
              ></span>
            </span>
            <span
              class="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ qrDataUrl ? $t("camera.waiting") : $t("camera.preparing") }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="h-px flex-1 bg-border"></span>
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/60"
          >
            {{ $t("camera.or") }}
          </span>
          <span class="h-px flex-1 bg-border"></span>
        </div>

        <Button
          class="w-full"
          variant="ghost"
          size="sm"
          :disabled="!qrDataUrl"
          @click="emit('openOnThisComputer')"
        >
          <LucideMonitor class="h-3.5 w-3.5" />
          {{ $t("camera.choose_pc") }}
        </Button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.camera-fade-enter-active,
.camera-fade-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

/* The leaving state is taken out of flow so the two cross-fade in place
   instead of stacking and pushing the panel taller mid-transition. */
.camera-fade-leave-active {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.camera-fade-enter-from {
  opacity: 0;
  transform: scale(0.98);
}

.camera-fade-leave-to {
  opacity: 0;
  transform: scale(1.01);
}

@media (prefers-reduced-motion: reduce) {
  .camera-fade-enter-active,
  .camera-fade-leave-active {
    transition: opacity 120ms linear;
  }

  .camera-fade-enter-from,
  .camera-fade-leave-to {
    transform: none;
  }
}
</style>
