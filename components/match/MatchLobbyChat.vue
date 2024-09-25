<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { CornerDownLeft } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import MatchLobbyChatMessage from "~/components/match/MatchLobbyChatMessage.vue";
</script>

<template>
  <div
    class="relative flex max-h-[500px] min-h-[25vh] flex-col rounded-xl bg-muted/50 p-4"
  >
    <div class="absolute right-3 top-3">
      <div class="flex">
        <Badge variant="secondary"> Lobby Chat </Badge>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto max-h-screen">
      <MatchLobbyChatMessage
        :message="message"
        :previous-message="messages[index - 1]"
        v-for="(message, index) in messages"
        :key="index"
      ></MatchLobbyChatMessage>
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
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import socket from "~/web-sockets/Socket";

export default {
  props: {
    matchId: {
      required: true,
      type: String,
    },
    messages: {
      default: [],
      type: Array<string>,
    },
  },
  data() {
    return {
      lobbyListener: undefined,

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
    matchId: {
      immediate: true,
      handler() {
        this.lobbyListener = socket.listen("lobby:chat", (message) => {
          if (this.matchId === message.matchId) {
            this.messages.push(message);
          }
        });
      },
    },
  },
  methods: {
    sendMessage() {
      const { message } = this.form.values;
      if (message?.length === 0) {
        return;
      }

      socket.event("lobby:chat", {
        matchId: this.matchId,
        message: message,
      });

      this.form.resetForm();
    },
  },
  beforeUnmount() {
    this.lobbyListener?.stop();
  },
};
</script>
