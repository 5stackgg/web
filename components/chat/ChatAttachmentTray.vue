<script setup lang="ts">
import { Film, RotateCw, Trash2 } from "lucide-vue-next";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import type { ChatTrayItem } from "~/utilities/chatAttachments";

defineProps<{ items: ChatTrayItem[] }>();

const emit = defineEmits<{
  remove: [key: string];
  retry: [key: string];
}>();

const ERRORS = [
  "too_large",
  "unsupported_type",
  "too_many_pending",
  "not_allowed",
  "gagged",
];

function errorKey(code?: string) {
  return `chat.attachments.errors.${ERRORS.includes(code ?? "") ? code : "unavailable"}`;
}
</script>

<template>
  <TransitionGroup
    tag="div"
    name="chat-tray"
    class="flex gap-2 overflow-x-auto p-2"
    data-chat-tray
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="relative w-24 shrink-0 rounded-md border p-1.5 transition-colors duration-200 motion-reduce:transition-none"
      :class="
        item.status === 'failed'
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-border/60 bg-card/40'
      "
    >
      <FadeSwap class="aspect-square w-full">
        <button
          v-if="item.status === 'failed'"
          key="failed"
          type="button"
          class="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
          :title="$t(errorKey(item.error))"
          @click="emit('retry', item.key)"
        >
          <RotateCw class="h-4 w-4" />
          <span
            class="font-mono text-[9px] font-semibold uppercase tracking-wide"
          >
            {{ $t("chat.attachments.retry") }}
          </span>
        </button>
        <div
          v-else
          key="media"
          class="relative aspect-square w-full overflow-hidden rounded bg-muted/40"
        >
          <img
            v-if="item.kind === 'image' && item.previewUrl"
            :src="item.previewUrl"
            alt=""
            class="h-full w-full object-cover"
          />
          <video
            v-else-if="item.kind === 'video' && item.previewUrl"
            :src="item.previewUrl"
            muted
            playsinline
            preload="metadata"
            class="h-full w-full object-cover"
          ></video>
          <span v-else class="flex h-full w-full items-center justify-center">
            <Film class="h-4 w-4 text-muted-foreground" />
          </span>
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
            leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
          >
            <div
              v-if="item.status === 'uploading'"
              class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded bg-black/55"
            >
              <span
                class="font-mono text-[0.65rem] tabular-nums text-[hsl(var(--tac-amber))]"
              >
                {{ Math.round(item.progress * 100) }}%
              </span>
              <div class="h-1 w-14 overflow-hidden rounded-full bg-white/15">
                <div
                  class="h-full bg-[hsl(var(--tac-amber))] transition-[width] duration-200 ease-out motion-reduce:transition-none"
                  :style="{ width: `${Math.round(item.progress * 100)}%` }"
                ></div>
              </div>
            </div>
          </Transition>
        </div>
      </FadeSwap>
      <p
        class="mt-1 truncate text-[10px]"
        :class="
          item.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
        "
      >
        {{ item.name }}
      </p>
      <button
        type="button"
        class="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-white/90 transition-colors duration-150 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
        :aria-label="$t('chat.attachments.remove', { name: item.name })"
        @click="emit('remove', item.key)"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.chat-tray-enter-active {
  transition:
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.24s ease-out;
}
.chat-tray-leave-active {
  transition:
    transform 0.16s ease-in,
    opacity 0.16s ease-in;
}
.chat-tray-enter-from,
.chat-tray-leave-to {
  transform: scale(0.9);
  opacity: 0;
}
.chat-tray-move {
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .chat-tray-enter-active,
  .chat-tray-leave-active,
  .chat-tray-move {
    transition-duration: 1ms;
  }
}
</style>
