<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ChatGifPickerPanel from "~/components/chat/ChatGifPickerPanel.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import type { ChatGif } from "~/utilities/chatAttachments";

const emit = defineEmits<{ select: [gif: ChatGif] }>();

const open = ref(false);

// The picker sits over the right hub, which closes itself when the pointer
// leaves it.
let holding = false;

watch(open, (value) => {
  if (value && !holding) {
    holding = true;
    useRightSidebar().suspendHoverClose();
  } else if (!value && holding) {
    holding = false;
    useRightSidebar().resumeHoverClose();
  }
});

onBeforeUnmount(() => {
  if (holding) {
    useRightSidebar().resumeHoverClose();
  }
});

function select(gif: ChatGif) {
  open.value = false;
  emit("select", gif);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-chat-gif
        class="inline-flex h-7 shrink-0 items-center self-center rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-[hsl(var(--tac-amber))] transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)/0.2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))] motion-reduce:transition-none"
        :aria-label="$t('chat.gifs.open')"
        @mousedown.prevent
      >
        {{ $t("chat.gifs.label") }}
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      side="top"
      :collision-padding="8"
      class="w-auto overflow-hidden p-0"
      data-right-hub-interactive
    >
      <ChatGifPickerPanel v-if="open" @select="select" />
    </PopoverContent>
  </Popover>
</template>
