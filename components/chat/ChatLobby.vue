<script lang="ts" setup>
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CornerDownLeft } from "lucide-vue-next";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
</script>

<template>
  <div
    class="relative flex max-h-[500px] min-h-[25vh] flex-col rounded-xl bg-muted/50 p-4"
  >
    <div class="absolute right-3 top-3">
      <div class="flex">
        <Badge variant="secondary">
          <slot name="chat-label">Lobby Chat</slot>
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
                placeholder="..."
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
  },
  data() {
    return {
      messages: [],
      lobby: undefined as Lobby | undefined,
      lobbyListener: undefined as { stop: () => void } | undefined,
      chatMessages: undefined as HTMLElement | undefined,
      isAtBottom: false,
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
          (message) => {
            this.messages.push(message);
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
  },
  methods: {
    updateLobbyMessages(messages: any) {
      this.messages = messages.sort((a, b) => {
        return a.timestamp - b.timestamp;
      });
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
