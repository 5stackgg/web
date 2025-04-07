<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { CornerDownLeft } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { TrashIcon } from "@radix-icons/vue";
import { ServerIcon, ChevronDown } from "lucide-vue-next";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div
    class="grid grid-rows-[auto_1fr_auto] h-full min-h-[50vh] max-h-[50vh] rounded-xl bg-muted/50 p-4 lg:col-span-2 overflow-hidden"
  >
    <div class="grid grid-cols-[1fr_auto] gap-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline">
              <ServerIcon class="mr-2 h-4 w-4" />
              {{ $t("server.rcon.quick_commands") }}
              <ChevronDown class="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56">
            <DropdownMenuGroup>
              <slot :commander="commander"></slot>

              <DropdownMenuSeparator v-if="$slots.default">
              </DropdownMenuSeparator>

              <DropdownMenuItem
                @click="commander('get_match', '')"
                :disabled="!online"
              >
                {{ $t("server.rcon.refresh_match") }}
              </DropdownMenuItem>

              <DropdownMenuSeparator> </DropdownMenuSeparator>

              <DropdownMenuItem
                @click="commander('meta version', '')"
                :disabled="!online"
              >
                {{ $t("server.rcon.metamod_info") }}
              </DropdownMenuItem>
              <DropdownMenuItem
                @click="commander(['css_plugins list', 'css'], '')"
                :disabled="!online"
              >
                {{ $t("server.rcon.css_info") }}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div class="flex items-center space-x-2 justify-self-end">
        <TrashIcon
          @click="logs = []"
          class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
        />
        <Badge variant="outline">{{ $t("server.rcon.output") }}</Badge>
      </div>
    </div>

    <div class="overflow-auto max-h-[calc(100vh-200px)]">
      <template v-for="(log, index) in logs" :key="index">
        <p class="whitespace-pre my-2 text-sm text-foreground/80">
          {{ log }}
        </p>
        <Separator></Separator>
      </template>
    </div>

    <form
      class="mt-4 overflow-hidden rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
      @submit.prevent="sendCommand"
    >
      <FormField v-slot="{ componentField }" name="command">
        <FormItem>
          <FormControl>
            <Input
              :placeholder="$t('server.rcon.command_placeholder')"
              v-bind="componentField"
              class="min-h-12 resize-none border-0 p-3 shadow-none focus-visible:ring-0"
            />
          </FormControl>
        </FormItem>
      </FormField>
      <div class="flex items-center p-3 pt-0">
        <Button
          :disabled="!online"
          type="submit"
          size="sm"
          class="ml-auto gap-1.5"
        >
          {{ $t("server.rcon.send_command") }}
          <CornerDownLeft class="h-3.5 w-3.5" />
        </Button>
      </div>
    </form>
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";

export default {
  props: {
    serverId: {
      required: true,
      type: String,
    },
    online: {
      required: true,
      type: Boolean,
    },
  },
  data() {
    return {
      logs: [],
      uuid: undefined,
      rconListener: undefined,
      commander: (commands: string | Array<string>, value: string) => {
        if (!Array.isArray(commands)) {
          commands = [commands];
        }

        for (let command of commands) {
          if (value) {
            command = `${command} ${value}`;
          }

          this.form.setFieldValue("command", command);
          this.sendCommand();
        }
      },
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            command: z.string().min(1),
          }),
        ),
      }),
    };
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
};
</script>
