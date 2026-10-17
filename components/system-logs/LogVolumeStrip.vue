<script setup lang="ts">
import { computed, ref } from "vue";
import { hourMinute, type VolumeBucket } from "./logLines";

// Lines per minute over the loaded window, stacked by level with errors on
// the baseline. Hover for the counts; click to jump the stream there.
const props = defineProps<{ buckets: VolumeBucket[] }>();
const emit = defineEmits<{ (e: "jump", bucket: VolumeBucket): void }>();

const bars = ref<HTMLElement | null>(null);
const tip = ref<{ bucket: VolumeBucket; left: number } | null>(null);

const max = computed(() =>
  Math.max(1, ...props.buckets.map((b) => b.LOG + b.WARN + b.ERROR)),
);

const fromLabel = computed(() =>
  props.buckets[0] ? hourMinute(props.buckets[0].t) : "",
);

function show(bucket: VolumeBucket, event: Event) {
  const col = event.currentTarget as HTMLElement;
  const host = bars.value;
  if (!host) return;
  const hr = host.getBoundingClientRect();
  const cr = col.getBoundingClientRect();
  const left = Math.min(
    Math.max(cr.left - hr.left + cr.width / 2, 70),
    hr.width - 70,
  );
  tip.value = { bucket, left };
}
</script>

<template>
  <div v-if="buckets.length" class="relative grid gap-1">
    <div
      ref="bars"
      class="relative flex h-12 items-end gap-px border-b border-[hsl(240_4%_22%)]"
      @pointerleave="tip = null"
    >
      <button
        v-for="(b, i) in buckets"
        :key="i"
        type="button"
        class="lg-col"
        :aria-label="
          $t('pages.system_logs.bar_label', {
            time: hourMinute(b.t),
            total: b.LOG + b.WARN + b.ERROR,
            warnings: b.WARN,
            errors: b.ERROR,
          })
        "
        @pointerenter="show(b, $event)"
        @focus="show(b, $event)"
        @blur="tip = null"
        @click="emit('jump', b)"
      >
        <span
          class="lg-stack"
          :style="{ height: `${((b.LOG + b.WARN + b.ERROR) / max) * 100}%` }"
        >
          <i
            v-if="b.LOG"
            class="bg-[hsl(240_5%_34%)]"
            :style="{ flexGrow: b.LOG }"
          />
          <i v-if="b.WARN" class="bg-amber-500" :style="{ flexGrow: b.WARN }" />
          <i
            v-if="b.ERROR"
            class="bg-destructive"
            :style="{ flexGrow: b.ERROR }"
          />
        </span>
      </button>
      <div
        role="tooltip"
        class="lg-tip"
        :data-show="tip ? '' : undefined"
        :style="{ left: `${tip?.left ?? 0}px` }"
      >
        <template v-if="tip">
          <div>
            {{ hourMinute(tip.bucket.t) }}–{{
              hourMinute(tip.bucket.t + tip.bucket.size)
            }}
          </div>
          <div>
            <span class="lg-key bg-destructive" /><b>{{
              tip.bucket.ERROR.toLocaleString()
            }}</b>
            {{ $t("pages.system_logs.errors_word") }}
          </div>
          <div>
            <span class="lg-key bg-amber-500" /><b>{{
              tip.bucket.WARN.toLocaleString()
            }}</b>
            {{ $t("pages.system_logs.warnings_word") }}
          </div>
          <div>
            <span class="lg-key bg-[hsl(240_5%_34%)]" /><b>{{
              tip.bucket.LOG.toLocaleString()
            }}</b>
            {{ $t("pages.system_logs.log_lines_word") }}
          </div>
        </template>
      </div>
    </div>
    <div
      class="flex items-center justify-between gap-2.5 text-[10.5px] tabular-nums text-muted-foreground/70"
    >
      <span>{{
        buckets[0].size > 60000
          ? $t("pages.system_logs.minutes_per_bar", {
              time: hourMinute(buckets[0].t),
              minutes: buckets[0].size / 60000,
            })
          : fromLabel
      }}</span>
      <span class="hidden gap-2.5 sm:inline-flex">
        <span class="inline-flex items-center gap-1"
          ><i class="lg-legend bg-destructive" />{{
            $t("pages.system_logs.level_error")
          }}</span
        >
        <span class="inline-flex items-center gap-1"
          ><i class="lg-legend bg-amber-500" />{{
            $t("pages.system_logs.level_warning")
          }}</span
        >
        <span class="inline-flex items-center gap-1"
          ><i class="lg-legend bg-[hsl(240_5%_34%)]" />{{
            $t("pages.system_logs.level_log")
          }}</span
        >
      </span>
      <span>{{ $t("pages.system_logs.now") }}</span>
    </div>
  </div>
</template>

<style scoped>
.lg-col {
  flex: 1;
  height: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  border-radius: 2px 2px 0 0;
  transition: background-color 120ms ease;
}
.lg-col:hover,
.lg-col:focus-visible {
  background: hsl(240 4% 13% / 0.8);
}
.lg-stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  max-width: 14px;
  overflow: hidden;
  border-radius: 2px 2px 0 0;
}
.lg-stack i {
  display: block;
  min-height: 2px;
  flex-basis: 0;
}
.lg-tip {
  position: absolute;
  top: -6px;
  z-index: 5;
  display: grid;
  gap: 2px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 6px;
  background: #0c0c0f;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -100%);
  transition: opacity 120ms ease;
}
.lg-tip[data-show] {
  opacity: 1;
}
.lg-tip b {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.lg-key {
  display: inline-block;
  width: 10px;
  height: 2px;
  margin-right: 6px;
  vertical-align: 3px;
  border-radius: 1px;
}
.lg-legend {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
</style>
