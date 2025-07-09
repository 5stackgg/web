<template>
  <slot
    :messages="messages"
    :is-minimized="isMinimized"
    :unread-count="unreadCount"
    :toggle-minimize="toggleMinimize"
    :send-message="sendMessage"
  />
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
    sendMessage(message: string) {
      socket.chat(
        this.type as "match" | "team" | "matchmaking",
        this.lobbyId,
        message,
      );
    },
    joinLobby() {
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
        },
      );
    },
    leaveLobby() {
      this.lobby?.leave();
      this.lobbyListener?.stop();
    },
  },
  watch: {
    lobbyId: {
      immediate: true,
      handler() {
        this.joinLobby();
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
    this.leaveLobby();
  },
};
</script>
