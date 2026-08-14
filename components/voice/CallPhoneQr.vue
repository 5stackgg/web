<script setup lang="ts">
import { ref, computed, watch } from "vue";
import QRCode from "qrcode";

// A shortcut for typing a URL onto a phone, and nothing more.
//
// The code carries no credential: the page it points at is behind the ordinary
// login, so whoever scans it signs in to their own 5Stack account before the
// camera is offered. A screenshot of this is worth exactly as much as the link
// itself, which is nothing.
const props = defineProps<{ channelId: string }>();

const open = ref(false);
const dataUrl = ref<string | null>(null);

const joinUrl = computed(
  () =>
    `https://${useRuntimeConfig().public.webDomain}/call/${props.channelId}`,
);

watch(
  [open, joinUrl],
  async ([isOpen, url]) => {
    if (!isOpen) {
      return;
    }

    dataUrl.value = await QRCode.toDataURL(url, { width: 220, margin: 1 });
  },
  { immediate: true },
);

defineExpose({ toggle: () => (open.value = !open.value) });
</script>

<template>
  <div v-if="open" class="rounded-lg border border-border bg-card/40 p-3">
    <div class="flex flex-col items-center gap-2">
      <img
        v-if="dataUrl"
        :src="dataUrl"
        alt=""
        width="160"
        height="160"
        class="rounded-md border border-border bg-white p-1.5"
      />
      <p class="text-center text-[11px] leading-snug text-muted-foreground">
        {{ $t("voice.call.phone.scan") }}
      </p>
      <p
        class="text-center font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground/60"
      >
        {{ $t("voice.call.phone.scan_hint") }}
      </p>
    </div>
  </div>
</template>
