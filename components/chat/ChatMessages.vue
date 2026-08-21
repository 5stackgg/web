<template>
  <div
    v-if="variant !== 'global' || !isMinimized"
    ref="chatMessages"
    :class="
      variant === 'global'
        ? 'min-h-0 flex-1 overflow-y-auto p-3'
        : 'min-h-0 flex-1 overflow-y-auto'
    "
  >
    <!-- Changing the filter rewrites nearly every row, and animating those in
         and out against each other put two sets of text on the same pixels.
         The whole list leaves before the replacement arrives instead -- one
         thing on screen at a time, which is the only version that reads. -->
    <Transition
      mode="out-in"
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
      @after-enter="scrollToBottom(true)"
    >
      <!-- Keyed on the filter, so it swaps only when the filter does. A message
         merely arriving leaves the key alone and animates on its own below. -->
      <TransitionGroup
        :key="groupKey"
        tag="div"
        enter-from-class="opacity-0 translate-y-1"
        enter-active-class="transition duration-200 ease-out"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="hidden"
      >
        <div v-for="(message, index) in messages" :key="messageKey(message)">
          <div
            v-if="
              lastReadCount > 0 &&
              lastReadCount < messages.length &&
              index === lastReadCount
            "
            class="relative my-2 flex items-center text-[11px] text-red-400"
            data-new-divider="true"
          >
            <div class="flex-1 h-px bg-red-500/60"></div>
            <span
              class="mx-2 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/60"
            >
              {{ $t("chat.new_since_last_visit", "New") }}
            </span>
            <div class="flex-1 h-px bg-red-500/60"></div>
          </div>
          <ChatMessage
            :message="message"
            :previous-message="messages[index - 1]"
            :next-message="messages[index + 1]"
          />
        </div>
      </TransitionGroup>
    </Transition>
  </div>
</template>

<script lang="ts">
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { chatMessageKey } from "~/web-sockets/Socket";

export default {
  components: {
    ChatMessage,
  },
  props: {
    messages: {
      type: Array as () => any[],
      required: true,
    },
    variant: {
      type: String,
      default: "embedded",
      validator: (value: string) => ["global", "embedded"].includes(value),
    },
    isMinimized: {
      type: Boolean,
      default: false,
    },
    lastReadCount: {
      type: Number,
      default: 0,
    },
    // Changes when the surface is showing a different slice of the same room.
    // Constant everywhere that only ever shows one thing, which is every
    // surface but the merged match panel.
    groupKey: {
      type: String,
      default: "",
    },
  },
  emits: ["bottom-state-change"],
  data() {
    return {
      isAtBottom: false,
    };
  },
  methods: {
    messageKey(message: any) {
      return chatMessageKey(message);
    },
    checkIfAtBottom() {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (chatMessages) {
        const { scrollTop, scrollHeight, clientHeight } = chatMessages;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
        this.isAtBottom = atBottom;
        this.$emit("bottom-state-change", atBottom);
      }
    },
    scrollToBottom(force = false) {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (chatMessages && (this.isAtBottom || force)) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    },
    scrollToNewDivider() {
      if (
        this.lastReadCount <= 0 ||
        this.lastReadCount >= this.messages.length
      ) {
        return;
      }
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (!chatMessages) {
        return;
      }
      const divider = chatMessages.querySelector(
        "[data-new-divider='true']",
      ) as HTMLElement | null;
      if (!divider) {
        return;
      }
      // Measured rather than read off offsetTop: the transition group is a
      // positioned element now, so it -- not the scroller -- is the offset
      // parent, and offsetTop would be short by the scroller's padding.
      const offset =
        divider.getBoundingClientRect().top -
        chatMessages.getBoundingClientRect().top +
        chatMessages.scrollTop;
      const targetTop = offset - Math.max(0, chatMessages.clientHeight / 3);
      chatMessages.scrollTop = targetTop < 0 ? 0 : targetTop;
      this.checkIfAtBottom();
    },
  },
  watch: {
    messages: {
      handler(current, prev) {
        this.$nextTick(() => {
          this.scrollToBottom(prev.length === 0);
          this.checkIfAtBottom();
        });
      },
      deep: true,
    },
  },
  mounted() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    if (chatMessages) {
      chatMessages.addEventListener("scroll", this.checkIfAtBottom);
      this.checkIfAtBottom();
    }
  },
  beforeUnmount() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    if (chatMessages) {
      chatMessages.removeEventListener("scroll", this.checkIfAtBottom);
    }
  },
};
</script>
