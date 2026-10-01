<script setup lang="ts">
import { ref, computed, useId } from "vue";
import { useI18n } from "vue-i18n";
import {
  dailyActivity,
  niceScale,
  type HourBucket,
} from "~/utilities/communityStats";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import { dateLocale } from "~/utilities/dateLocale";

const props = defineProps<{
  hourly: HourBucket[];
  serverLabel: string;
}>();

const { t } = useI18n();
const format = useCommunityFormat();
const hatchId = `activity-hatch-${useId()}`;

const WIDTH = 640;
const HEIGHT = 230;
const LEFT = 40;
const RIGHT = 8;
const TOP = 26;
const BOTTOM = 30;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;
const RADIUS = 4;

const active = ref<number | null>(null);

const days = computed(() => dailyActivity(props.hourly ?? []));

// Floored at an hour so a quiet server's axis reads 0 / 30m / 1h instead of
// a column of identical "0h" ticks.
const scale = computed(() =>
  niceScale(Math.max(...days.value.map((day) => day.seconds / 3600), 1)),
);

const band = computed(() => PLOT_WIDTH / Math.max(days.value.length, 1));
const barWidth = computed(() => Math.min(46, band.value * 0.55));

function y(hours: number) {
  return TOP + PLOT_HEIGHT - (hours / scale.value.max) * PLOT_HEIGHT;
}

const peakIndex = computed(() => {
  let best = -1;

  days.value.forEach((day, index) => {
    if (
      day.seconds > 0 &&
      (best < 0 || day.seconds > days.value[best].seconds)
    ) {
      best = index;
    }
  });

  return best;
});

const columns = computed(() =>
  days.value.map((day, index) => {
    const hours = day.seconds / 3600;
    const center = LEFT + band.value * index + band.value / 2;
    const x = center - barWidth.value / 2;
    const base = y(0);
    const top = y(hours);
    const radius = Math.min(RADIUS, base - top, barWidth.value / 2);
    const right = x + barWidth.value;
    const path =
      hours > 0
        ? `M${x},${base} V${top + radius} Q${x},${top} ${x + radius},${top} H${right - radius} Q${right},${top} ${right},${top + radius} V${base} Z`
        : null;
    const fullDate = format.day(day.date);

    return {
      ...day,
      index,
      hours,
      center,
      top,
      path,
      label: day.today
        ? t("community.server_page.today")
        : day.date.toLocaleDateString(dateLocale(), { weekday: "short" }),
      fullDate: day.today
        ? t("community.server_page.today_so_far", { date: fullDate })
        : fullDate,
      hoursText: format.hours(day.seconds),
      showPeak: index === peakIndex.value && !day.today,
    };
  }),
);

const tooltip = computed(() =>
  active.value === null ? null : columns.value[active.value],
);

function tickLabel(value: number) {
  return format.hours(value * 3600);
}

function columnLabel(column: (typeof columns.value)[number]) {
  return t("community.server_page.chart_column", {
    date: column.fullDate,
    hours: column.hoursText,
    players: format.count(column.peakPlayers),
  });
}
</script>

<template>
  <div>
    <div class="relative overflow-x-auto">
      <div class="relative min-w-[480px]">
        <svg
          class="block h-auto w-full"
          :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
          role="group"
          :aria-label="
            $t('community.server_page.chart_title', { server: serverLabel })
          "
        >
          <defs>
            <pattern
              :id="hatchId"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="2" height="5" class="activity-fill" />
            </pattern>
          </defs>

          <g v-for="tick in scale.ticks" :key="tick" aria-hidden="true">
            <line
              :x1="LEFT"
              :x2="WIDTH - RIGHT"
              :y1="y(tick)"
              :y2="y(tick)"
              class="activity-grid"
            />
            <text
              :x="LEFT - 8"
              :y="y(tick) + 4"
              text-anchor="end"
              class="activity-axis"
            >
              {{ tickLabel(tick) }}
            </text>
          </g>

          <g
            v-for="column in columns"
            :key="column.key"
            class="outline-none"
            tabindex="0"
            role="img"
            :aria-label="columnLabel(column)"
            :data-day="column.key"
            @mouseenter="active = column.index"
            @mouseleave="active = null"
            @focus="active = column.index"
            @blur="active = null"
          >
            <rect
              :x="LEFT + band * column.index"
              :y="TOP"
              :width="band"
              :height="PLOT_HEIGHT"
              fill="transparent"
            />
            <path
              v-if="column.path"
              :d="column.path"
              class="activity-bar"
              :class="[
                column.today ? 'activity-bar--today' : 'activity-fill',
                active === column.index && 'opacity-80',
              ]"
              :style="{
                '--bar-index': column.index,
                fill: column.today ? `url(#${hatchId})` : undefined,
              }"
            />
            <text
              v-if="column.showPeak"
              :x="column.center"
              :y="column.top - 8"
              text-anchor="middle"
              class="activity-value"
              data-peak
            >
              {{ column.hoursText }}
            </text>
            <text
              v-if="column.today && column.seconds > 0"
              :x="column.center"
              :y="column.top - 8"
              text-anchor="middle"
              class="activity-value activity-value--sub"
              data-today
            >
              {{
                $t("community.server_page.so_far", { hours: column.hoursText })
              }}
            </text>
            <text
              :x="column.center"
              :y="HEIGHT - 10"
              text-anchor="middle"
              class="activity-axis"
              :class="column.today && 'activity-axis--today'"
            >
              {{ column.label }}
            </text>
          </g>
        </svg>

        <div
          v-if="tooltip"
          role="tooltip"
          class="pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
          :style="{
            left: `${(tooltip.center / WIDTH) * 100}%`,
            top: `${(Math.min(tooltip.top, HEIGHT - BOTTOM) / HEIGHT) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }"
        >
          <div class="font-medium">{{ tooltip.fullDate }}</div>
          <div class="text-muted-foreground">
            <span class="font-mono font-semibold text-foreground">{{
              tooltip.hoursText
            }}</span>
            {{ $t("community.server_page.played") }} ·
            <span class="font-mono font-semibold text-foreground">{{
              format.count(tooltip.peakPlayers)
            }}</span>
            {{ $t("community.server_page.peak_players") }}
          </div>
        </div>
      </div>
    </div>

    <div
      class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
      aria-hidden="true"
    >
      <span class="inline-flex items-center gap-1.5">
        <i
          class="inline-block h-2.5 w-3 rounded-sm bg-[hsl(var(--tac-amber))]"
        />
        {{ $t("community.server_page.full_day") }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <i
          class="inline-block h-2.5 w-3 rounded-sm shadow-[inset_0_0_0_1px_hsl(var(--tac-amber))] [background:repeating-linear-gradient(135deg,hsl(var(--tac-amber))_0_2px,transparent_2px_5px)]"
        />
        {{ $t("community.server_page.today_partial") }}
      </span>
    </div>

    <table class="sr-only">
      <caption>
        {{
          $t("community.server_page.chart_title", { server: serverLabel })
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ $t("community.server_page.day") }}</th>
          <th scope="col">{{ $t("community.server_page.player_hours") }}</th>
          <th scope="col">{{ $t("community.server_page.busiest_hour") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="column in columns" :key="column.key">
          <td>{{ column.fullDate }}</td>
          <td>{{ column.hoursText }}</td>
          <td>{{ format.count(column.peakPlayers) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.activity-fill {
  fill: hsl(var(--tac-amber));
}

.activity-grid {
  stroke: hsl(var(--border));
  stroke-width: 1;
}

.activity-axis {
  fill: hsl(var(--muted-foreground));
  font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.activity-axis--today {
  fill: hsl(var(--foreground));
}

.activity-value {
  fill: hsl(var(--foreground));
  font: 600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.activity-value--sub {
  fill: hsl(var(--muted-foreground));
  font-weight: 400;
}

.activity-bar {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  transition: opacity 0.15s ease;
  animation: activity-bar-grow 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--bar-index) * 45ms);
}

.activity-bar--today {
  stroke: hsl(var(--tac-amber));
  stroke-width: 1;
}

@keyframes activity-bar-grow {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity-bar {
    animation: none;
    transition: none;
  }
}
</style>
