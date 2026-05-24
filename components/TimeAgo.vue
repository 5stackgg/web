<script lang="ts" setup>
import { CalendarIcon } from "lucide-vue-next";
</script>

<template>
  <span class="inline-flex items-center gap-2 whitespace-nowrap">
    <CalendarIcon class="h-4 w-4 shrink-0" v-if="!seconds" />
    {{ text }}
  </span>
</template>

<script lang="ts">
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";

TimeAgo.addDefaultLocale(en);

// Shared tickers — every TimeAgo subscribes to the right clock instead
// of allocating its own setInterval. Match-list / clip-list / chat pages
// can mount dozens of TimeAgo instances at once; one timer per instance
// turns into a measurable wake-storm during playback. Two clocks because
// minute-resolution displays shouldn't wake the page every second.
type Tick = () => void;
const minuteSubscribers = new Set<Tick>();
const secondSubscribers = new Set<Tick>();
let minuteTimer: ReturnType<typeof setInterval> | null = null;
let secondTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerInstalled = false;

function fireAll(set: Set<Tick>) {
  for (const fn of set) {
    try {
      fn();
    } catch {
      /* one bad ticker shouldn't take the whole list down */
    }
  }
}

function syncTimers() {
  if (typeof window === "undefined") return;
  const hidden = typeof document !== "undefined" && document.hidden;

  if (!hidden && minuteSubscribers.size > 0 && !minuteTimer) {
    minuteTimer = setInterval(() => fireAll(minuteSubscribers), 10_000);
  } else if ((hidden || minuteSubscribers.size === 0) && minuteTimer) {
    clearInterval(minuteTimer);
    minuteTimer = null;
  }

  if (!hidden && secondSubscribers.size > 0 && !secondTimer) {
    secondTimer = setInterval(() => fireAll(secondSubscribers), 1_000);
  } else if ((hidden || secondSubscribers.size === 0) && secondTimer) {
    clearInterval(secondTimer);
    secondTimer = null;
  }
}

function installVisibilityListener() {
  if (visibilityListenerInstalled || typeof document === "undefined") return;
  visibilityListenerInstalled = true;
  document.addEventListener("visibilitychange", () => {
    syncTimers();
    // Run a one-shot resync on the way back so labels aren't stale
    // for up to a full minute after the tab returns.
    if (!document.hidden) {
      fireAll(minuteSubscribers);
      fireAll(secondSubscribers);
    }
  });
}

function subscribe(seconds: boolean, fn: Tick) {
  installVisibilityListener();
  const set = seconds ? secondSubscribers : minuteSubscribers;
  set.add(fn);
  syncTimers();
  return () => {
    set.delete(fn);
    syncTimers();
  };
}

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
      unsubscribe: null as null | (() => void),
    };
  },
  watch: {
    date: {
      immediate: true,
      handler() {
        this.updateText();
      },
    },
    seconds: {
      handler() {
        // Mode swap (seconds <-> minutes) needs the timer rewire — drop
        // the old subscription and pick up the right tick cadence.
        this.detach();
        this.attach();
      },
    },
  },
  mounted() {
    this.attach();
  },
  beforeUnmount() {
    this.detach();
  },
  methods: {
    attach() {
      if (this.unsubscribe) return;
      this.unsubscribe = subscribe(this.seconds, () => this.updateText());
    },
    detach() {
      this.unsubscribe?.();
      this.unsubscribe = null;
    },
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
