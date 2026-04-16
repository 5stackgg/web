<script setup lang="ts">
import socket from "~/web-sockets/Socket";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent } from "~/components/ui/tabs";
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

import {
  DownloadIcon,
  FullscreenIcon,
  ExpandIcon,
  PlayIcon,
} from "lucide-vue-next";

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
  <section
    class="relative overflow-hidden border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.6)_0%,hsl(var(--card)/0.25)_100%)] [backdrop-filter:blur(6px)]"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
    />
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
    />

    <header
      class="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-wrap items-center gap-2">
        <TooltipProvider v-if="compact">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="grid h-9 w-9 place-items-center border border-border bg-background/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]"
                @click="expanded = !expanded"
              >
                <ExpandIcon class="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("ui.tooltips.expand") }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                class="grid h-9 w-9 place-items-center border border-border bg-background/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]"
                @click="toggleFullscreen"
              >
                <FullscreenIcon class="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("ui.tooltips.fullscreen") }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <label
          v-if="followLogs === undefined"
          class="flex h-9 cursor-pointer items-center gap-2 border px-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] transition-colors"
          :class="
            _followLogs
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-background/40 text-muted-foreground'
          "
        >
          <Switch
            :model-value="_followLogs"
            @click="_followLogs = !_followLogs"
          />
          {{ $t("ui.logs.follow") }}
        </label>

        <label
          v-if="timestamps === undefined"
          class="flex h-9 cursor-pointer items-center gap-2 border px-3 font-mono text-[0.65rem] uppercase tracking-[0.2em] transition-colors"
          :class="
            _timestamps
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-background/40 text-muted-foreground'
          "
        >
          <Switch
            :model-value="_timestamps"
            @click="_timestamps = !_timestamps"
          />
          {{ $t("ui.logs.timestamps") }}
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              class="grid h-9 w-9 place-items-center border border-border bg-background/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))]"
            >
              <DownloadIcon class="h-4 w-4" />
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

      <button
        class="flex h-9 items-center gap-2 border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] px-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.2)]"
        @click="jumpToLive"
      >
        <PlayIcon class="h-3 w-3" />
        {{ $t("ui.logs.jump_to_live") }}
      </button>
    </header>

    <div
      v-if="podCount > 1"
      class="flex flex-wrap gap-1.5 border-b border-border/70 px-4 py-2.5"
    >
      <button
        v-for="(pod, idx) in podList"
        :key="pod"
        class="group relative flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] transition-colors"
        :class="
          activePod === pod
            ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border bg-background/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground'
        "
        @click="activePod = pod"
      >
        <span
          class="tracking-[0.14em]"
          :class="
            activePod === pod ? 'text-[hsl(var(--tac-amber))]' : 'text-border'
          "
        >
          p-{{ String(idx + 1).padStart(2, "0") }}
        </span>
        <span class="truncate normal-case tracking-normal">{{ pod }}</span>
      </button>
    </div>

    <div
      class="relative overflow-x-auto bg-[hsl(var(--background)/0.6)] p-3 sm:p-4"
    >
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-background/60 to-transparent"
      />

      <Tabs v-if="podCount > 1" v-model="activePod">
        <TabsContent v-for="pod in podList" :key="pod" :value="pod">
          <PodLogs
            :pod="pod"
            :logs="logsByPod[pod] || []"
            :show-timestamps="effectiveTimestamps"
            :follow="effectiveFollowLogs"
            @follow-logs-changed="handleFollowLogsChanged"
            @load-more-logs="handleLoadMoreLogs"
          />
        </TabsContent>
      </Tabs>

      <PodLogs
        v-else
        :pod="activePod"
        :logs="logsByPod[activePod] || []"
        :show-timestamps="effectiveTimestamps"
        :follow="effectiveFollowLogs"
        @follow-logs-changed="handleFollowLogsChanged"
        @load-more-logs="handleLoadMoreLogs"
      />
    </div>
  </section>
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
      gettingSinceLogs: false,
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
    effectiveFollowLogs(): boolean {
      return this.followLogs === undefined ? this._followLogs : this.followLogs;
    },
    effectiveTimestamps(): boolean {
      return this.timestamps === undefined ? this._timestamps : this.timestamps;
    },
  },

  methods: {
    jumpToLive() {
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

    handleLoadMoreLogs({ pod, oldestLogTime }) {
      this.gettingSinceLogs = true;

      const start = new Date(oldestLogTime);
      start.setMinutes(start.getMinutes() - 60);

      socket.event("logs", {
        service: this.service,
        since: {
          start: start.toISOString(),
          until: oldestLogTime.toISOString(),
        },
      });
    },
    handleFollowLogsChanged(value: boolean) {
      if (this.followLogs === undefined) {
        this._followLogs = value;
      }
      this.$emit("follow-logs-changed", value);
    },
  },

  watch: {
    $route: {
      immediate: true,
      handler() {
        this.logsByPod = {};
        this.activePod = "";
        let partial: Record<string, any[]> = {};

        this.logListener?.stop();

        this.logListener = socket.listen(`logs:${this.service}`, (raw) => {
          const log = JSON.parse(raw);

          if (log.end) {
            if (log.job_finshed !== true && log.partial !== true) {
              this.retryTimeout = setTimeout(() => {
                socket.event("logs", {
                  tailLines: 250,
                  service: this.service,
                });
              }, 5000);
            }

            if (log.partial) {
              this.gettingSinceLogs = false;
              for (const pod in partial) {
                this.logsByPod[pod].unshift(...partial[pod]);
                delete partial[pod];
              }
              return;
            }
          }

          if (!log.log) {
            return;
          }

          if (this.gettingSinceLogs) {
            if (!partial[log.pod]) {
              partial[log.pod] = [];
            }

            partial[log.pod].push(log);
            return;
          }

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
