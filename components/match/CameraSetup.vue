<script setup lang="ts">
import { ref } from "vue";
import { Button } from "~/components/ui/button";
import {
  LucideArrowLeft,
  LucideCheckCircle2,
  LucideLoader2,
  LucideMonitor,
  LucideSmartphone,
} from "lucide-vue-next";

defineProps<{
  token: string | null;
  qrDataUrl: string | null;
  ready: boolean;
}>();

const emit = defineEmits<{ (e: "openOnThisComputer"): void }>();

const step = ref<"choose" | "mobile" | "pc">("choose");
</script>

<template>
  <div class="space-y-4 text-center">
    <div v-if="ready" class="flex flex-col items-center gap-2 py-2">
      <LucideCheckCircle2 class="h-6 w-6 text-emerald-500" />
      <p class="text-sm font-medium text-emerald-500">
        {{ $t("camera.connected") }}
      </p>
      <p class="text-xs text-muted-foreground">
        {{ $t("camera.keep_open") }}
      </p>
    </div>

    <div v-else-if="!token" class="flex flex-col items-center gap-2 py-4">
      <LucideLoader2 class="h-5 w-5 animate-spin text-muted-foreground" />
      <p class="text-xs text-muted-foreground">
        {{ $t("camera.preparing") }}
      </p>
    </div>

    <template v-else-if="step === 'choose'">
      <div class="flex flex-col gap-3">
        <Button class="w-full" @click="step = 'mobile'">
          <LucideSmartphone class="mr-2 h-4 w-4" />
          {{ $t("camera.choose_mobile") }}
        </Button>
        <Button
          class="w-full"
          variant="secondary"
          @click="
            step = 'pc';
            emit('openOnThisComputer');
          "
        >
          <LucideMonitor class="mr-2 h-4 w-4" />
          {{ $t("camera.choose_pc") }}
        </Button>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col items-center gap-3">
        <template v-if="step === 'mobile'">
          <p class="text-sm">{{ $t("camera.scan") }}</p>
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            alt=""
            class="rounded-lg bg-white p-2"
          />
        </template>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <LucideLoader2 class="h-3.5 w-3.5 animate-spin" />
          {{ $t("camera.waiting") }}
        </div>

        <Button variant="ghost" size="sm" @click="step = 'choose'">
          <LucideArrowLeft class="mr-2 h-3.5 w-3.5" />
          {{ $t("camera.back") }}
        </Button>
      </div>
    </template>
  </div>
</template>
