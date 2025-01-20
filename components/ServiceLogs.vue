<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Card } from "~/components/ui/card";
import { DownloadIcon } from "lucide-vue-next";
import Convert from "ansi-to-html";
import { FullscreenIcon, ExpandIcon } from "lucide-vue-next";
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row gap-4 items-center justify-end w-full">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <ExpandIcon
              @click="expanded = !expanded"
              class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
              v-if="compact"
            />
          </TooltipTrigger>
          <TooltipContent>Expand</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <FullscreenIcon
              @click="toggleFullscreen"
              class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
            />
          </TooltipTrigger>
          <TooltipContent>Toggle Fullscreen</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div class="flex items-center gap-2" v-if="followLogs === undefined">
        <Switch
          class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
          :checked="_followLogs"
          @click="_followLogs = !_followLogs"
        >
        </Switch>
        Follow Logs
      </div>

      <div class="flex items-center gap-2" v-if="timestamps === undefined">
        <Switch
          class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
          :checked="_timestamps"
          @click="_timestamps = !_timestamps"
        >
        </Switch>
        Timestamps
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <DownloadIcon
              @click="downloadLogs"
              class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
            />
          </TooltipTrigger>
          <TooltipContent>Download Logs</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardHeader>
    <CardContent class="p-4">
      <div
        ref="logsContainer"
        class="overflow-auto whitespace-nowrap"
        :class="{
          'max-h-[50vh]': !compact,
          'max-h-[320px]': compact && !expanded,
        }"
      >
        <template
          v-for="({ log, node, container, timestamp }, index) in logs"
          :key="index"
        >
          <div class="text-xs font-mono text-foreground/80 py-1 flex gap-4">
            <div class="flex flex-col justify-end">
              <div class="flex gap-2" v-if="log && log.trim() !== ''">
                <span class="text-muted-foreground" v-if="nodes.size > 1"
                  >[{{ node }}|{{ container }}]</span
                >
                <span
                  class="text-blue-100"
                  v-if="(timestamps === undefined && _timestamps) || timestamps"
                  >{{ timestamp }}</span
                >
              </div>
            </div>
            <div class="self-end">
              <span v-html="colorize(log)"></span>
            </div>
          </div>
        </template>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
const convert = new Convert();

export default {
  props: {
    service: {
      type: String,
      required: true,
    },
    timestamps: {
      type: Boolean,
      default: undefined,
    },
    followLogs: {
      type: Boolean,
      default: undefined,
    },
    compact: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      _timestamps: true,
      _followLogs: true,
      expanded: false,
      logs: [] as Array<{
        log: string;
        node: string;
        container: string;
        timestamp: string;
      }>,
      logListener: undefined as { stop: () => void } | undefined,
      nodes: new Set<string>(),
    };
  },
  methods: {
    colorize(log: string) {
      return convert.toHtml(log);
    },
    toggleFullscreen() {
      const container = this.$refs.logsContainer as HTMLElement;
      if (container) {
        container.requestFullscreen();
      }
    },
    downloadLogs() {
      // Create text content from logs array
      const logContent = this.logs
        .map(({ log }) => log.replace(/\x1b\[[0-9;]*m/g, ""))
        .join("\n");

      // Create blob and download link
      const blob = new Blob([logContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${this.service}-logs.txt`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    scrollToBottom() {
      if (
        (this.followLogs === undefined && !this._followLogs) ||
        !this._followLogs
      ) {
        return;
      }

      this.$nextTick(() => {
        const container = this.$refs.logsContainer as HTMLElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (this.logListener) {
          this.logListener.stop();
          this.logListener = undefined;
        }
        this.logListener = socket.listen(`logs:${this.service}`, (log) => {
          const _log = JSON.parse(log);
          this.logs.push(_log);

          this.$nextTick(() => {
            this.scrollToBottom();
          });
        });

        socket.event("logs", {
          service: this.service,
        });
      },
    },
  },
  unmounted() {
    this.logListener?.stop();
  },
};
</script>
