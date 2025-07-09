<template>
  <div
    v-if="variant === 'global' && !isMinimized"
    class="flex-1 overflow-y-auto p-3"
    ref="chatMessages"
  >
    <ChatMessage
      :message="message"
      :previous-message="messages[index - 1]"
      v-for="(message, index) in messages"
      :key="index"
    />
  </div>
  <div
    v-else-if="variant === 'embedded'"
    class="flex-1 overflow-y-auto max-h-screen"
    ref="chatMessages"
  >
    <ChatMessage
      :message="message"
      :previous-message="messages[index - 1]"
      v-for="(message, index) in messages"
      :key="index"
    />
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
  },
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
        this.isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      }
    },
    scrollToBottom(force = false) {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (chatMessages && (this.isAtBottom || force)) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    },
  },
  watch: {
    messages: {
      handler(current, prev) {
        this.$nextTick(() => {
          this.scrollToBottom(prev.length === 0);
        });
      },
      deep: true,
    },
  },
  mounted() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    if (chatMessages) {
      chatMessages.addEventListener("scroll", this.checkIfAtBottom);
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
