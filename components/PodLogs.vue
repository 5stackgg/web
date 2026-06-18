<template>
  <div
    v-if="oldestLogTime"
    class="mb-2 flex items-center gap-2 border-l-2 border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.06)] px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
  >
    <span class="text-[hsl(var(--tac-amber))]">◢</span>
    <span>{{ $t("pod_logs.tail_since") }}</span>
    <span class="normal-case tracking-normal text-foreground">
      {{ oldestLogTime.toLocaleString() }}
    </span>
  </div>
  <div
    :class="[
      'relative flex flex-col',
      maximized ? 'min-h-0 flex-1' : fill ? 'lg:min-h-0 lg:flex-1' : '',
    ]"
  >
  <div
    ref="scrollContainer"
    :class="[
      'overflow-auto whitespace-pre-wrap break-words border border-border/40 bg-[hsl(var(--background)/0.5)] [scrollbar-color:hsl(var(--tac-amber)/0.4)_transparent] [scrollbar-width:thin]',
      maximized
        ? 'min-h-0 flex-1'
        : fill
          ? 'h-80 lg:h-auto lg:min-h-0 lg:max-h-[70vh] lg:flex-1'
          : 'max-h-[50vh]',
    ]"
    @scroll="handleScroll"
  >
    <div
      v-for="(entry, index) in logs"
      :key="index"
      class="group flex items-baseline gap-3 border-b border-border/20 px-3 py-[3px] font-mono text-xs hover:bg-[hsl(var(--tac-amber)/0.04)]"
    >
      <span
        v-if="showTimestamps"
        class="shrink-0 select-none border-r border-border/30 pr-3 font-mono text-[10px] tabular-nums text-muted-foreground/70"
      >
        {{ entry.timestamp }}
      </span>
      <span
        class="min-w-0 flex-1 leading-relaxed"
        v-html="colorize(entry.log)"
      />
    </div>
    </div>

    <!-- Following is automatic while pinned to the bottom; this only
         surfaces once the user scrolls up and needs to catch back up. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 translate-y-1"
    >
      <button
        v-if="!isNearBottom"
        class="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.18)] px-3 py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] shadow-lg backdrop-blur transition-colors hover:bg-[hsl(var(--tac-amber)/0.3)]"
        @click="jumpToLive"
      >
        <PlayIcon class="h-3 w-3" />
        {{ $t("ui.logs.jump_to_live") }}
      </button>
    </Transition>
  </div>
</template>

<script lang="ts">
import Convert from "ansi-to-html";
import { PlayIcon } from "lucide-vue-next";

const convert = new Convert();

type LogEntry = {
  log: string;
  node: string;
  container: string;
  timestamp: string;
  pod: string;
};

export default {
  components: { PlayIcon },
  emits: ["follow-logs-changed", "load-more-logs"],
  props: {
    pod: {
      type: String,
      required: true,
    },
    logs: {
      type: Array as () => LogEntry[],
      required: true,
    },
    showTimestamps: {
      type: Boolean,
      default: false,
    },
    follow: {
      type: Boolean,
      default: true,
    },
    fill: {
      type: Boolean,
      default: false,
    },
    maximized: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      isLoadingMore: false,
      previousLogsLength: 0,
      previousIsNearBottom: true,
      previousIsNearTop: false,
      scrollStateBeforeUpdate: {
        scrollTop: 0,
        scrollHeight: 0,
      },
    };
  },

  computed: {
    isNearBottom(): boolean {
      if (!this.scrollHeight || !this.clientHeight) return true;
      const threshold = 100; // pixels from bottom
      return (
        this.scrollTop + this.clientHeight >= this.scrollHeight - threshold
      );
    },

    isNearTop(): boolean {
      if (this.follow) {
        return false;
      }
      if (!this.scrollHeight) {
        return false;
      }
      return this.scrollTop <= 5000;
    },

    oldestLogTime(): Date {
      if (!this.logs || this.logs.length === 0) {
        return;
      }
      const firstLog = this.logs[0];
      if (!firstLog || !firstLog.timestamp) {
        return;
      }
      return new Date(firstLog.timestamp);
    },
  },

  methods: {
    handleScroll() {
      if (this.$refs.scrollContainer) {
        const el = this.$refs.scrollContainer as HTMLElement;
        this.scrollTop = el.scrollTop;
        this.scrollHeight = el.scrollHeight;
        this.clientHeight = el.clientHeight;
      }
    },
    colorize(log: string) {
      return convert.toHtml(log);
    },

    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.scrollContainer) {
          const el = this.$refs.scrollContainer as HTMLElement;
          el.scrollTop = el.scrollHeight;
          this.handleScroll();
        }
      });
    },

    jumpToLive() {
      this.scrollToBottom();
      this.$emit("follow-logs-changed", true);
    },

    requestMoreLogs() {
      if (!this.isLoadingMore && this.isNearTop && this.oldestLogTime) {
        this.isLoadingMore = true;
        this.$emit("load-more-logs", {
          pod: this.pod,
          oldestLogTime: this.oldestLogTime,
        });
      }
    },
  },

  beforeUpdate() {
    // Capture scroll state BEFORE Vue updates the DOM
    const container = this.$refs.scrollContainer as HTMLElement;
    if (container && this.isLoadingMore) {
      this.scrollStateBeforeUpdate = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }
  },

  updated() {
    // Restore scroll position AFTER Vue updates the DOM
    const container = this.$refs.scrollContainer as HTMLElement;
    if (!container) return;

    const newLogsLength = this.logs?.length || 0;
    const wasLoadingMore = this.isLoadingMore;

    // If we were loading more (prepending logs), preserve scroll position
    if (
      wasLoadingMore &&
      this.previousLogsLength > 0 &&
      newLogsLength > this.previousLogsLength
    ) {
      const heightDifference =
        container.scrollHeight - this.scrollStateBeforeUpdate.scrollHeight;
      if (heightDifference > 0) {
        // Adjust scrollTop to maintain visual position
        container.scrollTop =
          this.scrollStateBeforeUpdate.scrollTop + heightDifference;
        this.handleScroll();
      }
    }

    // Update previous length for next comparison
    this.previousLogsLength = newLogsLength;

    // Auto-scroll to bottom if following
    if (this.follow && this.isNearBottom) {
      this.scrollToBottom();
    }

    // Reset loading flag
    this.isLoadingMore = false;
  },

  watch: {
    isNearBottom(newValue) {
      this.$emit("follow-logs-changed", newValue);
    },

    isNearTop(newValue) {
      if (newValue) {
        this.requestMoreLogs();
      }
    },

    follow(newValue) {
      if (newValue) {
        this.scrollToBottom();
      }
    },
  },

  mounted() {
    this.handleScroll();
    this.previousLogsLength = this.logs?.length || 0;
    this.$nextTick(() => {
      this.$emit("follow-logs-changed", this.isNearBottom);
      if (this.follow) {
        this.scrollToBottom();
      }
    });
  },
};
</script>
