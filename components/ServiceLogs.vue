<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Card, CardHeader, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { DownloadIcon, FullscreenIcon, ExpandIcon } from "lucide-vue-next";
import Convert from "ansi-to-html";
</script>

<template>
  <Card>
    <CardHeader class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-4">
        <div
          v-if="oldestTimestamp"
          class="text-xs font-mono text-muted-foreground"
        >
          Displaying logs from
          {{ new Date(oldestTimestamp).toLocaleString() }}
        </div>

        <div class="flex items-center gap-4">
          <Button variant="outline" @click="jumpToLive">
            {{ $t("ui.logs.jump_to_live") }}
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ExpandIcon
                  v-if="compact"
                  @click="expanded = !expanded"
                  class="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
                />
              </TooltipTrigger>
              <TooltipContent>{{ $t("ui.tooltips.expand") }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FullscreenIcon
                  @click="toggleFullscreen"
                  class="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
                />
              </TooltipTrigger>
              <TooltipContent>{{
                $t("ui.tooltips.fullscreen")
              }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div v-if="followLogs === undefined" class="flex items-center gap-2">
            <Switch
              :model-value="_followLogs"
              @click="_followLogs = !_followLogs"
            />
            {{ $t("ui.logs.follow") }}
          </div>

          <div v-if="timestamps === undefined" class="flex items-center gap-2">
            <Switch
              :model-value="_timestamps"
              @click="_timestamps = !_timestamps"
            />
            {{ $t("ui.logs.timestamps") }}
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <DownloadIcon
                  @click="downloadLogs"
                  class="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground"
                />
              </TooltipTrigger>
              <TooltipContent>{{ $t("ui.tooltips.download") }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <!-- Tabs header -->
      <Tabs v-if="podCount > 1" v-model="activePod">
        <TabsList>
          <TabsTrigger v-for="pod in podList" :key="pod" :value="pod">
            {{ pod }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </CardHeader>

    <CardContent class="p-4">
      <!-- Multi-pod -->
      <Tabs v-if="podCount > 1" v-model="activePod">
        <TabsContent v-for="pod in podList" :key="pod" :value="pod">
          <div class="overflow-auto whitespace-nowrap max-h-[50vh]">
            <div
              v-for="(entry, index) in logsByPod[pod]"
              :key="index"
              class="text-xs font-mono py-1 flex gap-4"
            >
              <span
                v-if="(timestamps === undefined && _timestamps) || timestamps"
                class="text-muted-foreground"
              >
                {{ entry.timestamp }}
              </span>
              <span v-html="colorize(entry.log)" />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <!-- Single pod -->
      <div v-else class="overflow-auto whitespace-nowrap max-h-[50vh]">
        <div
          v-for="(entry, index) in logsByPod[activePod] || []"
          :key="index"
          class="text-xs font-mono py-1 flex gap-4"
        >
          <span
            v-if="(timestamps === undefined && _timestamps) || timestamps"
            class="text-muted-foreground"
          >
            {{ entry.timestamp }}
          </span>
          <span v-html="colorize(entry.log)" />
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
const convert = new Convert();

type LogEntry = {
  log: string;
  node: string;
  container: string;
  timestamp: string;
  pod: string;
};

export default {
  props: {
    service: { type: String, required: true },
    timestamps: { type: Boolean, default: undefined },
    followLogs: { type: Boolean, default: undefined },
    compact: { type: Boolean, default: false },
  },

  data() {
    return {
      logsByPod: {} as Record<string, LogEntry[]>,
      activePod: "",
      oldestTimestamp: undefined as string | undefined,
      _timestamps: true,
      _followLogs: true,
      expanded: false,
      logListener: undefined as { stop: () => void } | undefined,
      retryTimeout: undefined as NodeJS.Timeout | undefined,
    };
  },

  computed: {
    podList(): string[] {
      return Object.keys(this.logsByPod);
    },
    podCount(): number {
      return this.podList.length;
    },
  },

  methods: {
    colorize(log: string) {
      return convert.toHtml(log);
    },

    jumpToLive() {
      this._followLogs = true;
      this.$emit("follow-logs-changed", true);
    },

    toggleFullscreen() {
      document.documentElement.requestFullscreen?.();
    },

    downloadLogs() {
      const content = Object.values(this.logsByPod)
        .flat()
        .map((l) => l.log.replace(/\x1b\[[0-9;]*m/g, ""))
        .join("\n");

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.service}-logs.txt`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },

  watch: {
    $route: {
      immediate: true,
      handler() {
        this.logsByPod = {};
        this.activePod = "";

        this.logListener?.stop();

        this.logListener = socket.listen(`logs:${this.service}`, (raw) => {
          const log = JSON.parse(raw);

          if (log.oldest_timestamp) {
            this.oldestTimestamp = log.oldest_timestamp;
            return;
          }

          if (!log.log) return;

          const pod = log.pod ?? "default";

          if (!this.logsByPod[pod]) {
            this.logsByPod[pod] = [];
            if (!this.activePod) this.activePod = pod;
          }

          this.logsByPod[pod].push(log);
        });

        socket.event("logs", {
          tailLines: 250,
          service: this.service,
        });
      },
    },
  },

  unmounted() {
    clearTimeout(this.retryTimeout);
    this.logListener?.stop();
  },
};
</script>
