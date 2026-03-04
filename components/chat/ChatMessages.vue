<template>
  <div
    v-if="variant === 'global' && !isMinimized"
    class="flex-1 overflow-y-auto p-3"
    ref="chatMessages"
  >
    <template v-for="(message, index) in messages" :key="index">
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
      <ChatMessage :message="message" :previous-message="messages[index - 1]" />
    </template>
  </div>
  <div
    v-else-if="variant === 'embedded'"
    class="flex-1 overflow-y-auto max-h-screen"
    ref="chatMessages"
  >
    <template v-for="(message, index) in messages" :key="index">
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
      <ChatMessage :message="message" :previous-message="messages[index - 1]" />
    </template>
  </div>
</template>

<script lang="ts">
import ChatMessage from "~/components/chat/ChatMessage.vue";

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
  },
  emits: ["bottom-state-change"],
  data() {
    return {
      isAtBottom: false,
    };
  },
  methods: {
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
      const targetTop =
        divider.offsetTop - Math.max(0, chatMessages.clientHeight / 3);
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
