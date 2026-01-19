<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Card, CardHeader, CardContent } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import { DownloadIcon, FullscreenIcon, ExpandIcon } from "lucide-vue-next";

const config = useRuntimeConfig();

async function downloadFullLogs(service: string) {
  try {
    const response = await fetch(
      `https://${config.public.apiDomain}/system/logs/download?service=${service}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ service }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to download logs");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = `${service}-logs.zip`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading full logs", error);
  }
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
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

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                class="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-center"
              >
                <DownloadIcon class="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="downloadLogs" class="cursor-pointer">
                Download visible logs
              </DropdownMenuItem>
              <DropdownMenuItem
                @click="downloadFullLogs(service)"
                class="cursor-pointer"
              >
                Download full logs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      <Tabs v-if="podCount > 1" v-model="activePod">
        <TabsContent v-for="pod in podList" :key="pod" :value="pod">
          <PodLogs
            :logs="logsByPod[pod] || []"
            :show-timestamps="
              (timestamps === undefined && _timestamps) || timestamps
            "
            :follow="(followLogs === undefined && _followLogs) || followLogs"
          />
        </TabsContent>
      </Tabs>

      <!-- Single pod -->
      <PodLogs
        v-else
        :logs="logsByPod[activePod] || []"
        :show-timestamps="
          (timestamps === undefined && _timestamps) || timestamps
        "
        :follow="(followLogs === undefined && _followLogs) || followLogs"
      />
    </CardContent>
  </Card>
</template>

<script lang="ts">
import PodLogs from "~/components/PodLogs.vue";

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
