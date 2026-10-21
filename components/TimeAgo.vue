<script lang="ts" setup>
import { CalendarIcon } from "lucide-vue-next";
</script>

<template>
  <span class="inline-flex items-center gap-2 whitespace-nowrap">
    <CalendarIcon class="h-4 w-4 shrink-0" v-if="!seconds && !hideIcon" />
    {{ text }}
  </span>
</template>

<script lang="ts">
import { shallowRef } from "vue";
import TimeAgo from "javascript-time-ago";
import type { LocaleData } from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import { dateLocale } from "~/utilities/dateLocale";

TimeAgo.addDefaultLocale(en);

// A language downloads only once it is picked; until then times read English.
const localeLoaders: Record<string, () => Promise<{ default: LocaleData }>> = {
  ar: () => import("javascript-time-ago/locale/ar"),
  da: () => import("javascript-time-ago/locale/da"),
  de: () => import("javascript-time-ago/locale/de"),
  es: () => import("javascript-time-ago/locale/es"),
  fr: () => import("javascript-time-ago/locale/fr"),
  it: () => import("javascript-time-ago/locale/it"),
  ja: () => import("javascript-time-ago/locale/ja"),
  ko: () => import("javascript-time-ago/locale/ko"),
  pl: () => import("javascript-time-ago/locale/pl"),
  pt: () => import("javascript-time-ago/locale/pt"),
  ru: () => import("javascript-time-ago/locale/ru"),
  sv: () => import("javascript-time-ago/locale/sv"),
  tr: () => import("javascript-time-ago/locale/tr"),
  uk: () => import("javascript-time-ago/locale/uk"),
  "zh-Hans": () => import("javascript-time-ago/locale/zh"),
  "zh-Hant": () => import("javascript-time-ago/locale/zh-Hant"),
};

const formatters = shallowRef<Record<string, TimeAgo>>({
  en: new TimeAgo("en"),
});
const requestedLocales = new Set<string>();

// Each language is requested once per page load: one that fails stays English
// rather than every mounted TimeAgo requesting it again.
function loadLocale(code: string) {
  const load = localeLoaders[code];
  if (!load || requestedLocales.has(code)) {
    return;
  }
  requestedLocales.add(code);
  load()
    .then(({ default: locale }) => {
      TimeAgo.addLocale(locale);
      formatters.value = {
        ...formatters.value,
        [code]: new TimeAgo(locale.locale),
      };
    })
    .catch(() => {});
}

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
    // Counts down to a future date instead of up from a past one. `seconds`
    // alone renders now - date, which goes negative for anything upcoming.
    countdown: {
      required: false,
      type: Boolean,
      default: false,
    },
    hideIcon: {
      required: false,
      type: Boolean,
      default: false,
    },
    clockAfterHour: {
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
  computed: {
    formatter(): TimeAgo {
      return formatters.value[this.$i18n.locale] ?? formatters.value.en;
    },
  },
  watch: {
    "$i18n.locale": {
      immediate: true,
      handler(code: string) {
        loadLocale(code);
      },
    },
    formatter() {
      this.updateText();
    },
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
      this.unsubscribe = subscribe(this.seconds || this.countdown, () =>
        this.updateText(),
      );
    },
    detach() {
      this.unsubscribe?.();
      this.unsubscribe = null;
    },
    clockText(time: Date) {
      const now = new Date();
      // The relative text reads the date a second early and rounds 59.5
      // minutes up to "1 hour ago"; the clock takes over at that moment.
      if (now.getTime() - time.getTime() + 1000 < 59.5 * 60 * 1000) {
        return "";
      }

      if (time.toDateString() === now.toDateString()) {
        return time.toLocaleTimeString(dateLocale(), {
          hour: "numeric",
          minute: "2-digit",
        });
      }

      return time.toLocaleString(dateLocale(), {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: time.getFullYear() === now.getFullYear() ? undefined : "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
    updateText() {
      const time = new Date(this.date);
      if (Number.isNaN(time.getTime())) {
        this.text = "";
        return;
      }
      if (this.countdown) {
        const remaining = Math.max(
          0,
          Math.floor((time.getTime() - Date.now()) / 1000),
        );
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;

        this.text =
          hours > 0
            ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`
            : `${minutes}:${seconds.toString().padStart(2, "0")}`;
        return;
      }

      const clock = this.clockAfterHour ? this.clockText(time) : "";
      if (clock) {
        this.text = clock;
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

        // Every segment below the largest one is always emitted, zero padded.
        // Dropping empty segments rendered exactly three minutes as "3:", and
        // collapsed 1h00m30s to "1:30" -- which reads as a minute and a half,
        // so the timer appeared to run backwards from "59:59".
        const pad = (value: number) => value.toString().padStart(2, "0");

        this.text =
          hours > 0
            ? `${hours}:${pad(minutes)}:${pad(seconds)}`
            : `${minutes}:${pad(seconds)}`;
      } else {
        this.text = this.formatter.format(time);
      }
    },
  },
};
</script>
