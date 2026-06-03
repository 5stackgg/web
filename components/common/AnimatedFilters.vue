<script lang="ts" setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

type FilterOption = {
  key: string;
  label: string;
  title?: string;
  desc?: string;
  count?: number;
  disabled?: boolean;
};

const props = defineProps<{
  options: FilterOption[];
}>();

const model = defineModel<string>();

const containerRef = ref<HTMLElement | null>(null);
const btns = ref<Record<string, HTMLElement | null>>({});
const indicator = ref({ left: 0, top: 0, width: 0, height: 0, ready: false });

function setBtn(el: Element | null, key: string) {
  btns.value[key] = (el as HTMLElement) ?? null;
}

function updateIndicator() {
  const el = model.value ? btns.value[model.value] : null;
  if (!el || !containerRef.value) {
    indicator.value = { ...indicator.value, ready: false };
    return;
  }
  indicator.value = {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
    ready: true,
  };
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
    class="relative inline-flex w-fit max-w-full flex-wrap gap-1 self-start rounded-full border border-border bg-muted/30 p-1"
  >
    <!-- sliding active highlight -->
    <span
      class="pointer-events-none absolute rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_-2px_hsl(var(--tac-amber)/0.6)] transition-all duration-300 ease-out"
      :class="indicator.ready ? 'opacity-100' : 'opacity-0'"
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
      >
        <template #trigger>
          <button
            :ref="(el) => setBtn(el as Element | null, opt.key)"
            type="button"
            :disabled="opt.disabled"
            class="relative z-10 rounded-full px-3 py-1.5 text-xs tracking-[0.06em] transition-colors duration-200"
            :class="
              opt.disabled
                ? 'cursor-not-allowed text-muted-foreground/40'
                : model === opt.key
                  ? 'font-bold text-black'
                  : 'text-muted-foreground hover:text-foreground'
            "
            @click="!opt.disabled && (model = opt.key)"
          >
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
          <div v-if="opt.desc" class="text-xs leading-snug text-muted-foreground">
            {{ opt.desc }}
          </div>
        </div>
      </FiveStackToolTip>
      <button
        v-else
        :ref="(el) => setBtn(el as Element | null, opt.key)"
        type="button"
        :disabled="opt.disabled"
        class="relative z-10 rounded-full px-3 py-1.5 text-xs tracking-[0.06em] transition-colors duration-200"
        :class="
          opt.disabled
            ? 'cursor-not-allowed text-muted-foreground/40'
            : model === opt.key
              ? 'font-bold text-black'
              : 'text-muted-foreground hover:text-foreground'
        "
        @click="!opt.disabled && (model = opt.key)"
      >
        {{ opt.label }}
        <span v-if="opt.count !== undefined" class="ml-1 opacity-60">{{
          opt.count
        }}</span>
      </button>
    </template>
  </div>
</template>
