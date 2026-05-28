<script setup lang="ts">
import { Button } from "@/components/ui/button";

type SettingsSideTabItem = {
  path: string;
  label: string;
};

type SettingsSideTabGroup = {
  label: string;
  items: SettingsSideTabItem[];
};

const props = defineProps<{
  /** Grouped tabs with section headers. */
  groups?: SettingsSideTabGroup[];
  /** Flat tabs (no headers) — convenience for simple navs. */
  items?: SettingsSideTabItem[];
  activePath: string;
  ariaLabel?: string;
}>();

// Normalize to groups; a flat `items` list becomes one header-less group.
const renderGroups = computed<SettingsSideTabGroup[]>(() =>
  props.groups ?? [{ label: "", items: props.items ?? [] }],
);

const navRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const hasAnimated = ref(false);

function updateIndicator() {
  const nav = navRef.value;
  if (!nav) return;

  const active = nav.querySelector(
    "[data-settings-tab-active='true']",
  ) as HTMLElement | null;

  if (!active) {
    indicatorHeight.value = 0;
    hasAnimated.value = false;
    return;
  }

  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorY.value = activeRect.top - navRect.top;
  indicatorHeight.value = activeRect.height;

  nextTick(() => {
    hasAnimated.value = true;
  });
}

let observer: MutationObserver | null = null;

watch(
  () => [props.activePath, renderGroups.value],
  () => nextTick(updateIndicator),
  { deep: true },
);

onMounted(() => {
  nextTick(updateIndicator);

  const nav = navRef.value;
  if (!nav) return;

  observer = new MutationObserver(updateIndicator);
  observer.observe(nav, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-settings-tab-active", "class"],
  });
  window.addEventListener("resize", updateIndicator);
});

onUnmounted(() => {
  observer?.disconnect();
  window.removeEventListener("resize", updateIndicator);
});

const showIndicator = computed(() => indicatorHeight.value > 0);
</script>

<template>
  <nav
    ref="navRef"
    :aria-label="ariaLabel"
    class="relative hidden min-w-[12rem] flex-col gap-1 border-r border-border/70 pr-2 lg:flex"
  >
    <div
      v-show="showIndicator"
      class="pointer-events-none absolute right-[-1px] top-0 z-10 w-0.5 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.45)] motion-reduce:transition-none"
      :class="
        hasAnimated
          ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),height_0.18s_ease]'
          : ''
      "
      :style="{
        transform: `translateY(${indicatorY}px)`,
        height: `${indicatorHeight}px`,
      }"
    />

    <div
      v-for="(group, groupIndex) in renderGroups"
      :key="group.label || groupIndex"
      class="flex flex-col gap-1"
      :class="groupIndex > 0 ? 'mt-4' : ''"
    >
      <p
        v-if="group.label"
        class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60"
      >
        {{ group.label }}
      </p>

      <Button
        v-for="item in group.items"
        :key="item.path"
        as-child
        variant="ghost"
        class="relative z-[1] h-9 w-full justify-start overflow-hidden rounded-sm px-3 text-left transition-colors duration-200 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground"
        :class="
          item.path === activePath
            ? 'bg-[hsl(var(--tac-amber)/0.06)] text-foreground'
            : 'text-muted-foreground'
        "
      >
        <NuxtLink
          :to="item.path"
          :aria-current="item.path === activePath ? 'page' : undefined"
          :data-settings-tab-active="item.path === activePath ? 'true' : 'false'"
        >
          <span class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </Button>
    </div>

    <div v-if="$slots.actions" class="mt-2 border-t border-border/50 pt-2">
      <slot name="actions" />
    </div>
  </nav>
</template>
