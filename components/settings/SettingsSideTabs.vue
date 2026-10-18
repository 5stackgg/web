<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-vue-next";
import SettingsStatusChip from "~/components/settings/SettingsStatusChip.vue";
import type { SettingsItemStatus } from "~/composables/useSettingsStatus";
import { useListKeyboard } from "~/composables/useListKeyboard";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

type SettingsSideTabItem = {
  path: string;
  label: string;
};

type SettingsSideTabSubgroup = {
  label: string;
  items: SettingsSideTabItem[];
};

type SettingsSideTabGroup = {
  label: string;
  items?: SettingsSideTabItem[];
  subgroups?: SettingsSideTabSubgroup[];
  // A "danger" group holds destructive actions: it sits apart, last, in red.
  tone?: "danger";
};

const props = withDefaults(
  defineProps<{
    /** Grouped tabs with section headers; groups may nest one level. */
    groups?: SettingsSideTabGroup[];
    /** Flat tabs (no headers) — convenience for simple navs. */
    items?: SettingsSideTabItem[];
    activePath: string;
    ariaLabel?: string;
    /** Per-path state shown at the right of each tab (the status board). */
    statuses?: Record<string, SettingsItemStatus>;
    /** "attention" folds away every tab that doesn't need a look. */
    filter?: string;
  }>(),
  { filter: "all" },
);

// Normalize every shape to groups-of-subgroups. A flat `items` list becomes one
// header-less group, and a single-level group becomes one unlabelled subgroup,
// so the template only ever renders one structure.
const renderGroups = computed<
  Array<{
    label: string;
    subgroups: SettingsSideTabSubgroup[];
    danger: boolean;
  }>
>(() => {
  const groups = props.groups ?? [{ label: "", items: props.items ?? [] }];
  return groups.map((group) => ({
    label: group.label,
    subgroups: group.subgroups ?? [{ label: "", items: group.items ?? [] }],
    danger: group.tone === "danger",
  }));
});

function matches(path: string) {
  if (props.filter === "all") return true;
  const status = props.statuses?.[path];
  return props.filter === "attention" && !!status?.attention;
}

const subgroupVisible = (subgroup: SettingsSideTabSubgroup) =>
  subgroup.items.some((item) => matches(item.path));

const navRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const indicatorDanger = ref(false);
const indicatorShown = ref(false);
// Off for the first placement and while it rides along with folding tabs,
// so it never slides in from the top or lags a moving row.
const animateIndicator = ref(false);

function updateIndicator() {
  const nav = navRef.value;
  if (!nav) return;

  const active = nav.querySelector(
    "[data-settings-tab-active='true']",
  ) as HTMLElement | null;

  if (!active) {
    indicatorShown.value = false;
    animateIndicator.value = false;
    return;
  }

  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorY.value = activeRect.top - navRect.top;
  indicatorHeight.value = activeRect.height;
  indicatorDanger.value = active.dataset.settingsTabTone === "danger";
  indicatorShown.value = matches(props.activePath);
}

let followFrame = 0;
let following = false;

// Tabs fold for 240ms when the filter changes; the indicator tracks its row
// frame by frame instead of easing towards a spot that keeps moving.
function follow(duration = 300) {
  cancelAnimationFrame(followFrame);
  following = true;
  animateIndicator.value = false;
  const start = performance.now();
  const step = (now: number) => {
    updateIndicator();
    if (now - start < duration) {
      followFrame = requestAnimationFrame(step);
    } else {
      following = false;
      nextTick(() => (animateIndicator.value = indicatorShown.value));
    }
  };
  followFrame = requestAnimationFrame(step);
}

function place() {
  updateIndicator();
  if (!following) {
    nextTick(() => (animateIndicator.value = indicatorShown.value));
  }
}

let observer: MutationObserver | null = null;

watch(
  () => [props.activePath, renderGroups.value],
  () => nextTick(place),
  { deep: true },
);

// Which tabs are showing; the indicator only has to chase it when it changes.
const visibleKey = computed(() =>
  renderGroups.value
    .flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.items))
    .filter((item) => matches(item.path))
    .map((item) => item.path)
    .join("|"),
);

watch(visibleKey, () => nextTick(() => follow()));

onMounted(() => {
  nextTick(place);

  const nav = navRef.value;
  if (!nav) return;

  observer = new MutationObserver(() => {
    if (!following) updateIndicator();
  });
  observer.observe(nav, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-settings-tab-active"],
  });
  window.addEventListener("resize", updateIndicator);
});

onUnmounted(() => {
  observer?.disconnect();
  cancelAnimationFrame(followFrame);
  window.removeEventListener("resize", updateIndicator);
});

// ↑/↓ walk the sections shown, Home/End jump, Enter opens one. Focus moves;
// the page only changes on Enter, so walking past a section with unsaved
// edits never trips its leave guard.
const visibleItems = computed(() =>
  renderGroups.value
    .flatMap((group) => group.subgroups.flatMap((subgroup) => subgroup.items))
    .filter((item) => matches(item.path)),
);
const focusedPath = ref<string | null>(null);
const railKeys = useListKeyboard({
  items: visibleItems,
  getId: (item) => item.path,
  activeId: focusedPath,
  container: navRef,
  // A real click, so the link navigates and the shell hands the pane back
  // from search results the way a mouse click does.
  onOpen: (path) =>
    navRef.value
      ?.querySelector<HTMLElement>(`[data-list-row="${CSS.escape(path)}"]`)
      ?.click(),
});

// One tab stop: the section being walked, else the open one.
function tabProps(path: string) {
  const {
    "aria-selected": _selected,
    tabindex: _tabindex,
    ...rest
  } = railKeys.rowProps(path);
  const paths = visibleItems.value.map((item) => item.path);
  const tabbable =
    [focusedPath.value, props.activePath].find(
      (candidate) => !!candidate && paths.includes(candidate),
    ) ?? paths[0];
  return { ...rest, tabindex: path === tabbable ? 0 : -1 };
}

// Keys only belong to the rail while focus is in it.
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (!next || !navRef.value?.contains(next)) {
    focusedPath.value = null;
  }
}

// Folds use the app's one clock; `inert` keeps folded tabs out of the tab
// order while they are shut.
const foldClasses =
  "grid transition-[grid-template-rows,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]";
</script>

<template>
  <nav
    ref="navRef"
    :aria-label="ariaLabel"
    class="relative hidden min-w-[12rem] flex-col border-r border-border/70 pr-2 lg:flex lg:min-h-full"
    @focusout="onFocusOut"
  >
    <div
      class="pointer-events-none absolute right-[-1px] top-0 z-10 w-0.5 rounded-full transition-opacity duration-150 motion-reduce:transition-none"
      :class="[
        indicatorDanger ? 'bg-destructive' : 'bg-[hsl(var(--tac-amber))]',
        indicatorShown ? 'opacity-100' : 'opacity-0',
        animateIndicator
          ? '[transition-property:transform,height,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]'
          : '',
      ]"
      :style="{
        transform: `translateY(${indicatorY}px)`,
        height: `${indicatorHeight}px`,
      }"
    />

    <div
      v-for="(group, groupIndex) in renderGroups"
      :key="group.label || groupIndex"
      :class="[
        foldClasses,
        group.subgroups.some(subgroupVisible)
          ? 'grid-rows-[1fr]'
          : 'grid-rows-[0fr] opacity-0',
      ]"
      :inert="!group.subgroups.some(subgroupVisible)"
    >
      <div class="min-h-0 overflow-hidden">
        <div
          class="flex flex-col gap-0.5"
          :class="[
            groupIndex > 0 ? 'pt-5' : '',
            group.danger
              ? 'mt-7 border-t border-dashed border-destructive/35 pt-4'
              : '',
          ]"
        >
          <div
            v-if="group.label"
            :class="[
              tacticalSectionLabelClasses,
              'mb-0 px-3 pb-1.5 text-[0.66rem]',
              group.danger ? '!text-destructive' : '',
            ]"
          >
            <span
              :class="[
                tacticalSectionTickClasses,
                group.danger ? '!bg-destructive' : '',
              ]"
            ></span>
            {{ group.label }}
          </div>

          <div
            v-for="(subgroup, subgroupIndex) in group.subgroups"
            :key="subgroup.label || subgroupIndex"
            :class="[
              foldClasses,
              subgroupVisible(subgroup)
                ? 'grid-rows-[1fr]'
                : 'grid-rows-[0fr] opacity-0',
            ]"
            :inert="!subgroupVisible(subgroup)"
          >
            <div class="min-h-0 overflow-hidden">
              <p
                v-if="subgroup.label"
                class="px-3 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground/60"
              >
                {{ subgroup.label }}
              </p>

              <div
                v-for="item in subgroup.items"
                :key="item.path"
                :class="[
                  foldClasses,
                  matches(item.path)
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr] opacity-0',
                ]"
                :inert="!matches(item.path)"
              >
                <div class="min-h-0 overflow-hidden">
                  <div class="pb-0.5">
                    <Button
                      as-child
                      variant="ghost"
                      class="relative z-[1] h-8 w-full justify-start gap-2 overflow-hidden px-3 text-left text-[13px] font-normal transition-colors duration-150"
                      :class="
                        group.danger
                          ? item.path === activePath
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                            : 'text-destructive/70 hover:bg-destructive/10 hover:text-destructive'
                          : item.path === activePath
                            ? 'bg-[hsl(var(--tac-amber)/0.06)] text-foreground hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground'
                            : 'text-muted-foreground hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground'
                      "
                    >
                      <NuxtLink
                        v-bind="tabProps(item.path)"
                        :to="item.path"
                        :aria-current="
                          item.path === activePath ? 'page' : undefined
                        "
                        :data-settings-tab-active="
                          item.path === activePath ? 'true' : 'false'
                        "
                        :data-settings-tab-tone="
                          group.danger ? 'danger' : undefined
                        "
                      >
                        <TriangleAlert
                          v-if="group.danger"
                          class="h-3.5 w-3.5 shrink-0"
                        />
                        <span class="min-w-0 truncate">{{ item.label }}</span>
                        <SettingsStatusChip
                          v-if="statuses?.[item.path]?.chip"
                          :chip="statuses[item.path].chip!"
                          class="ml-auto"
                        />
                      </NuxtLink>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>
