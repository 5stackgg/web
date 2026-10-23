<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsSearch from "~/components/settings/SettingsSearch.vue";
import SettingsSideTabs from "~/components/settings/SettingsSideTabs.vue";
import { useSettingsNav } from "~/composables/useSettingsNav";
import { useSettingsSearchReveal } from "~/composables/useSettingsSearch";
import { useSettingsStatus } from "~/composables/useSettingsStatus";
import { SETTINGS_LEAVE_GUARD } from "~/composables/useSettingsLeaveGuard";

const { t: $t } = useI18n();
const { groups: navGroups, items: navItems } = useSettingsNav();

const route = useRoute();
const router = useRouter();

// Unsaved edits hold the user on their section until they save or discard.
provide(SETTINGS_LEAVE_GUARD, true);

/** Resolve current path to a nav item path (for sub-routes like /players/123). */
const resolvedPath = computed(() => {
  const path = route.path;
  const items = navItems.value ?? [];
  if (items.some((item) => item.path === path)) return path;
  const match = items
    .filter((item) => path.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});

// The rail is a status board: each section says what state it is in, and
// the filter narrows it to the ones that need a look.
const statuses = useSettingsStatus(navItems);
const railFilter = ref("all");

const attentionCount = computed(
  () =>
    Object.values(statuses.value).filter((status) => status.attention).length,
);

const filterOptions = computed(() => [
  { key: "all", label: $t("common.all") },
  {
    key: "attention",
    label: $t("layouts.application_settings.status.filter_attention"),
    count: attentionCount.value || undefined,
    // Nothing to look at, so nothing to click.
    disabled: attentionCount.value === 0,
  },
]);

watch(attentionCount, (count) => {
  if (count === 0 && railFilter.value === "attention") {
    railFilter.value = "all";
  }
});

// The phone picker names a section's state when it has one.
function pickerLabel(path: string, label: string) {
  const chip = statuses.value[path]?.chip;
  if (!chip) return label;
  const state =
    chip.tone === "job"
      ? $t(`layouts.application_settings.status.job_${chip.job}`, {
          pct: chip.pct,
        })
      : $t("layouts.application_settings.status.not_set_up");
  return `${label} · ${state}`;
}

const search = ref<InstanceType<typeof SettingsSearch> | null>(null);

// Picking a section from the rail, even the one already open, hands the
// content pane back from the search results.
function onRailClick(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest("a")) {
    search.value?.clear();
  }
}

// This nav is long enough to run past a viewport, so a section picked from the
// bottom of it would otherwise render off-screen above the user.
const contentRow = ref<HTMLElement | null>(null);

useScrollIntoViewOnChange(contentRow, () => route.path);
useSettingsSearchReveal(contentRow);
</script>

<template>
  <!-- Two-pane console at lg: the page itself is pinned to the viewport and
       each pane owns its own scrollbar, so the nav and the content scroll
       independently. `overscroll-contain` is what keeps a flick that runs out
       of one pane from ever leaking into the page behind it. -->
  <div
    class="lg:flex lg:flex-col lg:h-[calc(var(--sidebar-height,100svh)-2rem-var(--main-bottom-dock-height,0px))]"
  >
    <h1 class="sr-only">{{ $t("layouts.application_settings.title") }}</h1>
    <div
      ref="contentRow"
      class="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row"
    >
      <PageTransition>
        <aside
          class="hidden lg:flex lg:w-[280px] lg:shrink-0 lg:flex-col lg:min-h-0"
          :aria-label="$t('ui.tooltips.settings_section')"
          @click="onRailClick"
        >
          <div class="border-r border-border/70 pb-3 pr-2">
            <AnimatedFilters
              v-model="railFilter"
              :options="filterOptions"
              square
              block
            />
          </div>
          <div
            class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin]"
          >
            <SettingsSideTabs
              class="flex-1 pb-14"
              :groups="navGroups"
              :active-path="resolvedPath"
              :statuses="statuses"
              :filter="railFilter"
              :aria-label="$t('ui.tooltips.settings_section')"
            />
          </div>
        </aside>
      </PageTransition>

      <SettingsSearch ref="search" :statuses="statuses" class="lg:pl-3">
        <!-- Phone: one dropdown, so every section is a tap away -->
        <template #picker>
          <Select v-model="selectedPath">
            <SelectTrigger
              class="h-8 w-full max-md:text-base"
              :aria-label="$t('ui.tooltips.settings_section')"
            >
              <SelectValue
                :placeholder="$t('layouts.application_settings.select_section')"
              />
            </SelectTrigger>
            <SelectContent>
              <template v-for="group in navGroups" :key="group.label">
                <SelectGroup
                  v-for="subgroup in group.subgroups"
                  :key="`${group.label}-${subgroup.label}`"
                >
                  <SelectLabel>
                    {{ group.label }} · {{ subgroup.label }}
                  </SelectLabel>
                  <SelectItem
                    v-for="item in subgroup.items"
                    :key="item.path"
                    :value="item.path"
                  >
                    {{ pickerLabel(item.path, item.label) }}
                  </SelectItem>
                </SelectGroup>
              </template>
            </SelectContent>
          </Select>
        </template>

        <!-- Keyed on the route so each tab switch mounts a fresh transition and
             re-fires the enter animation; the shell itself stays mounted, so
             the page's own PageTransition (appear) never re-runs on tab
             switches. The key also hands each section a fresh pane, so
             switching sections always starts at the top without touching the
             nav's scroll.

             The grid is what lets the outgoing and incoming pane cross-fade:
             both land in the same 1/1 cell, so they stack instead of standing
             side by side and halving the column for the length of the
             transition. -->
        <div class="grid min-w-0 grid-rows-[1fr] lg:h-full lg:min-h-0">
          <PageTransition :key="route.path">
            <div
              class="space-y-6 min-w-0 [grid-area:1/1] lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pl-3 lg:[scrollbar-width:thin]"
              :data-settings-pane="route.path"
            >
              <slot />
            </div>
          </PageTransition>
        </div>
      </SettingsSearch>
    </div>
  </div>
</template>
