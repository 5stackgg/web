<script setup lang="ts">
import ChatHeader from "~/components/chat/ChatHeader.vue";
import ChatMessages from "~/components/chat/ChatMessages.vue";
import ChatInput from "~/components/chat/ChatInput.vue";
</script>

<template>
  <div>
    <Teleport to="#global-chat-container" v-if="global" defer>
      <div
        class="fixed bottom-4 right-4 w-80 bg-background border rounded-lg shadow-lg z-50 transition-all duration-300 ease-in-out flex flex-col"
        :class="{ 'h-12': isMinimized, 'h-96': !isMinimized }"
      >
        <ChatHeader
          variant="global"
          :is-minimized="isMinimized"
          :unread-count="unreadCount"
          @toggle-minimize="toggleMinimize"
        >
          <template #title>
            <slot name="chat-label">{{ $t("chat.lobby_chat") }}</slot>
          </template>
        </ChatHeader>
        <div
          v-if="!isMinimized"
          class="flex flex-col flex-1 transition-opacity duration-200"
          :class="{ 'opacity-0': isMinimized, 'opacity-100': !isMinimized }"
        >
          <ChatMessages
            ref="chatMessagesRef"
            :messages="messages"
            variant="global"
            :is-minimized="isMinimized"
          />
          <ChatInput variant="global" @send-message="handleSendMessage" />
        </div>
      </div>
    </Teleport>
    <div
      v-if="!global"
      class="relative flex min-h-[25vh] flex-col rounded-xl bg-muted/50 p-4"
    >
      <ChatHeader variant="embedded">
        <template #title>
          <slot name="chat-label">{{ $t("chat.lobby_chat") }}</slot>
        </template>
      </ChatHeader>
      <ChatMessages
        ref="chatMessagesRef"
        :messages="messages"
        variant="embedded"
      />
      <ChatInput variant="embedded" @send-message="handleSendMessage" />
    </div>
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import type { Lobby } from "~/web-sockets/Socket";

export default {
  props: {
    instance: {
      type: String,
      required: true,
    },
    lobbyId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      validator: (value: string) =>
        ["match", "team", "matchmaking"].includes(value),
    },
    global: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      messages: [] as any[],
      lobby: undefined as Lobby | undefined,
      lobbyListener: undefined as { stop: () => void } | undefined,
      isMinimized: false,
      unreadCount: 0,
      lastReadMessageCount: 0,
    };
  },
  methods: {
    updateLobbyMessages(newMessages: any) {
      this.messages = newMessages.sort((a: any, b: any) => {
        return a.timestamp - b.timestamp;
      });
    },
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
    },
    handleSendMessage(message: string) {
      socket.chat(
        this.type as "match" | "team" | "matchmaking",
        this.lobbyId,
        message,
      );
      this.$nextTick(() => {
        const chatMessagesRef = this.$refs.chatMessagesRef as any;
        chatMessagesRef?.scrollToBottom();
      });
    },
  },
  watch: {
    lobbyId: {
      immediate: true,
      handler() {
        this.lobby?.leave();
        this.lobby = socket.joinLobby(
          this.instance,
          this.type as "match" | "team" | "matchmaking",
          this.lobbyId,
        );
        this.updateLobbyMessages(this.lobby.messages);
        this.lobby.on("lobby:messages", this.updateLobbyMessages);
        this.lobbyListener = socket.listenChat(
          this.type,
          this.lobbyId,
          (message: any) => {
            this.messages.push(message);
            if (this.isMinimized && this.global) {
              this.unreadCount++;
            }
            this.$nextTick(() => {
              const chatMessagesRef = this.$refs.chatMessagesRef as any;
              chatMessagesRef?.scrollToBottom();
            });
          },
        );
      },
    },
    messages: {
      handler(current, prev) {
        this.$nextTick(() => {
          const chatMessagesRef = this.$refs.chatMessagesRef as any;
          chatMessagesRef?.scrollToBottom(prev.length === 0);
        });
      },
    },
    isMinimized: {
      handler(minimized) {
        if (!minimized) {
          this.unreadCount = 0;
          this.lastReadMessageCount = this.messages.length;
        } else {
          this.lastReadMessageCount = this.messages.length;
        }
      },
    },
  },
  beforeUnmount() {
    this.lobby?.leave();
    this.lobbyListener?.stop();
  },
};
</script>
