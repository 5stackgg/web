<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  LucideCheckCircle2,
  LucideLoader2,
  LucideMonitor,
} from "lucide-vue-next";

defineProps<{
  token: string | null;
  qrDataUrl: string | null;
  ready: boolean;
}>();

const emit = defineEmits<{ (e: "openOnThisComputer"): void }>();
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="ready"
      class="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-6 text-center"
    >
      <LucideCheckCircle2 class="h-6 w-6 text-emerald-400" />
      <p class="text-sm font-medium text-emerald-400">
        {{ $t("camera.connected") }}
      </p>
      <p class="text-xs text-muted-foreground">
        {{ $t("camera.keep_open") }}
      </p>
    </div>

    <template v-else>
      <div
        class="flex flex-col items-center gap-3 rounded-xl border bg-card/40 p-4"
      >
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("camera.scan") }}
        </span>

        <div
          class="flex h-[172px] w-[172px] items-center justify-center rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-white p-2"
        >
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            alt=""
            class="h-full w-full"
          />
          <LucideLoader2 v-else class="h-5 w-5 animate-spin text-zinc-400" />
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
            {{ token ? $t("camera.waiting") : $t("camera.preparing") }}
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
        :disabled="!token"
        @click="emit('openOnThisComputer')"
      >
        <LucideMonitor class="h-3.5 w-3.5" />
        {{ $t("camera.choose_pc") }}
      </Button>
    </template>
  </div>
</template>
