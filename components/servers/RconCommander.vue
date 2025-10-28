<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Terminal, ChevronDown, ChevronRight } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { TrashIcon } from "@radix-icons/vue";
import { ServerIcon } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
</script>

<template>
  <!-- RCON Console Interface -->
  <div class="bg-muted/50 p-6 rounded-xl border">
    <div class="flex items-center justify-between mb-6">
      <h4 class="text-foreground font-semibold text-lg flex items-center gap-2">
        <Terminal class="w-5 h-5" />
        RCON Console
      </h4>
      <Badge variant="outline" class="text-xs">
        {{ online ? "Connected" : "Disconnected" }}
      </Badge>
    </div>

    <!-- Command Controls -->
    <div class="flex items-center gap-3 mb-6">
      <!-- Quick Commands Dropdown -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="default" class="h-10 px-4">
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

      <!-- Command Input Form -->
      <form
        @submit.prevent="sendCommand"
        class="flex items-center gap-2 flex-1"
      >
        <FormField v-slot="{ componentField }" name="command">
          <FormItem class="flex-1">
            <FormControl>
              <Input
                :placeholder="$t('server.rcon.command_placeholder')"
                v-bind="componentField"
                class="bg-background h-10"
              />
            </FormControl>
          </FormItem>
        </FormField>
        <Button
          :disabled="!online"
          type="submit"
          size="default"
          class="h-10 px-6"
        >
          Send
        </Button>
      </form>

      <!-- Clear Button -->
      <Button
        @click="clearLogs"
        variant="outline"
        size="default"
        class="h-10 w-10 p-0 text-muted-foreground hover:text-foreground"
      >
        <TrashIcon class="h-4 w-4" />
      </Button>
    </div>

    <!-- Console Output -->
    <div class="bg-background rounded-lg border shadow-sm">
      <div class="p-4 border-b bg-muted/30">
        <div class="flex items-center justify-between">
          <h5 class="text-sm font-medium text-foreground">Console Output</h5>
          <span class="text-xs text-muted-foreground"
            >{{ logs.length }} entries</span
          >
        </div>
      </div>
      <div class="p-4 h-96 overflow-y-auto">
        <div class="text-sm font-mono space-y-3">
          <template v-for="(log, index) in logs" :key="log.id">
            <Collapsible v-model:open="logStates[index]">
              <div
                class="border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <CollapsibleTrigger
                  class="flex w-full items-center justify-between p-3 hover:bg-muted/40 rounded-lg transition-colors group"
                >
                  <div class="flex items-center gap-3 text-left">
                    <ChevronRight
                      :class="[
                        'h-4 w-4 transition-transform text-muted-foreground group-hover:text-foreground',
                        logStates[index] ? 'rotate-90' : '',
                      ]"
                    />
                    <span class="text-sm font-medium text-foreground">
                      {{ log.command }}
                    </span>
                  </div>
                  <div class="text-sm text-muted-foreground font-mono">
                    {{ log.timestamp }}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent class="px-3 py-3">
                  <div
                    class="text-sm font-mono text-foreground whitespace-pre-wrap"
                  >
                    {{ log.response }}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </template>
          <div
            v-if="logs.length === 0"
            class="text-center py-12 text-muted-foreground"
          >
            <Terminal class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">No commands executed yet</p>
            <p class="text-xs mt-1">Enter a command above to get started</p>
          </div>
        </div>
      </div>
    </div>
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
    const form = useForm({
      validationSchema: toTypedSchema(
        z.object({
          command: z.string().min(1),
        }),
      ),
    });

    return {
      logs: [] as Array<{
        id: string;
        command: string;
        response: string;
        timestamp: string;
        type: "command" | "response" | "error";
      }>,
      logStates: [] as boolean[],
      uuid: undefined as string | undefined,
      rconListener: undefined as any,
      commander: (commands: string | Array<string>, value: string) => {
        if (!Array.isArray(commands)) {
          commands = [commands];
        }

        for (let command of commands) {
          if (value) {
            command = `${command} ${value}`;
          }

          form.setFieldValue("command", command);
          this.sendCommand();
        }
      },
      form,
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

        this.rconListener = socket.listen("rcon", (data: any) => {
          if (data.uuid === this.uuid) {
            if (data.result === "unable to connect to rcon") {
              this.addCommandResponse(
                data.command,
                "Failed to connect to game server RCON",
                "error",
              );
            } else {
              this.addCommandResponse(data.command, data.result, "response");
            }
          }
        });
      },
    },
  },
  methods: {
    sendCommand() {
      const command = this.form.values.command;
      if (!command || command.length === 0) {
        return;
      }

      socket.event("rcon", {
        uuid: this.uuid,
        serverId: this.serverId,
        command: command,
      });

      this.form.resetForm();
    },
    addCommandResponse(
      command: string,
      response: string,
      type: "command" | "response" | "error",
    ) {
      const timestamp = new Date().toLocaleTimeString();

      this.logs.unshift({
        id: uuidv4(),
        command: command,
        response: response,
        timestamp: timestamp,
        type: type,
      });
      this.logStates.unshift(true);
    },
    clearLogs() {
      this.logs = [];
      this.logStates = [];
    },
  },
  beforeUnmount() {
    this.rconListener?.stop();
  },
};
</script>
