<script lang="ts" setup>
import { CalendarIcon } from "lucide-vue-next";
</script>

<template>
  <span class="flex items-center gap-2">
    <CalendarIcon class="h-4 w-4" />
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
      type: String,
    },
  },
  data() {
    return {
      text: "",
      interval: undefined,
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
    this.interval = setInterval(() => {
      this.updateText();
    }, 1000 * 10);
  },
  beforeUnmount() {
    clearInterval(this.interval);
  },
  methods: {
    updateText() {
      const timeAgo = new TimeAgo("en-US");

      const time = new Date(this.date);

      time.setSeconds(time.getSeconds() - 1);

      this.text = timeAgo.format(time);
    },
  },
};
</script>
