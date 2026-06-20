<script lang="ts" setup>
import {
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  computed,
} from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

type FilterOption = {
  key: string;
  label: string;
  title?: string;
  desc?: string;
  count?: number;
  disabled?: boolean;
  icon?: any;
};

const props = defineProps<{
  options: FilterOption[];
  square?: boolean;
  size?: "lg";
  block?: boolean;
}>();

const model = defineModel<string>();

const containerShape = computed(() =>
  props.square ? "rounded-md" : "rounded-full",
);
const indicatorShape = computed(() =>
  props.square ? "rounded" : "rounded-full",
);
const buttonShape = computed(() => {
  const base = props.block ? "flex-1" : "";
  if (props.size === "lg") {
    return `inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2.5 font-mono text-[0.72rem] font-bold uppercase leading-tight tracking-[0.08em] ${base}`;
  }
  return props.square
    ? `inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${base}`
    : `inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs tracking-[0.06em] ${base}`;
});
function buttonState(opt: FilterOption) {
  if (opt.disabled) {
    return "cursor-not-allowed text-muted-foreground/40";
  }
  return model.value === opt.key
    ? "font-bold text-black"
    : "text-muted-foreground hover:text-foreground";
}

const containerRef = ref<HTMLElement | null>(null);
const btns = ref<Record<string, HTMLElement | null>>({});
const indicator = ref({ left: 0, top: 0, width: 0, height: 0, ready: false });
const animate = ref(false);

function setBtn(el: Element | null, key: string) {
  if (el) {
    btns.value[key] = el as HTMLElement;
  } else {
    delete btns.value[key];
  }
}

function updateIndicator() {
  const el = model.value ? btns.value[model.value] : null;
  if (!el || !containerRef.value || el.offsetWidth === 0) {
    indicator.value = { ...indicator.value, ready: false };
    animate.value = false;
    return;
  }
  const wasReady = indicator.value.ready;
  indicator.value = {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    ready: true,
  };
  if (!wasReady) {
    animate.value = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        animate.value = true;
      }),
    );
  }
}

let ro: ResizeObserver | null = null;
onMounted(() => {
  nextTick(updateIndicator);
  if (typeof ResizeObserver !== "undefined" && containerRef.value) {
    ro = new ResizeObserver(() => updateIndicator());
    ro.observe(containerRef.value);
  }
});
onBeforeUnmount(() => ro?.disconnect());

watch(
  () => [model.value, props.options.map((o) => o.key).join(",")],
  () => nextTick(updateIndicator),
);
</script>

<template>
  <div
    ref="containerRef"
    class="relative max-w-full gap-1 self-start border border-border bg-muted/30 p-1"
    :class="[
      containerShape,
      block ? 'flex w-full' : 'inline-flex w-fit flex-wrap',
    ]"
  >
    <span
      class="pointer-events-none absolute bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_-2px_hsl(var(--tac-amber)/0.6)]"
      :class="[
        indicatorShape,
        indicator.ready ? 'opacity-100' : 'opacity-0',
        animate ? 'transition-all duration-300 ease-out' : '',
      ]"
      :style="{
        left: `${indicator.left}px`,
        top: `${indicator.top}px`,
        width: `${indicator.width}px`,
        height: `${indicator.height}px`,
      }"
    />
    <template v-for="opt in options" :key="opt.key">
      <FiveStackToolTip
        v-if="opt.title || opt.desc"
        as-child
        side="top"
        :delay-duration="120"
        :tap-toggle="false"
      >
        <template #trigger>
          <button
            :ref="(el) => setBtn(el as Element | null, opt.key)"
            type="button"
            :disabled="opt.disabled"
            class="relative z-10 transition-colors duration-200"
            :class="[buttonShape, buttonState(opt)]"
            @click="!opt.disabled && (model = opt.key)"
          >
            <component :is="opt.icon" v-if="opt.icon" class="h-4 w-4" />
            {{ opt.label }}
            <span v-if="opt.count !== undefined" class="ml-1 opacity-60">{{
              opt.count
            }}</span>
          </button>
        </template>
        <div class="max-w-[220px] space-y-0.5">
          <div
            v-if="opt.title"
            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
          >
            {{ opt.title }}
          </div>
          <div
            v-if="opt.desc"
            class="text-xs leading-snug text-muted-foreground"
          >
            {{ opt.desc }}
          </div>
        </div>
      </FiveStackToolTip>
      <button
        v-else
        :ref="(el) => setBtn(el as Element | null, opt.key)"
        type="button"
        :disabled="opt.disabled"
        class="relative z-10 transition-colors duration-200"
        :class="[buttonShape, buttonState(opt)]"
        @click="!opt.disabled && (model = opt.key)"
      >
        <component :is="opt.icon" v-if="opt.icon" class="h-4 w-4" />
        {{ opt.label }}
        <span v-if="opt.count !== undefined" class="ml-1 opacity-60">{{
          opt.count
        }}</span>
      </button>
    </template>
  </div>
</template>
