<script lang="ts" setup>
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CornerDownLeft, MessageCircle, Minimize2 } from "lucide-vue-next";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
</script>

<template>
  <div>
    <Teleport to="#global-chat-container" v-if="global" defer>
      <div
        class="fixed bottom-4 right-4 w-80 bg-background border rounded-lg shadow-lg z-50 transition-all duration-300 ease-in-out flex flex-col"
        :class="{ 'h-12': isMinimized, 'h-96': !isMinimized }"
      >
        <div
          class="flex items-center justify-between p-3 cursor-pointer transition-opacity duration-200 flex-shrink-0"
          :class="{ 'border-b': !isMinimized }"
          @click="toggleMinimize"
        >
          <div class="flex items-center gap-2">
            <MessageCircle class="size-4 transition-transform duration-200" />
            <span class="text-sm font-medium">
              <slot name="chat-label">{{ $t("chat.lobby_chat") }}</slot>
            </span>
            <Badge
              v-if="unreadCount > 0 && isMinimized"
              variant="destructive"
              class="text-xs animate-pulse"
            >
              {{ unreadCount }}
            </Badge>
          </div>
          <Minimize2
            class="size-4 text-foreground transition-colors duration-200"
          />
        </div>

        <div
          v-if="!isMinimized"
          class="flex flex-col flex-1 transition-opacity duration-200"
          :class="{ 'opacity-0': isMinimized, 'opacity-100': !isMinimized }"
        >
          <div class="flex-1 overflow-y-auto p-3" ref="chatMessages">
            <ChatMessage
              :message="message"
              :previous-message="messages[index - 1]"
              v-for="(message, index) in messages"
              :key="index"
            ></ChatMessage>
          </div>

          <form
            class="border-t bg-background p-3 flex-shrink-0"
            @submit.prevent="sendMessage"
          >
            <FormField v-slot="{ componentField }" name="message">
              <FormItem>
                <FormControl>
                  <div class="flex gap-2">
                    <Input
                      :placeholder="$t('chat.message_placeholder')"
                      v-bind="componentField"
                      class="flex-1 transition-all duration-200 focus:scale-[1.02]"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      class="transition-all duration-200 hover:scale-105"
                    >
                      <CornerDownLeft class="size-3.5" />
                    </Button>
                  </div>
                </FormControl>
              </FormItem>
            </FormField>
          </form>
        </div>
      </div>
    </Teleport>

    <div
      v-if="!global"
      class="relative flex min-h-[25vh] flex-col rounded-xl bg-muted/50 p-4"
    >
      <div class="absolute right-3 top-3">
        <div class="flex">
          <Badge variant="secondary">
            <slot name="chat-label">{{ $t("chat.lobby_chat") }}</slot>
          </Badge>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto max-h-screen" ref="chatMessages">
        <ChatMessage
          :message="message"
          :previous-message="messages[index - 1]"
          v-for="(message, index) in messages"
          :key="index"
        ></ChatMessage>
      </div>

      <form
        class="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
        @submit.prevent="sendMessage"
      >
        <FormField v-slot="{ componentField }" name="message">
          <FormItem>
            <FormControl>
              <div class="p-3 flex justify-between">
                <Input
                  :placeholder="$t('chat.message_placeholder')"
                  v-bind="componentField"
                  class="resize-none border-0 p-3 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" size="sm" class="ml-auto gap-1.5">
                  <CornerDownLeft class="size-3.5" />
                </Button>
              </div>
            </FormControl>
          </FormItem>
        </FormField>
      </form>
    </div>
  </div>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import socket from "~/web-sockets/Socket";
import { toTypedSchema } from "@vee-validate/zod";
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
    },
    global: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      messages: [] as any[],
      lobby: undefined as Lobby | undefined,
      lobbyListener: undefined as { stop: () => void } | undefined,
      chatMessages: undefined as HTMLElement | undefined,
      isAtBottom: false,
      isMinimized: false,
      unreadCount: 0,
      lastReadMessageCount: 0,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            message: z.string().min(1),
          }),
        ),
      }),
    };
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

            // If minimized and global, increment unread count
            if (this.isMinimized && this.global) {
              this.unreadCount++;
            }

            this.$nextTick(() => {
              this.scrollToBottom();
            });
          },
        );
      },
    },
    messages: {
      handler(current, prev) {
        this.$nextTick(() => {
          this.scrollToBottom(prev.length === 0);
        });
      },
    },
    isMinimized: {
      handler(minimized) {
        if (!minimized) {
          // When expanded, clear unread count
          this.unreadCount = 0;
          this.lastReadMessageCount = this.messages.length;
        } else {
          // When minimized, set baseline for unread counting
          this.lastReadMessageCount = this.messages.length;
        }
      },
    },
  },
  methods: {
    updateLobbyMessages(messages: any) {
      this.messages = messages.sort((a: any, b: any) => {
        return a.timestamp - b.timestamp;
      });
    },
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
    },
    checkIfAtBottom() {
      if (this.chatMessages) {
        const { scrollTop, scrollHeight, clientHeight } = this.chatMessages;
        this.isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      }
    },
    scrollToBottom(force = false) {
      if (this.chatMessages && (this.isAtBottom || force)) {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
    },
    sendMessage() {
      const { message } = this.form.values;
      if (!message || message?.length === 0) {
        return;
      }

      socket.chat(
        this.type as "match" | "team" | "matchmaking",
        this.lobbyId,
        message,
      );

      this.form.resetForm();
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    },
  },
  mounted() {
    this.chatMessages = this.$refs.chatMessages as HTMLElement;
    if (this.chatMessages) {
      this.chatMessages.addEventListener("scroll", this.checkIfAtBottom);
    }
  },
  beforeUnmount() {
    this.lobby?.leave();
    this.lobbyListener?.stop();
    if (this.chatMessages) {
      this.chatMessages.removeEventListener("scroll", this.checkIfAtBottom);
    }
  },
};
</script>
