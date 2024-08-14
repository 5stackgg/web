<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { CornerDownLeft } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <div
    class="relative flex h-full min-h-[50vh] flex-col rounded-xl bg-muted/50 p-4 lg:col-span-2"
  >
    <div class="absolute right-3 top-3">
      <div class="flex">
        <Badge variant="outline"> {{ matchId }} </Badge>
      </div>
    </div>
    <div class="flex-1 overflow-scroll max-h-screen">
      <div
        v-for="{ message, from, timestamp } in messages"
        :key="message"
        class="whitespace-pre my-2"
      >
        <div class="flex justify-between">
          <div>
            <Avatar class="mx-3">
              <AvatarImage
                :src="from.avatar_url"
                :alt="from.name"
                v-if="from.avatar_url"
              />
            </Avatar>
            {{ from.name }}[{{ from.role }}]: {{ message }}
          </div>
          <small>
            <time-ago :date="timestamp"></time-ago>
          </small>
        </div>
      </div>
    </div>
    <form
      class="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
      @submit.prevent="sendMessage"
    >
      <FormField v-slot="{ componentField }" name="message">
        <FormItem>
          <FormControl>
            <Input
              placeholder="..."
              v-bind="componentField"
              class="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
            />
          </FormControl>
        </FormItem>
      </FormField>
      <div class="flex items-center p-3 pt-0">
        <Button type="submit" size="sm" class="ml-auto gap-1.5">
          Send Message
          <CornerDownLeft class="size-3.5" />
        </Button>
      </div>
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
