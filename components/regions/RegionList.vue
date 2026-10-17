<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Skeleton } from "~/components/ui/skeleton";
import RegionListItem from "~/components/regions/RegionListItem.vue";
import { useListKeyboard } from "~/composables/useListKeyboard";

const props = defineProps<{
  regions?: Array<{
    value: string;
    description?: string | null;
    status?: string | null;
    steam_relay: boolean;
    is_lan: boolean;
    available_server_count?: number | null;
    total_server_count?: number | null;
  }>;
  selectedValue?: string | null;
}>();

const emit = defineEmits<{
  (e: "select", value: string): void;
  /** ↑/↓ moved to a region: show it, without pushing the detail on phones. */
  (e: "move", value: string): void;
}>();

// ↑/↓ walk the regions and the detail follows; Enter opens the one picked
// (on phones that pushes its detail over the list).
const activeValue = ref<string | null>(null);
const keys = useListKeyboard({
  items: () => props.regions ?? [],
  getId: (region) => region.value,
  activeId: activeValue,
  onOpen: (value) => emit("select", value),
});

watch(activeValue, (value) => {
  if (value && value !== props.selectedValue) {
    emit("move", value);
  }
});

// Tab lands on the region being shown; a nav button carries aria-current,
// not aria-selected.
function rowProps(value: string) {
  const {
    "aria-selected": _selected,
    tabindex: _tabindex,
    ...rest
  } = keys.rowProps(value);
  const values = (props.regions ?? []).map((region) => region.value);
  const tabbable =
    [activeValue.value, props.selectedValue].find(
      (candidate) => !!candidate && values.includes(candidate),
    ) ?? values[0];
  return { ...rest, tabindex: value === tabbable ? 0 : -1 };
}

// The settings rail's indicator: an amber bar on the right hairline that
// glides to the picked row. It jumps (no glide) on first placement, when the
// rows themselves change, and on resize.
const navRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const indicatorShown = ref(false);
const animateIndicator = ref(false);

async function place(glide: boolean) {
  const active = navRef.value?.querySelector<HTMLElement>(
    "[aria-current='true']",
  );
  if (!active) {
    indicatorShown.value = false;
    animateIndicator.value = false;
    return;
  }
  if (!glide || !indicatorShown.value) {
    animateIndicator.value = false;
  }
  indicatorY.value = active.offsetTop;
  indicatorHeight.value = active.offsetHeight;
  indicatorShown.value = true;
  if (animateIndicator.value) {
    return;
  }
  await nextTick();
  // Commit the jump before the transition comes back on.
  void indicatorRef.value?.offsetHeight;
  animateIndicator.value = true;
}

const rowsKey = computed(() =>
  (props.regions ?? []).map((region) => region.value).join("|"),
);

watch(
  () => props.selectedValue,
  () => nextTick(() => place(true)),
);
watch(rowsKey, () => nextTick(() => place(false)));

const jump = () => place(false);

onMounted(() => {
  nextTick(jump);
  window.addEventListener("resize", jump);
});

onUnmounted(() => {
  window.removeEventListener("resize", jump);
});
</script>

<template>
  <nav
    ref="navRef"
    :aria-label="$t('pages.regions.list.label')"
    class="relative flex min-w-0 flex-col gap-0.5 lg:border-r lg:border-border/70 lg:pr-2"
  >
    <div
      ref="indicatorRef"
      class="pointer-events-none absolute right-[-1px] top-0 z-10 hidden w-0.5 rounded-full bg-[hsl(var(--tac-amber))] transition-opacity duration-150 motion-reduce:transition-none lg:block"
      :class="[
        indicatorShown ? 'opacity-100' : 'opacity-0',
        animateIndicator &&
          '[transition-duration:240ms] [transition-property:transform,height,opacity] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]',
      ]"
      :style="{
        transform: `translateY(${indicatorY}px)`,
        height: `${indicatorHeight}px`,
      }"
    />

    <template v-if="regions">
      <RegionListItem
        v-for="region in regions"
        :key="region.value"
        :region="region"
        v-bind="rowProps(region.value)"
        :current="region.value === selectedValue"
        @select="$emit('select', region.value)"
      />
    </template>
    <template v-else>
      <Skeleton v-for="n in 3" :key="n" class="h-[42px] rounded-md" />
    </template>
  </nav>
</template>
