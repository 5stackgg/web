<template>
  <div
    ref="scrollContainer"
    class="overflow-auto whitespace-nowrap max-h-[50vh]"
  >
    <div
      v-for="(entry, index) in logs"
      :key="index"
      class="text-xs font-mono py-1 flex gap-4"
    >
      <span v-if="showTimestamps" class="text-muted-foreground">
        {{ entry.timestamp }}
      </span>
      <span v-html="colorize(entry.log)" />
    </div>
  </div>
</template>

<script lang="ts">
import Convert from "ansi-to-html";

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
  },

  methods: {
    colorize(log: string) {
      return convert.toHtml(log);
    },

    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.scrollContainer) {
          const el = this.$refs.scrollContainer as HTMLElement;
          el.scrollTop = el.scrollHeight;
        }
      });
    },
  },

  watch: {
    logs: {
      deep: true,
      handler() {
        if (this.follow) {
          this.scrollToBottom();
        }
      },
    },
  },

  mounted() {
    if (this.follow) {
      this.scrollToBottom();
    }
  },
};
</script>
