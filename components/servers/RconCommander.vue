<template>
  <div
      class="relative flex h-full min-h-[50vh] flex-col rounded-xl bg-muted/50 p-4 lg:col-span-2"
  >
    <Badge variant="outline" class="absolute right-3 top-3"> Output </Badge>
    <div class="flex-1 overflow-scroll max-h-screen">
      <p v-for="log in logs" :key="log" class="whitespace-pre mt-2 mb-2">
        {{ log }}
      </p>
    </div>
    <form
        class="relative overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
        @submit.prevent="sendCommand"
    >
      <FormField v-slot="{ componentField }" name="command">
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
          Send Command
          <CornerDownLeft class="size-3.5" />
        </Button>
      </div>
    </form>
  </div>

</template>
<script setup lang="ts">
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {FormControl, FormField, FormItem} from "~/components/ui/form";
import {CornerDownLeft} from "lucide-vue-next";
import {Badge} from "~/components/ui/badge";

</script>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";

export default {
  props: {
    serverId: {
      required: true,
      type: String,
    }
  },
  data() {
    return {
      logs: [],
      uuid: undefined,
      rconListener: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
            z.object({
              command: z.string().min(1),
            })
        ),
      }),
    }
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (this.rconListener) {
          this.rconListener.stop();
          this.rconListener = undefined;
        }

        this.uuid = uuidv4();

        this.rconListener = socket.listen("rcon", (data) => {
          if (data.uuid === this.uuid) {
            this.logs.unshift(data.result);
          }
        });
      },
    },
  },
  methods: {
    sendCommand() {
      const { command } = this.form.values;
      if (command?.length === 0) {
        return;
      }

      socket.event("rcon", {
        uuid: this.uuid,
        serverId: this.serverId,
        command: command,
      });
      this.form.resetForm();
    },
  },
  beforeUnmount() {
    this.rconListener?.stop();
  },
}
</script>