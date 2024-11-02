<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Card } from "~/components/ui/card";
import { DownloadIcon } from "lucide-vue-next";
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="grid grid-cols-[1fr_auto] gap-4">
        <div></div>
        <div class="flex items-center space-x-2">
          <DownloadIcon
            @click="downloadLogs"
            class="cursor-pointer h-5 w-5 text-muted-foreground hover:text-foreground transition-colors"
          />
          <div class="flex items-center gap-2 ml-4">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :checked="followLogs"
              @click="followLogs = !followLogs"
            >
            </Switch>
            Follow Logs
          </div>
        </div>
      </div>

      <div ref="logsContainer" class="overflow-auto max-h-[50vh]">
        <template v-for="(log, index) in logs" :key="index">
          <p class="whitespace-pre-wrap text-sm text-foreground/80">
            {{ log }}
          </p>
        </template>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
export default {
  props: {
    service: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      logs: [],
      _followLogs: true,
      logListener: undefined,
    };
  },
  methods: {
    downloadLogs() {
      // Create text content from logs array
      const logContent = this.logs.join("\n");

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
          this.logs.push(log);
          this.scrollToBottom();
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
  computed: {
    followLogs: {
      get() {
        return this._followLogs;
      },
      set(value: boolean) {
        this._followLogs = value;
      },
    },
  },
};
</script>
