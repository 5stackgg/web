<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import {
  Terminal,
  ChevronDown,
  Info,
  RefreshCw,
  RotateCcw,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import ClipBoard from "~/components/ClipBoard.vue";
import { ButtonGroup } from "~/components/ui/button-group";
import debounce from "~/utilities/debounce";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  effectivePluginRuntime,
  quickCommandsForRuntime,
} from "~/constants/rconCommands";
</script>

<template>
  <div
    :class="[
      'flex flex-col overflow-hidden rounded-md border border-border bg-[hsl(var(--background))]',
      compact && 'lg:min-h-0',
    ]"
  >
    <div
      class="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-2"
    >
      <h4
        class="flex items-center gap-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-foreground"
      >
        <Terminal class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
        {{ $t("rcon.console") }}
      </h4>
      <span
        class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]"
        :class="online ? 'text-success' : 'text-destructive'"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
        {{ online ? $t("common.connected") : $t("common.disconnected") }}
      </span>
      <span
        class="ml-auto font-mono text-[0.65rem] tabular-nums text-muted-foreground"
      >
        {{ $t("rcon.entry_count", { count: logs.length }) }}
      </span>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
        :aria-label="$t('common.clear')"
        :disabled="logs.length === 0"
        @click="clearLogs"
      >
        <RotateCcw />
      </Button>
    </div>

    <div
      ref="output"
      :class="[
        'overflow-y-auto px-3 py-3 font-mono text-xs leading-relaxed sm:px-4',
        compact
          ? 'h-80 lg:h-auto lg:min-h-0 lg:flex-1'
          : 'h-[min(28rem,60vh)]',
      ]"
      role="log"
      aria-live="polite"
    >
      <div
        v-if="logs.length === 0"
        class="flex h-full flex-col items-center justify-center gap-1 text-center font-sans text-muted-foreground"
      >
        <p class="text-sm">{{ $t("server.rcon.no_commands_yet") }}</p>
        <p class="text-xs">{{ $t("server.rcon.enter_command_hint") }}</p>
      </div>
      <div v-else class="flex flex-col gap-3">
        <div v-for="log in logs" :key="log.id" class="group">
          <div class="flex items-center gap-2">
            <span class="select-none text-muted-foreground/60">
              {{ log.timestamp }}
            </span>
            <span class="select-none text-[hsl(var(--tac-amber))]">&gt;</span>
            <span class="min-w-0 break-all text-foreground">
              {{ log.command }}
            </span>
            <ClipBoard
              v-if="log.response"
              :data="log.response"
              class="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
            />
          </div>
          <div
            v-if="log.response"
            class="ml-1 mt-1 whitespace-pre-wrap break-words border-l border-border pl-3"
            :class="
              log.type === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
            "
          >
            {{ log.response }}
          </div>
        </div>
      </div>
    </div>

    <form class="relative border-t border-border" @submit.prevent="sendCommand">
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="absolute bottom-full left-2 right-2 z-50 mb-2 overflow-hidden rounded-md border bg-background shadow-xl ring-1 ring-border"
      >
        <div
          class="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
        >
          {{ $t("rcon.suggestions") }}
        </div>
        <ul class="max-h-72 divide-y divide-muted/30 overflow-auto">
          <li
            v-for="(s, i) in suggestions"
            :key="s.name + '_' + i"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-muted/60"
            :class="{ 'bg-muted/70': i === suggestionIndex }"
            @mousedown.prevent="selectSuggestion(s.command)"
          >
            <div class="flex items-start gap-3">
              <div class="min-w-0">
                <div class="break-words font-mono text-foreground">
                  <span v-html="s.name"></span>
                </div>
                <div
                  v-if="s.description"
                  class="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
                >
                  <span v-html="s.description"></span>
                </div>
              </div>
              <div
                class="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
              >
                <span v-if="s.kind">{{ s.kind }}</span>
                <span v-if="s.flags" class="opacity-80">{{ s.flags }}</span>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div class="flex items-center gap-2 py-1.5 pl-3 pr-1.5 sm:pl-4">
        <span
          class="select-none font-mono text-sm font-bold text-[hsl(var(--tac-amber))]"
          aria-hidden="true"
          >&gt;</span
        >
        <FormField v-slot="{ componentField }" name="command">
          <FormItem class="min-w-0 flex-1">
            <FormControl>
              <Input
                :placeholder="$t('server.rcon.command_placeholder')"
                v-bind="componentField"
                :aria-label="$t('rcon.console')"
                autocomplete="off"
                spellcheck="false"
                class="h-9 border-0 bg-transparent px-0 font-mono shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                @keydown="onCommandKeyDown"
                @input="onCommandInput"
                @focus="onCommandFocus"
                @blur="onCommandBlur"
              />
            </FormControl>
          </FormItem>
        </FormField>
        <ButtonGroup>
          <Button
            :disabled="!online"
            type="submit"
            size="sm"
            variant="secondary"
            class="h-8 px-4"
          >
            {{ $t("server.rcon.send") }}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-8 w-8 p-0"
                :disabled="!online && !$slots.default && !matchId"
              >
                <ChevronDown class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-56">
              <DropdownMenuGroup>
                <slot :commander="commander"></slot>

                <DropdownMenuItem
                  @click="commander('get_match', '')"
                  :disabled="!online"
                  v-if="matchId"
                >
                  <RefreshCw />
                  {{ $t("server.rcon.refresh_match") }}
                </DropdownMenuItem>

                <DropdownMenuSeparator v-if="matchId" />

                <DropdownMenuItem
                  v-for="quickCommand of quickCommands"
                  :key="quickCommand.display"
                  @click="commander(quickCommand.command, '')"
                  :disabled="!online"
                >
                  <Info />
                  {{ $t(quickCommand.display) }}
                </DropdownMenuItem>

                <slot name="footer" :commander="commander"></slot>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
    </form>
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import { isLogsOnlyCommand } from "~/constants/rconCommands";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
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
    matchId: {
      required: false,
      type: String,
    },
    compact: {
      type: Boolean,
      default: false,
    },
    pluginRuntime: {
      required: false,
      type: String,
      default: null,
    },
  },
  computed: {
    quickCommands() {
      return quickCommandsForRuntime(
        effectivePluginRuntime(
          this.pluginRuntime,
          useApplicationSettingsStore().gameServerPluginRuntime,
        ),
      );
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
      uuid: undefined as string | undefined,
      rconListener: undefined as any,
      history: [] as string[],
      historyIndex: -1 as number, // -1 means not navigating history
      historyTemp: "" as string, // buffer of current input before history navigation
      suggestions: [] as Array<{
        command: string;
        name: string;
        kind?: string;
        flags?: string;
        description?: string;
      }>,
      showSuggestions: false as boolean,
      _debouncedSearch: undefined as undefined | ((q: string) => void),
      suggestionIndex: -1 as number,
      _suppressSuggestions: false,
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
  created() {
    this._debouncedSearch = debounce(
      (q: string) => this.fetchSuggestions(q),
      50,
    );
  },
  watch: {
    serverId: {
      immediate: true,
      handler() {
        this.loadHistory();
      },
    },
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
                this.$t("server.rcon.connect_failed"),
                "error",
              );
            } else {
              this.addCommandResponse(
                data.command,
                !data.result?.trim() && isLogsOnlyCommand(data.command)
                  ? this.$t("server.rcon.logs_only_response")
                  : data.result,
                "response",
              );
            }
          }
        });
      },
    },
  },
  methods: {
    async fetchSuggestions(query: string) {
      const q = (query || "").trim();
      if (q.length < 1) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      // Don't show suggestions if we just sent a command
      if (this._suppressSuggestions) {
        this.suggestions = [];
        this.showSuggestions = false;
        return;
      }

      try {
        const res = await fetch("/api/rcon-command-search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        const commands = Array.isArray(data?.hits) ? data.hits : [];
        this.suggestions = commands.map(
          (command: {
            document: {
              command: string;
              name: string;
              kind: string;
              flags: string;
              description: string;
            };
            highlights: Array<{
              field: string;
              snippet: string;
            }>;
            text_match_info: {
              best_field_score: string;
            };
          }) => {
            command.document.command = command.document.name;

            for (const highlight of command.highlights) {
              if (highlight.field === "name") {
                command.document.name = highlight.snippet;
              }
              if (highlight.field === "description") {
                command.document.description = highlight.snippet;
              }
            }

            return command.document;
          },
        );
        this.showSuggestions =
          !this._suppressSuggestions && this.suggestions.length > 0;
      } catch (error) {
        console.error(`unable to fetch suggestions`, error);
        this.suggestions = [];
        this.showSuggestions = false;
      }
    },
    onCommandInput(event: any) {
      const value = event?.target?.value ?? this.form.values.command ?? "";
      this._suppressSuggestions = false;
      if (this._debouncedSearch) {
        this._debouncedSearch(value);
      }
      this.suggestionIndex = -1;
    },
    onCommandFocus() {
      if (this.suggestions.length > 0) {
        this.showSuggestions = true;
      }
    },
    onCommandBlur() {
      setTimeout(() => (this.showSuggestions = false), 100);
    },
    selectSuggestion(command: string) {
      this.form.setFieldValue("command", command);
      this.showSuggestions = false;
      this.sendCommand();
    },
    sendCommand() {
      this.suggestions = [];
      this.showSuggestions = false;
      this._suppressSuggestions = true;

      const command = this.form.values.command;
      if (!command || command.length === 0) {
        return;
      }

      socket.event("rcon", {
        uuid: this.uuid,
        serverId: this.serverId,
        command: command,
      });

      // track history
      this.history.push(command);
      if (this.history.length > 50) {
        this.history = this.history.slice(this.history.length - 50);
      }
      this.saveHistory();
      this.historyIndex = -1;
      this.historyTemp = "";

      this.form.resetForm();
    },
    onCommandKeyDown(event: KeyboardEvent) {
      // When suggestions are visible, arrow keys navigate suggestions instead of history
      if (this.showSuggestions && this.suggestions.length > 0) {
        if (event.key === "Tab") {
          const selectedIndex =
            this.suggestionIndex >= 0 ? this.suggestionIndex : 0;
          const selected = this.suggestions[selectedIndex];
          if (selected?.command) {
            this.form.setFieldValue("command", selected.command + " ");
            this.showSuggestions = false;
            this.suggestionIndex = -1;
            event.preventDefault();
            return;
          }
        }
        if (event.key === "ArrowDown") {
          this.suggestionIndex =
            (this.suggestionIndex + 1) % this.suggestions.length;
          event.preventDefault();
          return;
        }
        if (event.key === "ArrowUp") {
          this.suggestionIndex =
            (this.suggestionIndex - 1 + this.suggestions.length) %
            this.suggestions.length;
          event.preventDefault();
          return;
        }
        if (event.key === "Enter") {
          if (this.suggestionIndex >= 0) {
            const selected = this.suggestions[this.suggestionIndex];
            if (selected?.command) {
              this.selectSuggestion(selected.command);
              event.preventDefault();
              return;
            }
          }
        }
        if (event.key === "Escape") {
          this.showSuggestions = false;
          this.suggestionIndex = -1;
          event.preventDefault();
          return;
        }
      }
      if (event.key === "ArrowUp") {
        if (this.history.length === 0) {
          return;
        }
        if (this.historyIndex === -1) {
          this.historyTemp = this.form.values.command || "";
        }
        const nextIndex = Math.min(
          this.historyIndex + 1,
          this.history.length - 1,
        );
        const value = this.history[this.history.length - 1 - nextIndex];
        this.form.setFieldValue("command", value);
        this.historyIndex = nextIndex;
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowDown") {
        if (this.historyIndex === -1) {
          return;
        }
        const nextIndex = this.historyIndex - 1;
        if (nextIndex < 0) {
          this.form.setFieldValue("command", this.historyTemp);
          this.historyIndex = -1;
          this.historyTemp = "";
        } else {
          const value = this.history[this.history.length - 1 - nextIndex];
          this.form.setFieldValue("command", value);
          this.historyIndex = nextIndex;
        }
        event.preventDefault();
      }
    },
    addCommandResponse(
      command: string,
      response: string,
      type: "command" | "response" | "error",
    ) {
      const timestamp = new Date().toLocaleTimeString();

      this.logs.push({
        id: uuidv4(),
        command: command,
        response: response,
        timestamp: timestamp,
        type: type,
      });

      this.$nextTick(() => {
        const output = this.$refs.output as HTMLElement | undefined;

        if (output) {
          output.scrollTop = output.scrollHeight;
        }
      });
    },
    clearLogs() {
      this.logs = [];
    },
    historyStorageKey(): string {
      return `rcon_history_${this.serverId || "global"}`;
    },
    loadHistory() {
      try {
        const raw = localStorage.getItem(this.historyStorageKey());
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.history = parsed.slice(-50);
          }
        } else {
          this.history = [];
        }
        this.historyIndex = -1;
        this.historyTemp = "";
      } catch (_) {
        this.history = [];
        this.historyIndex = -1;
        this.historyTemp = "";
      }
    },
    saveHistory() {
      try {
        localStorage.setItem(
          this.historyStorageKey(),
          JSON.stringify(this.history.slice(-50)),
        );
      } catch (_) {
        // ignore storage errors
      }
    },
  },
  beforeUnmount() {
    this.rconListener?.stop();
  },
};
</script>
