<script lang="ts" setup>
import { CalendarIcon } from "lucide-vue-next";
</script>

<template>
  <span class="flex items-center gap-2">
    <CalendarIcon class="h-4 w-4" v-if="!seconds" />
    {{ text }}
  </span>
</template>

<script lang="ts">
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";

TimeAgo.addDefaultLocale(en);

export default {
  props: {
    date: {
      required: true,
      type: [String, Number, Date],
    },
    seconds: {
      required: false,
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      text: "",
      interval: undefined as NodeJS.Timeout | undefined,
    };
  },
  watch: {
    date: {
      immediate: true,
      handler() {
        this.updateText();
      },
    },
  },
  mounted() {
    this.interval = setInterval(
      () => {
        this.updateText();
      },
      this.seconds ? 1000 : 1000 * 10,
    );
  },
  beforeUnmount() {
    clearInterval(this.interval);
  },
  methods: {
    updateText() {
      const timeAgo = new TimeAgo("en-US");
      const time = new Date(this.date);
      if (Number.isNaN(time.getTime())) {
        this.text = "";
        return;
      }
      time.setSeconds(time.getSeconds() - 1);

      if (this.seconds) {
        const now = new Date();
        const diffInSeconds = Math.floor(
          (now.getTime() - time.getTime()) / 1000,
        );

        const hours = Math.floor(diffInSeconds / 3600);
        const minutes = Math.floor((diffInSeconds % 3600) / 60);
        const seconds = diffInSeconds % 60;

        let timeText = "";
        if (hours > 0) {
          timeText += `${hours}:`;
        }
        if (minutes > 0) {
          timeText += `${minutes}:`;
        }
        if (seconds > 0 || timeText === "") {
          timeText += `${seconds.toString().padStart(2, "0")}`;
        }

        this.text = timeText.trim();
      } else {
        this.text = timeAgo.format(time);
      }
    },
  },
};
</script>
