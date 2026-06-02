<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Monitor } from "lucide-vue-next";
import socket from "~/web-sockets/Socket";

type SnapshotKind = "live" | "demo" | "bake" | "clips";

const props = withDefaults(
  defineProps<{
    kind: SnapshotKind;
    id?: string | null;
    alt?: string;
    emptyLabel?: string;
    forceEmpty?: boolean;
    fallbackSeconds?: number;
  }>(),
  {
    id: null,
    alt: "",
    emptyLabel: "",
    forceEmpty: false,
    fallbackSeconds: 30,
  },
);

const baseUrl = computed<string | null>(() => {
  if (!props.id) return null;
  const apiDomain = useRuntimeConfig().public.apiDomain;
  if (!apiDomain) return null;
  return `https://${apiDomain}/snapshots/${props.kind}/${props.id}`;
});

const displayedSrc = ref<string | null>(null);
const hasLoaded = ref(false);

function poll() {
  const base = baseUrl.value;
  if (!base || typeof window === "undefined") return;
  const candidate = `${base}?b=${Date.now()}`;
  const probe = new Image();
  probe.referrerPolicy = "no-referrer";
  probe.onload = () => {
    displayedSrc.value = candidate;
    hasLoaded.value = true;
  };
  probe.src = candidate;
}

let timer: ReturnType<typeof setInterval> | null = null;
let listener: { stop: () => void } | null = null;

watch(baseUrl, () => {
  displayedSrc.value = null;
  hasLoaded.value = false;
  poll();
});

onMounted(() => {
  poll();
  timer = setInterval(poll, Math.max(5, props.fallbackSeconds) * 1000);
  listener = socket.listen("snapshot:updated", (data: any) => {
    if (data?.kind === props.kind && data?.id === props.id) {
      poll();
    }
  });
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  timer = null;
  if (listener) listener.stop();
  listener = null;
});
</script>

<template>
  <div class="relative aspect-video w-full overflow-hidden bg-background/60">
    <img
      v-show="hasLoaded && displayedSrc && !forceEmpty"
      :src="displayedSrc ?? undefined"
      :alt="alt"
      class="h-full w-full object-cover"
    />
    <div
      v-if="!hasLoaded || forceEmpty"
      class="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.5)_0%,hsl(var(--background))_70%)] text-muted-foreground/50"
    >
      <Monitor class="h-8 w-8" />
      <span class="text-[0.65rem] uppercase tracking-[0.14em]">
        {{ emptyLabel || $t("match.stream.no_preview") }}
      </span>
    </div>
    <slot />
  </div>
</template>
