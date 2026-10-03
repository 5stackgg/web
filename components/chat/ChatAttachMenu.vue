<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { ImagePlus, Plus } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ChatGifPickerPanel from "~/components/chat/ChatGifPickerPanel.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import type { ChatGif } from "~/utilities/chatAttachments";

// The one "+" in the composer. Without GIFs it opens the file dialog straight
// away; with them it asks which, and picking GIF swaps the menu for the picker
// in place so the text box keeps its width.
defineProps<{ gifs: boolean }>();

const emit = defineEmits<{ files: []; gif: [gif: ChatGif] }>();

const triggerClasses =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full bg-muted text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:text-foreground motion-reduce:transition-none";

const itemClasses =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none motion-reduce:transition-none";

const open = ref(false);
const view = ref<"menu" | "gifs">("menu");

// The menu sits over the right hub, which closes itself when the pointer
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

// One GIF per opening: the panel stays up through the close animation, where
// a second click would otherwise send it again. The view resets on the way in
// rather than the way out, so the picker does not flick back to the menu while
// it fades.
let picked = false;

watch(open, (value) => {
  if (value) {
    picked = false;
    view.value = "menu";
  }
});

// Still inside the click, so the file dialog is allowed to open.
function chooseFiles() {
  open.value = false;
  emit("files");
}

function select(gif: ChatGif) {
  if (picked) {
    return;
  }

  picked = true;
  open.value = false;
  emit("gif", gif);
}
</script>

<template>
  <button
    v-if="!gifs"
    type="button"
    data-chat-attach
    :class="triggerClasses"
    :aria-label="$t('chat.attachments.add')"
    @mousedown.prevent
    @click="emit('files')"
  >
    <Plus class="h-4 w-4" />
  </button>
  <Popover v-else v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-chat-attach
        :class="triggerClasses"
        :aria-label="$t('chat.attachments.menu')"
        @mousedown.prevent
      >
        <Plus class="h-4 w-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      side="top"
      :collision-padding="8"
      class="w-auto overflow-hidden p-0"
      data-right-hub-interactive
    >
      <div v-if="view === 'menu'" class="grid min-w-48 gap-0.5 p-1">
        <button
          type="button"
          data-chat-attach-files
          :class="itemClasses"
          @click="chooseFiles"
        >
          <ImagePlus class="h-4 w-4 text-muted-foreground" />
          {{ $t("chat.attachments.add") }}
        </button>
        <button
          type="button"
          data-chat-gif
          :class="itemClasses"
          @click="view = 'gifs'"
        >
          <span
            class="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] font-mono text-[0.4rem] font-bold uppercase leading-none text-[hsl(var(--tac-amber))]"
            aria-hidden="true"
          >
            {{ $t("chat.gifs.label") }}
          </span>
          {{ $t("chat.gifs.open") }}
        </button>
      </div>
      <ChatGifPickerPanel v-else @select="select" />
    </PopoverContent>
  </Popover>
</template>
