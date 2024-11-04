<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Card } from "~/components/ui/card";
import { DownloadIcon } from "lucide-vue-next";
import Convert from "ansi-to-html";
</script>

<template>
  <Card>
    <CardHeader class="flex items-center justify-end w-full">
      <div class="ml-auto">
        <DownloadIcon
          @click="downloadLogs"
          class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
        />
      </div>
    </CardHeader>
    <CardContent class="p-4">
      <div
        ref="logsContainer"
        class="overflow-auto max-h-[50vh] whitespace-nowrap"
      >
        <template
          v-for="({ log, node, container, timestamp }, index) in logs"
          :key="index"
        >
          <div class="text-sm text-foreground/80 py-1 flex gap-4">
            <div class="flex flex-col justify-end">
              <div class="flex gap-2" v-if="log && log.trim() !== ''">
                <span
                  class="text-xs text-muted-foreground"
                  v-if="nodes.size > 1"
                  >[{{ node }}|{{ container }}]</span
                >
                <span class="text-xs text-blue-100" v-if="timestamps">{{
                  timestamp
                }}</span>
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
      default: true,
    },
    followLogs: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      logs: [] as Array<{
        log: string;
          node: string;
         container:string;
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
    downloadLogs() {
      // Create text content from logs array
      const logContent = this.logs.map(({log}) => 
        log.replace(/\x1b\[[0-9;]*m/g, '')
      ).join("\n");

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
      if (!this.followLogs) return;

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
        });

        socket.event("logs", {
          service: this.service,
        });
      },
    },
  },
  unmounted() {
    this.logListener?.stop();
    // TODO - send to stop sending to my socket...
  },
};
</script>
